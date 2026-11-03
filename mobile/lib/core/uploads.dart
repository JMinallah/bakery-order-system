import 'dart:typed_data';

import 'api_client.dart';

/// Uploads one photo (POST /uploads) and returns its link for an order.
/// Photos should already be compressed; the limit is 2 MB.
Future<String> uploadPhoto(
  Uint8List bytes, {
  String contentType = 'image/jpeg',
}) async {
  final json =
      await api.postBytes('/uploads', bytes, contentType)
          as Map<String, dynamic>;
  return json['url'] as String;
}
