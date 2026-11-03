import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../app.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import 'auth.dart';
import 'push.dart';

enum _Mode { signIn, create, reset }

/// Pops with true once the customer is signed in.
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  var _mode = _Mode.signIn;
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscurePassword = true;
  String? _error;
  String? _notice;

  void _leave() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop(false);
    } else {
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const HomeShell()));
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = FirebaseAuth.instance;
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      return setState(() => _error = 'Enter a valid email address');
    }
    if (_mode == _Mode.create &&
        (_name.text.trim().isEmpty || _phone.text.trim().isEmpty)) {
      return setState(
        () => _error =
            'Add your name and phone number, so the bakery can reach you about your cake',
      );
    }
    if (_mode != _Mode.reset && _password.text.length < 6) {
      return setState(
        () => _error = 'Your password must be at least 6 characters',
      );
    }
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      switch (_mode) {
        case _Mode.reset:
          await auth.sendPasswordResetEmail(email: email);
          if (!mounted) return;
          setState(() {
            _notice =
                'If $email has an account, a reset link is on its way. Check the inbox and spam folder.';
            _mode = _Mode.signIn;
          });
          return;
        case _Mode.create:
          final cred = await auth.createUserWithEmailAndPassword(
            email: email,
            password: _password.text,
          );
          await cred.user!.updateDisplayName(_name.text.trim());
          await cred.user!.getIdToken(true);
          // The backend makes the account on the first request; save the name and phone there too.
          await api
              .patch('/users/me', {
                'name': _name.text.trim(),
                'phone': _phone.text.trim(),
              })
              .catchError((_) => null);
        case _Mode.signIn:
          await auth.signInWithEmailAndPassword(
            email: email,
            password: _password.text,
          );
      }
      await Push.instance.register().catchError((e) {
        debugPrint('Push register failed: $e');
      });
      if (!mounted) return;
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
      } else {
        Navigator.of(
          context,
        ).pushReplacement(MaterialPageRoute(builder: (_) => const HomeShell()));
      }
    } catch (e) {
      if (mounted) setState(() => _error = authMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canBrowseWithoutSigningIn = Navigator.of(context).canPop();
    final title = switch (_mode) {
      _Mode.signIn => 'Sign in to order',
      _Mode.create => 'Create your account',
      _Mode.reset => 'Reset your password',
    };
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Continue browsing',
          onPressed: _leave,
        ),
      ),
      body: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.asset(
                'assets/images/bak1.png',
                height: 68,
                fit: BoxFit.contain,
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(switch (_mode) {
            _Mode.signIn =>
              'So the bakery knows who the cake is for, and you can follow your orders.',
            _Mode.create =>
              'It takes a minute. Your phone number is only shared with bakeries you order from.',
            _Mode.reset => "We'll email you a link to choose a new password.",
          }, style: const TextStyle(color: AppColors.muted)),
          if (canBrowseWithoutSigningIn && _mode == _Mode.signIn) ...[
            const SizedBox(height: 12),
            const Text(
              'You can keep browsing, but you will need an account before placing an order.',
              style: TextStyle(color: AppColors.ink2),
            ),
          ],
          if (_notice != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.okSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _notice!,
                style: const TextStyle(color: AppColors.ok),
              ),
            ),
          ],
          const SizedBox(height: 24),
          AutofillGroup(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_mode == _Mode.create) ...[
                  const FieldLabel('Your name'),
                  TextField(
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    autofillHints: const [AutofillHints.name],
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('Phone number'),
                  TextField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(hintText: '0772 000 000'),
                  ),
                  const SizedBox(height: 16),
                ],
                const FieldLabel('Email'),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  textInputAction: _mode == _Mode.reset
                      ? TextInputAction.done
                      : TextInputAction.next,
                  decoration: const InputDecoration(
                    hintText: 'you@example.com',
                  ),
                ),
                if (_mode != _Mode.reset) ...[
                  const SizedBox(height: 16),
                  const FieldLabel('Password'),
                  TextField(
                    controller: _password,
                    obscureText: _obscurePassword,
                    autofillHints: [
                      _mode == _Mode.create
                          ? AutofillHints.newPassword
                          : AutofillHints.password,
                    ],
                    textInputAction: TextInputAction.done,
                    decoration: InputDecoration(
                      hintText: _mode == _Mode.create
                          ? 'At least 6 characters'
                          : null,
                      suffixIcon: IconButton(
                        tooltip: _obscurePassword
                            ? 'Show password'
                            : 'Hide password',
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                    onSubmitted: (_) => _submit(),
                  ),
                ],
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Semantics(
              liveRegion: true,
              child: Text(
                _error!,
                style: const TextStyle(
                  color: AppColors.danger,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(
              _busy
                  ? 'Please wait…'
                  : switch (_mode) {
                      _Mode.signIn => 'Sign in',
                      _Mode.create => 'Create account',
                      _Mode.reset => 'Send reset link',
                    },
            ),
          ),
          const SizedBox(height: 12),
          if (_mode == _Mode.signIn) ...[
            TextButton(
              onPressed: () => setState(() => _mode = _Mode.reset),
              child: const Text('Forgot your password?'),
            ),
            TextButton(
              onPressed: () => setState(() => _mode = _Mode.create),
              child: const Text('New here? Create an account'),
            ),
          ] else
            TextButton(
              onPressed: () => setState(() => _mode = _Mode.signIn),
              child: const Text('Back to sign in'),
            ),
        ],
      ),
    );
  }
}
