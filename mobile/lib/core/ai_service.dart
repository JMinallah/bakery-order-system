import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'api_client.dart';
import 'config.dart';

class AiGeneratedCake {
  AiGeneratedCake({
    required this.id,
    required this.url,
    required this.prompt,
    required this.isDemo,
    this.message,
    this.imageBytes,
  });

  final String id;
  final String url;
  final String prompt;
  final bool isDemo;
  final String? message;
  final Uint8List? imageBytes;
}

/// Generates a cake concept through the FastAPI Pollinations proxy.
/// The API key stays on the server; Flutter receives image bytes only.
Future<AiGeneratedCake> generateCakeVisual({
  required String prompt,
  String? occasion,
  String? flavour,
  String? colours,
  String? theme,
  int? sampleIndex,
}) async {
  final details = <String>[
    if (occasion != null && occasion.trim().isNotEmpty)
      'Occasion: ${occasion.trim()}',
    if (flavour != null && flavour.trim().isNotEmpty)
      'Flavour: ${flavour.trim()}',
    if (colours != null && colours.trim().isNotEmpty)
      'Colours: ${colours.trim()}',
    if (theme != null && theme.trim().isNotEmpty) 'Theme: ${theme.trim()}',
  ];

  final fullPrompt = [
    prompt.trim(),
    ...details,
    'Create a realistic, high-quality bakery cake concept photograph.',
    'Show the complete cake clearly, with professional studio lighting.',
  ].join('\n');

  if (prompt.trim().isEmpty) {
    throw ApiException(400, 'Please describe the cake you want.');
  }

  final baseUrl = ImageApiConfig.baseUrl.replaceFirst(RegExp(r'/$'), '');

  http.Response response;
  try {
    response = await http
        .post(
          Uri.parse('$baseUrl/generate-image'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'prompt': fullPrompt}),
        )
        .timeout(const Duration(minutes: 2));
  } catch (e) {
    if (baseUrl.contains('10.0.2.2')) {
      final fallbackUrl = '$baseUrl/generate-image'.replaceFirst(
        '10.0.2.2',
        '127.0.0.1',
      );
      response = await http
          .post(
            Uri.parse(fallbackUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'prompt': fullPrompt}),
          )
          .timeout(const Duration(minutes: 2));
    } else {
      rethrow;
    }
  }

  final contentType = (response.headers['content-type'] ?? '').toLowerCase();

  if (response.statusCode != 200 || !contentType.startsWith('image/')) {
    var message = 'Image generation failed (HTTP ${response.statusCode}).';

    try {
      final error = jsonDecode(utf8.decode(response.bodyBytes));
      if (error is Map<String, dynamic>) {
        message = (error['detail'] ?? error['message'] ?? message).toString();
      }
    } catch (_) {
      // Keep the readable fallback error.
    }

    throw ApiException(response.statusCode, message);
  }

  if (response.bodyBytes.isEmpty) {
    throw ApiException(500, 'The image server returned an empty image.');
  }

  final id = 'pollinations-${DateTime.now().millisecondsSinceEpoch}';

  return AiGeneratedCake(
    id: id,
    // This is an internal placeholder, not a publicly accessible image URL.
    // The actual image is held in imageBytes and uploaded when the order is sent.
    url: 'pollinations://generated/$id',
    prompt: prompt.trim(),
    isDemo: false,
    message: 'Cake concept generated with Pollinations AI.',
    imageBytes: response.bodyBytes,
  );
}
