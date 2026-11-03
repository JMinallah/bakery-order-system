import 'package:flutter/material.dart';

import '../../core/cache.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../../models/bakery.dart';
import '../../models/product.dart';
import '../auth/auth.dart';
import '../custom_order/ai_cake_studio_step.dart';
import '../custom_order/draft.dart';
import '../custom_order/occasion_step.dart';
import '../product/product_screen.dart';

/// A bakery's dedicated storefront: eye-catching visual hero, sleek segmented tabs
/// ('Menu & Treats', 'Custom Studio', 'About & Delivery') for an engaging, uncluttered experience.
class BakeryScreen extends StatefulWidget {
  const BakeryScreen({super.key, required this.bakery, this.savedAt});

  final Bakery bakery;
  final DateTime? savedAt;

  @override
  State<BakeryScreen> createState() => _BakeryScreenState();
}

class _BakeryScreenState extends State<BakeryScreen> {
  late Future<Cached<dynamic>> _products = cachedGet(
    '/bakeries/${widget.bakery.id}/products',
  );

  void _reloadProducts() {
    if (!mounted) return;
    setState(() {
      _products = cachedGet('/bakeries/${widget.bakery.id}/products');
    });
  }

  @override
  Widget build(BuildContext context) {
    final bakery = widget.bakery;
    final next = bakery.nextCustomDate;

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            bakery.name,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          actions: [
            if (next != null)
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.okSoft,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('🟢', style: TextStyle(fontSize: 9)),
                        const SizedBox(width: 4),
                        Text(
                          'Slot: ${dayLabel(fromDayKey(next))}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ok,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
        body: SafeArea(
          child: FutureBuilder(
            future: _products,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return ErrorView(
                  message: snapshot.error.toString(),
                  onRetry: _reloadProducts,
                );
              }

              final cached = snapshot.data;
              final products = cached == null
                  ? <Product>[]
                  : (cached.data as List)
                        .map((p) => Product.fromJson(p as Map<String, dynamic>))
                        .toList();

              final savedAt = cached?.savedAt ?? widget.savedAt;

              return Column(
                children: [
                  if (savedAt != null) OfflineBanner(savedAt: savedAt),

                  // Eye-Catching Immersive Hero Banner
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                    child: _VisualBakeryHero(bakery: bakery),
                  ),

                  // Sleek Segmented TabBar
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    height: 44,
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFE6DD),
                      borderRadius: BorderRadius.circular(25),
                    ),
                    child: TabBar(
                      indicator: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFA62B52), Color(0xFF861D3D)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(
                              0xFFA62B52,
                            ).withValues(alpha: 0.35),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      indicatorSize: TabBarIndicatorSize.tab,
                      labelColor: Colors.white,
                      unselectedLabelColor: AppColors.muted,
                      labelStyle: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                      unselectedLabelStyle: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                      dividerColor: Colors.transparent,
                      tabs: const [
                        Tab(text: 'Menu & Treats'),
                        Tab(text: 'Custom Studio'),
                        Tab(text: 'About & Info'),
                      ],
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Tab Views
                  Expanded(
                    child:
                        snapshot.connectionState == ConnectionState.waiting &&
                            cached == null
                        ? const Center(child: CircularProgressIndicator())
                        : TabBarView(
                            children: [
                              _MenuTab(
                                products: products,
                                bakery: bakery,
                                onRefresh: () async {
                                  _reloadProducts();
                                  await _products;
                                },
                              ),
                              _CustomStudioTab(bakery: bakery),
                              _AboutDeliveryTab(bakery: bakery),
                            ],
                          ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

// =============================================================================
// VISUAL IMMERSIVE BAKERY HERO
// =============================================================================

class _VisualBakeryHero extends StatelessWidget {
  const _VisualBakeryHero({required this.bakery});

  final Bakery bakery;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 160,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background Photography
          AppImage(
            url: bakery.imageUrl,
            fallbackCategory: 'bakery',
            fit: BoxFit.cover,
          ),

          // Vignette & Dark Gradient Overlay for perfect readability
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.15),
                  Colors.black.withValues(alpha: 0.75),
                ],
              ),
            ),
          ),

          // Overlaid Storefront Details
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.2),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.storefront_rounded,
                          color: AppColors.accent,
                          size: 26,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            bakery.name,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: -0.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            bakery.about ??
                                'Artisanal cakes, pastries & custom bakes',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.white70,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(
                      Icons.location_on,
                      color: Colors.amber,
                      size: 14,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        bakery.deliveryAreas.isEmpty
                            ? '${bakery.city} · In-store pickup'
                            : '${bakery.city} · Delivers to ${bakery.deliveryAreas.take(3).join(', ')}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// =============================================================================
// TAB 1: MENU & TREATS (READY PRODUCTS WITH GOURMET PHOTOGRAPHY)
// =============================================================================

class _MenuTab extends StatefulWidget {
  const _MenuTab({
    required this.products,
    required this.bakery,
    required this.onRefresh,
  });

  final List<Product> products;
  final Bakery bakery;
  final Future<void> Function() onRefresh;

  @override
  State<_MenuTab> createState() => _MenuTabState();
}

class _MenuTabState extends State<_MenuTab> {
  String? _category;

  @override
  Widget build(BuildContext context) {
    final categories = [
      for (final c in categoryLabels.keys)
        if (widget.products.any((p) => p.category == c)) c,
    ];
    final category =
        _category ?? (categories.isEmpty ? null : categories.first);
    final shown = widget.products.where((p) => p.category == category).toList();

    if (widget.products.isEmpty) {
      return RefreshIndicator(
        onRefresh: widget.onRefresh,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 32),
            Center(
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  children: [
                    const Icon(
                      Icons.cake_outlined,
                      size: 48,
                      color: AppColors.muted,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'No ready-made cakes currently listed',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'You can still order a bespoke celebration cake through our Custom Studio tab.',
                      style: TextStyle(color: AppColors.muted, fontSize: 13),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () {
                        DefaultTabController.of(context).animateTo(1);
                      },
                      child: const Text('Go to Custom Studio'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
        children: [
          // Category Pills
          if (categories.length > 1)
            SizedBox(
              height: 38,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final c in categories)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(categoryLabels[c] ?? c),
                        selected: c == category,
                        onSelected: (_) => setState(() => _category = c),
                        labelStyle: TextStyle(
                          fontSize: 12,
                          fontWeight: c == category
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: c == category ? Colors.white : AppColors.ink,
                        ),
                        selectedColor: AppColors.accent,
                        backgroundColor: AppColors.surface,
                        side: BorderSide(
                          color: c == category
                              ? AppColors.accent
                              : AppColors.line,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                    ),
                ],
              ),
            ),

          if (categories.length > 1) const SizedBox(height: 12),

          // 2-Column Product Grid with Visual Cards
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: shown.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 14,
              crossAxisSpacing: 12,
              childAspectRatio: 0.74,
            ),
            itemBuilder: (context, i) =>
                _GourmetProductTile(product: shown[i], bakery: widget.bakery),
          ),
        ],
      ),
    );
  }
}

class _GourmetProductTile extends StatelessWidget {
  const _GourmetProductTile({required this.product, required this.bakery});

  final Product product;
  final Bakery bakery;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line.withValues(alpha: 0.7)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ProductScreen(product: product, bakery: bakery),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Mouth-Watering Product Photography
              Expanded(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    AppImage(
                      url: product.imageUrl,
                      fallbackCategory: product.name,
                      fit: BoxFit.cover,
                    ),

                    // Top Status Badge
                    if (product.leadTimeDays == 0)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(6),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.1),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('⚡', style: TextStyle(fontSize: 10)),
                              SizedBox(width: 2),
                              Text(
                                'Same Day',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.ok,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              // Product Info & Price
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          money(product.price, bakery.currency),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: AppColors.accent,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: AppColors.accentSoft,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.arrow_forward_rounded,
                            size: 12,
                            color: AppColors.accent,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// =============================================================================
// TAB 2: CUSTOM CAKE STUDIO
// =============================================================================

class _CustomStudioTab extends StatelessWidget {
  const _CustomStudioTab({required this.bakery});

  final Bakery bakery;

  @override
  Widget build(BuildContext context) {
    final next = bakery.nextCustomDate;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
      children: [
        // Primary Studio Banner Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFA62B52), Color(0xFF6B1D36)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFA62B52).withValues(alpha: 0.35),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.auto_awesome_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Bespoke Cake Studio',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Handcrafted specifically for your celebration',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 14),
              const Text(
                'Build your dream cake from scratch. Pick tiers, shapes, flavours, piping colours, and bespoke cake messages with real-time price estimates.',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  height: 1.45,
                ),
              ),

              const SizedBox(height: 16),

              // Creative Options Highlights
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: const [
                  _HighlightPill(label: '🎂 1-3 Tiers'),
                  _HighlightPill(label: '🎨 Custom Palette'),
                  _HighlightPill(label: '🍓 Gourmet Fillings'),
                  _HighlightPill(label: '✍️ Message Piping'),
                ],
              ),

              const SizedBox(height: 18),

              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.accent,
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: () async {
                  if (!await ensureSignedIn(context)) return;
                  if (!context.mounted) return;
                  final draft = CustomOrderDraft(bakery: bakery)
                    ..isAiDesigned = true;
                  Navigator.of(context).push(AiCakeStudioStep.route(draft));
                },
                icon: const Icon(Icons.auto_awesome, size: 18),
                label: const Text(
                  '✨ Design with AI Studio',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                ),
              ),

              const SizedBox(height: 10),

              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: BorderSide(color: Colors.white.withValues(alpha: 0.6)),
                  minimumSize: const Size.fromHeight(44),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: () async {
                  if (!await ensureSignedIn(context)) return;
                  if (!context.mounted) return;
                  Navigator.of(context).push(OccasionStep.route(bakery));
                },
                child: const Text(
                  'Standard Custom Order (Tiers & Steps)',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // How it Works Guide
        Text(
          'How Custom Orders Work',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),

        _StepRow(
          number: '1',
          title: 'Design your brief',
          subtitle:
              'Select tiers, shape, cake sponge, and icing flavours with an instant guide price.',
        ),
        const SizedBox(height: 10),
        _StepRow(
          number: '2',
          title: 'Bakery confirms dates',
          subtitle: next == null
              ? 'Dates depend on availability. Submit your requested day.'
              : 'Earliest booking slot available is ${dayLabel(fromDayKey(next))}.',
        ),
        const SizedBox(height: 10),
        _StepRow(
          number: '3',
          title: 'Quote & Direct Chat',
          subtitle:
              '${bakery.name} reviews your brief, sends your quote, and chats directly with you.',
        ),
      ],
    );
  }
}

class _HighlightPill extends StatelessWidget {
  const _HighlightPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({
    required this.number,
    required this.title,
    required this.subtitle,
  });

  final String number;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: AppColors.accentSoft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.accent,
                  fontSize: 13,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 12,
                    height: 1.35,
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

// =============================================================================
// TAB 3: ABOUT, POLICIES & DELIVERY
// =============================================================================

class _AboutDeliveryTab extends StatelessWidget {
  const _AboutDeliveryTab({required this.bakery});

  final Bakery bakery;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
      children: [
        // Story Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'About ${bakery.name}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                bakery.about ??
                    'Passionate artisans baking celebration cakes and pastries with love.',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.ink2,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Delivery Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(
                        Icons.local_shipping_outlined,
                        color: AppColors.accent,
                        size: 20,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Delivery Zones',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    'Fee: ${money(bakery.deliveryFee, bakery.currency)}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.accent,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (bakery.deliveryAreas.isEmpty)
                const Text(
                  'No delivery areas specified. Please select pickup at checkout.',
                  style: TextStyle(fontSize: 13, color: AppColors.muted),
                )
              else
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final a in bakery.deliveryAreas)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.sand,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          a,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.ink2,
                          ),
                        ),
                      ),
                  ],
                ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Pickup & Collection Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.storefront_outlined,
                    color: AppColors.accent,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'In-Store Collection',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                bakery.pickupAvailable
                    ? 'Free pickup available directly from our counter.'
                    : 'This bakery currently operates delivery only.',
                style: const TextStyle(fontSize: 13, color: AppColors.ink2),
              ),
              if (bakery.address != null) ...[
                const SizedBox(height: 6),
                Text(
                  'Address: ${bakery.address}, ${bakery.city}',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
              if (bakery.handoverTimes.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  'Collection & Delivery times: ${bakery.handoverTimes.join(' · ')}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accent,
                  ),
                ),
              ],
              const SizedBox(height: 6),
              Text(
                'Lead time: at least ${bakery.customNoticeDays} days notice for bespoke orders.',
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Payment & Direct Contact Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.payments_outlined,
                    color: AppColors.accent,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Payment Methods',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  if (bakery.acceptsCash)
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.ground,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: const Text(
                        'Cash on Delivery',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  if (bakery.acceptsMobileMoney)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.ground,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: const Text(
                        'Mobile Money (MTN / Airtel)',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
