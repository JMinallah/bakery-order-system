import 'dart:typed_data';

import '../../models/bakery.dart';
import '../../models/builder.dart';
import '../../models/product.dart';
import 'builder_rules.dart' as rules;

/// Everything the customer has chosen so far in the custom order steps.
/// One object is passed through every step, so going back keeps their answers.
class CustomOrderDraft {
  CustomOrderDraft({required this.bakery, this.basedOn});

  final Bakery bakery;

  /// Set when the customer tapped "Customise this cake" on a product.
  final Product? basedOn;

  String occasion = 'Birthday';
  bool useBuilder = true;
  bool bulk = false;

  List<OptionGroup> groups = [];
  rules.Selection selection = {};

  // Used when the customer describes the cake instead of building it.
  String flavour = '';
  String size = '';
  String colours = '';

  /// Inspiration photos, uploaded as soon as they're picked. The bytes are kept for previews.
  List<({Uint8List bytes, String url})> photos = [];

  /// A picture of the cake design (builder preview or AI-generated design).
  String? designImageUrl;

  /// Prompt used for OpenAI cake generation.
  String? aiPrompt;

  /// Raw image bytes from AI generation, kept so they can be uploaded to the bakery server.
  Uint8List? aiImageBytes;

  /// True when this cake was visualized or designed via AI Studio.
  bool isAiDesigned = false;

  String inscription = '';
  String theme = '';
  String notes = '';

  DateTime? dueDate;
  String fulfilment = 'DELIVERY';
  String? deliveryArea;
  String deliveryAddress = '';
  int? budget;

  bool get hasChanges =>
      groups.isNotEmpty ||
      inscription.isNotEmpty ||
      notes.isNotEmpty ||
      flavour.isNotEmpty ||
      (aiPrompt != null && aiPrompt!.isNotEmpty);

  int? get estimate => useBuilder && groups.isNotEmpty
      ? rules.estimate(groups, selection)
      : null;

  String get title => '$occasion cake';

  String get designSummary {
    if (isAiDesigned && aiPrompt != null && aiPrompt!.trim().isNotEmpty) {
      return 'AI Design: "${aiPrompt!.trim()}"';
    }
    if (useBuilder && groups.isNotEmpty)
      return rules.describe(groups, selection);
    final parts = [
      flavour,
      size,
      colours,
    ].where((p) => p.trim().isNotEmpty).join(', ');
    return parts.isEmpty ? 'Described in your own words' : parts;
  }

  /// The body for POST /orders (docs/api.md). The outbox adds clientRequestId.
  Map<String, dynamic> toJson() {
    String? text(String value) => value.trim().isEmpty ? null : value.trim();
    return {
      'bakeryId': bakery.id,
      'type': bulk ? 'BULK' : 'CUSTOM',
      'occasion': occasion,
      if (!useBuilder) ...{
        'flavour': text(flavour),
        'size': text(size),
        'colours': text(colours),
      },
      'inscription': text(inscription),
      'theme': text(theme),
      'notes': text(notes),
      'budget': budget,
      'dueDate': dueDate!.toUtc().toIso8601String(),
      'fulfilment': fulfilment,
      if (fulfilment == 'DELIVERY') ...{
        'deliveryArea': deliveryArea,
        'deliveryAddress': text(deliveryAddress),
      },
      if (photos.isNotEmpty)
        'inspirationImageUrls': [for (final p in photos) p.url],
      'designImageUrl': designImageUrl,
      'optionIds': useBuilder
          ? [for (final o in rules.picked(groups, selection)) o.id]
          : <String>[],
      'items': [
        if (basedOn != null) {'productId': basedOn!.id, 'quantity': 1},
      ],
    }..removeWhere((_, value) => value == null);
  }
}
