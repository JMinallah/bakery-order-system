// Formatting shared by every screen. Dates are shown in the phone's timezone,
// which for the pilot is the bakery's (Africa/Kampala).

const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// "UGX 165,000". Amounts are whole units of the bakery's currency.
String money(int amount, String currency) {
  final digits = amount.abs().toString();
  final grouped = digits.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => ',',
  );
  return '$currency ${amount < 0 ? '-' : ''}$grouped';
}

/// "Sat 7 Nov"
String dayLabel(DateTime date) {
  final d = date.toLocal();
  return '${_weekdays[d.weekday - 1]} ${d.day} ${_months[d.month - 1]}';
}

/// "2:00 pm"
String timeLabel(DateTime date) {
  final d = date.toLocal();
  final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '$hour:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'am' : 'pm'}';
}

/// "Sat 7 Nov, 2:00 pm"
String dateTimeLabel(DateTime date) => '${dayLabel(date)}, ${timeLabel(date)}';

/// "2026-11-07", the format the API uses for calendar days.
String dayKey(DateTime date) {
  final d = date.toLocal();
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

/// The local date for a "2026-11-07" key.
DateTime fromDayKey(String key) {
  final parts = key.split('-').map(int.parse).toList();
  return DateTime(parts[0], parts[1], parts[2]);
}

/// "BK1043"
String orderRef(int number) => 'BK$number';
