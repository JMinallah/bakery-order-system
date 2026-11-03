import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/firebase_setup.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import 'auth.dart';
import 'push.dart';
import 'sign_in_screen.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  late Future<Map<String, dynamic>?> _profile;
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _editing = false;
  bool _saving = false;
  StreamSubscription<User?>? _authSub;

  @override
  void initState() {
    super.initState();
    _profile = _load();
    if (firebaseReady) {
      _authSub = FirebaseAuth.instance.authStateChanges().listen((user) {
        if (mounted) {
          _reload();
        }
      });
    }
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>?> _load() async {
    if (!isCustomerSignedIn) {
      return null;
    }
    try {
      final res = await api.get('/users/me');
      if (res == null || res is! Map) return null;
      final profile = Map<String, dynamic>.from(res);
      _name.text =
          profile['name'] as String? ??
          (firebaseReady
              ? FirebaseAuth.instance.currentUser?.displayName
              : null) ??
          '';
      _phone.text = profile['phone'] as String? ?? '';
      return profile;
    } on ApiException catch (e) {
      if (e.statusCode == 401 ||
          e.message.toLowerCase().contains('bearer') ||
          e.message.toLowerCase().contains('unauthorized')) {
        return null;
      }
      rethrow;
    } catch (e) {
      final err = e.toString().toLowerCase();
      if (err.contains('bearer') || err.contains('unauthorized')) {
        return null;
      }
      rethrow;
    }
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      final profile = await api.patch('/users/me', {
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
      });
      final user = firebaseReady ? FirebaseAuth.instance.currentUser : null;
      if (user != null) await user.updateDisplayName(_name.text.trim());
      if (!mounted) {
        return;
      }
      setState(() {
        _profile = Future.value(Map<String, dynamic>.from(profile as Map));
        _editing = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Profile updated')));
    } catch (e) {
      if (mounted) {
        showError(context, e);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _reload() async {
    final next = _load();
    if (mounted) {
      setState(() {
        _profile = next;
      });
    }
    await next;
  }

  String _initial(Map<String, dynamic> profile) {
    final name = (profile['name'] as String?)?.trim();
    if (name != null && name.isNotEmpty) {
      return name.characters.first.toUpperCase();
    }
    final email = (profile['email'] as String?)?.trim();
    if (email != null && email.isNotEmpty) {
      return email.characters.first.toUpperCase();
    }
    return '?';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: FutureBuilder<Map<String, dynamic>?>(
          future: _profile,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            if (snapshot.hasError) {
              final err = snapshot.error.toString().toLowerCase();
              if (err.contains('bearer') || err.contains('unauthorized')) {
                return _GuestAccountView(onSignedIn: _reload);
              }
              return ErrorView(
                message: snapshot.error.toString(),
                onRetry: _reload,
              );
            }

            final profile = snapshot.data;
            if (profile == null) {
              return _GuestAccountView(onSignedIn: _reload);
            }

            final email =
                profile['email'] as String? ??
                (firebaseReady
                    ? FirebaseAuth.instance.currentUser?.email
                    : null) ??
                '';

            return RefreshIndicator(
              onRefresh: _reload,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                children: [
                  Text(
                    'Account',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 34,
                        backgroundColor: AppColors.accentSoft,
                        foregroundColor: AppColors.accent,
                        child: Text(
                          _initial(profile),
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              profile['name'] as String? ?? 'Your account',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              email,
                              style: const TextStyle(color: AppColors.muted),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  _Section(
                    title: 'Profile',
                    child: _editing
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const FieldLabel('Name'),
                              TextField(
                                controller: _name,
                                textCapitalization: TextCapitalization.words,
                              ),
                              const SizedBox(height: 16),
                              const FieldLabel('Phone number'),
                              TextField(
                                controller: _phone,
                                keyboardType: TextInputType.phone,
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: FilledButton(
                                      onPressed: _saving ? null : _save,
                                      child: Text(
                                        _saving ? 'Saving...' : 'Save changes',
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  TextButton(
                                    onPressed: _saving
                                        ? null
                                        : () =>
                                              setState(() => _editing = false),
                                    child: const Text('Cancel'),
                                  ),
                                ],
                              ),
                            ],
                          )
                        : ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              (profile['name'] as String?)?.isNotEmpty == true
                                  ? profile['name'] as String
                                  : 'Add your name',
                            ),
                            subtitle: Text(
                              (profile['phone'] as String?)?.isNotEmpty == true
                                  ? profile['phone'] as String
                                  : 'Add a phone number for order updates',
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.edit_outlined),
                              tooltip: 'Edit profile',
                              onPressed: () => setState(() => _editing = true),
                            ),
                          ),
                  ),
                  const SizedBox(height: 16),
                  _Section(
                    title: 'Order updates',
                    child: FutureBuilder<PushStatus>(
                      future: Push.instance.status(),
                      builder: (context, snapshot) {
                        final status = snapshot.data;
                        if (status == null) {
                          return const ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(Icons.notifications_none),
                            title: Text('Checking notifications...'),
                          );
                        }
                        final enabled = status == PushStatus.enabled;
                        final blocked = status == PushStatus.denied;
                        final unavailable = status == PushStatus.unavailable;
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            enabled
                                ? Icons.notifications_active_outlined
                                : Icons.notifications_none,
                            color: enabled ? AppColors.ok : AppColors.muted,
                          ),
                          title: Text(
                            enabled
                                ? 'Notifications enabled'
                                : blocked
                                ? 'Notifications are blocked'
                                : unavailable
                                ? 'Notifications unavailable'
                                : 'Get order updates',
                          ),
                          subtitle: Text(
                            enabled
                                ? 'We will notify you about quotes and order status changes.'
                                : blocked
                                ? 'Allow notifications in your device settings to receive order updates.'
                                : unavailable
                                ? 'Connect Firebase to enable order updates.'
                                : 'Know when your bakery replies or updates your order.',
                          ),
                          trailing: enabled
                              ? const Icon(
                                  Icons.check_circle,
                                  color: AppColors.ok,
                                )
                              : blocked
                              ? const Text(
                                  'Check device settings',
                                  textAlign: TextAlign.right,
                                  style: TextStyle(color: AppColors.muted),
                                )
                              : TextButton(
                                  onPressed: unavailable
                                      ? null
                                      : () async {
                                          final next = await Push.instance
                                              .requestPermission();
                                          if (next == PushStatus.enabled) {
                                            await Push.instance.register();
                                          }
                                          if (mounted) setState(() {});
                                        },
                                  child: const Text('Enable'),
                                ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 24),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: BorderSide(
                        color: AppColors.danger.withValues(alpha: 0.35),
                      ),
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed: () async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Sign out?'),
                          content: const Text(
                            'You will need to sign in again to view your orders or place new requests.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.of(ctx).pop(false),
                              child: const Text('Cancel'),
                            ),
                            FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.danger,
                              ),
                              onPressed: () => Navigator.of(ctx).pop(true),
                              child: const Text('Sign out'),
                            ),
                          ],
                        ),
                      );
                      if (confirm == true) {
                        await signOut();
                        if (mounted) {
                          setState(() {
                            _profile = Future.value(null);
                          });
                        }
                      }
                    },
                    icon: const Icon(Icons.logout_rounded, size: 18),
                    label: const Text('Sign out'),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _GuestAccountView extends StatelessWidget {
  const _GuestAccountView({required this.onSignedIn});

  final Future<void> Function() onSignedIn;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      children: [
        Text('Account', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 6),
        const Text(
          'Sign in to manage orders, custom bakes & preferences',
          style: TextStyle(color: AppColors.muted, fontSize: 14),
        ),
        const SizedBox(height: 20),

        // Hero Card
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.line),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: AppColors.accentSoft,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.bakery_dining_rounded,
                      color: AppColors.accent,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Welcome to Crumb & Co.',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Your artisanal cake community',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Create an account or sign in to track live cake status, personalize cakes with local bakeries, and keep your delivery details handy.',
                style: TextStyle(
                  color: AppColors.ink2,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () async {
                  final signedIn = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(
                      fullscreenDialog: true,
                      builder: (_) => const SignInScreen(),
                    ),
                  );
                  if (signedIn == true) {
                    await onSignedIn();
                  }
                },
                icon: const Icon(Icons.login_rounded, size: 18),
                label: const Text(
                  'Sign in / Create account',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 28),

        Text(
          'Why create an account?',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),

        const _FeatureTile(
          icon: Icons.track_changes_rounded,
          title: 'Live Order Tracking',
          subtitle:
              'Follow your cake from recipe preparation to decoration and doorstep delivery.',
        ),
        const SizedBox(height: 10),
        const _FeatureTile(
          icon: Icons.palette_outlined,
          title: 'Custom Cake Studio',
          subtitle:
              'Design bespoke tiered cakes, choose sponge & buttercream flavors, and get custom bakery quotes.',
        ),
        const SizedBox(height: 10),
        const _FeatureTile(
          icon: Icons.chat_outlined,
          title: 'Direct Baker Chat',
          subtitle:
              'Message pastry chefs directly to confirm dietary requirements, toppers, and timings.',
        ),

        const SizedBox(height: 28),

        // Network footer
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.ground,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.line),
          ),
          child: const Row(
            children: [
              Icon(Icons.verified_outlined, color: AppColors.accent, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Crumb & Co. Artisanal Bakery Network · v1.0.0',
                  style: TextStyle(
                    color: AppColors.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FeatureTile extends StatelessWidget {
  const _FeatureTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.accentSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.accent, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: child,
        ),
      ],
    );
  }
}
