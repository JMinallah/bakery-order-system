import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../common/date_sheet.dart';
import '../common/fulfilment_fields.dart';
import 'draft.dart';
import 'review_step.dart';

/// Step 4: the due date (only days the bakery can still take a custom cake), pickup or
/// delivery, and an optional budget.
class WhenStep extends StatefulWidget {
  const WhenStep({super.key, required this.draft});

  final CustomOrderDraft draft;

  @override
  State<WhenStep> createState() => _WhenStepState();
}

class _WhenStepState extends State<WhenStep> {
  CustomOrderDraft get d => widget.draft;
  late final _address = TextEditingController(text: d.deliveryAddress);
  late final _budget = TextEditingController(text: d.budget?.toString() ?? '');
  late String _fulfilment = d.dueDate == null
      ? defaultFulfilment(d.bakery)
      : d.fulfilment;
  String? _error;

  @override
  void dispose() {
    _address.dispose();
    _budget.dispose();
    super.dispose();
  }

  void _save() {
    d
      ..fulfilment = _fulfilment
      ..deliveryAddress = _address.text
      ..budget = int.tryParse(_budget.text.replaceAll(',', '').trim());
  }

  void _continue() {
    _save();
    final problem = d.dueDate == null
        ? 'Choose when you need it'
        : fulfilmentProblem(_fulfilment, d.deliveryArea, _address.text);
    if (problem != null) {
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(problem)));
      return setState(() => _error = problem);
    }
    setState(() => _error = null);
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        settings: const RouteSettings(name: 'custom/5'),
        builder: (_) => ReviewStep(draft: d),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      onPopInvokedWithResult: (_, _) => _save(),
      child: Scaffold(
        appBar: AppBar(),
        body: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            const StepHeader(step: 4, title: 'When and where?'),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const FieldLabel('Needed by'),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      alignment: Alignment.centerLeft,
                      side: const BorderSide(
                        color: AppColors.lineStrong,
                        width: 1.5,
                      ),
                    ),
                    icon: const Icon(Icons.event_outlined),
                    label: Text(
                      d.dueDate == null
                          ? 'Choose a day and time'
                          : dateTimeLabel(d.dueDate!),
                    ),
                    onPressed: () async {
                      final picked = await pickDueDate(
                        context,
                        bakery: d.bakery,
                        rule: CustomCakeRule(),
                        initial: d.dueDate,
                      );
                      if (picked != null) setState(() => d.dueDate = picked);
                    },
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Only days the bakery can still take a custom cake are offered.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 22),
                  FulfilmentFields(
                    bakery: d.bakery,
                    fulfilment: _fulfilment,
                    area: d.deliveryArea,
                    address: _address,
                    onFulfilment: (f) => setState(() => _fulfilment = f),
                    onArea: (a) => setState(() => d.deliveryArea = a),
                  ),
                  const SizedBox(height: 22),
                  const FieldLabel('Your budget', optional: true),
                  TextField(
                    controller: _budget,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      prefixText: '${d.bakery.currency} ',
                      hintText: '120000',
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Helps the bakery suggest options that fit.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: AppColors.danger,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: BottomBar(
          child: FilledButton(
            onPressed: _continue,
            child: const Text('Review order'),
          ),
        ),
      ),
    );
  }
}
