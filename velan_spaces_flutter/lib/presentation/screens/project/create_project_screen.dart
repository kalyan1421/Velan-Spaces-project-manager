import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

class CreateProjectScreen extends ConsumerStatefulWidget {
  const CreateProjectScreen({super.key});

  @override
  ConsumerState<CreateProjectScreen> createState() => _CreateProjectScreenState();
}

class _CreateProjectScreenState extends ConsumerState<CreateProjectScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _clientNameController = TextEditingController();
  final _clientPhoneController = TextEditingController();
  final _clientEmailController = TextEditingController();
  final _locationController = TextEditingController();
  final _budgetController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _clientNameController.dispose();
    _clientPhoneController.dispose();
    _clientEmailController.dispose();
    _locationController.dispose();
    _budgetController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final project = ProjectEntity(
      id: '',
      projectName: _nameController.text.trim(),
      clientName: _clientNameController.text.trim(),
      clientPhone: _clientPhoneController.text.trim(),
      clientEmail: _clientEmailController.text.trim(),
      location: _locationController.text.trim(),
      budget: double.tryParse(_budgetController.text) ?? 0,
      estimatedCost: double.tryParse(_budgetController.text) ?? 0,
      currentSpend: 0,
      completionPercentage: 0,
      isComplete: false,
      managerIds: [],
      workerIds: [],
    );

    await ref.read(projectCreationNotifierProvider.notifier).createProject(project);

    final creationState = ref.read(projectCreationNotifierProvider);
    if (creationState.hasValue && creationState.value != null && mounted) {
      context.pop();
    } else if (creationState.hasError && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: ${creationState.error}')),
      );
    }
    setState(() => _isSubmitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Project'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Project Details', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              _buildField(_nameController, 'Project Name', Icons.folder,
                  required: true),
              const SizedBox(height: 14),
              _buildField(_locationController, 'Location', Icons.location_on,
                  required: true),
              const SizedBox(height: 14),
              _buildField(_budgetController, 'Budget (₹)', Icons.account_balance_wallet,
                  required: true, keyboardType: TextInputType.number),
              const SizedBox(height: 24),

              Text('Client Details', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              _buildField(_clientNameController, 'Client Name', Icons.person,
                  required: true),
              const SizedBox(height: 14),
              _buildField(_clientPhoneController, 'Client Phone', Icons.phone,
                  keyboardType: TextInputType.phone),
              const SizedBox(height: 14),
              _buildField(_clientEmailController, 'Client Email', Icons.email,
                  keyboardType: TextInputType.emailAddress),

              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Create Project'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(
      TextEditingController controller, String label, IconData icon,
      {bool required = false, TextInputType? keyboardType}) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
      ),
      validator: required
          ? (value) => value == null || value.isEmpty ? '$label is required' : null
          : null,
    );
  }
}
