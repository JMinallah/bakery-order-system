import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../../models/order.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late Future<Order> _order = _load();
  final _message = TextEditingController();
  final _messageFocus = FocusNode();
  bool _sending = false;

  Future<Order> _load() async => Order.fromJson(
    await api.get('/orders/${widget.orderId}') as Map<String, dynamic>,
  );

  void _reload() {
    final next = _load();
    setState(() {
      _order = next;
    });
  }

  @override
  void dispose() {
    _message.dispose();
    _messageFocus.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    final body = _message.text.trim();
    if (body.isEmpty) return;
    setState(() => _sending = true);
    try {
      await api.post('/orders/${widget.orderId}/comments', {'body': body});
      _message.clear();
      _reload();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _acceptQuote(Order order, Quotation quote) async {
    final yes = await showModalBottomSheet<bool>(
      context: context,
      builder: (context) => _Sheet(
        title: 'Accept ${money(quote.amount, order.currency)}?',
        children: [
          _Detail('Cake', order.title),
          _Detail('When', dateTimeLabel(order.dueDate)),
          _Detail(
            'Where',
            order.fulfilment == 'PICKUP'
                ? 'Pickup'
                : 'Delivery to ${order.deliveryAddress ?? order.deliveryArea}',
          ),
          const Divider(height: 28),
          const Text(
            'What happens next',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            '${order.bakeryName} books your day and tells you how much deposit to pay'
            '${order.mobileMoneyNumber == null ? '' : ' (Mobile Money: ${order.mobileMoneyNumber})'}. Nothing is charged in the app.',
            style: const TextStyle(color: AppColors.ink2),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Yes, accept the quote'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Not yet'),
          ),
        ],
      ),
    );
    if (yes != true) return;
    try {
      await api.post('/orders/${order.id}/accept-quote', {
        'quotationId': quote.id,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Quote accepted. ${order.bakeryName} has been told.'),
        ),
      );
      _reload();
    } catch (e) {
      if (!mounted) return;
      showError(context, e);
      _reload();
    }
  }

  Future<void> _cancel(Order order) async {
    const reasons = [
      'Plans changed',
      'The price is too high',
      'I ordered somewhere else',
      'Something else',
    ];
    var reason = reasons.first;
    final yes = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheet) => _Sheet(
          title: 'Cancel your ${order.title.toLowerCase()}?',
          children: [
            Text(
              "${order.bakeryName} is told straight away. You can't undo this. If you've paid a deposit, talk to the bakery about getting it back.",
              style: const TextStyle(color: AppColors.ink2),
            ),
            const SizedBox(height: 16),
            const Text(
              'Tell the bakery why',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final r in reasons)
                  ChoiceChip(
                    label: Text(r),
                    selected: r == reason,
                    onSelected: (_) => setSheet(() => reason = r),
                  ),
              ],
            ),
            if (reason == 'The price is too high') ...[
              const SizedBox(height: 12),
              const Text(
                'You could also message the bakery and ask for a cheaper option.',
                style: TextStyle(color: AppColors.ink2),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.ink),
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Keep my order'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
                side: const BorderSide(color: AppColors.danger, width: 1.5),
              ),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Cancel order'),
            ),
          ],
        ),
      ),
    );
    if (yes != true) return;
    try {
      await api.post('/orders/${order.id}/cancel', {'reason': reason});
      _reload();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: FutureBuilder(
        future: _order,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return ErrorView(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: _body(snapshot.data!),
          );
        },
      ),
    );
  }

  Widget _body(Order order) {
    final (bg, fg) = statusColours[order.status]!;
    final quote = order.latestQuote;
    final accepted = order.quotations
        .where((q) => q.acceptedAt != null)
        .firstOrNull;
    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        _OrderHero(order: order, background: bg, foreground: fg),
        if (order.status == 'CANCELLED')
          _Band(
            colour: AppColors.dangerSoft,
            child: Text(
              'Cancelled by ${order.cancelledBy == 'CUSTOMER' ? 'you' : order.bakeryName}${order.cancelReason == null ? '' : ': ${order.cancelReason}'}',
              style: const TextStyle(
                color: AppColors.danger,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        if (order.status == 'QUOTED' && quote != null)
          _Band(
            colour: AppColors.accentSoft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Your quote',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.accent,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  money(quote.amount, order.currency),
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (quote.note != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    quote.note!,
                    style: const TextStyle(color: AppColors.ink2),
                  ),
                ],
                const SizedBox(height: 4),
                Text(
                  'Sent by ${order.bakeryName} on ${dayLabel(quote.createdAt)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: () => _acceptQuote(order, quote),
                        child: const Text('Accept quote'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _messageFocus.requestFocus(),
                        child: const Text('Ask for changes'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  "Accepting doesn't charge you. You pay the bakery directly.",
                  style: TextStyle(fontSize: 13, color: AppColors.ink2),
                ),
              ],
            ),
          ),
        if (order.status != 'CANCELLED') _Progress(order: order),
        _Section(
          title: 'Your cake',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (order.designImageUrl != null &&
                  order.designImageUrl!.startsWith('http')) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 16 / 10,
                    child: Image.network(
                      order.designImageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              for (final s in order.selections) _Detail(s.key, s.value),
              if (order.selections.isEmpty && order.itemNames.isNotEmpty)
                _Detail('Cake', order.itemNames.join(', ')),
              if (order.flavour != null) _Detail('Flavour', order.flavour!),
              if (order.inscription != null)
                _Detail('Writing', order.inscription!),
              if (order.theme != null) _Detail('Theme', order.theme!),
              if (order.notes != null) _Detail('Notes', order.notes!),
              if (order.inspirationImageUrls.isNotEmpty) ...[
                const SizedBox(height: 8),
                const Text(
                  'Inspiration photos',
                  style: TextStyle(fontSize: 13, color: AppColors.muted),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final url in order.inspirationImageUrls)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(
                          url,
                          width: 64,
                          height: 64,
                          fit: BoxFit.cover,
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        if (order.total != null || accepted != null)
          _Section(
            title: 'Payment',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (order.total != null)
                  _Detail('Total', money(order.total!, order.currency)),
                _Detail('Paid', money(order.amountPaid, order.currency)),
                const SizedBox(height: 6),
                Text(
                  order.paymentStatus == 'PAID'
                      ? 'Paid in full. Thank you!'
                      : 'Pay by Mobile Money${order.mobileMoneyNumber == null ? '' : ' (${order.mobileMoneyNumber})'} or cash. The bakery records it here once received.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        _Section(
          title: 'Messages with the bakery',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (order.comments.isEmpty)
                const Text(
                  'No messages yet. Ask the bakery anything about your cake.',
                  style: TextStyle(color: AppColors.muted),
                ),
              for (final c in order.comments)
                _Bubble(comment: c, bakeryName: order.bakeryName),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _message,
                      focusNode: _messageFocus,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        hintText: 'Message the bakery',
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _sending ? null : _sendMessage,
                    icon: const Icon(Icons.arrow_forward_rounded),
                    tooltip: 'Send message',
                  ),
                ],
              ),
            ],
          ),
        ),
        if (order.bakeryPhone != null ||
            customerCancellable.contains(order.status))
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (order.bakeryPhone != null)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: SelectableText(
                      'Call ${order.bakeryName}: ${order.bakeryPhone}',
                    ),
                  ),
                if (customerCancellable.contains(order.status))
                  TextButton(
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.danger,
                    ),
                    onPressed: () => _cancel(order),
                    child: const Text('Cancel this order'),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _OrderHero extends StatelessWidget {
  const _OrderHero({
    required this.order,
    required this.background,
    required this.foreground,
  });

  final Order order;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Your order',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.muted,
                  ),
                ),
              ),
              Pill(
                statusLabels[order.status]!,
                background: Colors.white.withValues(alpha: 0.72),
                foreground: foreground,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(order.title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            order.bakeryName,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 4),
          Text(
            '${dateTimeLabel(order.dueDate)} · ${order.fulfilment == 'PICKUP' ? 'Pickup' : 'Delivery to ${order.deliveryAddress ?? order.deliveryArea}'}',
            style: const TextStyle(fontSize: 14, color: AppColors.ink2),
          ),
          const SizedBox(height: 4),
          Text(
            'Order ${orderRef(order.number)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final steps = [
      ('SUBMITTED', 'Sent to the bakery'),
      if (order.needsQuote) ('QUOTED', 'Quote ready'),
      ('CONFIRMED', 'Confirmed'),
      ('PREPARING', 'Being made'),
      ('READY', order.fulfilment == 'PICKUP' ? 'Ready to collect' : 'Ready'),
      ('COMPLETED', order.fulfilment == 'PICKUP' ? 'Collected' : 'Delivered'),
    ];
    final current = steps.indexWhere((s) => s.$1 == order.status);
    return _Section(
      title: 'Progress',
      child: Column(
        children: [
          for (var i = 0; i < steps.length; i++)
            Semantics(
              label:
                  '${steps[i].$2}${i < current
                      ? ', done'
                      : i == current
                      ? ', now'
                      : ''}',
              child: Row(
                children: [
                  Container(
                    width: 20,
                    height: 20,
                    margin: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < current ? AppColors.accent : AppColors.surface,
                      border: Border.all(
                        color: i <= current
                            ? AppColors.accent
                            : const Color(0xFFD9C7BB),
                        width: 2,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Text(
                    steps[i].$2,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: i == current
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: i <= current ? AppColors.ink : AppColors.muted,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _Band extends StatelessWidget {
  const _Band({required this.colour, required this.child});

  final Color colour;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    color: colour,
    padding: const EdgeInsets.all(20),
    child: child,
  );
}

class _Detail extends StatelessWidget {
  const _Detail(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 104,
            child: Text(label, style: const TextStyle(color: AppColors.muted)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.comment, required this.bakeryName});

  final OrderComment comment;
  final String bakeryName;

  @override
  Widget build(BuildContext context) {
    final mine = !comment.fromBakery;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 280),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: mine ? AppColors.accentSoft : AppColors.surface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 4),
            bottomRight: Radius.circular(mine ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: mine
              ? CrossAxisAlignment.end
              : CrossAxisAlignment.start,
          children: [
            Text(comment.body),
            const SizedBox(height: 4),
            Text(
              '${mine ? 'You' : bakeryName} · ${dayLabel(comment.createdAt)}',
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _Sheet extends StatelessWidget {
  const _Sheet({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          0,
          20,
          16 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              header: true,
              child: Text(title, style: Theme.of(context).textTheme.titleLarge),
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }
}
