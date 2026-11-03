/// A choice in the cake builder (GET /bakeries/:id/builder).
class BuilderOption {
  BuilderOption({
    required this.id,
    required this.name,
    required this.price,
    this.value,
    this.serves,
    this.imageUrl,
  });

  final String id;
  final String name;

  /// Added to the estimate when picked. Sizes carry the base price.
  final int price;

  /// Drawing hint: "ROUND", "2", "#F5B8C9", "pearls".
  final String? value;
  final int? serves;
  final String? imageUrl;

  factory BuilderOption.fromJson(Map<String, dynamic> json) => BuilderOption(
    id: json['id'] as String,
    name: json['name'] as String,
    price: json['price'] as int,
    value: json['value'] as String?,
    serves: json['serves'] as int?,
    imageUrl: json['imageUrl'] as String?,
  );
}

class OptionGroup {
  OptionGroup({
    required this.id,
    required this.kind,
    required this.name,
    required this.multiple,
    required this.required,
    required this.options,
  });

  final String id;

  /// SHAPE, TIERS, SIZE, FLAVOUR, ICING_COLOUR, DECORATION or OTHER
  final String kind;
  final String name;
  final bool multiple;
  final bool required;
  final List<BuilderOption> options;

  factory OptionGroup.fromJson(Map<String, dynamic> json) => OptionGroup(
    id: json['id'] as String,
    kind: json['kind'] as String,
    name: json['name'] as String,
    multiple: json['multiple'] as bool,
    required: json['required'] as bool,
    options: (json['options'] as List)
        .map((o) => BuilderOption.fromJson(o as Map<String, dynamic>))
        .toList(),
  );
}
