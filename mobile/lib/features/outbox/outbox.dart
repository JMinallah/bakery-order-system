import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api_client.dart';
import '../../models/order.dart';

/// An order saved on the phone because it couldn't be sent yet.
class OutboxItem {
  OutboxItem({
    required this.clientRequestId,
    required this.body,
    required this.title,
    required this.bakeryName,
    required this.savedAt,
    this.error,
  });

  /// Sent with the order, so the backend never saves the same order twice.
  final String clientRequestId;
  final Map<String, dynamic> body;
  final String title;
  final String bakeryName;
  final DateTime savedAt;

  /// Set when the bakery refused it, e.g. the day filled up while the phone was offline.
  final String? error;

  OutboxItem withError(String? message) => OutboxItem(
    clientRequestId: clientRequestId,
    body: body,
    title: title,
    bakeryName: bakeryName,
    savedAt: savedAt,
    error: message,
  );

  Map<String, dynamic> toJson() => {
    'clientRequestId': clientRequestId,
    'body': body,
    'title': title,
    'bakeryName': bakeryName,
    'savedAt': savedAt.toIso8601String(),
    'error': error,
  };

  factory OutboxItem.fromJson(Map<String, dynamic> json) => OutboxItem(
    clientRequestId: json['clientRequestId'] as String,
    body: (json['body'] as Map).cast<String, dynamic>(),
    title: json['title'] as String,
    bakeryName: json['bakeryName'] as String,
    savedAt: DateTime.parse(json['savedAt'] as String),
    error: json['error'] as String?,
  );
}

sealed class SubmitResult {}

class Sent extends SubmitResult {
  Sent(this.order);
  final Order order;
}

class Queued extends SubmitResult {
  Queued(this.item);
  final OutboxItem item;
}

/// A random version 4 UUID, made on the phone so it exists before any connection.
String newRequestId([Random? random]) {
  final r = random ?? Random.secure();
  final bytes = List<int>.generate(16, (_) => r.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Orders waiting to be sent. Retries when the app opens, comes back to the
/// foreground, and every 30 seconds while something is waiting.
class Outbox extends ChangeNotifier {
  Outbox._();

  static final instance = Outbox._();
  static const _key = 'outbox';
  static const _initialRetryDelay = Duration(seconds: 30);
  static const _maxRetryDelay = Duration(minutes: 5);

  List<OutboxItem> _items = [];
  Timer? _timer;
  bool _flushing = false;
  Duration _retryDelay = _initialRetryDelay;

  List<OutboxItem> get items => List.unmodifiable(_items);
  List<OutboxItem> get waiting => _items.where((i) => i.error == null).toList();
  Duration get retryDelay => _retryDelay;

  Future<void> start() async {
    _retryDelay = _initialRetryDelay;
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_key);
    if (saved != null) {
      _items = (jsonDecode(saved) as List)
          .map((e) => OutboxItem.fromJson(e as Map<String, dynamic>))
          .toList();
      notifyListeners();
    }
    await flush();
  }

  void _scheduleRetry() {
    _timer?.cancel();
    if (waiting.isEmpty) {
      _retryDelay = _initialRetryDelay;
      _timer = null;
      return;
    }
    _timer = Timer(_retryDelay, () => flush());
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode(_items.map((i) => i.toJson()).toList()),
    );
    notifyListeners();
    _scheduleRetry();
  }

  /// Sends the order now, or keeps it when there's no connection.
  /// The bakery refusing it (an [ApiException]) is thrown, so the form can show why.
  Future<SubmitResult> submit(
    Map<String, dynamic> body, {
    required String title,
    required String bakeryName,
  }) async {
    final id = newRequestId();
    final item = OutboxItem(
      clientRequestId: id,
      body: {...body, 'clientRequestId': id},
      title: title,
      bakeryName: bakeryName,
      savedAt: DateTime.now(),
    );
    try {
      final json = await api.post('/orders', item.body);
      return Sent(Order.fromJson(json as Map<String, dynamic>));
    } on NetworkException {
      _items = [..._items, item];
      await _save();
      return Queued(item);
    }
  }

  /// Tries every waiting order. Returns how many were sent.
  Future<int> flush() async {
    if (_flushing || waiting.isEmpty) return 0;
    _flushing = true;
    var sent = 0;
    try {
      for (final item in waiting) {
        try {
          await api.post('/orders', item.body);
          _items = _items
              .where((i) => i.clientRequestId != item.clientRequestId)
              .toList();
          sent++;
          _retryDelay = _initialRetryDelay;
        } on ApiException catch (e) {
          _items = [
            for (final i in _items)
              i.clientRequestId == item.clientRequestId
                  ? i.withError(e.message)
                  : i,
          ];
        } on NetworkException {
          final nextDelay = _retryDelay < _maxRetryDelay
              ? _retryDelay * 2
              : _maxRetryDelay;
          _retryDelay = nextDelay;
          break;
        }
      }
    } finally {
      _flushing = false;
      await _save();
    }
    return sent;
  }

  Future<void> remove(String clientRequestId) async {
    _items = _items.where((i) => i.clientRequestId != clientRequestId).toList();
    await _save();
  }

  @visibleForTesting
  void reset() {
    _items = [];
    _retryDelay = _initialRetryDelay;
    _timer?.cancel();
    _timer = null;
  }
}
