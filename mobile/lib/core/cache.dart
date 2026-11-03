import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

/// The answer to a [cachedGet], and whether it came from the phone instead of the server.
class Cached<T> {
  const Cached(this.data, {this.savedAt});

  final T data;

  /// Set when the server couldn't be reached and this is the copy saved last time.
  final DateTime? savedAt;

  bool get isOffline => savedAt != null;
}

/// GETs [path] and keeps a copy, so bakeries and menus still show on a weak connection.
/// Only throws [NetworkException] when there is no saved copy yet.
Future<Cached<dynamic>> cachedGet(String path) async {
  final prefs = await SharedPreferences.getInstance();
  final key = 'cache:$path';
  try {
    final data = await api.get(path);
    await prefs.setString(
      key,
      jsonEncode({'at': DateTime.now().toIso8601String(), 'data': data}),
    );
    return Cached(data);
  } on NetworkException {
    final saved = prefs.getString(key);
    if (saved == null) rethrow;
    final decoded = jsonDecode(saved) as Map<String, dynamic>;
    return Cached(
      decoded['data'],
      savedAt: DateTime.parse(decoded['at'] as String),
    );
  }
}
