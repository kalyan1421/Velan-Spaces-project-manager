import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:velan_spaces_flutter/core/utils/account_validators.dart';
import 'package:velan_spaces_flutter/data/datasources/api_accounts_datasource.dart';

enum LinkKind { invite, reset }

/// Accept a client invite or reset a password from a link opened in the app:
/// looks the link up, asks for a new password, then returns to sign-in.
class LinkPasswordScreen extends ConsumerStatefulWidget {
  const LinkPasswordScreen({required this.kind, required this.token, super.key});

  final LinkKind kind;
  final String token;

  @override
  ConsumerState<LinkPasswordScreen> createState() => _LinkPasswordScreenState();
}

class _LinkPasswordScreenState extends ConsumerState<LinkPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  AccountLinkInfo? _info;
  String? _loadError;
  bool _loading = true;
  bool _saving = false;
  bool _obscure = true;
  String? _submitError;

  bool get _isInvite => widget.kind == LinkKind.invite;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final ds = ref.read(accountsDatasourceProvider);
    try {
      final info = _isInvite
          ? await ds.describeInvite(widget.token)
          : await ds.describeReset(widget.token);
      if (mounted) setState(() { _info = info; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loadError = e.toString(); _loading = false; });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _submitError = null; });
    final ds = ref.read(accountsDatasourceProvider);
    try {
      if (_isInvite) {
        await ds.acceptInvite(widget.token, password: _password.text);
      } else {
        await ds.resetPassword(widget.token, _password.text);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(_isInvite
            ? 'Account ready. Sign in with ${_info?.email ?? 'your email'}.'
            : 'Password updated. Sign in with your new password.'),
      ));
      context.go('/login');
    } catch (e) {
      if (mounted) setState(() { _saving = false; _submitError = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = _isInvite ? 'Accept your invite' : 'Reset your password';
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => context.go('/login')),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: _loading
                  ? const CircularProgressIndicator()
                  : _loadError != null
                      ? Column(mainAxisSize: MainAxisSize.min, children: [
                          const Icon(Icons.link_off, size: 56, color: Colors.grey),
                          const SizedBox(height: 16),
                          Text(_loadError!, textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          OutlinedButton(onPressed: () => context.go('/login'), child: const Text('Go to sign in')),
                        ])
                      : _form(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _form() {
    final info = _info;
    final who = info?.displayName ?? info?.email;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_isInvite && info?.projectName != null)
            Text('You are invited to follow "${info!.projectName}".',
                style: Theme.of(context).textTheme.titleMedium),
          if (who != null) ...[
            const SizedBox(height: 8),
            Text(_isInvite ? 'Signing in as ${info?.email ?? who}' : 'Account: ${info?.email ?? who}'),
          ],
          const SizedBox(height: 20),
          TextFormField(
            controller: _password,
            obscureText: _obscure,
            decoration: InputDecoration(
              labelText: 'New password',
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
            validator: AccountValidators.newPassword,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _confirm,
            obscureText: _obscure,
            decoration: const InputDecoration(labelText: 'Confirm password', border: OutlineInputBorder()),
            validator: (v) => v == _password.text ? null : 'Passwords do not match',
          ),
          if (_submitError != null) ...[
            const SizedBox(height: 12),
            Text(_submitError!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(_isInvite ? 'Set password' : 'Update password'),
          ),
        ],
      ),
    );
  }
}
