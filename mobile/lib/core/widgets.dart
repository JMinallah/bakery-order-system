import 'package:flutter/material.dart';

import 'theme.dart';

/// "Step 2 of 5" with a progress bar, above the step's title.
class StepHeader extends StatelessWidget {
  const StepHeader({
    super.key,
    required this.step,
    required this.title,
    this.total = 5,
    this.subtitle,
  });

  final int step;
  final int total;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Step $step of $total',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.muted,
            ),
          ),
          const SizedBox(height: 6),
          Semantics(
            label: 'Step $step of $total',
            child: Row(
              children: [
                for (var i = 1; i <= total; i++)
                  Expanded(
                    child: Container(
                      height: 5,
                      margin: EdgeInsets.only(right: i == total ? 0 : 4),
                      decoration: BoxDecoration(
                        color: i <= step
                            ? AppColors.accent
                            : const Color(0xFFE8DCD2),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(
              subtitle!,
              style: const TextStyle(fontSize: 15, color: AppColors.muted),
            ),
          ],
        ],
      ),
    );
  }
}

/// The white bar at the bottom of a step with its main button.
class BottomBar extends StatelessWidget {
  const BottomBar({super.key, required this.child, this.note});

  final Widget child;
  final String? note;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            child,
            if (note != null) ...[
              const SizedBox(height: 8),
              Text(
                note!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Shown when a screen is using the copy saved on the phone.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key, required this.savedAt});

  final DateTime savedAt;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: "You're offline. Showing data saved on your phone.",
      child: Container(
        width: double.infinity,
        color: AppColors.ink,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: const Row(
          children: [
            Icon(Icons.wifi_off_rounded, color: Colors.white, size: 18),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                "You're offline. Showing what was saved last time.",
                style: TextStyle(color: Colors.white, fontSize: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A failed load, with a way to try again.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}

/// A small coloured label, e.g. an order status.
class Pill extends StatelessWidget {
  const Pill(
    this.label, {
    super.key,
    this.background = AppColors.sand,
    this.foreground = AppColors.ink2,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Status: $label',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: foreground,
          ),
        ),
      ),
    );
  }
}

const statusColours = {
  'SUBMITTED': (AppColors.infoSoft, AppColors.info),
  'QUOTED': (AppColors.accentSoft, AppColors.accent),
  'CONFIRMED': (AppColors.violetSoft, AppColors.violet),
  'PREPARING': (AppColors.warnSoft, AppColors.warn),
  'READY': (AppColors.okSoft, AppColors.ok),
  'COMPLETED': (AppColors.sand, AppColors.ink2),
  'CANCELLED': (AppColors.dangerSoft, AppColors.danger),
};

/// A field label with an optional "· optional" note.
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.optional = false});

  final String text;
  final bool optional;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text.rich(
        TextSpan(
          text: text,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: AppColors.ink,
          ),
          children: [
            if (optional)
              const TextSpan(
                text: ' · optional',
                style: TextStyle(
                  fontWeight: FontWeight.w400,
                  color: AppColors.muted,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

void showError(BuildContext context, Object error) {
  ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(error.toString())));
}

/// Renders an image with automatic graceful fallback to bundled culinary photography.
class AppImage extends StatelessWidget {
  const AppImage({
    super.key,
    this.url,
    this.fallbackCategory,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.borderRadius,
  });

  final String? url;
  final String? fallbackCategory;
  final BoxFit fit;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  static String resolveAsset(String? name) {
    final lower = (name ?? '').toLowerCase();
    if (lower.contains('choc') || lower.contains('fudge'))
      return 'assets/images/chocolate_fudge.jpg';
    if (lower.contains('lemon') || lower.contains('drizzle'))
      return 'assets/images/lemon_drizzle.jpg';
    if (lower.contains('red') || lower.contains('velvet'))
      return 'assets/images/red_velvet.jpg';
    if (lower.contains('vanilla') || lower.contains('sponge'))
      return 'assets/images/vanilla_sponge.jpg';
    return 'assets/images/bakery_hero.jpg';
  }

  @override
  Widget build(BuildContext context) {
    final assetPath = resolveAsset(fallbackCategory);

    Widget imageWidget;
    if (url != null && url!.startsWith('http')) {
      imageWidget = Image.network(
        url!,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, _, _) =>
            Image.asset(assetPath, width: width, height: height, fit: fit),
      );
    } else {
      imageWidget = Image.asset(
        assetPath,
        width: width,
        height: height,
        fit: fit,
      );
    }

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: imageWidget);
    }
    return imageWidget;
  }
}
