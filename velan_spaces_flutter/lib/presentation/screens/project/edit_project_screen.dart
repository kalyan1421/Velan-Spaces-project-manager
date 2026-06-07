import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/notification_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/worker_manager_providers.dart';

class EditProjectScreen extends ConsumerStatefulWidget {
  final String projectId;
  
  const EditProjectScreen({required this.projectId, super.key});

  @override
  ConsumerState<EditProjectScreen> createState() => _EditProjectScreenState();
}

class _EditProjectScreenState extends ConsumerState<EditProjectScreen> {
  int _currentStep = 0;
  final _formKey1 = GlobalKey<FormState>();
  final _formKey2 = GlobalKey<FormState>();

  late TextEditingController _projectCodeController;
  late TextEditingController _nameController;
  late TextEditingController _clientNameController;
  late TextEditingController _clientPhoneController;
  late TextEditingController _clientEmailController;
  late TextEditingController _locationController;
  late TextEditingController _budgetController;
  
  List<String> _selectedManagerIds = [];
  List<String> _budgetAccessManagerIds = [];

  bool _isSubmitting = false;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _projectCodeController = TextEditingController();
    _nameController = TextEditingController();
    _clientNameController = TextEditingController();
    _clientPhoneController = TextEditingController();
    _clientEmailController = TextEditingController();
    _locationController = TextEditingController();
    _budgetController = TextEditingController();
  }

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

  void _initializeFields(ProjectEntity project) {
    if (_isInitialized) return;
    _projectCodeController.text = project.projectCode;
    _nameController.text = project.projectName;
    _clientNameController.text = project.clientName;
    _clientPhoneController.text = project.clientPhone;
    _clientEmailController.text = project.clientEmail;
    _locationController.text = project.location;
    _budgetController.text = project.budget.toString();
    _selectedManagerIds = List.from(project.managerIds);
    _budgetAccessManagerIds = List.from(project.budgetAccessManagerIds);
    _isInitialized = true;
  }

  Future<void> _submit() async {
    if (!_formKey2.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    // Capture oldManagerIds before update for diff
    final oldManagerIds = List<String>.from(
        ref.read(projectDetailProvider(widget.projectId)).valueOrNull?.managerIds ?? []);

    final updates = {
      'projectCode': _projectCodeController.text.trim(),
      'projectName': _nameController.text.trim(),
      'clientName': _clientNameController.text.trim(),
      'clientPhone': _clientPhoneController.text.trim(),
      'clientEmail': _clientEmailController.text.trim(),
      'location': _locationController.text.trim(),
      'budget': double.tryParse(_budgetController.text) ?? 0,
      'managerIds': _selectedManagerIds,
      'budgetAccessManagerIds': _budgetAccessManagerIds,
    };

    final success = await ref.read(projectUpdateNotifierProvider.notifier).updateProject(widget.projectId, updates);

    if (success && mounted) {
      // ─── Notify newly assigned managers ─────────────────────────
      try {
        final newManagers = _selectedManagerIds
            .where((id) => !oldManagerIds.contains(id))
            .toList();
        if (newManagers.isNotEmpty) {
          final ns = ref.read(notificationServiceProvider);
          final projectName = _nameController.text.trim();
          for (final mId in newManagers) {
            await ns.notifyManagerOfAssignment(
              managerId: mId,
              projectId: widget.projectId,
              projectName: projectName,
            );
          }
        }
      } catch (_) {}
      // ─────────────────────────────────────────────────────
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Project updated successfully')),
      );
      context.pop();
    } else if (mounted) {
      final updateState = ref.read(projectUpdateNotifierProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: ${updateState.error}')),
      );
    }
    setState(() => _isSubmitting = false);
  }

  @override
  Widget build(BuildContext context) {
    final projectAsync = ref.watch(projectDetailProvider(widget.projectId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Project'),
      ),
      body: projectAsync.when(
        data: (project) {
          // Initialize fields on first load
          WidgetsBinding.instance.addPostFrameCallback((_) {
            setState(() {
              _initializeFields(project);
            });
          });

          return Column(
            children: [
              Container(
                padding: const EdgeInsets.all(16.0),
                width: double.infinity,
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                child: Text(
                  'System ID: ${project.id}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey.shade600,
                  ),
                ),
              ),
              Expanded(
                child: Stepper(
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
                                  : Text(isLastStep ? 'Save Changes' : 'Next'),
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
                            Builder(
                              builder: (context) {
                                final userRole = ref.watch(currentUserRoleProvider);
                                final isAdmin = userRole == UserRole.head;
                                return _buildField(
                                  _budgetController,
                                  'Budget (₹)',
                                  Icons.account_balance_wallet,
                                  required: true,
                                  keyboardType: TextInputType.number,
                                  readOnly: !isAdmin,
                                  helperText: isAdmin ? null : 'Budget can only be edited by Admin',
                                );
                              },
                            ),
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
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
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
                        _budgetAccessManagerIds.remove(manager.id);
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
      {bool required = false, TextInputType? keyboardType, bool readOnly = false, String? helperText}) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      readOnly: readOnly,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: const OutlineInputBorder(),
        helperText: helperText,
        helperStyle: const TextStyle(color: Colors.orange, fontSize: 11),
        filled: readOnly,
        fillColor: readOnly ? Colors.grey.shade100 : null,
      ),
      validator: required
          ? (value) => value == null || value.isEmpty ? '$label is required' : null
          : null,
    );
  }
}
