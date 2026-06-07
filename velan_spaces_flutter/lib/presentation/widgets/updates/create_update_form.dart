import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:velan_spaces_flutter/domain/entities/project_update_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/notification_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:video_player/video_player.dart';
import 'package:velan_spaces_flutter/core/services/media_compression_service.dart';

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
  
  XFile? _mediaFile; // single video file when _type == 'video'
  final List<XFile> _photoFiles = []; // multiple photos when _type == 'photo'
  VideoPlayerController? _videoController;

  bool _isPosting = false;
  String? _uploadStage;
  String? _uploadError;
  DateTime? _lastPostedAt;

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

  void _showMediaSourcePicker(String type) {
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
              Text(
                type == 'photo' ? 'Select Photo Source' : 'Select Video Source',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt, color: Colors.black87),
                title: const Text('Camera'),
                subtitle: Text(type == 'photo' ? 'Take a photo' : 'Record a video'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickMedia(type, ImageSource.camera);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: Colors.black87),
                title: const Text('Gallery'),
                subtitle: Text(type == 'photo' ? 'Choose from gallery' : 'Choose from gallery'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickMedia(type, ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickMedia(String type, ImageSource source) async {
    final picker = ImagePicker();

    if (type == 'photo') {
      // Gallery → allow selecting many photos at once. Camera → single shot
      // appended to the existing selection.
      if (source == ImageSource.gallery) {
        final files = await picker.pickMultiImage();
        if (files.isNotEmpty) {
          setState(() {
            _photoFiles.addAll(files);
            _type = 'photo';
            _mediaFile = null;
            _videoController?.dispose();
            _videoController = null;
          });
        }
      } else {
        final file = await picker.pickImage(source: source);
        if (file != null) {
          setState(() {
            _photoFiles.add(file);
            _type = 'photo';
            _mediaFile = null;
            _videoController?.dispose();
            _videoController = null;
          });
        }
      }
    } else if (type == 'video') {
      final file = await picker.pickVideo(source: source);
      if (file != null) {
        _videoController?.dispose();
        _videoController = VideoPlayerController.file(File(file.path))
          ..initialize().then((_) {
            setState(() {});
          });
        setState(() {
          _mediaFile = file;
          _photoFiles.clear();
          _type = 'video';
        });
      }
    }
  }

  void _removePhotoAt(int index) {
    setState(() {
      _photoFiles.removeAt(index);
      if (_photoFiles.isEmpty) _type = 'message';
    });
  }

  void _clearMedia() {
    setState(() {
      _mediaFile = null;
      _photoFiles.clear();
      _videoController?.dispose();
      _videoController = null;
      _type = 'message';
    });
  }

  Future<void> _validateFileSize(String path, {required bool isVideo}) async {
    final bytes = await File(path).length();
    final maxBytes = isVideo ? 200 * 1024 * 1024 : 15 * 1024 * 1024;
    if (bytes > maxBytes) {
      throw Exception(
        isVideo
            ? 'Video is too large. Select a file under 200 MB.'
            : 'Photo is too large. Select an image under 15 MB.',
      );
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_isPosting) return;
    if (_type == 'photo' && _photoFiles.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one photo')),
      );
      return;
    }
    if (_type == 'video' && _mediaFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a video')),
      );
      return;
    }

    setState(() {
      _isPosting = true;
      _uploadError = null;
      _uploadStage = 'Validating update';
    });

    try {
      final repo = ref.read(projectRepositoryProvider);
      final meta = ref.read(currentUserMetaProvider);
      final role = ref.read(currentUserRoleProvider);
      final storage = ref.read(storageDatasourceProvider);

      List<String> mediaUrls = [];
      final path = 'projects/${widget.projectId}/updates';

      // Upload Media if present
      if (_type == 'photo' && _photoFiles.isNotEmpty) {
        setState(() => _uploadStage = 'Preparing photos');
        // Compress each photo before upload to prevent OOM/timeout.
        final compressedPaths = <String>[];
        for (final f in _photoFiles) {
          await _validateFileSize(f.path, isVideo: false);
          compressedPaths.add(
              await MediaCompressionService.compressImage(f.path));
        }
        setState(() =>
            _uploadStage = 'Uploading ${compressedPaths.length} photo(s)');
        mediaUrls = await storage.uploadMultipleFiles(compressedPaths, path);
      } else if (_type == 'video' && _mediaFile != null) {
        setState(() => _uploadStage = 'Preparing video');
        await _validateFileSize(_mediaFile!.path, isVideo: true);
        final compressed =
            await MediaCompressionService.compressVideo(_mediaFile!.path);
        setState(() => _uploadStage = 'Uploading video');
        mediaUrls.add(await storage.uploadFile(compressed, path));
      }

      setState(() => _uploadStage = 'Saving update');
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

      // ─── Notification trigger ─────────────────────────────
      try {
        setState(() => _uploadStage = 'Sending notifications');
        final ns = ref.read(notificationServiceProvider);
        // Fetch project to get managerIds
        final project = await repo.getProjectById(widget.projectId)
            .then((r) => r.fold((_) => null, (p) => p));
        await ns.dispatchUpdateNotification(
          senderRole: role,
          senderId: meta['id'] as String? ?? '',
          senderName: meta['name'] as String? ?? 'Unknown',
          projectId: widget.projectId,
          projectName: project?.projectName ?? '',
          managerIds: project?.managerIds ?? [],
        );
      } catch (_) {}
      // ─────────────────────────────────────────────────────

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
          _uploadStage = null;
          _lastPostedAt = DateTime.now();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _uploadError = e.toString();
          _uploadStage = null;
        });
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
        border: Border.all(color: Colors.grey.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_uploadStage != null || _uploadError != null || _lastPostedAt != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _uploadError != null
                        ? Theme.of(context)
                            .colorScheme
                            .errorContainer
                            .withValues(alpha: 0.6)
                        : Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _uploadError ??
                        _uploadStage ??
                        'Last update posted at ${TimeOfDay.fromDateTime(_lastPostedAt!).format(context)}',
                  ),
                ),
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
                    _showMediaSourcePicker(type);
                  } else {
                    _clearMedia();
                  }
                },
                style: const ButtonStyle(
                  visualDensity: VisualDensity.compact,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
              const SizedBox(height: 16),
  
              // ─── Photo Preview (multiple) ─────────────────
              if (_photoFiles.isNotEmpty) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${_photoFiles.length} photo(s) selected',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    TextButton.icon(
                      onPressed: () => _showMediaSourcePicker('photo'),
                      icon: const Icon(Icons.add_a_photo, size: 18),
                      label: const Text('Add more'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 100,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _photoFiles.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      return Stack(
                        alignment: Alignment.topRight,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: kIsWeb
                                ? Image.network(
                                    _photoFiles[index].path,
                                    width: 100, height: 100, fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => const Icon(Icons.image, size: 48),
                                  )
                                : Image.file(
                                    File(_photoFiles[index].path),
                                    width: 100, height: 100, fit: BoxFit.cover,
                                  ),
                          ),
                          InkWell(
                            onTap: () => _removePhotoAt(index),
                            child: Container(
                              margin: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: Colors.black54,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.close,
                                  color: Colors.white, size: 18),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // ─── Video Preview (single) ───────────────────
              if (_type == 'video' && _mediaFile != null) ...[
                Stack(
                  alignment: Alignment.topRight,
                  children: [
                    Container(
                      height: 200,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.black,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
                      ),
                      child: _videoController != null &&
                              _videoController!.value.isInitialized
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
                const SizedBox(height: 16),
              ],
  
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
      ),
    );
  }
}
