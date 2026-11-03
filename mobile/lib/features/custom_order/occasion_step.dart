import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../../models/bakery.dart';
import '../../models/product.dart';
import 'ai_cake_studio_step.dart';
import 'builder_step.dart';
import 'draft.dart';
import 'personal_step.dart';

const defaultOccasions = [
  'Birthday',
  'Wedding',
  'Introduction',
  'Graduation',
  'Baby shower',
  'Other',
];

enum _DesignMode { ai, builder, words }

/// Step 1: what the cake is for, and how the customer wants to design it.
class OccasionStep extends StatefulWidget {
  const OccasionStep({super.key, required this.draft});

  final CustomOrderDraft draft;

  static Route<void> route(Bakery bakery, {Product? basedOn}) =>
      MaterialPageRoute(
        settings: const RouteSettings(name: 'custom/1'),
        builder: (_) => OccasionStep(
          draft: CustomOrderDraft(bakery: bakery, basedOn: basedOn),
        ),
      );

  @override
  State<OccasionStep> createState() => _OccasionStepState();
}

class _OccasionStepState extends State<OccasionStep> {
  CustomOrderDraft get d => widget.draft;
  late _DesignMode _mode = widget.draft.isAiDesigned
      ? _DesignMode.ai
      : (widget.draft.useBuilder ? _DesignMode.builder : _DesignMode.words);

  List<String> get _occasions =>
      d.bakery.occasions.isNotEmpty ? d.bakery.occasions : defaultOccasions;

  Future<void> _confirmLeave() async {
    final leave = await showModalBottomSheet<bool>(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Leave your design?',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              const Text(
                'Your choices are lost if you leave now.',
                style: TextStyle(color: AppColors.ink2),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Keep designing'),
              ),
              const SizedBox(height: 4),
              TextButton(
                style: TextButton.styleFrom(foregroundColor: AppColors.danger),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Leave and lose my choices'),
              ),
            ],
          ),
        ),
      ),
    );
    if (leave == true && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !d.hasChanges,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: AppBar(),
        body: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            StepHeader(
              step: 1,
              title: d.basedOn == null
                  ? 'What are we celebrating?'
                  : 'Customise ${d.basedOn!.name.toLowerCase()}',
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (d.basedOn != null) const FieldLabel('What is it for?'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final o in _occasions)
                        ChoiceChip(
                          label: Text(o),
                          selected: d.occasion == o,
                          onSelected: (_) => setState(() => d.occasion = o),
                        ),
                    ],
                  ),
                  if (d.basedOn == null) ...[
                    const SizedBox(height: 24),
                    const FieldLabel('How would you like to design it?'),
                    _Choice(
                      icon: Icons.auto_awesome,
                      title: '✨ Design with AI Studio',
                      body:
                          'Describe your dream cake in plain words, let AI visualize it, and send the concept to the baker.',
                      selected: _mode == _DesignMode.ai,
                      onTap: () => setState(() {
                        _mode = _DesignMode.ai;
                        d.isAiDesigned = true;
                        d.useBuilder = false;
                      }),
                    ),
                    const SizedBox(height: 10),
                    _Choice(
                      icon: Icons.layers_outlined,
                      title: 'Build it here',
                      body:
                          'Pick the shape, tiers, colours and decorations, and watch your cake take shape.',
                      selected: _mode == _DesignMode.builder,
                      onTap: () => setState(() {
                        _mode = _DesignMode.builder;
                        d.isAiDesigned = false;
                        d.useBuilder = true;
                      }),
                    ),
                    const SizedBox(height: 10),
                    _Choice(
                      icon: Icons.edit_note_outlined,
                      title: 'Describe it in your own words',
                      body:
                          'Already have an idea or a picture? Tell the bakery what you want.',
                      selected: _mode == _DesignMode.words,
                      onTap: () => setState(() {
                        _mode = _DesignMode.words;
                        d.isAiDesigned = false;
                        d.useBuilder = false;
                      }),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'You can switch at any time. Nothing is sent until the last step.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: 24),
                  const FieldLabel('How many?'),
                  SegmentedButton<bool>(
                    showSelectedIcon: false,
                    style: SegmentedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      selectedBackgroundColor: AppColors.accentSoft,
                      selectedForegroundColor: AppColors.accent,
                    ),
                    segments: const [
                      ButtonSegment(value: false, label: Text('One cake')),
                      ButtonSegment(
                        value: true,
                        label: Text('Bulk, for an event'),
                      ),
                    ],
                    selected: {d.bulk},
                    onSelectionChanged: (s) => setState(() => d.bulk = s.first),
                  ),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: BottomBar(
          child: FilledButton(
            onPressed: () {
              switch (_mode) {
                case _DesignMode.ai:
                  d.isAiDesigned = true;
                  d.useBuilder = false;
                  Navigator.of(context).push(AiCakeStudioStep.route(d));
                  break;
                case _DesignMode.builder:
                  d.isAiDesigned = false;
                  d.useBuilder = true;
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      settings: const RouteSettings(name: 'custom/2'),
                      builder: (_) => BuilderStep(draft: d),
                    ),
                  );
                  break;
                case _DesignMode.words:
                  d.isAiDesigned = false;
                  d.useBuilder = false;
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      settings: const RouteSettings(name: 'custom/3'),
                      builder: (_) => PersonalStep(draft: d),
                    ),
                  );
                  break;
              }
            },
            child: const Text('Continue'),
          ),
        ),
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({
    required this.icon,
    required this.title,
    required this.body,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String body;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: selected ? AppColors.accent : AppColors.lineStrong,
            width: selected ? 2 : 1.5,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  icon,
                  color: selected ? AppColors.accent : AppColors.muted,
                  size: 26,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        body,
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppColors.muted,
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
    );
  }
}
