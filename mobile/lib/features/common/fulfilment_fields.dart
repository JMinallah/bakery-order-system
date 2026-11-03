import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../../models/bakery.dart';

/// Pickup or delivery, the delivery area (only areas the bakery covers) and the address.
class FulfilmentFields extends StatelessWidget {
  const FulfilmentFields({
    super.key,
    required this.bakery,
    required this.fulfilment,
    required this.area,
    required this.address,
    required this.onFulfilment,
    required this.onArea,
  });

  final Bakery bakery;
  final String fulfilment;
  final String? area;
  final TextEditingController address;
  final ValueChanged<String> onFulfilment;
  final ValueChanged<String?> onArea;

  @override
  Widget build(BuildContext context) {
    final canDeliver = bakery.deliveryAreas.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const FieldLabel('How will you get it?'),
        SegmentedButton<String>(
          showSelectedIcon: false,
          style: SegmentedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            selectedBackgroundColor: AppColors.accentSoft,
            selectedForegroundColor: AppColors.accent,
          ),
          segments: [
            ButtonSegment(
              value: 'PICKUP',
              label: const Text('Pickup, free'),
              enabled: bakery.pickupAvailable,
            ),
            ButtonSegment(
              value: 'DELIVERY',
              label: Text(
                bakery.deliveryFee > 0
                    ? 'Delivery, ${money(bakery.deliveryFee, bakery.currency)}'
                    : 'Delivery',
              ),
              enabled: canDeliver,
            ),
          ],
          selected: {fulfilment},
          onSelectionChanged: (s) => onFulfilment(s.first),
        ),
        if (fulfilment == 'PICKUP') ...[
          const SizedBox(height: 8),
          Text(
            bakery.address != null
                ? 'Pick up from ${bakery.address}, ${bakery.city}'
                : 'Pick up from ${bakery.name}, ${bakery.city}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (bakery.handoverTimes.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Collection slots: ${bakery.handoverTimes.join(' · ')}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.accent,
              ),
            ),
          ],
        ],
        if (fulfilment == 'DELIVERY') ...[
          const SizedBox(height: 16),
          const FieldLabel('Area'),
          DropdownButtonFormField<String>(
            initialValue: area,
            hint: const Text('Choose the area'),
            items: [
              for (final a in bakery.deliveryAreas)
                DropdownMenuItem(value: a, child: Text(a)),
            ],
            onChanged: onArea,
          ),
          const SizedBox(height: 6),
          Text(
            '${bakery.name} delivers to these areas only.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (bakery.handoverTimes.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Delivery slots: ${bakery.handoverTimes.join(' · ')}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.accent,
              ),
            ),
          ],
          const SizedBox(height: 16),
          const FieldLabel('Delivery address'),
          TextField(
            controller: address,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              hintText: 'For example Plot 12, near the market',
            ),
          ),
        ],
      ],
    );
  }
}

/// Delivery when the bakery has delivery areas, otherwise pickup.
String defaultFulfilment(Bakery bakery) =>
    bakery.deliveryAreas.isEmpty ? 'PICKUP' : 'DELIVERY';

/// Why the order can't be sent yet, or null when pickup/delivery is complete.
String? fulfilmentProblem(String fulfilment, String? area, String address) {
  if (fulfilment != 'DELIVERY') return null;
  if (area == null) return 'Choose the delivery area';
  if (address.trim().isEmpty) return 'Add the delivery address';
  return null;
}
