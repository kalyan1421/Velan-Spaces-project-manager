import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/domain/entities/project_update_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:video_player/video_player.dart';

class CreateUpdateForm extends ConsumerStatefulWidget {
  const CreateUpdateForm({required this.projectId, super.key});

  final String projectId;

  @override
  ConsumerState<CreateUpdateForm> createState() => _CreateUpdateFormState();
}

class _CreateUpdateFormState extends ConsumerState<CreateUpdateForm> {
  final _formKey = GlobalKey<FormState>();
  final _contentController = TextEditingController();
  
  String _type = 'message'; // message, photo, video
  String? _selectedCategory;
  String? _selectedRoomId;
  final List<String> _selectedWorkerIds = [];
  
  XFile? _mediaFile;
  VideoPlayerController? _videoController;

  bool _isPosting = false;

  final List<String> _categories = [
    'General',
    'Civil',
    'Electrical',
    'Carpentry',
    'Painting',
    'Glass Work',
    'Deco Work',
    'Tiles',
    'Granite',
    'Plumbing',
    'Welding',
    'Fall Ceiling',
    'AC Works',
    'Solar Works',
    'Lighting Works',
  ];

  @override
  void dispose() {
    _contentController.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  Future<void> _pickMedia(String type) async {
    final picker = ImagePicker();
    XFile? file;

    if (type == 'photo') {
      file = await picker.pickImage(source: ImageSource.gallery);
    } else if (type == 'video') {
      file = await picker.pickVideo(source: ImageSource.gallery);
    }

    if (file != null) {
      if (type == 'video') {
        _videoController?.dispose();
        _videoController = VideoPlayerController.file(File(file.path))
          ..initialize().then((_) {
            setState(() {});
          });
      }
      
      setState(() {
        _mediaFile = file;
        _type = type;
      });
    }
  }

  void _clearMedia() {
    setState(() {
      _mediaFile = null;
      _videoController?.dispose();
      _videoController = null;
      _type = 'message';
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if ((_type == 'photo' || _type == 'video') && _mediaFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a file')),
      );
      return;
    }

    setState(() => _isPosting = true);

    try {
      final repo = ref.read(projectRepositoryProvider);
      final meta = ref.read(currentUserMetaProvider);
      final role = ref.read(currentUserRoleProvider);
      final storage = ref.read(storageDatasourceProvider);

      List<String> mediaUrls = [];

      // Upload Media if present
      if (_mediaFile != null) {
        final path = 'projects/${widget.projectId}/updates';
        final url = await storage.uploadFile(_mediaFile!.path, path);
        mediaUrls.add(url);
      }

      final update = ProjectUpdateEntity(
        id: '',
        postedBy: meta['name'] ?? 'Unknown',
        role: role,
        type: _type,
        content: _contentController.text.trim(),
        timestamp: DateTime.now(),
        category: _selectedCategory,
        roomId: _selectedRoomId,
        associatedWorkerIds: _selectedWorkerIds,
        mediaUrls: mediaUrls,
      );

      await repo.addUpdate(widget.projectId, update);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Update posted successfully!')),
        );
        // Reset form
        _contentController.clear();
        _clearMedia();
        setState(() {
          _selectedCategory = null;
          _selectedRoomId = null;
          _selectedWorkerIds.clear();
        });
        // Close if implemented as bottom sheet, or just reset state
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isPosting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final roomsAsync = ref.watch(projectRoomsProvider(widget.projectId));
    final workersAsync = ref.watch(validProjectWorkersProvider(widget.projectId));

    // Resolve rooms and workers safely
    final rooms = roomsAsync.valueOrNull ?? [];
    final workers = workersAsync.valueOrNull ?? [];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.withOpacity(0.2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ─── Input Type Toggle ────────────────────────
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'message',
                  label: Text('Message'),
                  icon: Icon(Icons.chat_bubble_outline),
                ),
                ButtonSegment(
                  value: 'photo',
                  label: Text('Photo'),
                  icon: Icon(Icons.photo_outlined),
                ),
                ButtonSegment(
                  value: 'video',
                  label: Text('Video'),
                  icon: Icon(Icons.videocam_outlined),
                ),
              ],
              selected: {_type},
              onSelectionChanged: (Set<String> newSelection) {
                final type = newSelection.first;
                if (type != 'message') {
                  _pickMedia(type);
                } else {
                  _clearMedia();
                }
              },
              style: ButtonStyle(
                visualDensity: VisualDensity.compact,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
            const SizedBox(height: 16),

            // ─── Media Preview ────────────────────────────
            if (_mediaFile != null)
              Stack(
                alignment: Alignment.topRight,
                children: [
                  Container(
                    height: 200,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.withOpacity(0.3)),
                    ),
                    child: _type == 'photo'
                        ? Image.file(
                            File(_mediaFile!.path),
                            fit: BoxFit.contain,
                          )
                        : _videoController != null && _videoController!.value.isInitialized
                            ? AspectRatio(
                                aspectRatio: _videoController!.value.aspectRatio,
                                child: VideoPlayer(_videoController!),
                              )
                            : const Center(child: CircularProgressIndicator()),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    style: IconButton.styleFrom(backgroundColor: Colors.black45),
                    onPressed: _clearMedia,
                  ),
                ],
              ),
            if (_mediaFile != null) const SizedBox(height: 16),

            // ─── Content ──────────────────────────────────
            TextFormField(
              controller: _contentController,
              decoration: const InputDecoration(
                labelText: 'Update Description',
                hintText: 'What work was done today?',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
              maxLines: 3,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter a description';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),

            // ─── Metadata (Category, Room, Workers) ───────
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                // Category
                DropdownMenu<String>(
                  width: 160,
                  hintText: 'Category',
                  dropdownMenuEntries: _categories
                      .map((c) => DropdownMenuEntry(value: c, label: c))
                      .toList(),
                  onSelected: (v) => setState(() => _selectedCategory = v),
                  inputDecorationTheme: const InputDecorationTheme(
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 10),
                    border: OutlineInputBorder(),
                  ),
                ),

                // Room
                DropdownMenu<String>(
                  width: 160,
                  hintText: 'Select Room',
                  enabled: rooms.isNotEmpty,
                  dropdownMenuEntries: rooms
                      .map((r) => DropdownMenuEntry(value: r.id, label: r.name))
                      .toList(),
                  onSelected: (v) => setState(() => _selectedRoomId = v),
                  inputDecorationTheme: const InputDecorationTheme(
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 10),
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Workers Multi-select Chip (Simplified)
            // Ideally use a MultiSelectDialog, but utilizing FilterChip for now
            if (workers.isNotEmpty) ...[
              const Text('Tag Workers:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                children: workers.map((w) {
                  final isSelected = _selectedWorkerIds.contains(w.id);
                  return FilterChip(
                    label: Text(w.name),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() {
                         if (selected) {
                           _selectedWorkerIds.add(w.id);
                         } else {
                           _selectedWorkerIds.remove(w.id);
                         }
                      });
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
            ],

            // ─── Submit Button ────────────────────────────
            SizedBox(
              height: 48,
              child: FilledButton.icon(
                onPressed: _isPosting ? null : _submit,
                icon: _isPosting 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.send),
                label: Text(_isPosting ? 'Posting...' : 'Post Update'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
