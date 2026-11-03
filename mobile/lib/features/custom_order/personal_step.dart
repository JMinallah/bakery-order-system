import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/ai_service.dart';
import '../../core/api_client.dart';
import '../../core/uploads.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import 'ai_cake_studio_step.dart';
import 'draft.dart';
import 'when_step.dart';

/// Step 3: writing, theme and notes. When the customer chose to describe the cake,
/// this is also where they say what it should be like.
class PersonalStep extends StatefulWidget {
  const PersonalStep({super.key, required this.draft});

  final CustomOrderDraft draft;

  @override
  State<PersonalStep> createState() => _PersonalStepState();
}

class _PersonalStepState extends State<PersonalStep> {
  CustomOrderDraft get d => widget.draft;

  final _picker = ImagePicker();
  bool _uploadingPhoto = false;
  String? _photoError;
  bool _generatingAi = false;
  String? _aiError;

  late final _inscription = TextEditingController(text: d.inscription);
  late final _theme = TextEditingController(text: d.theme);
  late final _notes = TextEditingController(text: d.notes);
  late final _flavour = TextEditingController(text: d.flavour);
  late final _size = TextEditingController(text: d.size);
  late final _colours = TextEditingController(text: d.colours);

  @override
  void dispose() {
    for (final c in [_inscription, _theme, _notes, _flavour, _size, _colours]) {
      c.dispose();
    }
    super.dispose();
  }

  void _save() {
    d
      ..inscription = _inscription.text
      ..theme = _theme.text
      ..notes = _notes.text
      ..flavour = _flavour.text
      ..size = _size.text
      ..colours = _colours.text;
  }

  Future<void> _pickPhoto() async {
    if (d.photos.length >= 5) {
      setState(() => _photoError = 'You can add up to 5 inspiration photos');
      return;
    }

    setState(() {
      _uploadingPhoto = true;
      _photoError = null;
    });

    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 82,
      );

      if (file == null) {
        return;
      }

      final bytes = await file.readAsBytes();
      final url = await uploadPhoto(
        Uint8List.fromList(bytes),
        contentType: _contentType(file.name),
      );

      if (mounted) {
        setState(() {
          d.photos = [...d.photos, (bytes: bytes, url: url)];
        });
      }
    } catch (e) {
      if (mounted) setState(() => _photoError = e.toString());
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  String _contentType(String name) {
    final extension = name.split('.').last.toLowerCase();

    return switch (extension) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => 'image/jpeg',
    };
  }

  Widget _photos() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const FieldLabel('Inspiration photos', optional: true),
        const Text(
          'Show the baker what you have in mind. You can add up to 5.',
          style: TextStyle(color: AppColors.muted),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (var i = 0; i < d.photos.length; i++)
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.memory(
                      d.photos[i].bytes,
                      width: 76,
                      height: 76,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 2,
                    right: 2,
                    child: IconButton(
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white,
                        minimumSize: const Size(44, 44),
                        padding: EdgeInsets.zero,
                      ),
                      icon: const Icon(Icons.close, size: 18),
                      tooltip: 'Remove photo',
                      onPressed: () => setState(() {
                        d.photos = [...d.photos]..removeAt(i);
                      }),
                    ),
                  ),
                ],
              ),
            if (d.photos.length < 5)
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(76, 76),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: _uploadingPhoto ? null : _pickPhoto,
                icon: _uploadingPhoto
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add_photo_alternate_outlined),
                label: const Text('Add'),
              ),
          ],
        ),
        if (_photoError != null) ...[
          const SizedBox(height: 8),
          Text(_photoError!, style: const TextStyle(color: AppColors.danger)),
        ],
      ],
    );
  }

  Future<void> _visualizeWithAi() async {
    _save();

    final parts = [
      if (d.flavour.isNotEmpty) '${d.flavour} flavour',
      if (d.colours.isNotEmpty) '${d.colours} colours',
      if (d.size.isNotEmpty) '${d.size} size',
      if (d.theme.isNotEmpty) '${d.theme} theme',
      if (d.inscription.isNotEmpty) 'inscription "${d.inscription}"',
      if (d.notes.isNotEmpty) d.notes,
    ];

    final prompt = parts.isEmpty
        ? '${d.occasion} celebration cake'
        : parts.join(', ');

    setState(() {
      _generatingAi = true;
      _aiError = null;
    });

    try {
      final cake = await generateCakeVisual(
        prompt: prompt,
        occasion: d.occasion,
        flavour: d.flavour,
        colours: d.colours,
        theme: d.theme,
      );

      if (!mounted) return;

      setState(() {
        d
          ..designImageUrl = cake.url
          ..aiImageBytes = cake.imageBytes
          ..aiPrompt = prompt
          ..isAiDesigned = true;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _aiError = e.message);
    } on NetworkException catch (e) {
      if (mounted) setState(() => _aiError = e.toString());
    } catch (e) {
      if (mounted) {
        setState(() => _aiError = 'Could not generate visual: $e');
      }
    } finally {
      if (mounted) setState(() => _generatingAi = false);
    }
  }

  void _removeVisual() {
    setState(() {
      d
        ..designImageUrl = null
        ..aiImageBytes = null
        ..aiPrompt = null
        ..isAiDesigned = false;
    });
  }

  Widget _aiCakeHeroCard() {
    final prompt = d.aiPrompt?.trim() ?? '';
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.accent.withAlpha(90), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: AppColors.ink.withAlpha(12),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
            child: AspectRatio(
              aspectRatio: 16 / 10,
              child: d.aiImageBytes != null
                  ? Image.memory(d.aiImageBytes!, fit: BoxFit.cover)
                  : (d.designImageUrl != null &&
                            !d.designImageUrl!.startsWith('pollinations://')
                        ? (d.designImageUrl!.startsWith('assets/')
                              ? Image.asset(
                                  d.designImageUrl!,
                                  fit: BoxFit.cover,
                                )
                              : Image.network(
                                  d.designImageUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) =>
                                      _fallbackDesign(),
                                ))
                        : _fallbackDesign()),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.accentSoft,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.auto_awesome,
                            size: 14,
                            color: AppColors.accent,
                          ),
                          SizedBox(width: 5),
                          Text(
                            'AI Cake Concept',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.accent,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: _editInAiStudio,
                      icon: const Icon(Icons.edit_outlined, size: 16),
                      label: const Text(
                        'Edit Concept',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
                if (prompt.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.sand,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '“$prompt”',
                      style: const TextStyle(
                        fontSize: 13,
                        fontStyle: FontStyle.italic,
                        color: AppColors.ink2,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Text(
                  'This visual concept and your specifications will be sent to ${d.bakery.name}.',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _fallbackDesign() {
    return Container(
      color: AppColors.sand,
      alignment: Alignment.center,
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cake_outlined, color: AppColors.muted, size: 36),
          SizedBox(height: 8),
          Text(
            'AI Design Ready',
            style: TextStyle(color: AppColors.muted, fontSize: 13),
          ),
        ],
      ),
    );
  }

  void _editInAiStudio() {
    _save();
    final navigator = Navigator.of(context);
    var popped = false;
    navigator.popUntil((route) {
      if (route.settings.name == 'custom/ai') {
        popped = true;
        return true;
      }
      return route.isFirst;
    });
    if (!popped) {
      navigator.push(AiCakeStudioStep.route(d));
    }
  }

  Widget _aiVisualizerCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.accentSoft.withAlpha(50),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.accent.withAlpha(80), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.auto_awesome, color: AppColors.accent, size: 22),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'AI Cake Visualizer',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      'Turn your cake description into a photorealistic visual.',
                      style: TextStyle(fontSize: 12, color: AppColors.ink2),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton.tonalIcon(
            onPressed: _generatingAi ? null : _visualizeWithAi,
            icon: _generatingAi
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.auto_awesome, size: 18),
            label: Text(
              _generatingAi ? 'Visualizing your cake…' : '✨ Visualize with AI',
            ),
          ),
          if (_aiError != null) ...[
            const SizedBox(height: 8),
            Text(
              _aiError!,
              style: const TextStyle(color: AppColors.danger, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    String? hint,
    int? maxLength,
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FieldLabel(label, optional: true),
          TextField(
            controller: controller,
            maxLength: maxLength,
            maxLines: maxLines,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(hintText: hint),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasAiDesign =
        d.isAiDesigned &&
        (d.aiImageBytes != null ||
            (d.designImageUrl != null && d.designImageUrl!.isNotEmpty));

    return PopScope(
      onPopInvokedWithResult: (_, _) => _save(),
      child: Scaffold(
        appBar: AppBar(),
        body: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            StepHeader(
              step: 3,
              title: hasAiDesign
                  ? 'Make it personal'
                  : (d.useBuilder ? 'Make it personal' : 'Describe your cake'),
              subtitle: hasAiDesign
                  ? 'Review your cake concept and add any personal finishing touches.'
                  : 'Everything here is optional.',
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Column(
                children: [
                  if (hasAiDesign) _aiCakeHeroCard(),
                  if (!d.useBuilder) ...[
                    _field('Flavour', _flavour, hint: 'For example chocolate'),
                    _field(
                      'Size',
                      _size,
                      hint: 'For example 2 kg, or how many guests',
                    ),
                    _field(
                      'Colours',
                      _colours,
                      hint: 'For example pink and gold',
                    ),
                    if (!hasAiDesign) _aiVisualizerCard(),
                  ],
                  _field(
                    'Writing on the cake',
                    _inscription,
                    hint: 'For example Happy 5th Birthday Amara',
                    maxLength: 40,
                  ),
                  _field(
                    'Theme or character',
                    _theme,
                    hint: 'For example football, flowers or a cartoon',
                  ),
                  _field(
                    'Notes for the baker',
                    _notes,
                    hint: 'Allergies, colours to avoid, anything else',
                    maxLines: 3,
                  ),
                  _photos(),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: BottomBar(
          child: FilledButton(
            onPressed: () {
              _save();
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  settings: const RouteSettings(name: 'custom/4'),
                  builder: (_) => WhenStep(draft: d),
                ),
              );
            },
            child: const Text('Continue'),
          ),
        ),
      ),
    );
  }
}
