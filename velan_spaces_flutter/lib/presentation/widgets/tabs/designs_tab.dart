import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/domain/entities/design_document_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:velan_spaces_flutter/presentation/screens/designs/design_viewer_screen.dart';
import 'package:path/path.dart' as path;
import 'package:intl/intl.dart';

class DesignsTab extends ConsumerWidget {
  const DesignsTab({required this.projectId, super.key});
  final String projectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final designsAsync = ref.watch(projectDesignsProvider(projectId));
    final role = ref.watch(currentUserRoleProvider);
    final isManager = role == UserRole.manager || role == UserRole.head;

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: isManager
          ? FloatingActionButton.extended(
              onPressed: () => _showUploadBottomSheet(context, ref),
              label: const Text('Upload Design', style: TextStyle(fontWeight: FontWeight.bold)),
              icon: const Icon(Icons.add),
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
            )
          : null,
      body: designsAsync.when(
        data: (designs) {
          if (designs.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.design_services_outlined, size: 48,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3)),
                  const SizedBox(height: 12),
                  const Text('No designs uploaded yet'),
                ],
              ),
            );
          }
          
          return LayoutBuilder(
            builder: (context, constraints) {
              // Responsive grid
              final crossAxisCount = constraints.maxWidth > 600 ? 3 : 1;
              return GridView.builder(
                padding: const EdgeInsets.all(16),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: crossAxisCount,
                  childAspectRatio: crossAxisCount == 1 ? 1.5 : 1.2,
                  crossAxisSpacing: 16,
                  mainAxisSpacing: 16,
                ),
                itemCount: designs.length,
                itemBuilder: (context, index) {
                  return _DesignCard(design: designs[index], projectId: projectId, role: role);
                },
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error loading designs: $err')),
      ),
    );
  }

  void _showUploadBottomSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => _UploadDesignSheet(projectId: projectId),
    );
  }
}

class _DesignCard extends ConsumerWidget {
  const _DesignCard({required this.design, required this.projectId, required this.role});

  final DesignDocumentEntity design;
  final String projectId;
  final UserRole role;

  bool get _canDelete => role == UserRole.manager || role == UserRole.head;

  void _openViewer(BuildContext context) {
    if (design.fileUrl.isEmpty) return;
    
    final uri = Uri.parse(design.fileUrl);
    final pathStr = uri.path.toLowerCase();
    final isPdf = pathStr.contains('.pdf');
    final isImage = pathStr.contains('.jpg') || 
                    pathStr.contains('.jpeg') || 
                    pathStr.contains('.png') || 
                    pathStr.contains('.webp');

    if (isPdf || isImage) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => DesignViewerScreen(
            url: design.fileUrl,
            title: design.title,
            isPdf: isPdf,
          ),
        ),
      );
    } else {
      // Fallback for other files
      launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _deleteDesign(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Design?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final repo = ref.read(projectRepositoryProvider);
      await repo.deleteDesign(projectId, design.id, design.fileUrl);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dateStr = design.timestamp != null 
        ? DateFormat('MMM d').format(design.timestamp!)
        : 'Unknown Date';

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openViewer(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: Stack(
                children: [
                   Container(
                    color: Colors.grey.shade200,
                    width: double.infinity,
                    alignment: Alignment.center,
                    child: Icon(
                      design.type == '3D' ? Icons.view_in_ar : Icons.image,
                      size: 48,
                      color: Colors.grey.shade400,
                    ),
                  ),
                  if (_canDelete)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: IconButton(
                        icon: const Icon(Icons.delete, color: Colors.red, size: 20),
                        onPressed: () => _deleteDesign(context, ref),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withOpacity(0.8),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          design.title.toUpperCase(),
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          design.type.toUpperCase(), // '3D RENDER' or '2D PLAN'
                          style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          dateStr,
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                        ),
                        InkWell(
                          onTap: () => _openViewer(context),
                          child: const Row(
                            children: [
                              Text('View', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                              Icon(Icons.visibility, size: 12),
                            ],
                          ),
                        )
                      ],
                    )
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UploadDesignSheet extends ConsumerStatefulWidget {
  const _UploadDesignSheet({required this.projectId});
  final String projectId;

  @override
  ConsumerState<_UploadDesignSheet> createState() => _UploadDesignSheetState();
}

class _UploadDesignSheetState extends ConsumerState<_UploadDesignSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  String _selectedType = '2D Plan';
  String? _filePath;
  String? _fileName;
  bool _isLoading = false;

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );

    if (result != null) {
      setState(() {
        _filePath = result.files.single.path;
        _fileName = result.files.single.name;
      });
    }
  }

  Future<void> _upload() async {
    if (!_formKey.currentState!.validate() || _filePath == null) return;
    
    setState(() => _isLoading = true);

    try {
      final repo = ref.read(projectRepositoryProvider);
      final userMeta = ref.read(currentUserMetaProvider);
      final userName = userMeta['name'] as String? ?? 'Project Manager';
      
      final design = DesignDocumentEntity(
        id: '', // Will be ignored by addDesign
        title: _titleController.text,
        fileUrl: '', // Will be updated by upload logic
        type: _selectedType,
        approvalStatus: const DesignApprovalStatus(),
        postedBy: userName,
        timestamp: DateTime.now(),
        projectId: widget.projectId,
      );

      await repo.addDesign(widget.projectId, design, filePath: _filePath);
      
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error uploading: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Upload Design', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder()),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _selectedType,
              items: const [
                DropdownMenuItem(value: '2D Plan', child: Text('2D Plan')),
                DropdownMenuItem(value: '3D Render', child: Text('3D Render')),
              ],
              onChanged: (v) => setState(() => _selectedType = v!),
              decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _pickFile,
              icon: const Icon(Icons.upload_file),
              label: Text(_fileName ?? 'Select File (PDF/Image)'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
            if (_filePath == null)
               const Padding(
                 padding: EdgeInsets.only(top: 8.0),
                 child: Text('No file selected', style: TextStyle(color: Colors.red, fontSize: 12)),
               ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : _upload,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.black,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _isLoading 
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Upload'),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
