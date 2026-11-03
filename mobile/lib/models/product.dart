const categoryLabels = {
  'CAKE': 'Cakes',
  'CUPCAKE': 'Cupcakes',
  'BREAD': 'Bread',
  'PASTRY': 'Pastries',
  'COOKIE': 'Cookies',
  'EXTRA': 'Extras',
};

class Product {
  Product({
    required this.id,
    required this.name,
    required this.category,
    required this.price,
    required this.leadTimeDays,
    required this.customisable,
    this.description,
    this.imageUrl,
    this.sizeLabel,
    this.serves,
  });

  final String id;
  final String name;
  final String category;
  final int price;
  final int leadTimeDays;

  /// Can be opened in the cake builder and changed.
  final bool customisable;
  final String? description;
  final String? imageUrl;
  final String? sizeLabel;
  final int? serves;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
    id: json['id'] as String,
    name: json['name'] as String,
    category: json['category'] as String,
    price: json['price'] as int,
    leadTimeDays: json['leadTimeDays'] as int,
    customisable: json['customisable'] as bool,
    description: json['description'] as String?,
    imageUrl: json['imageUrl'] as String?,
    sizeLabel: json['sizeLabel'] as String?,
    serves: json['serves'] as int?,
  );
}
