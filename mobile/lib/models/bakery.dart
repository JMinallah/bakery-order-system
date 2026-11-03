/// A bakery as customers see it (GET /bakeries).
class Bakery {
  Bakery({
    required this.id,
    required this.slug,
    required this.name,
    required this.city,
    required this.currency,
    required this.deliveryAreas,
    required this.deliveryFee,
    required this.pickupAvailable,
    required this.acceptsCash,
    required this.acceptsMobileMoney,
    this.about,
    this.phone,
    this.address,
    this.imageUrl,
    this.mobileMoneyNumber,
    this.cakesFrom,
    this.nextCustomDate,
    this.handoverTimes = const ['10:00', '14:00', '17:00'],
    this.occasions = const [
      'Birthday',
      'Wedding',
      'Introduction',
      'Graduation',
      'Baby shower',
      'Other',
    ],
    this.customNoticeDays = 3,
  });

  final String id;
  final String slug;
  final String name;
  final String city;
  final String currency;
  final List<String> deliveryAreas;
  final int deliveryFee;
  final bool pickupAvailable;
  final bool acceptsCash;
  final bool acceptsMobileMoney;
  final String? about;
  final String? phone;
  final String? address;
  final String? imageUrl;
  final String? mobileMoneyNumber;
  final int? cakesFrom;

  /// "2026-10-20": the first day a new custom cake could be due.
  final String? nextCustomDate;

  /// Time slots set by the bakery for collection or delivery (e.g. "09:00", "14:00").
  final List<String> handoverTimes;

  /// Celebration occasions offered by this bakery for custom designs.
  final List<String> occasions;

  /// Number of days notice required for custom bespoke cakes.
  final int customNoticeDays;

  bool deliversTo(String area) =>
      deliveryAreas.any((a) => a.toLowerCase() == area.toLowerCase());

  /// Parses string time slots ("HH:MM") into (hour, minute) tuples for UI chips and pickers.
  List<(int, int)> get parsedHandoverTimes {
    if (handoverTimes.isEmpty) return const [(10, 0), (14, 0), (17, 0)];
    final result = <(int, int)>[];
    for (final t in handoverTimes) {
      final parts = t.split(':');
      if (parts.length == 2) {
        final h = int.tryParse(parts[0]);
        final m = int.tryParse(parts[1]);
        if (h != null && m != null) {
          result.add((h, m));
        }
      }
    }
    return result.isEmpty ? const [(10, 0), (14, 0), (17, 0)] : result;
  }

  factory Bakery.fromJson(Map<String, dynamic> json) => Bakery(
    id: json['id'] as String,
    slug: json['slug'] as String,
    name: json['name'] as String,
    city: json['city'] as String,
    currency: json['currency'] as String,
    deliveryAreas: (json['deliveryAreas'] as List).cast<String>(),
    deliveryFee: json['deliveryFee'] as int,
    pickupAvailable: json['pickupAvailable'] as bool,
    acceptsCash: json['acceptsCash'] as bool,
    acceptsMobileMoney: json['acceptsMobileMoney'] as bool,
    about: json['about'] as String?,
    phone: json['phone'] as String?,
    address: json['address'] as String?,
    imageUrl: json['imageUrl'] as String?,
    mobileMoneyNumber: json['mobileMoneyNumber'] as String?,
    cakesFrom: json['cakesFrom'] as int?,
    nextCustomDate: json['nextCustomDate'] as String?,
    handoverTimes:
        (json['handoverTimes'] as List?)?.cast<String>() ??
        const ['10:00', '14:00', '17:00'],
    occasions:
        (json['occasions'] as List?)?.cast<String>() ??
        const [
          'Birthday',
          'Wedding',
          'Introduction',
          'Graduation',
          'Baby shower',
          'Other',
        ],
    customNoticeDays: json['customNoticeDays'] as int? ?? 3,
  );
}

/// One day in GET /bakeries/:id/availability.
class CalendarDay {
  CalendarDay({
    required this.date,
    required this.status,
    required this.booked,
    required this.limit,
  });

  /// "2026-11-07"
  final String date;

  /// OPEN, FULL, CLOSED, BLOCKED or TOO_SOON
  final String status;
  final int booked;
  final int limit;

  factory CalendarDay.fromJson(Map<String, dynamic> json) => CalendarDay(
    date: json['date'] as String,
    status: json['status'] as String,
    booked: json['booked'] as int,
    limit: json['limit'] as int,
  );
}
