import 'dart:convert';

import 'package:bakery_orders/core/api_client.dart';
import 'package:bakery_orders/core/theme.dart';
import 'package:bakery_orders/features/custom_order/builder_step.dart';
import 'package:bakery_orders/features/custom_order/draft.dart';
import 'package:bakery_orders/models/bakery.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models_and_draft_test.dart' show bakeryJson;

final builderJson = [
  {
    'id': 'size',
    'kind': 'SIZE',
    'name': 'Size',
    'multiple': false,
    'required': true,
    'options': [
      {'id': '1kg', 'name': '1 kg', 'price': 60000, 'serves': 8},
      {'id': '2kg', 'name': '2 kg', 'price': 110000, 'serves': 16},
    ],
  },
  {
    'id': 'deco',
    'kind': 'DECORATION',
    'name': 'Decorations',
    'multiple': true,
    'required': false,
    'options': [
      {'id': 'pearls', 'name': 'Pearls', 'price': 10000, 'value': 'pearls'},
    ],
  },
];

void main() {
  testWidgets('the estimate follows what the customer picks', (tester) async {
    SharedPreferences.setMockInitialValues({});

    api = ApiClient(
      client: MockClient(
        (_) async => http.Response(jsonEncode(builderJson), 200),
      ),
    );

    final draft = CustomOrderDraft(bakery: Bakery.fromJson(bakeryJson));

    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme.copyWith(splashFactory: NoSplash.splashFactory),
        home: BuilderStep(draft: draft),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Build your cake'), findsOneWidget);
    expect(
      find.text('UGX 60,000'),
      findsOneWidget,
      reason: 'the first size is picked to start',
    );

    await tester.tap(find.text('2 kg · serves 16'));
    await tester.pump();

    expect(find.text('UGX 110,000'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Pearls +UGX 10,000'),
      100,
      scrollable: find.byType(Scrollable).last,
    );

    await tester.tap(find.text('Pearls +UGX 10,000'));
    await tester.pump();

    expect(find.text('UGX 120,000'), findsOneWidget);
    expect(
      draft.estimate,
      120000,
      reason: 'the choices are kept on the draft for the next steps',
    );
  });
}
