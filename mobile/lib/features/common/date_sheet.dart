import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/bakery.dart';

/// Default handover times fallback if a bakery has no custom times configured.
const defaultHandoverTimes = [(10, 0), (14, 0), (17, 0)];

/// Which days can be picked. Custom cakes need an open slot; ready made ones only
/// need the bakery open and enough days to make them.
sealed class DateRule {}

class CustomCakeRule extends DateRule {}

class ReadyMadeRule extends DateRule {
  ReadyMadeRule(this.leadTimeDays);
  final int leadTimeDays;
}

/// Opens the date picker and returns the chosen due date and time, or null.
Future<DateTime?> pickDueDate(
  BuildContext context, {
  required Bakery bakery,
  required DateRule rule,
  DateTime? initial,
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _DateSheet(bakery: bakery, rule: rule, initial: initial),
  );
}

class _DateSheet extends StatefulWidget {
  const _DateSheet({required this.bakery, required this.rule, this.initial});

  final Bakery bakery;
  final DateRule rule;
  final DateTime? initial;

  @override
  State<_DateSheet> createState() => _DateSheetState();
}

class _DateSheetState extends State<_DateSheet> {
  late Future<List<CalendarDay>> _days = _load();
  late String? _picked = widget.initial == null
      ? null
      : dayKey(widget.initial!);
  List<(int, int)> get _times => widget.bakery.parsedHandoverTimes;
  late (int, int) _time = widget.initial == null
      ? (_times.isNotEmpty ? _times[0] : defaultHandoverTimes[1])
      : (widget.initial!.hour, widget.initial!.minute);
  int _month = 0;

  Future<List<CalendarDay>> _load() async {
    final data =
        await api.get('/bakeries/${widget.bakery.id}/availability?days=92')
            as List;
    return data
        .map((d) => CalendarDay.fromJson(d as Map<String, dynamic>))
        .toList();
  }

  bool _allowed(CalendarDay day) {
    return switch (widget.rule) {
      CustomCakeRule() => day.status == 'OPEN',
      ReadyMadeRule(:final leadTimeDays) =>
        day.status != 'CLOSED' &&
            day.status != 'BLOCKED' &&
            !fromDayKey(day.date).isBefore(
              DateUtils.dateOnly(
                DateTime.now(),
              ).add(Duration(days: leadTimeDays)),
            ),
    };
  }

  String _why(CalendarDay day) => switch (day.status) {
    'CLOSED' => 'closed',
    'BLOCKED' => 'not taking orders',
    'FULL' => 'fully booked',
    _ => 'too soon',
  };

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: FutureBuilder(
          future: _days,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              final offline = snapshot.error is NetworkException;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      offline
                          ? 'Connect to the internet to see which days the bakery has free.'
                          : snapshot.error.toString(),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: () {
                        final next = _load();
                        setState(() {
                          _days = next;
                        });
                      },
                      child: const Text('Try again'),
                    ),
                  ],
                ),
              );
            }
            if (!snapshot.hasData)
              return const Padding(
                padding: EdgeInsets.all(48),
                child: Center(child: CircularProgressIndicator()),
              );
            return _calendar(context, snapshot.data!);
          },
        ),
      ),
    );
  }

  Widget _calendar(BuildContext context, List<CalendarDay> days) {
    final byKey = {for (final d in days) d.date: d};
    final first = fromDayKey(days.first.date);
    final month = DateTime(first.year, first.month + _month);
    final lastMonth = fromDayKey(days.last.date);
    final canNext = DateTime(
      month.year,
      month.month + 1,
    ).isBefore(DateTime(lastMonth.year, lastMonth.month + 1));
    final leading = DateTime(month.year, month.month, 1).weekday - 1;
    final count = DateUtils.getDaysInMonth(month.year, month.month);
    final picked = _picked == null ? null : byKey[_picked];
    final chosen = picked != null && _allowed(picked);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'When do you need it?',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            IconButton(
              onPressed: _month > 0 ? () => setState(() => _month--) : null,
              icon: const Icon(Icons.chevron_left),
              tooltip: 'Previous month',
            ),
            Expanded(
              child: Text(
                '${monthNames[month.month - 1]} ${month.year}',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton(
              onPressed: canNext ? () => setState(() => _month++) : null,
              icon: const Icon(Icons.chevron_right),
              tooltip: 'Next month',
            ),
          ],
        ),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            for (final d in ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
              Center(
                child: Text(
                  d,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.muted,
                  ),
                ),
              ),
            for (var i = 0; i < leading; i++) const SizedBox.shrink(),
            for (var n = 1; n <= count; n++)
              _dayCell(byKey[dayKey(DateTime(month.year, month.month, n))], n),
          ],
        ),
        const SizedBox(height: 4),
        const Wrap(
          spacing: 16,
          children: [
            Text(
              'Greyed out: closed, fully booked or too soon',
              style: TextStyle(fontSize: 13, color: AppColors.ink2),
            ),
          ],
        ),
        const Divider(height: 28),
        const Text(
          'Time',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final t in _times)
              ChoiceChip(
                label: Text(timeLabel(DateTime(2000, 1, 1, t.$1, t.$2))),
                selected: _time == t,
                onSelected: (_) => setState(() => _time = t),
              ),
          ],
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: chosen
              ? () {
                  final day = fromDayKey(_picked!);
                  Navigator.of(context).pop(
                    DateTime(day.year, day.month, day.day, _time.$1, _time.$2),
                  );
                }
              : null,
          child: Text(
            chosen
                ? 'Choose ${dayLabel(fromDayKey(_picked!))}, ${timeLabel(DateTime(2000, 1, 1, _time.$1, _time.$2))}'
                : 'Pick a day',
          ),
        ),
      ],
    );
  }

  Widget _dayCell(CalendarDay? day, int n) {
    if (day == null) {
      return Center(
        child: Text('$n', style: const TextStyle(color: Color(0xFFB9A89D))),
      );
    }
    final allowed = _allowed(day);
    final selected = day.date == _picked;
    return Semantics(
      button: true,
      enabled: allowed,
      selected: selected,
      label:
          '${dayLabel(fromDayKey(day.date))}${allowed ? '' : ', ${_why(day)}'}',
      child: InkResponse(
        onTap: allowed ? () => setState(() => _picked = day.date) : null,
        radius: 22,
        child: Center(
          child: Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? AppColors.accent : null,
              shape: BoxShape.circle,
            ),
            child: Text(
              '$n',
              style: TextStyle(
                fontSize: 15,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? Colors.white
                    : allowed
                    ? AppColors.ink
                    : const Color(0xFFB9A89D),
                decoration: day.status == 'FULL'
                    ? TextDecoration.lineThrough
                    : null,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
