import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../../models/bakery.dart';
import '../../models/product.dart';
import '../auth/auth.dart';
import '../custom_order/occasion_step.dart';
import 'quick_checkout_screen.dart';

class ProductScreen extends StatefulWidget {
  const ProductScreen({super.key, required this.product, required this.bakery});

  final Product product;
  final Bakery bakery;

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  int _quantity = 1;

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final facts = [
      if (p.sizeLabel != null) ('Size', p.sizeLabel!),
      if (p.serves != null) ('Serves', 'About ${p.serves}'),
      (
        'Ready in',
        p.leadTimeDays == 0
            ? 'Same day'
            : '${p.leadTimeDays} ${p.leadTimeDays == 1 ? 'day' : 'days'}',
      ),
    ];
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 300,
            pinned: true,
            backgroundColor: AppColors.sand,
            flexibleSpace: FlexibleSpaceBar(
              background: AppImage(
                url: p.imageUrl,
                fallbackCategory: p.name,
                fit: BoxFit.cover,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 24),
            sliver: SliverList.list(
              children: [
                Text(p.name, style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 6),
                Text(
                  money(p.price, widget.bakery.currency),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (p.description != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    p.description!,
                    style: const TextStyle(fontSize: 16, color: AppColors.ink2),
                  ),
                ],
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: const BoxDecoration(
                    border: Border.symmetric(
                      horizontal: BorderSide(color: AppColors.line),
                    ),
                  ),
                  child: Row(
                    children: [
                      for (final (label, value) in facts)
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                label,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.muted,
                                ),
                              ),
                              Text(
                                value,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'How many?',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    IconButton.outlined(
                      onPressed: _quantity > 1
                          ? () => setState(() => _quantity--)
                          : null,
                      icon: const Icon(Icons.remove),
                      tooltip: 'One less',
                    ),
                    SizedBox(
                      width: 44,
                      child: Semantics(
                        liveRegion: true,
                        child: Text(
                          '$_quantity',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    IconButton.outlined(
                      onPressed: () => setState(() => _quantity++),
                      icon: const Icon(Icons.add),
                      tooltip: 'One more',
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomBar(
        note: p.customisable
            ? 'Customising lets you change the size, colour or decorations. The bakery then sends you a new price.'
            : null,
        child: Column(
          children: [
            FilledButton(
              onPressed: () async {
                if (!await ensureSignedIn(context)) return;
                if (!context.mounted) return;
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => QuickCheckoutScreen(
                      product: p,
                      bakery: widget.bakery,
                      quantity: _quantity,
                    ),
                  ),
                );
              },
              child: Text(
                'Order this · ${money(p.price * _quantity, widget.bakery.currency)}',
              ),
            ),
            if (p.customisable) ...[
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () async {
                  if (!await ensureSignedIn(context)) return;
                  if (!context.mounted) return;
                  Navigator.of(
                    context,
                  ).push(OccasionStep.route(widget.bakery, basedOn: p));
                },
                child: const Text('Customise this cake'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
