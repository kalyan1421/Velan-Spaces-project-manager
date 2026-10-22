import 'package:flutter/material.dart';
import 'package:velan_spaces_flutter/core/utils/account_validators.dart';
import 'package:velan_spaces_flutter/presentation/widgets/common/share_link_sheet.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/domain/entities/manager_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/worker_manager_providers.dart';

class EditManagerDialog extends ConsumerStatefulWidget {
  final ManagerEntity manager;
  
  const EditManagerDialog({required this.manager, super.key});

  @override
  ConsumerState<EditManagerDialog> createState() => _EditManagerDialogState();
}

class _EditManagerDialogState extends ConsumerState<EditManagerDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  late bool _isSuspended;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.manager.name);
    _phoneController = TextEditingController(text: widget.manager.phone);
    _emailController = TextEditingController(text: widget.manager.email);
    _isSuspended = widget.manager.isSuspended;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final success = await ref.read(workerManagerControllerProvider.notifier).updateManager(
      managerId: widget.manager.id,
      name: _nameController.text.trim(),
      phone: _phoneController.text.trim(),
      email: _emailController.text.trim().toLowerCase(),
      isSuspended: _isSuspended,
    );

    if (success && mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Manager updated successfully')),
      );
    } else if (mounted) {
      final error = ref.read(workerManagerControllerProvider).error;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not update manager: $error')),
      );
      setState(() => _isSubmitting = false);
    }
  }

  /// Passwords can't be read or typed in any more: the manager sets a new
  /// one through a one-time link.
  Future<void> _shareResetLink() async {
    final url = await ref
        .read(workerManagerControllerProvider.notifier)
        .createResetLink(widget.manager.id);
    if (!mounted) return;
    if (url == null) {
      final error = ref.read(workerManagerControllerProvider).error;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not create link: $error')),
      );
      return;
    }
    await showShareLinkSheet(
      context,
      title: 'Password reset link',
      message: 'Send this to ${widget.manager.name}. It lets them set a new password once, '
          'within 24 hours. They keep signing in with ${widget.manager.email}.',
      url: url,
      shareText: 'Velan Spaces: set your new password here (valid 24 hours)',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 0,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Name',
                prefixIcon: Icon(Icons.person),
                border: OutlineInputBorder(),
              ),
              validator: (val) =>
                  val == null || val.trim().isEmpty ? 'Name is required' : null,
            ),

            const SizedBox(height: 16),
            TextFormField(
              controller: _phoneController,
              decoration: const InputDecoration(
                labelText: 'Phone',
                prefixIcon: Icon(Icons.phone),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _emailController,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Email (sign-in)',
                prefixIcon: Icon(Icons.email),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.emailAddress,
              validator: AccountValidators.email,
            ),
            const SizedBox(height: 16),
            SwitchListTile(
              title: const Text('Account Suspended'),
              subtitle: const Text('Prevent this manager from logging in'),
              value: _isSuspended,
              activeColor: Colors.red,
              onChanged: (val) => setState(() => _isSuspended = val),
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save Changes'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _isSubmitting ? null : _shareResetLink,
              icon: const Icon(Icons.lock_reset),
              label: const Text('Create password reset link'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
