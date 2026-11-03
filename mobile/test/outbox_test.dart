import 'dart:convert';

import 'package:bakery_orders/core/api_client.dart';
import 'package:bakery_orders/features/outbox/outbox.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A fake backend: offline until [online] is set, records every POST /orders body.
class FakeBackend {
  bool online = false;
  String? refuseWith;
  final posted = <Map<String, dynamic>>[];

  late final client = MockClient((request) async {
    if (!online) throw http.ClientException('No connection');
    final body = jsonDecode(request.body) as Map<String, dynamic>;
    posted.add(body);
    if (refuseWith != null)
      return http.Response(jsonEncode({'error': refuseWith}), 409);
    return http.Response(jsonEncode(orderJson), 201);
  });
}

final orderJson = {
  'id': 'o1',
  'number': 1043,
  'type': 'CUSTOM',
  'status': 'SUBMITTED',
  'currency': 'UGX',
  'dueDate': '2026-11-07T11:00:00.000Z',
  'fulfilment': 'PICKUP',
  'paymentStatus': 'UNPAID',
  'amountPaid': 0,
  'bakery': {'name': 'Sweet Crumbs Bakery'},
};

void main() {
  late FakeBackend backend;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    backend = FakeBackend();
    api = ApiClient(client: backend.client);
    Outbox.instance.reset();
  });

  test('sends straight away when online', () async {
    backend.online = true;
    final result = await Outbox.instance.submit(
      {'bakeryId': 'b1'},
      title: 'Birthday cake',
      bakeryName: 'Sweet Crumbs',
    );
    expect(result, isA<Sent>());
    expect((result as Sent).order.number, 1043);
    expect(Outbox.instance.items, isEmpty);
  });

  test(
    'keeps the order on the phone when offline, then sends it with the same id',
    () async {
      final result = await Outbox.instance.submit(
        {'bakeryId': 'b1'},
        title: 'Birthday cake',
        bakeryName: 'Sweet Crumbs',
      );
      expect(result, isA<Queued>());
      expect(Outbox.instance.waiting, hasLength(1));

      // Still offline: nothing is lost.
      expect(await Outbox.instance.flush(), 0);
      expect(Outbox.instance.waiting, hasLength(1));

      backend.online = true;
      expect(await Outbox.instance.flush(), 1);
      expect(Outbox.instance.items, isEmpty);
      expect(
        backend.posted.single['clientRequestId'],
        (result as Queued).item.clientRequestId,
      );
    },
  );

  test('survives the app closing', () async {
    await Outbox.instance.submit(
      {'bakeryId': 'b1'},
      title: 'Birthday cake',
      bakeryName: 'Sweet Crumbs',
    );
    Outbox.instance.reset();
    expect(Outbox.instance.items, isEmpty);

    await Outbox.instance.start();
    expect(Outbox.instance.waiting, hasLength(1));
  });

  test('backs off after repeated network failures', () async {
    await Outbox.instance.submit(
      {'bakeryId': 'b1'},
      title: 'Birthday cake',
      bakeryName: 'Sweet Crumbs',
    );
    expect(await Outbox.instance.flush(), 0);
    expect(Outbox.instance.retryDelay, const Duration(seconds: 60));

    backend.online = true;
    expect(await Outbox.instance.flush(), 1);
    expect(Outbox.instance.retryDelay, const Duration(seconds: 30));
  });

  test('keeps the reason when the bakery refuses a saved order', () async {
    await Outbox.instance.submit(
      {'bakeryId': 'b1'},
      title: 'Birthday cake',
      bakeryName: 'Sweet Crumbs',
    );
    backend
      ..online = true
      ..refuseWith = 'That day is fully booked. Please pick another date';
    await Outbox.instance.flush();
    expect(Outbox.instance.items.single.error, contains('fully booked'));
    expect(
      Outbox.instance.waiting,
      isEmpty,
      reason: "a refused order isn't retried forever",
    );
  });

  test('shows the bakery refusing a new order instead of saving it', () async {
    backend
      ..online = true
      ..refuseWith = 'That day is fully booked';
    expect(
      () => Outbox.instance.submit(
        {'bakeryId': 'b1'},
        title: 'Birthday cake',
        bakeryName: 'Sweet Crumbs',
      ),
      throwsA(isA<ApiException>()),
    );
  });
}
