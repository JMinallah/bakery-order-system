import 'package:bakery_orders/app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'prompts for sign-in only when Firebase is ready and we have no current user',
    () {
      expect(shouldPromptSignIn(firebaseReady: true, signedIn: false), isTrue);
      expect(shouldPromptSignIn(firebaseReady: true, signedIn: true), isFalse);
      expect(
        shouldPromptSignIn(firebaseReady: false, signedIn: false),
        isFalse,
      );
    },
  );
}
