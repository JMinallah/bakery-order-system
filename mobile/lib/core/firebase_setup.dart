import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Firebase settings, passed in at build time so no generated files are needed:
///   flutter run --dart-define-from-file=firebase.json
/// mobile/firebase.json is kept out of git; firebase.example.json shows the shape and
/// docs/firebase.md says where each value comes from.
abstract final class FirebaseConfig {
  static const apiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: 'AIzaSyBaxmx-JDonLURsgZMIUmspYIRl1J4CfcU',
  );
  static const appId = String.fromEnvironment(
    'FIREBASE_APP_ID',
    defaultValue: '1:224030489499:android:6fde0e20abd178fb6eff3e',
  );
  static const messagingSenderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '224030489499',
  );
  static const projectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'bakery-orders-prod',
  );

  static bool get provided =>
      apiKey.isNotEmpty && appId.isNotEmpty && projectId.isNotEmpty;
}

bool _ready = false;

/// True once Firebase has started. False means the app uses the test login (DEV_USER).
bool get firebaseReady => _ready;

Future<void> setupFirebase() async {
  try {
    if (FirebaseConfig.provided) {
      await Firebase.initializeApp(
        options: const FirebaseOptions(
          apiKey: FirebaseConfig.apiKey,
          appId: FirebaseConfig.appId,
          messagingSenderId: FirebaseConfig.messagingSenderId,
          projectId: FirebaseConfig.projectId,
        ),
      );
    } else {
      await Firebase.initializeApp();
    }
    _ready = true;
  } catch (e) {
    // A wrong value shouldn't stop the app opening; it falls back to the test login.
    debugPrint('Firebase did not start: $e');
  }
}
