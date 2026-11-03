import 'package:flutter/material.dart';

import '../../core/cache.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../../models/builder.dart';
import 'builder_rules.dart' as rules;
import 'cake_preview.dart';
import 'draft.dart';
import 'personal_step.dart';

/// Step 2: the cake builder. Options and prices come from the bakery, so options
/// that are switched off or out of stock never show here.
class BuilderStep extends StatefulWidget {
  const BuilderStep({super.key, required this.draft});

  final CustomOrderDraft draft;

  @override
  State<BuilderStep> createState() => _BuilderStepState();
}

class _BuilderStepState extends State<BuilderStep> {
  CustomOrderDraft get d => widget.draft;
  late Future<void> _loading = _load();

  Future<void> _load() async {
    if (d.groups.isNotEmpty) return;
    final cached = await cachedGet('/bakeries/${d.bakery.id}/builder');
    final groups = (cached.data as List)
        .map((g) => OptionGroup.fromJson(g as Map<String, dynamic>))
        .toList();
    setState(() {
      d.groups = groups;
      d.selection = rules.defaultSelection(groups, basedOn: d.basedOn);
    });
  }

  void _pick(OptionGroup group, BuilderOption option) =>
      setState(() => d.selection = rules.toggle(d.selection, group, option));

  bool _isPicked(OptionGroup group, BuilderOption option) =>
      d.selection[group.id]?.contains(option.id) ?? false;

  // Sizes show servings (their price is the base price); other options show what they add.
  String _chipLabel(OptionGroup group, BuilderOption o) {
    if (group.kind == 'SIZE')
      return o.serves == null ? o.name : '${o.name} · serves ${o.serves}';
    return o.price > 0
        ? '${o.name} +${money(o.price, d.bakery.currency)}'
        : o.name;
  }

  void _showSizeHelp(OptionGroup sizes) {
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Which size do I need?',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              const Text(
                'Count your guests, then pick the size that serves a few more.',
                style: TextStyle(color: AppColors.ink2),
              ),
              const SizedBox(height: 12),
              for (final o in sizes.options)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: AppColors.line)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          o.name,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      Text(
                        o.serves == null
                            ? 'Ask the bakery'
                            : 'Serves about ${o.serves}',
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 6),
              Text(
                'Serving numbers come from ${d.bakery.name}.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Got it'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: FutureBuilder(
        future: _loading,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return ErrorView(
              message: snapshot.error.toString(),
              onRetry: () {
                final next = _load();
                setState(() {
                  _loading = next;
                });
              },
            );
          }
          if (d.groups.isEmpty) {
            return snapshot.connectionState == ConnectionState.done
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(28),
                      child: Text(
                        'This bakery has no builder options yet. Go back and describe your cake instead.',
                      ),
                    ),
                  )
                : const Center(child: CircularProgressIndicator());
          }
          final description = rules.describe(d.groups, d.selection);
          return Column(
            children: [
              const StepHeader(step: 2, title: 'Build your cake'),
              Container(
                margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                padding: const EdgeInsets.fromLTRB(0, 8, 0, 12),
                decoration: BoxDecoration(
                  color: AppColors.sand,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  children: [
                    CakePreview(
                      look: rules.lookFor(d.groups, d.selection),
                      description: description,
                      height: 200,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        description,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: AppColors.ink2,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                  children: [for (final g in d.groups) _group(g)],
                ),
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: d.groups.isEmpty
          ? null
          : BottomBar(
              note: 'The bakery confirms the final price in your quote.',
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Estimate',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.muted,
                          ),
                        ),
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            money(d.estimate ?? 0, d.bakery.currency),
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(
                    width: 160,
                    child: FilledButton(
                      onPressed: () {
                        final missing = rules.missingRequired(
                          d.groups,
                          d.selection,
                        );
                        if (missing.isNotEmpty)
                          return showError(
                            context,
                            'Pick an option for ${missing.join(', ')}',
                          );
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            settings: const RouteSettings(name: 'custom/3'),
                            builder: (_) => PersonalStep(draft: d),
                          ),
                        );
                      },
                      child: const Text('Continue'),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _group(OptionGroup group) {
    final selected = group.options.where((o) => _isPicked(group, o)).toList();
    final requirement = group.required ? 'Required' : 'Optional';
    final selectionSummary = selected.isEmpty
        ? requirement
        : '${selected.length} selected · $requirement';
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text.rich(
                  TextSpan(
                    text: group.name,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                    children: [
                      if (group.multiple)
                        const TextSpan(
                          text: ' · pick any',
                          style: TextStyle(
                            fontWeight: FontWeight.w400,
                            color: AppColors.muted,
                          ),
                        ),
                      TextSpan(
                        text: '  $selectionSummary',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w400,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (group.kind == 'SIZE')
                TextButton.icon(
                  onPressed: () => _showSizeHelp(group),
                  icon: const Icon(Icons.help_outline, size: 18),
                  label: const Text('Which size do I need?'),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (group.kind == 'ICING_COLOUR')
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final o in group.options)
                  Semantics(
                    label: o.name,
                    selected: _isPicked(group, o),
                    button: true,
                    child: InkResponse(
                      onTap: () => _pick(group, o),
                      radius: 26,
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color:
                              rules.parseHex(o.value ?? '') ?? AppColors.sand,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _isPicked(group, o)
                                ? AppColors.ink
                                : AppColors.ground,
                            width: 3,
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x1F2B1B14),
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final o in group.options)
                  if (group.multiple)
                    FilterChip(
                      label: Text(_chipLabel(group, o)),
                      selected: _isPicked(group, o),
                      onSelected: (_) => _pick(group, o),
                    )
                  else
                    ChoiceChip(
                      label: Text(_chipLabel(group, o)),
                      selected: _isPicked(group, o),
                      onSelected: (_) => _pick(group, o),
                    ),
              ],
            ),
          if (group.kind == 'ICING_COLOUR') ...[
            const SizedBox(height: 6),
            Text(
              group.options
                  .where((o) => _isPicked(group, o))
                  .map((o) => o.name)
                  .join(', '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}
