import 'package:flutter/material.dart';

import '../../core/ai_service.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import 'draft.dart';
import 'personal_step.dart';

/// Step 2 (AI Flow): Prompt OpenAI DALL-E 3 to generate a photorealistic bespoke cake design.
class AiCakeStudioStep extends StatefulWidget {
  const AiCakeStudioStep({super.key, required this.draft});

  final CustomOrderDraft draft;

  static Route<void> route(CustomOrderDraft draft) => MaterialPageRoute(
    settings: const RouteSettings(name: 'custom/ai'),
    builder: (_) => AiCakeStudioStep(draft: draft),
  );

  @override
  State<AiCakeStudioStep> createState() => _AiCakeStudioStepState();
}

class _AiCakeStudioStepState extends State<AiCakeStudioStep> {
  CustomOrderDraft get d => widget.draft;

  late final TextEditingController _promptController;
  bool _generating = false;
  String? _generatedUrl;
  String? _errorMessage;
  String? _statusMessage;
  bool _isDemo = false;
  int _variationIndex = 0;

  static const _samplePrompts = [
    'Two-tier pastel blush & ivory cake with edible flowers, gold leaf, and fresh raspberries',
    'Decadent triple chocolate truffle drip cake with French macarons and hazelnut crunch',
    'Whimsical pastel rainbow ombre buttercream cake with spun sugar clouds and pearls',
    'Rustic woodland forest cake with textured bark finish, fresh rosemary sprigs, and blackberries',
    'Minimalist emerald green and white wedding cake with geometric gold trim and orchids',
  ];

  static const _flavours = [
    'Vanilla Cream',
    'Chocolate Fudge',
    'Red Velvet',
    'Lemon Berry',
    'Salted Caramel',
  ];
  static const _colorThemes = [
    'Blush & Gold',
    'Dark & Moody',
    'Pastel Dream',
    'White & Foliage',
    'Vibrant Festive',
  ];

  String? _selectedFlavour;
  String? _selectedColor;

  @override
  void initState() {
    super.initState();
    final initialPrompt =
        d.aiPrompt ??
        (d.notes.isNotEmpty
            ? d.notes
            : (d.flavour.isNotEmpty
                  ? '${d.occasion} cake with ${d.flavour} flavour and ${d.colours} colours'
                  : ''));
    _promptController = TextEditingController(text: initialPrompt);
    _generatedUrl = d.designImageUrl;
    if (_generatedUrl != null) {
      d.isAiDesigned = true;
    }
  }

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _generateCake() async {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) {
      setState(
        () => _errorMessage = 'Please enter a description for your dream cake',
      );
      return;
    }

    setState(() {
      _generating = true;
      _errorMessage = null;
      _statusMessage = null;
    });

    try {
      final cake = await generateCakeVisual(
        prompt: prompt,
        occasion: d.occasion,
        flavour: _selectedFlavour ?? d.flavour,
        colours: _selectedColor ?? d.colours,
        theme: d.theme,
        sampleIndex: _variationIndex,
      );

      if (!mounted) return;

      setState(() {
        _generatedUrl = cake.url;
        _isDemo = cake.isDemo;
        _statusMessage = cake.message;
        _variationIndex++;
      });

      // Save into draft
      d
        ..designImageUrl = cake.url
        ..aiImageBytes = cake.imageBytes
        ..aiPrompt = prompt
        ..isAiDesigned = true
        ..useBuilder = false;

      if (_selectedFlavour != null && d.flavour.isEmpty) {
        d.flavour = _selectedFlavour!;
      }
      if (_selectedColor != null && d.colours.isEmpty) {
        d.colours = _selectedColor!;
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } on NetworkException catch (e) {
      if (mounted) setState(() => _errorMessage = e.toString());
    } catch (e) {
      if (mounted)
        setState(() => _errorMessage = 'Could not generate cake image: $e');
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  void _usePrompt(String text) {
    _promptController.text = text;
    setState(() => _errorMessage = null);
  }

  void _proceed() {
    if (_generatedUrl != null) {
      d
        ..designImageUrl = _generatedUrl
        ..aiPrompt = _promptController.text.trim()
        ..isAiDesigned = true
        ..useBuilder = false;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        settings: const RouteSettings(name: 'custom/3'),
        builder: (_) => PersonalStep(draft: d),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'AI Cake Studio',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          StepHeader(
            step: 2,
            title: 'Describe your dream cake',
            subtitle:
                'Our AI visualizer creates an artisanal preview to send directly to the baker.',
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Quick inspiration pills
                const FieldLabel('Inspiration ideas', optional: true),
                const SizedBox(height: 6),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final sample in _samplePrompts) ...[
                        ActionChip(
                          avatar: const Icon(
                            Icons.auto_awesome,
                            size: 16,
                            color: AppColors.accent,
                          ),
                          label: Text(
                            sample.length > 36
                                ? '${sample.substring(0, 34)}…'
                                : sample,
                            style: const TextStyle(fontSize: 13),
                          ),
                          backgroundColor: AppColors.surface,
                          side: const BorderSide(color: AppColors.lineStrong),
                          onPressed: () => _usePrompt(sample),
                        ),
                        const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Prompt Input Box
                const FieldLabel('What should the cake look like?'),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.lineStrong, width: 1.5),
                  ),
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    children: [
                      TextField(
                        controller: _promptController,
                        maxLines: 4,
                        minLines: 3,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          hintText:
                              'e.g. A 2-tier rustic wedding cake with blush pink frosting, fresh raspberries, rosemary sprigs and gold leaf accents',
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                      if (_promptController.text.isNotEmpty)
                        Align(
                          alignment: Alignment.centerRight,
                          child: InkWell(
                            onTap: () {
                              _promptController.clear();
                              setState(() {});
                            },
                            child: const Padding(
                              padding: EdgeInsets.only(top: 4),
                              child: Text(
                                'Clear',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.muted,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Optional flavor & color enhancers
                const FieldLabel('Flavor & palette cues', optional: true),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final f in _flavours)
                      ChoiceChip(
                        label: Text(f, style: const TextStyle(fontSize: 12)),
                        selected: _selectedFlavour == f,
                        onSelected: (selected) => setState(
                          () => _selectedFlavour = selected ? f : null,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final c in _colorThemes)
                      ChoiceChip(
                        label: Text(c, style: const TextStyle(fontSize: 12)),
                        selected: _selectedColor == c,
                        onSelected: (selected) => setState(
                          () => _selectedColor = selected ? c : null,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 20),

                // Generate Button
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: _generating ? null : _generateCake,
                  icon: _generating
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2.2,
                          ),
                        )
                      : const Icon(Icons.auto_awesome),
                  label: Text(
                    _generating
                        ? 'Visualizing your cake with AI…'
                        : (_generatedUrl == null
                              ? 'Generate Cake Design'
                              : '✨ Regenerate / Try Variation'),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),

                if (_errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withAlpha(20),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.error_outline,
                          color: AppColors.danger,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                              color: AppColors.danger,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Generated Preview Box
                if (_generatedUrl != null) ...[
                  const SizedBox(height: 24),
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: AppColors.accent.withAlpha(80),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.ink.withAlpha(15),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(19),
                          ),
                          child: AspectRatio(
                            aspectRatio: 1,
                            child: d.aiImageBytes != null
                                ? Image.memory(
                                    d.aiImageBytes!,
                                    fit: BoxFit.cover,
                                  )
                                : (_generatedUrl != null &&
                                          _generatedUrl!.startsWith('assets/')
                                      ? Image.asset(
                                          _generatedUrl!,
                                          fit: BoxFit.cover,
                                        )
                                      : Image.network(
                                          _generatedUrl!,
                                          fit: BoxFit.cover,
                                          loadingBuilder:
                                              (context, child, progress) {
                                                if (progress == null)
                                                  return child;
                                                return Container(
                                                  color: AppColors.sand,
                                                  alignment: Alignment.center,
                                                  child:
                                                      const CircularProgressIndicator(
                                                        strokeWidth: 2,
                                                      ),
                                                );
                                              },
                                          errorBuilder:
                                              (
                                                context,
                                                error,
                                                stackTrace,
                                              ) => Container(
                                                color: AppColors.sand,
                                                alignment: Alignment.center,
                                                child: const Column(
                                                  mainAxisSize:
                                                      MainAxisSize.min,
                                                  children: [
                                                    Icon(
                                                      Icons.cake_outlined,
                                                      color: AppColors.muted,
                                                      size: 36,
                                                    ),
                                                    SizedBox(height: 8),
                                                    Text(
                                                      'Cake Design Concept Ready',
                                                      style: TextStyle(
                                                        color: AppColors.muted,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                        )),
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
                                        SizedBox(width: 4),
                                        Text(
                                          'AI Custom Cake Concept',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.accent,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Spacer(),
                                  if (_isDemo)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.sand,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Text(
                                        'Demo Visualizer',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: AppColors.ink2,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'This AI-generated reference photo and your description will be sent directly to ${d.bakery.name} so their pastry chefs can bake it accurately.',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.ink2,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
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
          onPressed: _generating ? null : _proceed,
          child: Text(
            _generatedUrl == null
                ? 'Skip to Cake Details'
                : 'Continue with this Cake Design',
          ),
        ),
      ),
    );
  }
}
