import 'package:flutter/material.dart';

import '../auth/auth.dart';
import '../outbox/outbox.dart';
import 'order_sent_screen.dart';

/// Sends an order (or saves it when offline) and moves to the matching screen,
/// clearing the ordering steps so Back doesn't return to them.
/// Throws ApiException when the bakery refuses it, so the form can show why.
Future<void> submitOrder(
  BuildContext context, {
  required Map<String, dynamic> body,
  required String title,
  required String bakeryName,
  required bool custom,
}) async {
  if (!await ensureSignedIn(context)) return;
  if (!context.mounted) return;
  final result = await Outbox.instance.submit(
    body,
    title: title,
    bakeryName: bakeryName,
  );
  if (!context.mounted) return;
  final screen = switch (result) {
    Sent(:final order) => OrderSentScreen(order: order, custom: custom),
    Queued(:final item) => QueuedScreen(item: item),
  };
  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute<void>(builder: (_) => screen),
    (route) => route.isFirst,
  );
}
