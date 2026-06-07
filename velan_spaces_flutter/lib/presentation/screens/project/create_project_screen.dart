import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/notification_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/worker_manager_providers.dart';

class CreateProjectScreen extends ConsumerStatefulWidget {
  const CreateProjectScreen({super.key});

  @override
  ConsumerState<CreateProjectScreen> createState() => _CreateProjectScreenState();
}

class _CreateProjectScreenState extends ConsumerState<CreateProjectScreen> {
  int _currentStep = 0;
  final _formKey1 = GlobalKey<FormState>();
  final _formKey2 = GlobalKey<FormState>();

  final _projectCodeController = TextEditingController();
  final _nameController = TextEditingController();
  final _clientNameController = TextEditingController();
  final _clientPhoneController = TextEditingController();
  final _clientEmailController = TextEditingController();
  final _locationController = TextEditingController();
  final _budgetController = TextEditingController();
  
  final List<String> _selectedManagerIds = [];
  final List<String> _budgetAccessManagerIds = [];

  bool _isSubmitting = false;

  @override
  void dispose() {
    _projectCodeController.dispose();
    _nameController.dispose();
    _clientNameController.dispose();
    _clientPhoneController.dispose();
    _clientEmailController.dispose();
    _locationController.dispose();
    _budgetController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey2.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final project = ProjectEntity(
      id: '',
      projectCode: _projectCodeController.text.trim(),
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
      managerIds: _selectedManagerIds,
      budgetAccessManagerIds: _budgetAccessManagerIds,
      workerIds: const [],
    );

    await ref.read(projectCreationNotifierProvider.notifier).createProject(project);

    final creationState = ref.read(projectCreationNotifierProvider);
    if (creationState.hasValue && creationState.value != null && mounted) {
      // ─── Notify assigned managers ────────────────────────────────
      try {
        final ns = ref.read(notificationServiceProvider);
        final projectId = creationState.value!;
        final projectName = _nameController.text.trim();
        for (final managerId in _selectedManagerIds) {
          await ns.notifyManagerOfAssignment(
            managerId: managerId,
            projectId: projectId,
            projectName: projectName,
          );
        }
      } catch (_) {}
      // ─────────────────────────────────────────────────────
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
      body: Stepper(
        type: StepperType.horizontal,
        currentStep: _currentStep,
        onStepContinue: () {
          if (_currentStep == 0) {
            if (_formKey1.currentState!.validate()) {
              setState(() => _currentStep += 1);
            }
          } else {
            _submit();
          }
        },
        onStepCancel: () {
          if (_currentStep > 0) {
            setState(() => _currentStep -= 1);
          } else {
            context.pop();
          }
        },
        controlsBuilder: (context, details) {
          final isLastStep = _currentStep == 1;
          return Padding(
            padding: const EdgeInsets.only(top: 24.0),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : details.onStepContinue,
                    child: _isSubmitting && isLastStep
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : Text(isLastStep ? 'Create Project' : 'Next'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: OutlinedButton(
                    onPressed: details.onStepCancel,
                    child: Text(_currentStep == 0 ? 'Cancel' : 'Back'),
                  ),
                ),
              ],
            ),
          );
        },
        steps: [
          Step(
            title: const Text('Details'),
            isActive: _currentStep >= 0,
            state: _currentStep > 0 ? StepState.complete : StepState.indexed,
            content: Form(
              key: _formKey1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Project Details', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 16),
                  _buildField(_projectCodeController, 'Project ID', Icons.tag, required: true),
                  const SizedBox(height: 14),
                  _buildField(_nameController, 'Project Name', Icons.folder, required: true),
                  const SizedBox(height: 14),
                  _buildField(_locationController, 'Location', Icons.location_on, required: true),
                  const SizedBox(height: 24),
                  Text('Client Details', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 16),
                  _buildField(_clientNameController, 'Client Name', Icons.person, required: true),
                  const SizedBox(height: 14),
                  _buildField(_clientPhoneController, 'Client Phone', Icons.phone, keyboardType: TextInputType.phone),
                  const SizedBox(height: 14),
                  _buildField(_clientEmailController, 'Client Email', Icons.email, keyboardType: TextInputType.emailAddress),
                ],
              ),
            ),
          ),
          Step(
            title: const Text('Budget & Setup'),
            isActive: _currentStep >= 1,
            content: Form(
              key: _formKey2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Financials', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 16),
                  _buildField(_budgetController, 'Budget (₹)', Icons.account_balance_wallet,
                      required: true, keyboardType: TextInputType.number),
                  const SizedBox(height: 24),
                  Text('Assign Managers', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  const Text(
                    'Select managers who will oversee this project.',
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 16),
                  _buildManagerSelection(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildManagerSelection() {
    final managersAsync = ref.watch(allManagersProvider);

    return managersAsync.when(
      data: (managers) {
        if (managers.isEmpty) {
          return const Center(child: Text('No managers available'));
        }
        return ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: managers.length,
          itemBuilder: (context, index) {
            final manager = managers[index];
            final isSelected = _selectedManagerIds.contains(manager.id);
            final hasBudgetAccess = _budgetAccessManagerIds.contains(manager.id);
            return Column(
              children: [
                CheckboxListTile(
                  title: Text(manager.name),
                  subtitle: Text(manager.email),
                  value: isSelected,
                  onChanged: (bool? value) {
                    setState(() {
                      if (value == true) {
                        _selectedManagerIds.add(manager.id);
                      } else {
                        _selectedManagerIds.remove(manager.id);
                        _budgetAccessManagerIds.remove(manager.id); // Also remove budget access
                      }
                    });
                  },
                ),
                if (isSelected)
                  Padding(
                    padding: const EdgeInsets.only(left: 32.0, right: 16.0, bottom: 8.0),
                    child: CheckboxListTile(
                      title: const Text('Grant Budget Access', style: TextStyle(fontSize: 13)),
                      subtitle: const Text('Allow this manager to view and edit the project budget', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      value: hasBudgetAccess,
                      controlAffinity: ListTileControlAffinity.leading,
                      dense: true,
                      onChanged: (bool? value) {
                        setState(() {
                          if (value == true) {
                            _budgetAccessManagerIds.add(manager.id);
                          } else {
                            _budgetAccessManagerIds.remove(manager.id);
                          }
                        });
                      },
                    ),
                  ),
              ],
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Text('Error loading managers: $e', style: const TextStyle(color: Colors.red)),
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
        border: const OutlineInputBorder(),
      ),
      validator: required
          ? (value) => value == null || value.isEmpty ? '$label is required' : null
          : null,
    );
  }
}
