import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../core/config.dart';
import '../../core/firebase_setup.dart';
import 'push.dart';
import 'sign_in_screen.dart';

/// True when the user is logged into Firebase, or has dev bypass configured.
bool get isCustomerSignedIn {
  if (firebaseReady) {
    return FirebaseAuth.instance.currentUser != null;
  }
  return AppConfig.devUser.isNotEmpty;
}

/// Browsing is open to everyone; ordering and My orders need an account.
/// Returns true when the customer is signed in (or the test login is in use).
Future<bool> ensureSignedIn(BuildContext context) async {
  if (isCustomerSignedIn) return true;
  final signedIn = await Navigator.of(context).push<bool>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => const SignInScreen(),
    ),
  );
  return signedIn ?? false;
}

/// Whether someone is signed in, for screens that change when they do.
Stream<bool> signedInChanges() => firebaseReady
    ? FirebaseAuth.instance.authStateChanges().map((u) => u != null)
    : Stream.value(AppConfig.devUser.isNotEmpty);

Future<void> signOut() async {
  if (!firebaseReady) return;
  await Push.instance.forget();
  await FirebaseAuth.instance.signOut();
}

/// Firebase's error codes, turned into something a customer can act on.
String authMessage(Object error) {
  final code = error is FirebaseAuthException ? error.code : '';
  return switch (code) {
    'invalid-credential' || 'wrong-password' || 'user-not-found' =>
      "That email and password don't match. Check them, or reset your password.",
    'invalid-email' => "That doesn't look like an email address.",
    'email-already-in-use' =>
      'There is already an account with that email. Sign in instead.',
    'weak-password' => 'Use at least 6 characters for the password.',
    'too-many-requests' => 'Too many tries. Wait a few minutes and try again.',
    'network-request-failed' =>
      "You're offline. Connect to the internet to sign in.",
    'user-disabled' => 'This account has been turned off.',
    _ => 'Something went wrong. Please try again.',
  };
}
