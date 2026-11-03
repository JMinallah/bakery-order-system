import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/uploads.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../auth/auth.dart';
import '../orders/submit.dart';
import 'builder_rules.dart' as rules;
import 'cake_preview.dart';
import 'draft.dart';

/// Step 5: everything on one screen, with a way back to each part, before sending.
class ReviewStep extends StatefulWidget {
  const ReviewStep({super.key, required this.draft});

  final CustomOrderDraft draft;

  @override
  State<ReviewStep> createState() => _ReviewStepState();
}

class _ReviewStepState extends State<ReviewStep> {
  CustomOrderDraft get d => widget.draft;

  final _previewKey = GlobalKey();
  bool _sending = false;
  String? _error;

  void _editStep(String name) => Navigator.of(
    context,
  ).popUntil((r) => r.settings.name == name || r.isFirst);

  Future<void> _send() async {
    if (!await ensureSignedIn(context)) return;
    if (!mounted) return;

    setState(() {
      _sending = true;
      _error = null;
    });

    try {
      // Upload AI-generated image bytes first. The pollinations:// URL is
      // only an internal placeholder and cannot be displayed by the bakery.
      if (d.aiImageBytes != null &&
          (d.designImageUrl == null ||
              d.designImageUrl!.startsWith('pollinations://'))) {
        final remoteUrl = await uploadPhoto(
          d.aiImageBytes!,
          contentType: 'image/jpeg',
        );

        d.designImageUrl = remoteUrl;
      } else if (d.designImageUrl != null &&
          d.designImageUrl!.startsWith('pollinations://')) {
        d.designImageUrl = null;
      } else if (d.useBuilder && d.designImageUrl == null) {
        // Upload the cake-builder preview.
        await _uploadPreview();
      }

      if (!mounted) return;

      await submitOrder(
        context,
        body: d.toJson(),
        title: d.title,
        bakeryName: d.bakery.name,
        custom: true,
      );
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = e.message);
      }
    } on NetworkException catch (e) {
      if (mounted) {
        setState(() => _error = e.toString());
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Could not upload the design image: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  Future<void> _uploadPreview() async {
    await WidgetsBinding.instance.endOfFrame;

    final boundary =
        _previewKey.currentContext?.findRenderObject()
            as RenderRepaintBoundary?;

    if (boundary == null) return;

    final image = await boundary.toImage(pixelRatio: 2);

    try {
      final data = await image.toByteData(format: ui.ImageByteFormat.png);

      if (data == null) return;

      final bytes = data.buffer.asUint8List(
        data.offsetInBytes,
        data.lengthInBytes,
      );

      d.designImageUrl = await uploadPhoto(bytes, contentType: 'image/png');
    } finally {
      image.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = d.bakery.currency;
    final estimate = d.estimate;

    final personal = [
      if (d.inscription.trim().isNotEmpty) '“${d.inscription.trim()}”',
      if (d.theme.trim().isNotEmpty) '${d.theme.trim()} theme',
      if (d.notes.trim().isNotEmpty) d.notes.trim(),
    ];

    return Scaffold(
      appBar: AppBar(),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          const StepHeader(step: 5, title: 'Check your order'),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Your request to ${d.bakery.name}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                const Text(
                  'The bakery will review this and send you a quote. Nothing is charged now.',
                  style: TextStyle(color: AppColors.ink2),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    if (d.designImageUrl != null)
                      Container(
                        width: 120,
                        height: 104,
                        margin: const EdgeInsets.only(right: 16),
                        decoration: BoxDecoration(
                          color: AppColors.sand,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: d.aiImageBytes != null
                            ? Image.memory(d.aiImageBytes!, fit: BoxFit.cover)
                            : (d.designImageUrl!.startsWith('assets/')
                                  ? Image.asset(
                                      d.designImageUrl!,
                                      fit: BoxFit.cover,
                                    )
                                  : Image.network(
                                      d.designImageUrl!,
                                      fit: BoxFit.cover,
                                    )),
                      )
                    else if (d.useBuilder && d.groups.isNotEmpty)
                      Container(
                        width: 120,
                        height: 104,
                        margin: const EdgeInsets.only(right: 16),
                        decoration: BoxDecoration(
                          color: AppColors.sand,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: RepaintBoundary(
                          key: _previewKey,
                          child: CakePreview(
                            look: rules.lookFor(d.groups, d.selection),
                            description: d.designSummary,
                            height: 104,
                          ),
                        ),
                      ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            d.title,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            d.designSummary,
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.ink2,
                            ),
                          ),
                          TextButton(
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              alignment: Alignment.centerLeft,
                            ),
                            onPressed: () => _editStep(
                              d.isAiDesigned
                                  ? 'custom/ai'
                                  : (d.useBuilder ? 'custom/2' : 'custom/3'),
                            ),
                            child: const Text('Edit design'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                _Row(
                  label: 'Personal touches',
                  value: personal.isEmpty ? 'None' : personal.join(', '),
                  onEdit: () => _editStep('custom/3'),
                ),
                _Row(
                  label: 'When and where',
                  value:
                      '${d.dueDate != null ? dateTimeLabel(d.dueDate!) : 'Date not set'}, ${d.fulfilment == 'PICKUP' ? 'pickup' : (d.deliveryAddress.trim().isNotEmpty ? 'delivered to ${d.deliveryAddress.trim()}${d.deliveryArea != null ? ', ${d.deliveryArea}' : ''}' : 'delivery${d.deliveryArea != null ? ' to ${d.deliveryArea}' : ''}')}',
                  onEdit: () => _editStep('custom/4'),
                ),
                _Row(label: 'Bakery', value: d.bakery.name),
                const SizedBox(height: 16),
                if (estimate != null)
                  _sum('Estimate', money(estimate, currency), bold: true),
                if (d.budget != null)
                  _sum('Your budget', money(d.budget!, currency)),
                const SizedBox(height: 6),
                Text(
                  estimate != null && d.budget != null && estimate > d.budget!
                      ? 'The estimate is above your budget. The bakery can suggest changes when they send their quote.'
                      : 'The bakery looks at your design and sends you a quote in the app.',
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
        note: "You'll get a quote in the app. Nothing is charged now.",
        child: FilledButton(
          onPressed: _sending ? null : _send,
          child: Text(_sending ? 'Sending…' : 'Send to ${d.bakery.name}'),
        ),
      ),
    );
  }

  Widget _sum(String label, String value, {bool bold = false}) {
    final style = TextStyle(
      fontSize: bold ? 16 : 15,
      fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          Text(value, style: style),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.onEdit});

  final String label;
  final String value;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontSize: 13, color: AppColors.muted),
                ),
                const SizedBox(height: 3),
                Text(value, style: const TextStyle(fontSize: 15)),
              ],
            ),
          ),
          if (onEdit != null)
            TextButton(
              onPressed: onEdit,
              child: Semantics(label: 'Edit $label', child: const Text('Edit')),
            ),
        ],
      ),
    );
  }
}
