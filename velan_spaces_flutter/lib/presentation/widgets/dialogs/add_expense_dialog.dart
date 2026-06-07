import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:velan_spaces_flutter/core/services/media_compression_service.dart';
import 'package:velan_spaces_flutter/domain/entities/expense_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

class AddExpenseDialog extends ConsumerStatefulWidget {
  final String projectId;
  const AddExpenseDialog({required this.projectId, super.key});

  @override
  ConsumerState<AddExpenseDialog> createState() => _AddExpenseDialogState();
}

class _AddExpenseDialogState extends ConsumerState<AddExpenseDialog> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _accountDetailsController = TextEditingController();
  final _paymentMethodController = TextEditingController();
  
  String _type = 'debit';
  String _category = 'material';
  DateTime _selectedDate = DateTime.now();
  bool _isSubmitting = false;

  // Proof image
  XFile? _proofImage;

  @override
  void dispose() {
    _amountController.dispose();
    _accountDetailsController.dispose();
    _paymentMethodController.dispose();
    super.dispose();
  }

  void _showProofSourcePicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Add Proof Photo',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt, color: Colors.black87),
                title: const Text('Camera'),
                subtitle: const Text('Take a photo of the bill/receipt'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickProofImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: Colors.black87),
                title: const Text('Gallery'),
                subtitle: const Text('Choose from gallery'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickProofImage(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickProofImage(ImageSource source) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source);
    if (file != null) {
      setState(() => _proofImage = file);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_proofImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Proof photo is required. Please add a bill/receipt photo.')),
      );
      return;
    }
    
    setState(() => _isSubmitting = true);
    
    try {
      // Upload proof image
      String proofUrl = '';
      if (_proofImage != null) {
        final storage = ref.read(storageDatasourceProvider);
        final compressedPath = await MediaCompressionService.compressImage(_proofImage!.path);
        proofUrl = await storage.uploadFile(
          compressedPath,
          'projects/${widget.projectId}/proofs',
        );
      }

      final expense = ExpenseEntity(
        id: '',
        projectId: widget.projectId,
        type: _type,
        amount: double.tryParse(_amountController.text) ?? 0,
        date: _selectedDate,
        accountDetails: _accountDetailsController.text.trim(),
        category: _category,
        paymentMethod: _paymentMethodController.text.trim(),
        proofUrl: proofUrl,
      );
      
      final success = await ref.read(addExpenseNotifierProvider.notifier).addExpense(widget.projectId, expense);
      
      if (success && mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Expense added successfully')));
      } else if (mounted) {
        final state = ref.read(addExpenseNotifierProvider);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${state.error}')));
        setState(() => _isSubmitting = false);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DropdownButtonFormField<String>(
            value: _type,
            decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: 'debit', child: Text('Expense (Debit)')),
              DropdownMenuItem(value: 'credit', child: Text('Income (Credit)')),
            ],
            onChanged: (val) => setState(() => _type = val!),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _amountController,
            decoration: const InputDecoration(labelText: 'Amount (₹)', border: OutlineInputBorder()),
            keyboardType: TextInputType.number,
            validator: (val) => val == null || val.isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: 'material', child: Text('Material')),
              DropdownMenuItem(value: 'labour', child: Text('Labour')),
              DropdownMenuItem(value: 'transport', child: Text('Transport')),
              DropdownMenuItem(value: 'other', child: Text('Other')),
            ],
            onChanged: (val) => setState(() => _category = val!),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _paymentMethodController,
            decoration: const InputDecoration(
              labelText: 'Payment Method (e.g., Cash, UPI)',
              border: OutlineInputBorder(),
            ),
            validator: (val) => val == null || val.isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _accountDetailsController,
            decoration: const InputDecoration(
              labelText: 'Account Details / Notes',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('Date: ${_selectedDate.toLocal().toString().split(' ')[0]}'),
            trailing: const Icon(Icons.calendar_today),
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: _selectedDate,
                firstDate: DateTime(2000),
                lastDate: DateTime(2100),
              );
              if (date != null) setState(() => _selectedDate = date);
            },
          ),
          const SizedBox(height: 12),
          // ─── Proof Image ────────────────────────────────
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(
                color: _proofImage == null ? Colors.red.shade300 : Colors.green.shade300,
                width: 1.5,
              ),
              borderRadius: BorderRadius.circular(12),
              color: _proofImage == null ? Colors.red.shade50 : Colors.green.shade50,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(
                      _proofImage == null ? Icons.warning_amber_rounded : Icons.check_circle,
                      color: _proofImage == null ? Colors.red.shade400 : Colors.green.shade600,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _proofImage == null ? 'Proof photo required *' : 'Proof attached ✓',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: _proofImage == null ? Colors.red.shade700 : Colors.green.shade700,
                        ),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _showProofSourcePicker,
                      icon: Icon(
                        _proofImage == null ? Icons.add_a_photo : Icons.refresh,
                        size: 18,
                      ),
                      label: Text(_proofImage == null ? 'Add' : 'Change'),
                      style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                    ),
                  ],
                ),
                if (_proofImage != null) ...[
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LayoutBuilder(
                      builder: (context, constraints) => Image.file(
                        File(_proofImage!.path),
                        height: 120,
                        width: constraints.maxWidth,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _isSubmitting ? null : _submit,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _isSubmitting
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Add Transaction'),
          ),
        ],
      ),
    );
  }
}
