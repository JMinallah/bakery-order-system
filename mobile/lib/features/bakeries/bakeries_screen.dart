import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/cache.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../../models/bakery.dart';
import '../custom_order/ai_cake_studio_step.dart';
import '../custom_order/draft.dart';
import 'bakery_screen.dart';

/// The discovery tab. Displays a compact, minimalist list of bakeries with essential
/// details only (logo, name, delivery tag, next availability, and price range),
/// allowing users to filter by delivery area and dive into a bakery's full storefront.
class BakeriesScreen extends StatefulWidget {
  const BakeriesScreen({super.key});

  @override
  State<BakeriesScreen> createState() => _BakeriesScreenState();
}

class _BakeriesScreenState extends State<BakeriesScreen> {
  static const _areaKey = 'area';
  late Future<(Cached<dynamic>, String?)> _data = _load();

  void _setData(Future<(Cached<dynamic>, String?)> next) {
    if (!mounted) return;
    setState(() {
      _data = next;
    });
  }

  Future<(Cached<dynamic>, String?)> _load() async {
    final prefs = await SharedPreferences.getInstance();
    return (await cachedGet('/bakeries'), prefs.getString(_areaKey));
  }

  Future<void> _chooseArea(List<Bakery> bakeries, String? current) async {
    if (!mounted) return;

    final areas = {for (final b in bakeries) ...b.deliveryAreas}.toList()
      ..sort();

    final area = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Select delivery area',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (current != null)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(''),
                    child: const Text('Show all'),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Choose your area or where you want your cake delivered.',
              style: TextStyle(color: AppColors.muted, fontSize: 14),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final a in areas)
                  ChoiceChip(
                    label: Text(a),
                    selected: a == current,
                    onSelected: (_) => Navigator.of(context).pop(a),
                  ),
              ],
            ),
          ],
        ),
      ),
    );

    if (area == null) return;
    final prefs = await SharedPreferences.getInstance();
    if (area.isEmpty) {
      await prefs.remove(_areaKey);
    } else {
      await prefs.setString(_areaKey, area);
    }
    _setData(_load());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _data,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Scaffold(
            body: ErrorView(
              message: snapshot.error.toString(),
              onRetry: () {
                _setData(_load());
              },
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final (cached, area) = snapshot.data!;
        final all = (cached.data as List)
            .map((b) => Bakery.fromJson(b as Map<String, dynamic>))
            .toList();
        final shown = area == null
            ? all
            : all.where((b) => b.deliversTo(area)).toList();

        return Scaffold(
          body: SafeArea(
            child: RefreshIndicator(
              onRefresh: () async {
                final next = _load();
                _setData(next);
                await next;
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                children: [
                  if (cached.isOffline) OfflineBanner(savedAt: cached.savedAt!),

                  // App Logo Header
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16, top: 4),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.asset(
                            'assets/images/bak1.png',
                            height: 44,
                            fit: BoxFit.contain,
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Bakery Orders',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: AppColors.ink,
                                letterSpacing: -0.5,
                              ),
                            ),
                            Text(
                              'Artisanal & custom celebration cakes',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Sleek Location Bar
                  InkWell(
                    borderRadius: BorderRadius.circular(18),
                    onTap: () => _chooseArea(all, area),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.line),
                        boxShadow: AppShadows.card,
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(9),
                            decoration: BoxDecoration(
                              color: AppColors.accentSoft,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.location_on_rounded,
                              color: AppColors.accent,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'DELIVERING TO',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.6,
                                    color: AppColors.muted,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  area ?? 'All areas · Tap to select',
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.ink,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 7,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.sand,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              area == null ? 'Select' : 'Change',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink2,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // AI Cake Studio Discovery Banner
                  if (all.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    _AiStudioBanner(
                      onTap: () {
                        final bakery = shown.isNotEmpty
                            ? shown.first
                            : all.first;
                        final draft = CustomOrderDraft(bakery: bakery)
                          ..isAiDesigned = true;
                        Navigator.of(
                          context,
                        ).push(AiCakeStudioStep.route(draft));
                      },
                    ),
                  ],

                  const SizedBox(height: 20),

                  // Section Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        'Bakeries',
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      Text(
                        area == null
                            ? '${all.length} ${all.length == 1 ? 'bakery' : 'bakeries'}'
                            : '${shown.length} serving $area',
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Compact Minimalist Cards
                  for (final b in shown) ...[
                    _BakeryCard(bakery: b, savedAt: cached.savedAt),
                    const SizedBox(height: 12),
                  ],

                  if (shown.isEmpty) ...[
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
                              Icons.storefront_outlined,
                              size: 48,
                              color: AppColors.muted,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'No bakery delivers to $area yet',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Try picking a nearby neighbourhood or reset to see all available partner bakeries.',
                              style: TextStyle(
                                color: AppColors.muted,
                                fontSize: 14,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 16),
                            OutlinedButton(
                              onPressed: () async {
                                final prefs =
                                    await SharedPreferences.getInstance();
                                await prefs.remove(_areaKey);
                                _setData(_load());
                              },
                              child: const Text('Show all bakeries'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _BakeryCard extends StatelessWidget {
  const _BakeryCard({required this.bakery, this.savedAt});

  final Bakery bakery;
  final DateTime? savedAt;

  @override
  Widget build(BuildContext context) {
    final next = bakery.nextCustomDate;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
        boxShadow: AppShadows.card,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => BakeryScreen(bakery: bakery, savedAt: savedAt),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Compact Logo / Thumbnail
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    width: 72,
                    height: 72,
                    child: AppImage(
                      url: bakery.imageUrl,
                      fallbackCategory: 'bakery',
                      fit: BoxFit.cover,
                    ),
                  ),
                ),

                const SizedBox(width: 14),

                // Essential Info Column
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        bakery.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),

                      const SizedBox(height: 3),

                      // Delivery Area Tag
                      Row(
                        children: [
                          const Icon(
                            Icons.near_me_outlined,
                            size: 13,
                            color: AppColors.muted,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              bakery.deliveryAreas.isEmpty
                                  ? bakery.city
                                  : '${bakery.city} · ${bakery.deliveryAreas.take(3).join(', ')}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.muted,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 6),

                      // Badges and Fulfillment Wrap
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          if (next != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.okSoft,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                'Earliest: ${dayLabel(fromDayKey(next))}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.ok,
                                ),
                              ),
                            ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                bakery.deliveryAreas.isNotEmpty &&
                                        bakery.pickupAvailable
                                    ? Icons.storefront_outlined
                                    : bakery.deliveryAreas.isNotEmpty
                                    ? Icons.local_shipping_outlined
                                    : Icons.shopping_bag_outlined,
                                size: 13,
                                color: AppColors.muted,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                bakery.deliveryAreas.isNotEmpty &&
                                        bakery.pickupAvailable
                                    ? 'Delivery & Pickup'
                                    : bakery.deliveryAreas.isNotEmpty
                                    ? 'Delivery only'
                                    : 'Pickup only',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.muted,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 8),

                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.sand.withValues(alpha: 0.6),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.ink2,
                    size: 20,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AiStudioBanner extends StatelessWidget {
  const _AiStudioBanner({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFA62B52), Color(0xFF6B1D36)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFA62B52).withValues(alpha: 0.32),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.auto_awesome,
                    color: Colors.white,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text(
                            'AI Cake Studio',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text(
                              'NEW',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Describe any dream cake & see an instant visual concept',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.arrow_forward_rounded,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
