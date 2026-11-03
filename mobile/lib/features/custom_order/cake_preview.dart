import 'dart:math';

import 'package:flutter/foundation.dart' show setEquals;
import 'package:flutter/material.dart';

import 'builder_rules.dart';

/// A flat drawing of the cake being designed. Redraws as the customer changes options.
class CakePreview extends StatelessWidget {
  const CakePreview({
    super.key,
    required this.look,
    required this.description,
    this.height = 220,
  });

  final CakeLook look;
  final String description;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Preview of your cake: $description',
      image: true,
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(painter: CakePainter(look)),
      ),
    );
  }
}

class CakePainter extends CustomPainter {
  CakePainter(this.look);

  final CakeLook look;

  static const _sprinkles = [
    Color(0xFFE8505B),
    Color(0xFFF6C343),
    Color(0xFF4FB0C6),
    Color(0xFF8BC36A),
    Colors.white,
    Color(0xFF9A6FD1),
  ];

  Color _lighter(Color c) => Color.lerp(c, Colors.white, 0.35)!;

  @override
  void paint(Canvas canvas, Size size) {
    // Drawn on a 350 by 236 design and scaled to fit, like the designs.
    final scale = min(size.width / 350, size.height / 236);
    canvas.save();
    canvas.translate(
      (size.width - 350 * scale) / 2,
      (size.height - 236 * scale) / 2,
    );
    canvas.scale(scale);

    const cx = 175.0;
    const baseY = 214.0;
    final fill = Paint();

    // Plate
    fill.color = const Color(0x24000000);
    canvas.drawOval(
      Rect.fromCenter(
        center: const Offset(cx, baseY + 5),
        width: 284,
        height: 26,
      ),
      fill,
    );
    fill.color = Colors.white;
    canvas.drawOval(
      Rect.fromCenter(
        center: const Offset(cx, baseY + 1),
        width: 280,
        height: 26,
      ),
      fill,
    );

    const dims = {
      1: [
        [224.0, 104.0],
      ],
      2: [
        [212.0, 80.0],
        [150.0, 66.0],
      ],
      3: [
        [216.0, 62.0],
        [162.0, 54.0],
        [110.0, 48.0],
      ],
    };
    final random = Random(7);
    var bottom = baseY;
    var topY = baseY;
    var topW = 0.0;

    for (final dim in dims[look.tiers]!) {
      final w = dim[0];
      final h = dim[1];
      final top = bottom - h;
      final left = cx - w / 2;
      final ry = look.round ? (w * 0.075).roundToDouble() : 0.0;

      fill.color = look.colour;
      if (look.round) {
        final body = Path()
          ..moveTo(left, top)
          ..lineTo(left + w, top)
          ..lineTo(left + w, top + h - ry)
          ..arcToPoint(
            Offset(left, top + h - ry),
            radius: Radius.elliptical(w / 2, ry),
            clockwise: true,
          )
          ..close();
        canvas.drawPath(body, fill);
        // A flat shadow band on the right gives depth without a gradient.
        canvas.save();
        canvas.clipPath(body);
        fill.color = const Color(0x12000000);
        canvas.drawRect(Rect.fromLTWH(left + w - 14, top, 14, h), fill);
        canvas.restore();
        fill.color = _lighter(look.colour);
        canvas.drawOval(Rect.fromLTWH(left, top - ry, w, ry * 2), fill);
      } else {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(left, top, w, h),
            const Radius.circular(4),
          ),
          fill,
        );
        fill.color = const Color(0x12000000);
        canvas.drawRect(Rect.fromLTWH(left + w - 14, top, 14, h), fill);
        fill.color = _lighter(look.colour);
        canvas.drawRRect(
          RRect.fromRectAndCorners(
            Rect.fromLTWH(left, top - 9, w, 11),
            topLeft: const Radius.circular(4),
            topRight: const Radius.circular(4),
          ),
          fill,
        );
      }

      if (look.decorations.contains('sprinkles')) {
        for (var k = 0; k < 14; k++) {
          fill.color = _sprinkles[k % _sprinkles.length];
          final x = left + 10 + random.nextDouble() * (w - 20);
          final y = top + ry + 6 + random.nextDouble() * (h - ry * 2 - 12);
          canvas.save();
          canvas.translate(x, y);
          canvas.rotate(random.nextDouble() * pi);
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              const Rect.fromLTWH(-1.5, -4.5, 3, 9),
              const Radius.circular(2),
            ),
            fill,
          );
          canvas.restore();
        }
      }
      if (look.decorations.contains('pearls')) {
        final n = (w / 13).floor();
        for (var k = 0; k < n; k++) {
          final px = left + 6 + k * (w - 12) / (n - 1);
          final dx = (px - cx) / (w / 2);
          final edge = look.round
              ? top + h - ry + ry * sqrt(max(0, 1 - dx * dx))
              : top + h;
          fill.color = const Color(0x40000000);
          canvas.drawCircle(Offset(px, edge - 4), 4, fill);
          fill.color = const Color(0xFFFFFDF8);
          canvas.drawCircle(Offset(px, edge - 5), 4, fill);
        }
      }
      bottom = top;
      topY = top;
      topW = w;
    }

    if (look.decorations.contains('candles')) {
      for (final f in [-0.22, 0.0, 0.22]) {
        final x = cx + f * topW;
        fill.color = const Color(0xFF8FB8E8);
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(x - 3, topY - 30, 6, 30),
            const Radius.circular(2),
          ),
          fill,
        );
        fill.color = const Color(0xFFF6B13D);
        canvas.drawOval(Rect.fromLTWH(x - 4, topY - 44, 8, 12), fill);
      }
    }
    if (look.decorations.contains('flowers')) {
      for (final spot in [
        [-0.3, 2.0],
        [0.02, -3.0],
        [0.3, 3.0],
      ]) {
        final fx = cx + spot[0] * topW;
        final fy = topY + spot[1];
        fill.color = const Color(0xFFF28CB1);
        for (var k = 0; k < 5; k++) {
          final a = (k * 72 - 90) * pi / 180;
          canvas.drawCircle(
            Offset(fx + 6 * cos(a), fy + 4.5 * sin(a)),
            5,
            fill,
          );
        }
        fill.color = const Color(0xFFF6D365);
        canvas.drawCircle(Offset(fx, fy), 3.5, fill);
      }
    }
    if (look.decorations.contains('gold')) {
      fill.color = const Color(0xFFD4A537);
      for (var k = 0; k < 7; k++) {
        canvas.drawRect(
          Rect.fromLTWH(
            cx - topW / 2 + 14 + random.nextDouble() * (topW - 28),
            topY + 8 + random.nextDouble() * 24,
            6,
            4,
          ),
          fill,
        );
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(CakePainter old) =>
      old.look.round != look.round ||
      old.look.tiers != look.tiers ||
      old.look.colour != look.colour ||
      !setEquals(old.look.decorations, look.decorations);
}
