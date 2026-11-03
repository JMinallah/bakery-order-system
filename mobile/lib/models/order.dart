const statusLabels = {
  'SUBMITTED': 'Sent',
  'QUOTED': 'Quote ready',
  'CONFIRMED': 'Confirmed',
  'PREPARING': 'Being made',
  'READY': 'Ready',
  'COMPLETED': 'Completed',
  'CANCELLED': 'Cancelled',
};

/// Customers can cancel until the bakery starts making the cake (backend order-rules.ts).
const customerCancellable = {'SUBMITTED', 'QUOTED', 'CONFIRMED'};

class Quotation {
  Quotation({
    required this.id,
    required this.amount,
    required this.createdAt,
    this.note,
    this.acceptedAt,
  });

  final String id;
  final int amount;
  final DateTime createdAt;
  final String? note;
  final DateTime? acceptedAt;

  factory Quotation.fromJson(Map<String, dynamic> json) => Quotation(
    id: json['id'] as String,
    amount: json['amount'] as int,
    createdAt: DateTime.parse(json['createdAt'] as String),
    note: json['note'] as String?,
    acceptedAt: json['acceptedAt'] == null
        ? null
        : DateTime.parse(json['acceptedAt'] as String),
  );
}

class OrderComment {
  OrderComment({
    required this.id,
    required this.body,
    required this.fromBakery,
    required this.createdAt,
  });

  final String id;
  final String body;
  final bool fromBakery;
  final DateTime createdAt;

  factory OrderComment.fromJson(Map<String, dynamic> json) => OrderComment(
    id: json['id'] as String,
    body: json['body'] as String,
    fromBakery: json['fromBakery'] as bool,
    createdAt: DateTime.parse(json['createdAt'] as String),
  );
}

class Order {
  Order({
    required this.id,
    required this.number,
    required this.type,
    required this.status,
    required this.currency,
    required this.dueDate,
    required this.fulfilment,
    required this.paymentStatus,
    required this.amountPaid,
    required this.bakeryName,
    required this.itemNames,
    required this.quotations,
    required this.selections,
    required this.comments,
    this.occasion,
    this.inscription,
    this.theme,
    this.notes,
    this.flavour,
    this.budget,
    this.estimate,
    this.total,
    this.deliveryArea,
    this.deliveryAddress,
    this.cancelReason,
    this.cancelledBy,
    this.bakeryPhone,
    this.mobileMoneyNumber,
    this.designImageUrl,
    this.inspirationImageUrls = const [],
  });

  final String id;
  final int number;
  final String type;
  final String status;
  final String currency;
  final DateTime dueDate;
  final String fulfilment;
  final String paymentStatus;
  final int amountPaid;
  final String bakeryName;
  final List<String> itemNames;

  /// Newest first.
  final List<Quotation> quotations;

  /// "Group: option" pairs from the cake builder, in order.
  final List<MapEntry<String, String>> selections;
  final List<OrderComment> comments;
  final String? occasion;
  final String? inscription;
  final String? theme;
  final String? notes;
  final String? flavour;
  final int? budget;
  final int? estimate;
  final int? total;
  final String? deliveryArea;
  final String? deliveryAddress;
  final String? cancelReason;
  final String? cancelledBy;
  final String? bakeryPhone;
  final String? mobileMoneyNumber;
  final String? designImageUrl;
  final List<String> inspirationImageUrls;

  bool get needsQuote => type != 'STANDARD';
  Quotation? get latestQuote => quotations.isEmpty ? null : quotations.first;

  /// "Birthday cake", or the product name for a ready made order.
  String get title {
    if (occasion != null && occasion!.isNotEmpty) return '$occasion cake';
    if (itemNames.length == 1) return itemNames.first;
    return type == 'BULK' ? 'Bulk order' : 'Custom cake';
  }

  factory Order.fromJson(Map<String, dynamic> json) {
    final bakery = json['bakery'] as Map<String, dynamic>? ?? const {};
    List<Map<String, dynamic>> list(String key) =>
        ((json[key] as List?) ?? const []).cast<Map<String, dynamic>>();
    return Order(
      id: json['id'] as String,
      number: json['number'] as int,
      type: json['type'] as String,
      status: json['status'] as String,
      currency: json['currency'] as String,
      dueDate: DateTime.parse(json['dueDate'] as String),
      fulfilment: json['fulfilment'] as String,
      paymentStatus: json['paymentStatus'] as String,
      amountPaid: json['amountPaid'] as int,
      bakeryName: bakery['name'] as String? ?? 'The bakery',
      bakeryPhone: bakery['phone'] as String?,
      mobileMoneyNumber: bakery['mobileMoneyNumber'] as String?,
      itemNames: list('items')
          .map((i) => (i['product'] as Map<String, dynamic>)['name'] as String)
          .toList(),
      quotations: list('quotations').map(Quotation.fromJson).toList(),
      selections: list('selections')
          .map(
            (s) =>
                MapEntry(s['groupName'] as String, s['optionName'] as String),
          )
          .toList(),
      comments: list('comments').map(OrderComment.fromJson).toList(),
      occasion: json['occasion'] as String?,
      inscription: json['inscription'] as String?,
      theme: json['theme'] as String?,
      notes: json['notes'] as String?,
      flavour: json['flavour'] as String?,
      budget: json['budget'] as int?,
      estimate: json['estimate'] as int?,
      total: json['total'] as int?,
      deliveryArea: json['deliveryArea'] as String?,
      deliveryAddress: json['deliveryAddress'] as String?,
      cancelReason: json['cancelReason'] as String?,
      cancelledBy: json['cancelledBy'] as String?,
      designImageUrl: json['designImageUrl'] as String?,
      inspirationImageUrls:
          ((json['inspirationImageUrls'] as List?) ?? const []).cast<String>(),
    );
  }
}
