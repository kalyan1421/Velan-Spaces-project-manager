import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/domain/entities/project_update_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/screens/designs/design_viewer_screen.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import 'package:velan_spaces_flutter/domain/entities/room_entity.dart';

class UpdateCard extends ConsumerStatefulWidget {
  const UpdateCard({
    required this.update,
    required this.projectId,
    super.key,
  });

  final ProjectUpdateEntity update;
  final String projectId;

  @override
  ConsumerState<UpdateCard> createState() => _UpdateCardState();
}

class _UpdateCardState extends ConsumerState<UpdateCard> {
  final _commentController = TextEditingController();
  bool _isPostingComment = false;
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;

  @override
  void initState() {
    super.initState();
    if (widget.update.type == 'video' && widget.update.mediaUrls.isNotEmpty) {
      _initializeVideo(widget.update.mediaUrls.first);
    }
  }

  Future<void> _initializeVideo(String url) async {
    _videoController = VideoPlayerController.networkUrl(Uri.parse(url));
    await _videoController!.initialize();
    _chewieController = ChewieController(
      videoPlayerController: _videoController!,
      autoPlay: false,
      looping: false,
      aspectRatio: _videoController!.value.aspectRatio,
      placeholder: const Center(child: CircularProgressIndicator()),
      errorBuilder: (context, errorMessage) {
        return Center(
          child: Text(
            errorMessage,
            style: const TextStyle(color: Colors.white),
          ),
        );
      },
    );
    if(mounted) setState(() {});
  }

  @override
  void dispose() {
    _commentController.dispose();
    _videoController?.dispose();
    _chewieController?.dispose();
    super.dispose();
  }

  Future<void> _postComment() async {
    if (_commentController.text.trim().isEmpty) return;

    setState(() => _isPostingComment = true);
    final meta = ref.read(currentUserMetaProvider);
    final repo = ref.read(projectRepositoryProvider);

    try {
      await repo.addCommentToUpdate(widget.projectId, widget.update.id, {
        'text': _commentController.text.trim(),
        'postedBy': meta['name'] ?? 'Unknown',
        'timestamp': DateTime.now().toIso8601String(),
      });
      _commentController.clear();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to post comment: $e')),
      );
    } finally {
      if (mounted) setState(() => _isPostingComment = false);
    }
  }

  void _openPhoto(String url) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DesignViewerScreen(
          url: url,
          title: 'Photo Update',
          isPdf: false,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final update = widget.update;
    final dateStr = DateFormat('MMM d, y • h:mm a').format(update.timestamp);

    // Fetch room name if roomId is present (optional optimization: fetch all rooms once in parent)
    final roomName = update.roomId != null 
        ? ref.watch(projectRoomsProvider(widget.projectId)).when(
            data: (rooms) => rooms.firstWhere((r) => r.id == update.roomId, orElse: () => RoomEntity(id: '', name: 'Unknown Room', assignedWorkerIds: [])).name,
            loading: () => 'Loading...',
            error: (_,__) => 'Unknown Room')
        : null;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Header ─────────────────────────────────────
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: VelanTheme.highlight.withOpacity(0.1),
                  child: Text(
                    update.postedBy.isNotEmpty ? update.postedBy[0].toUpperCase() : '?',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: VelanTheme.highlight),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(update.postedBy,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      Text(dateStr,
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    update.type.toUpperCase(),
                    style: const TextStyle(fontSize: 10, color: Colors.blue, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // ─── Tags (Category, Room, Workers) ────────────────
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (update.category != null)
                  _buildTag(update.category!, Colors.orange),
                if (roomName != null && roomName != 'Unknown Room')
                  _buildTag(roomName, Colors.teal),
                // We could also show worker names if we fetch them via ID
                if (update.associatedWorkerIds != null && update.associatedWorkerIds!.isNotEmpty)
                   _buildTag('${update.associatedWorkerIds!.length} Workers', Colors.purple),
              ],
            ),
            if (update.category != null || update.roomId != null) const SizedBox(height: 12),

            // ─── Content ────────────────────────────────────
            if (update.content.isNotEmpty)
              Text(
                update.content,
                style: const TextStyle(fontSize: 15, height: 1.4),
              ),
            const SizedBox(height: 12),

            // ─── Media ──────────────────────────────────────
            if (update.type == 'photo' && update.mediaUrls.isNotEmpty)
              GestureDetector(
                onTap: () => _openPhoto(update.mediaUrls.first),
                child: Container(
                  height: 200,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.grey.shade200,
                    image: DecorationImage(
                      image: NetworkImage(update.mediaUrls.first),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
              ),
            if (update.type == 'video' && _chewieController != null)
              Container(
                height: 250,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: Colors.black,
                ),
                clipBehavior: Clip.antiAlias,
                child: Chewie(controller: _chewieController!),
              ),

            // ─── Comments Section ───────────────────────────
            const Divider(height: 32),
            if (update.comments.isNotEmpty) ...[
              ...update.comments.map((c) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${c['postedBy'] ?? 'User'}: ',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Expanded(
                          child: Text(
                            c['text'] ?? '',
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  )),
              const SizedBox(height: 8),
            ],
            
            // Comment Input
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 36,
                    child: TextField(
                      controller: _commentController,
                      decoration: InputDecoration(
                        hintText: 'Add a comment...',
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(18),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                        filled: true,
                        fillColor: Colors.grey.shade50,
                      ),
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _isPostingComment ? null : _postComment,
                  icon: _isPostingComment 
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.send, size: 20, color: VelanTheme.highlight),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTag(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
