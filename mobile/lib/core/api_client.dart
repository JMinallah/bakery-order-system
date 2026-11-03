import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'dart:typed_data';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import 'config.dart';
import 'firebase_setup.dart';

/// The server answered, but said no. [message] is written for people, so show it as it is.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => message;
}

/// The request never got an answer: no connection, or it took too long.
/// Orders that hit this are saved on the phone and sent later (see features/outbox).
class NetworkException implements Exception {
  const NetworkException();

  @override
  String toString() =>
      "You're offline or the connection is too weak right now.";
}

/// Every call to the backend goes through here. See docs/api.md for endpoints.
class ApiClient {
  ApiClient({http.Client? client, this.timeout = const Duration(seconds: 45)})
    : _client = client ?? http.Client();

  final http.Client _client;
  final Duration timeout;

  Future<Map<String, String>> _headers([
    String contentType = 'application/json',
  ]) async {
    final headers = {'Content-Type': contentType};
    if (firebaseReady) {
      // getIdToken refreshes the token when it is close to expiring.
      final token = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    } else if (AppConfig.devUser.isNotEmpty) {
      // Test login while there is no Firebase project; needs AUTH_DEV_BYPASS=true on the backend.
      headers['x-dev-user'] = AppConfig.devUser;
    }
    return headers;
  }

  Uri _uri(String path) => Uri.parse('${AppConfig.apiUrl}$path');

  Future<dynamic> get(String path) =>
      _send((h) => _client.get(_uri(path), headers: h));

  Future<dynamic> post(String path, [Object? body]) => _send(
    (h) => _client.post(_uri(path), headers: h, body: jsonEncode(body ?? {})),
  );

  Future<dynamic> patch(String path, Object body) => _send(
    (h) => _client.patch(_uri(path), headers: h, body: jsonEncode(body)),
  );

  /// Sends raw bytes, e.g. a photo for POST /uploads.
  Future<dynamic> postBytes(String path, Uint8List bytes, String contentType) =>
      _send(
        (h) => _client.post(_uri(path), headers: h, body: bytes),
        contentType: contentType,
      );

  Future<dynamic> _send(
    Future<http.Response> Function(Map<String, String> headers) request, {
    String contentType = 'application/json',
  }) async {
    final http.Response res;
    try {
      res = await request(await _headers(contentType)).timeout(timeout);
    } on SocketException {
      throw const NetworkException();
    } on TimeoutException {
      throw const NetworkException();
    } on http.ClientException {
      throw const NetworkException();
    }
    final body = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      throw ApiException(
        res.statusCode,
        (body is Map ? body['error'] as String? : null) ??
            'Something went wrong',
      );
    }
    return body;
  }
}

ApiClient api = ApiClient();
