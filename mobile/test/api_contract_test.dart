import 'dart:convert';
import 'dart:io';

import 'package:bakery_orders/features/custom_order/builder_rules.dart';
import 'package:bakery_orders/models/bakery.dart';
import 'package:bakery_orders/models/builder.dart';
import 'package:bakery_orders/models/order.dart';
import 'package:bakery_orders/models/product.dart';
import 'package:flutter_test/flutter_test.dart';

/// The files in test/fixtures are real responses recorded from the backend with its
/// seed data. If the API changes shape, these tests fail before the app does.
/// To record them again, see test/fixtures/README.md.
dynamic fixture(String name) =>
    jsonDecode(File('test/fixtures/$name.json').readAsStringSync());

void main() {
  test('bakeries parse, and only some deliver everywhere', () {
    final bakeries = (fixture('bakeries') as List)
        .map((b) => Bakery.fromJson(b as Map<String, dynamic>))
        .toList();
    expect(
      bakeries.map((b) => b.slug),
      containsAll(['sweet-crumbs', 'mamas-oven']),
    );
    final sweetCrumbs = bakeries.firstWhere((b) => b.slug == 'sweet-crumbs');
    expect(sweetCrumbs.deliversTo('Kyanja'), isTrue);
    expect(
      bakeries.firstWhere((b) => b.slug == 'mamas-oven').deliversTo('Kyanja'),
      isFalse,
    );
    expect(sweetCrumbs.nextCustomDate, isNotNull);
  });

  test('products parse, with hidden ones left out by the API', () {
    final products = (fixture('products') as List)
        .map((p) => Product.fromJson(p as Map<String, dynamic>))
        .toList();
    expect(products, isNotEmpty);
    expect(products.any((p) => p.customisable), isTrue);
    expect(products.map((p) => p.name), isNot(contains('Number candles')));
  });

  test('the real builder gives the same estimate as the backend', () {
    final groups = (fixture('builder') as List)
        .map((g) => OptionGroup.fromJson(g as Map<String, dynamic>))
        .toList();
    expect(
      groups.map((g) => g.kind),
      containsAll([
        'SHAPE',
        'TIERS',
        'SIZE',
        'FLAVOUR',
        'ICING_COLOUR',
        'DECORATION',
      ]),
    );
    expect(
      groups.expand((g) => g.options).map((o) => o.name),
      isNot(contains('Edible gold leaf')),
      reason: 'out of stock',
    );

    var selection = defaultSelection(groups);
    void choose(String group, String name) {
      final g = groups.firstWhere((g) => g.name == group);
      selection = toggle(
        selection,
        g,
        g.options.firstWhere((o) => o.name == name),
      );
    }

    choose('Tiers', '2 tiers');
    choose('Size', '2 kg');
    choose('Icing colour', 'Blush pink');
    choose('Decorations', 'Pearls');
    choose('Decorations', 'Fresh flowers');

    final order = Order.fromJson(
      fixture('order_detail_quoted') as Map<String, dynamic>,
    );
    expect(
      estimate(groups, selection),
      order.estimate,
      reason: 'the order fixture was placed with these choices',
    );
    expect(lookFor(groups, selection).tiers, 2);
  });

  test('calendar days parse', () {
    final days = (fixture('availability') as List)
        .map((d) => CalendarDay.fromJson(d as Map<String, dynamic>))
        .toList();
    expect(days, hasLength(42));
    expect(
      days.map((d) => d.status).toSet(),
      contains('CLOSED'),
      reason: 'the seeded bakery closes on Sundays',
    );
  });

  test('a quoted order parses with its quote, choices and messages', () {
    final order = Order.fromJson(
      fixture('order_detail_quoted') as Map<String, dynamic>,
    );
    expect(order.status, 'QUOTED');
    expect(order.title, 'Birthday cake');
    expect(order.latestQuote!.amount, 165000);
    expect(order.selections.map((s) => s.key), contains('Decorations'));
    expect(order.comments.map((c) => c.fromBakery), [false, true]);
    expect(order.bakeryName, 'Sweet Crumbs Bakery');
  });

  test('the order list shape parses too', () {
    final orders = (fixture('my_orders') as List)
        .map((o) => Order.fromJson(o as Map<String, dynamic>))
        .toList();
    expect(orders.single.latestQuote, isNotNull);
  });
}
