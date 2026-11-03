import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/order.dart';
import '../outbox/outbox.dart';
import 'order_detail_screen.dart';

/// Confirms the order reached the bakery and says what happens next.
class OrderSentScreen extends StatelessWidget {
  const OrderSentScreen({super.key, required this.order, required this.custom});

  final Order order;
  final bool custom;

  @override
  Widget build(BuildContext context) {
    final steps = custom
        ? const [
            'The bakery sends you a quote in the app. We notify you when it arrives.',
            'You accept the quote, or ask for changes.',
            'Pay the deposit by cash or Mobile Money, and the bakery starts on your cake.',
          ]
        : [
            'The bakery confirms your order. We notify you when they do.',
            'Your cake is ready on ${dayLabel(order.dueDate)}, by ${timeLabel(order.dueDate)}.',
            'Pay by cash or Mobile Money when you get it.',
          ];
    return _ResultScaffold(
      icon: Icons.check_rounded,
      iconBackground: AppColors.accent,
      iconColour: Colors.white,
      title: 'Order sent',
      lead: custom
          ? '${order.bakeryName} has your design. They will look at it and send you a price.'
          : '${order.bakeryName} will confirm your order soon.',
      extra: Text(
        'Order number ${orderRef(order.number)}',
        style: const TextStyle(color: AppColors.muted),
      ),
      steps: steps,
      primary: FilledButton(
        onPressed: () => Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => OrderDetailScreen(orderId: order.id),
          ),
        ),
        child: const Text('Track my order'),
      ),
    );
  }
}

/// Shown when the order couldn't be sent: it is saved and goes by itself later.
class QueuedScreen extends StatelessWidget {
  const QueuedScreen({super.key, required this.item});

  final OutboxItem item;

  @override
  Widget build(BuildContext context) {
    return _ResultScaffold(
      icon: Icons.phone_android_rounded,
      iconBackground: AppColors.sand,
      iconColour: AppColors.ink,
      title: 'Saved on your phone',
      lead:
          "You're offline right now. Your order is safe and will send by itself as soon as you're connected, even if you close the app.",
      extra: const Text(
        "It shows in My orders as \"Waiting to send\". It can't be sent twice, even if you tap Try again.",
        style: TextStyle(color: AppColors.muted, height: 1.45),
      ),
      steps: const [],
      primary: FilledButton(
        onPressed: () async {
          final sent = await Outbox.instance.flush();
          if (!context.mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                sent > 0
                    ? 'Sent to ${item.bakeryName}.'
                    : 'Still offline. We will keep trying.',
              ),
            ),
          );
          if (sent > 0) Navigator.of(context).pop();
        },
        child: const Text('Try sending now'),
      ),
    );
  }
}

class _ResultScaffold extends StatelessWidget {
  const _ResultScaffold({
    required this.icon,
    required this.iconBackground,
    required this.iconColour,
    required this.title,
    required this.lead,
    required this.extra,
    required this.steps,
    required this.primary,
  });

  final IconData icon;
  final Color iconBackground;
  final Color iconColour;
  final String title;
  final String lead;
  final Widget extra;
  final List<String> steps;
  final Widget primary;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(28, 48, 28, 20),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: (constraints.maxHeight - 68).clamp(
                  0,
                  double.infinity,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: iconBackground,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(icon, color: iconColour, size: 36),
                      ),
                      const SizedBox(height: 20),
                      Semantics(
                        liveRegion: true,
                        child: Text(
                          title,
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        lead,
                        style: const TextStyle(
                          fontSize: 17,
                          height: 1.5,
                          color: AppColors.ink2,
                        ),
                      ),
                      const SizedBox(height: 10),
                      extra,
                      if (steps.isNotEmpty) ...[
                        const Divider(height: 40),
                        const Text(
                          'What happens next',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 14),
                        for (var i = 0; i < steps.length; i++)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 28,
                                  height: 28,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: const Color(0xFFD9C7BB),
                                      width: 1.5,
                                    ),
                                  ),
                                  child: Text(
                                    '${i + 1}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: 3),
                                    child: Text(steps[i]),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        primary,
                        const SizedBox(height: 10),
                        Center(
                          child: TextButton(
                            onPressed: () => Navigator.of(
                              context,
                            ).popUntil((r) => r.isFirst),
                            child: const Text('Back to the bakery'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
