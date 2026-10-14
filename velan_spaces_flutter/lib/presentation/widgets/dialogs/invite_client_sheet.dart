import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/utils/account_validators.dart';
import 'package:velan_spaces_flutter/data/datasources/api_accounts_datasource.dart';
import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';
import 'package:velan_spaces_flutter/presentation/widgets/common/share_link_sheet.dart';

/// Invite the project's client to the app. They get a one-time link (7 days)
/// to set their password, then sign in with their email.
class InviteClientSheet extends ConsumerStatefulWidget {
  const InviteClientSheet({required this.project, super.key});

  final ProjectEntity project;

  @override
  ConsumerState<InviteClientSheet> createState() => _InviteClientSheetState();
}

class _InviteClientSheetState extends ConsumerState<InviteClientSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name =
      TextEditingController(text: widget.project.clientName);
  late final TextEditingController _email =
      TextEditingController(text: widget.project.clientEmail);
  late final TextEditingController _phone =
      TextEditingController(text: widget.project.clientPhone);
  bool _sending = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _sending = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    // The share sheet opens from the screen behind this one.
    final hostContext = navigator.context;
    try {
      final result = await ref.read(accountsDatasourceProvider).inviteClient(
            widget.project.id,
            email: _email.text,
            displayName: _name.text,
            phone: _phone.text,
          );
      navigator.pop();
      if (result.alreadyRegistered || result.inviteUrl == null) {
        messenger.showSnackBar(SnackBar(
          content: Text('${_name.text.trim()} already has an account and can now see this project.'),
        ));
        return;
      }
      if (!hostContext.mounted) return;
      await showShareLinkSheet(
        hostContext,
        title: 'Client invitation',
        message: 'Send this to ${_name.text.trim()}. They open it, set a password, and then sign '
            'in to the app with ${_email.text.trim().toLowerCase()}. The link works once, for 7 days.',
        url: result.inviteUrl!,
        shareText: 'You are invited to follow "${widget.project.projectName}" on Velan Spaces',
      );
    } catch (e) {
      if (mounted) setState(() => _sending = false);
      messenger.showSnackBar(SnackBar(content: Text('Could not invite: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _name,
            decoration: const InputDecoration(
              labelText: 'Client name',
              prefixIcon: Icon(Icons.person_outline),
              border: OutlineInputBorder(),
            ),
            validator: (v) => (v ?? '').trim().isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _email,
            autocorrect: false,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Client email (they sign in with this)',
              prefixIcon: Icon(Icons.email_outlined),
              border: OutlineInputBorder(),
            ),
            validator: AccountValidators.email,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Phone (optional)',
              prefixIcon: Icon(Icons.phone_outlined),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _sending ? null : _submit,
            icon: _sending
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.send_outlined),
            label: const Text('Create invitation link'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }
}
