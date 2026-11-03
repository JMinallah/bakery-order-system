import 'dart:ui' show Color;

import '../../models/builder.dart';
import '../../models/product.dart';

/// Picked option ids per group id. Pure functions here, so the rules match the
/// backend's (backend/src/modules/builder/selection.ts) and are easy to test.
typedef Selection = Map<String, Set<String>>;

/// Required groups start with their first option, so the preview shows a whole cake
/// and Continue works straight away. Starting from a product picks the matching flavour and size.
Selection defaultSelection(List<OptionGroup> groups, {Product? basedOn}) {
  final selection = <String, Set<String>>{};
  for (final group in groups) {
    final match = basedOn == null ? null : _matching(group, basedOn);
    if (match != null) {
      selection[group.id] = {match.id};
    } else if (group.required && group.options.isNotEmpty) {
      selection[group.id] = {group.options.first.id};
    } else {
      selection[group.id] = {};
    }
  }
  return selection;
}

BuilderOption? _matching(OptionGroup group, Product product) {
  final name = product.name.toLowerCase();
  for (final option in group.options) {
    final optionName = option.name.toLowerCase();
    if (group.kind == 'FLAVOUR' && name.contains(optionName)) return option;
    if (group.kind == 'SIZE' && product.sizeLabel?.toLowerCase() == optionName)
      return option;
  }
  return null;
}

/// Picking in a single choice group replaces the choice; in a multiple one it toggles.
/// A required single choice can't be emptied.
Selection toggle(Selection selection, OptionGroup group, BuilderOption option) {
  final current = selection[group.id] ?? {};
  final Set<String> next;
  if (group.multiple) {
    next = current.contains(option.id)
        ? ({...current}..remove(option.id))
        : {...current, option.id};
  } else {
    next = current.contains(option.id) && !group.required ? {} : {option.id};
  }
  return {...selection, group.id: next};
}

List<BuilderOption> picked(List<OptionGroup> groups, Selection selection) => [
  for (final g in groups)
    for (final o in g.options)
      if (selection[g.id]?.contains(o.id) ?? false) o,
];

int estimate(List<OptionGroup> groups, Selection selection) =>
    picked(groups, selection).fold(0, (sum, o) => sum + o.price);

List<String> missingRequired(List<OptionGroup> groups, Selection selection) => [
  for (final g in groups)
    if (g.required && (selection[g.id]?.isEmpty ?? true)) g.name,
];

/// "Round, 2 tiers, 2 kg, vanilla, blush pink, with pearls and flowers"
String describe(List<OptionGroup> groups, Selection selection) {
  final main = <String>[];
  final extras = <String>[];
  for (final g in groups) {
    final names = g.options
        .where((o) => selection[g.id]?.contains(o.id) ?? false)
        .map((o) => o.name);
    if (g.kind == 'DECORATION') {
      extras.addAll(names.map((n) => n.toLowerCase()));
    } else {
      main.addAll(names.map((n) => main.isEmpty ? n : n.toLowerCase()));
    }
  }
  if (extras.isEmpty) return main.join(', ');
  final last = extras.removeLast();
  final joined = extras.isEmpty ? last : '${extras.join(', ')} and $last';
  return '${main.join(', ')}${main.isEmpty ? 'With' : ', with'} $joined';
}

/// What the preview needs to draw.
class CakeLook {
  const CakeLook({
    required this.round,
    required this.tiers,
    required this.colour,
    required this.decorations,
  });

  final bool round;
  final int tiers;
  final Color colour;
  final Set<String> decorations;

  static const plain = CakeLook(
    round: true,
    tiers: 1,
    colour: Color(0xFFFBEFD9),
    decorations: {},
  );
}

CakeLook lookFor(List<OptionGroup> groups, Selection selection) {
  const plain = CakeLook.plain;
  var round = plain.round;
  var tiers = plain.tiers;
  var colour = plain.colour;
  final decorations = <String>{};
  for (final g in groups) {
    for (final o in g.options.where(
      (o) => selection[g.id]?.contains(o.id) ?? false,
    )) {
      final value = o.value ?? '';
      switch (g.kind) {
        case 'SHAPE':
          round = value.toUpperCase() != 'SQUARE';
        case 'TIERS':
          tiers = (int.tryParse(value) ?? 1).clamp(1, 3);
        case 'ICING_COLOUR':
          colour = parseHex(value) ?? colour;
        case 'DECORATION':
          decorations.add(value.toLowerCase());
      }
    }
  }
  return CakeLook(
    round: round,
    tiers: tiers,
    colour: colour,
    decorations: decorations,
  );
}

Color? parseHex(String value) {
  final hex = value.replaceFirst('#', '');
  if (hex.length != 6) return null;
  final n = int.tryParse(hex, radix: 16);
  return n == null ? null : Color(0xFF000000 | n);
}
