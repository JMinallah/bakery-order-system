import 'dart:math';

import 'package:bakery_orders/core/format.dart';
import 'package:bakery_orders/features/custom_order/builder_rules.dart';
import 'package:bakery_orders/features/outbox/outbox.dart';
import 'package:bakery_orders/models/builder.dart';
import 'package:bakery_orders/models/product.dart';
import 'package:flutter_test/flutter_test.dart';

OptionGroup makeGroup(
  String id,
  String kind,
  List<BuilderOption> options, {
  bool multiple = false,
  bool required = false,
}) => OptionGroup(
  id: id,
  kind: kind,
  name: id,
  multiple: multiple,
  required: required,
  options: options,
);

BuilderOption option(String id, {int price = 0, String? value, int? serves}) =>
    BuilderOption(id: id, name: id, price: price, value: value, serves: serves);

final groups = [
  makeGroup('Shape', 'SHAPE', [
    option('Round', value: 'ROUND'),
    option('Square', value: 'SQUARE'),
  ], required: true),
  makeGroup('Tiers', 'TIERS', [
    option('1 tier', value: '1'),
    option('2 tiers', value: '2', price: 30000),
  ], required: true),
  makeGroup('Size', 'SIZE', [
    option('1 kg', price: 60000, serves: 8),
    option('2 kg', price: 110000, serves: 16),
  ], required: true),
  makeGroup('Flavour', 'FLAVOUR', [
    option('Vanilla'),
    option('Red velvet', price: 10000),
  ], required: true),
  makeGroup('Icing colour', 'ICING_COLOUR', [
    option('Blush pink', value: '#F5B8C9'),
  ], required: true),
  makeGroup('Decorations', 'DECORATION', [
    option('Pearls', price: 10000, value: 'pearls'),
    option('Fresh flowers', price: 15000, value: 'flowers'),
  ], multiple: true),
];

void main() {
  group('builder rules', () {
    test(
      'required groups start with their first option, so the cake is complete',
      () {
        final s = defaultSelection(groups);
        expect(missingRequired(groups, s), isEmpty);
        expect(estimate(groups, s), 60000);
        expect(s['Decorations'], isEmpty);
      },
    );

    test('starting from a product picks its flavour and size', () {
      final product = Product(
        id: 'p',
        name: 'Red velvet cake',
        category: 'CAKE',
        price: 85000,
        leadTimeDays: 2,
        customisable: true,
        sizeLabel: '2 kg',
      );
      final s = defaultSelection(groups, basedOn: product);
      expect(s['Flavour'], {'Red velvet'});
      expect(s['Size'], {'2 kg'});
    });

    test(
      'single choice groups swap, multiple ones toggle, required ones never empty',
      () {
        var s = defaultSelection(groups);
        s = toggle(s, groups[2], groups[2].options[1]);
        expect(s['Size'], {'2 kg'});
        s = toggle(s, groups[2], groups[2].options[1]);
        expect(s['Size'], {
          '2 kg',
        }, reason: 'tapping the chosen size again keeps it');
        s = toggle(s, groups[5], groups[5].options[0]);
        s = toggle(s, groups[5], groups[5].options[1]);
        expect(s['Decorations'], {'Pearls', 'Fresh flowers'});
        s = toggle(s, groups[5], groups[5].options[0]);
        expect(s['Decorations'], {'Fresh flowers'});
      },
    );

    test('adds up the estimate like the backend', () {
      var s = defaultSelection(groups);
      s = toggle(s, groups[1], groups[1].options[1]);
      s = toggle(s, groups[2], groups[2].options[1]);
      s = toggle(s, groups[5], groups[5].options[0]);
      s = toggle(s, groups[5], groups[5].options[1]);
      expect(estimate(groups, s), 165000);
    });

    test('describes the cake in words', () {
      var s = defaultSelection(groups);
      s = toggle(s, groups[5], groups[5].options[0]);
      s = toggle(s, groups[5], groups[5].options[1]);
      expect(
        describe(groups, s),
        'Round, 1 tier, 1 kg, vanilla, blush pink, with pearls and fresh flowers',
      );
    });

    test('turns choices into what the preview draws', () {
      var s = defaultSelection(groups);
      s = toggle(s, groups[0], groups[0].options[1]);
      s = toggle(s, groups[1], groups[1].options[1]);
      s = toggle(s, groups[5], groups[5].options[0]);
      final look = lookFor(groups, s);
      expect(look.round, isFalse);
      expect(look.tiers, 2);
      expect(look.colour.toARGB32(), 0xFFF5B8C9);
      expect(look.decorations, {'pearls'});
    });
  });

  group('format', () {
    test('money', () {
      expect(money(165000, 'UGX'), 'UGX 165,000');
      expect(money(500, 'UGX'), 'UGX 500');
    });

    test('dates', () {
      final date = DateTime(2026, 11, 7, 14);
      expect(dayLabel(date), 'Sat 7 Nov');
      expect(timeLabel(date), '2:00 pm');
      expect(timeLabel(DateTime(2026, 11, 7, 0, 5)), '12:05 am');
      expect(dayKey(date), '2026-11-07');
      expect(fromDayKey('2026-11-07'), DateTime(2026, 11, 7));
      expect(orderRef(1043), 'BK1043');
    });
  });

  test('request ids are version 4 UUIDs and differ each time', () {
    final a = newRequestId(Random(1));
    final b = newRequestId(Random(2));
    expect(
      a,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
    expect(a, isNot(b));
  });
}
