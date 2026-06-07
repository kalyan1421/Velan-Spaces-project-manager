import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:velan_spaces_flutter/domain/entities/project_chat_message_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/project_complaint_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/notification_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

class ProjectSupportScreen extends ConsumerStatefulWidget {
  const ProjectSupportScreen({required this.projectId, super.key});

  final String projectId;

  @override
  ConsumerState<ProjectSupportScreen> createState() => _ProjectSupportScreenState();
}

class _ProjectSupportScreenState extends ConsumerState<ProjectSupportScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final TextEditingController _chatController = TextEditingController();
  bool _isSendingChat = false;
  PlatformFile? _pendingChatAttachment;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _chatController.dispose();
    super.dispose();
  }

  Future<void> _pickChatAttachment() async {
    final result = await FilePicker.platform.pickFiles(withData: false);
    if (result == null || result.files.isEmpty) return;
    setState(() => _pendingChatAttachment = result.files.single);
  }

  Future<void> _sendChatMessage() async {
    if (_isSendingChat) return;
    final text = _chatController.text.trim();
    if (text.isEmpty && _pendingChatAttachment == null) return;

    final messenger = ScaffoldMessenger.of(context);
    final meta = ref.read(currentUserMetaProvider);
    final role = ref.read(currentUserRoleProvider);
    final project = await ref.read(projectDetailProvider(widget.projectId).future);
    final senderId = meta['id'] as String? ?? widget.projectId;
    final senderName = meta['name'] as String? ?? project.clientName;

    setState(() => _isSendingChat = true);
    try {
      final attachmentUrls = <String>[];
      var messageType = ProjectChatMessageType.text;

      final pendingChatPath = _pendingChatAttachment?.path;
      if (pendingChatPath != null) {
        final uploaded = await ref
            .read(storageDatasourceProvider)
            .uploadFile(pendingChatPath, 'projects/${widget.projectId}/support/chat');
        attachmentUrls.add(uploaded);
        final ext = (_pendingChatAttachment!.extension ?? '').toLowerCase();
        messageType = ['jpg', 'jpeg', 'png', 'webp', 'heic'].contains(ext)
            ? ProjectChatMessageType.image
            : ProjectChatMessageType.file;
      }

      final success = await ref.read(projectSupportControllerProvider.notifier).sendChatMessage(
            widget.projectId,
            ProjectChatMessageEntity(
              id: '',
              projectId: widget.projectId,
              senderId: senderId,
              senderName: senderName,
              senderRole: role,
              content: text,
              messageType: messageType,
              attachmentUrls: attachmentUrls,
              readBy: [senderId],
              createdAt: DateTime.now(),
            ),
          );

      if (!success) return;

      if (role == UserRole.client || role == UserRole.worker) {
        await ref.read(notificationServiceProvider).notifyAdminOfChat(
              projectId: widget.projectId,
              projectName: project.projectName,
              senderName: senderName,
              senderId: senderId,
            );
        await ref.read(notificationServiceProvider).notifyProjectManagersOfChat(
              managerIds: project.managerIds,
              projectId: widget.projectId,
              projectName: project.projectName,
              senderName: senderName,
              senderId: senderId,
            );
      }

      _chatController.clear();
      setState(() => _pendingChatAttachment = null);
      messenger.showSnackBar(
        const SnackBar(content: Text('Message sent')),
      );
    } finally {
      if (mounted) {
        setState(() => _isSendingChat = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final projectAsync = ref.watch(projectDetailProvider(widget.projectId));
    final role = ref.watch(currentUserRoleProvider);

    return projectAsync.when(
      data: (project) => Scaffold(
        appBar: AppBar(
          title: Text('Support • ${project.projectName}'),
          bottom: TabBar(
            controller: _tabController,
            tabs: const [
              Tab(text: 'Chat'),
              Tab(text: 'Complaints'),
            ],
          ),
        ),
        body: TabBarView(
          controller: _tabController,
          children: [
            Column(
              children: [
                Expanded(
                  child: ref.watch(projectChatMessagesProvider(widget.projectId)).when(
                        data: (messages) {
                          if (messages.isEmpty) {
                            return const Center(child: Text('No messages yet'));
                          }
                          return ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: messages.length,
                            itemBuilder: (context, index) {
                              final message = messages[index];
                              final isMine = (ref.read(currentUserMetaProvider)['id'] as String? ?? '') ==
                                  message.senderId;
                              return Align(
                                alignment:
                                    isMine ? Alignment.centerRight : Alignment.centerLeft,
                                child: Container(
                                  constraints: const BoxConstraints(maxWidth: 320),
                                  margin: const EdgeInsets.only(bottom: 12),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: isMine
                                        ? Theme.of(context).colorScheme.primaryContainer
                                        : Theme.of(context).colorScheme.surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        message.senderName,
                                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                              fontWeight: FontWeight.w700,
                                            ),
                                      ),
                                      if (message.content.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(message.content),
                                      ],
                                      if (message.attachmentUrls.isNotEmpty) ...[
                                        const SizedBox(height: 8),
                                        InkWell(
                                          onTap: () {},
                                          child: Text(
                                            message.messageType == ProjectChatMessageType.image
                                                ? 'Attachment image'
                                                : 'Attachment file',
                                            style: TextStyle(
                                              color: Theme.of(context).colorScheme.primary,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 6),
                                      Text(
                                        DateFormat('dd MMM, h:mm a').format(
                                          message.createdAt ?? DateTime.now(),
                                        ),
                                        style: Theme.of(context).textTheme.labelSmall,
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          );
                        },
                        loading: () =>
                            const Center(child: CircularProgressIndicator()),
                        error: (error, _) => Center(child: Text('Error: $error')),
                      ),
                ),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_pendingChatAttachment != null)
                          Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.attach_file),
                                const SizedBox(width: 8),
                                Expanded(child: Text(_pendingChatAttachment!.name)),
                                IconButton(
                                  onPressed: () =>
                                      setState(() => _pendingChatAttachment = null),
                                  icon: const Icon(Icons.close),
                                ),
                              ],
                            ),
                          ),
                        Row(
                          children: [
                            IconButton(
                              onPressed: _pickChatAttachment,
                              icon: const Icon(Icons.attach_file),
                            ),
                            Expanded(
                              child: TextField(
                                controller: _chatController,
                                minLines: 1,
                                maxLines: 4,
                                decoration: const InputDecoration(
                                  hintText: 'Type a message',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            FilledButton(
                              onPressed: _isSendingChat ? null : _sendChatMessage,
                              child: _isSendingChat
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Text('Send'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            _ComplaintsTab(projectId: widget.projectId, role: role),
          ],
        ),
      ),
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(body: Center(child: Text('Error: $error'))),
    );
  }
}

class _ComplaintsTab extends ConsumerWidget {
  const _ComplaintsTab({
    required this.projectId,
    required this.role,
  });

  final String projectId;
  final UserRole role;

  bool get _canManage =>
      role == UserRole.head || role == UserRole.manager;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateComplaintSheet(context, ref, projectId),
        label: const Text('Raise Complaint'),
        icon: const Icon(Icons.add),
      ),
      body: ref.watch(projectComplaintsProvider(projectId)).when(
            data: (complaints) {
              if (complaints.isEmpty) {
                return const Center(child: Text('No complaints yet'));
              }
              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
                itemCount: complaints.length,
                itemBuilder: (context, index) {
                  final complaint = complaints[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  complaint.title,
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                              ),
                              DropdownButton<ProjectComplaintStatus>(
                                value: complaint.status,
                                onChanged: !_canManage
                                    ? null
                                    : (next) async {
                                        if (next == null) return;
                                        final success = await ref
                                            .read(projectSupportControllerProvider.notifier)
                                            .updateComplaint(
                                              projectId,
                                              complaint.id,
                                              {
                                                'status': next.name,
                                                if (next == ProjectComplaintStatus.resolved ||
                                                    next == ProjectComplaintStatus.closed)
                                                  'resolvedAt': DateTime.now(),
                                              },
                                            );
                                        if (!context.mounted || !success) return;
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text('Complaint updated')),
                                        );
                                      },
                                items: ProjectComplaintStatus.values
                                    .map(
                                      (status) => DropdownMenuItem(
                                        value: status,
                                        child: Text(status.name),
                                      ),
                                    )
                                    .toList(),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(complaint.description),
                          const SizedBox(height: 12),
                          Text(
                            'Raised by ${complaint.createdByName} • ${DateFormat('dd MMM').format(complaint.createdAt ?? DateTime.now())}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          if (complaint.resolutionNote.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Text(
                              'Resolution: ${complaint.resolutionNote}',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                          if (_canManage) ...[
                            const SizedBox(height: 12),
                            OutlinedButton(
                              onPressed: () => _showResolutionNoteDialog(
                                context,
                                ref,
                                projectId,
                                complaint,
                              ),
                              child: Text(
                                complaint.resolutionNote.isEmpty
                                    ? 'Add resolution note'
                                    : 'Edit resolution note',
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => Center(child: Text('Error: $error')),
          ),
    );
  }

  Future<void> _showResolutionNoteDialog(
    BuildContext context,
    WidgetRef ref,
    String projectId,
    ProjectComplaintEntity complaint,
  ) async {
    final controller = TextEditingController(text: complaint.resolutionNote);
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Resolution note'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          decoration: const InputDecoration(border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final success = await ref
                  .read(projectSupportControllerProvider.notifier)
                  .updateComplaint(
                    projectId,
                    complaint.id,
                    {'resolutionNote': controller.text.trim()},
                  );
              if (!dialogContext.mounted || !success) return;
              Navigator.of(dialogContext).pop();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

Future<void> _showCreateComplaintSheet(
  BuildContext context,
  WidgetRef ref,
  String projectId,
) async {
  final titleController = TextEditingController();
  final descriptionController = TextEditingController();
  PlatformFile? attachment;
  final formKey = GlobalKey<FormState>();

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) => StatefulBuilder(
      builder: (context, setState) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Raise Complaint',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: titleController,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  border: OutlineInputBorder(),
                ),
                validator: (value) =>
                    value == null || value.trim().isEmpty ? 'Title is required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: descriptionController,
                minLines: 3,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  border: OutlineInputBorder(),
                ),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Description is required'
                    : null,
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () async {
                  final result = await FilePicker.platform.pickFiles(withData: false);
                  if (result == null || result.files.isEmpty) return;
                  setState(() => attachment = result.files.single);
                },
                icon: const Icon(Icons.attach_file),
                label: Text(
                  attachment == null ? 'Attach file (optional)' : attachment!.name,
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () async {
                  if (!formKey.currentState!.validate()) return;
                  final meta = ref.read(currentUserMetaProvider);
                  final project = await ref.read(projectDetailProvider(projectId).future);
                  final role = ref.read(currentUserRoleProvider);
                  final createdBy = meta['id'] as String? ?? projectId;
                  final createdByName =
                      meta['name'] as String? ?? project.clientName;
                  final attachments = <String>[];
                  final attachmentPath = attachment?.path;
                  if (attachmentPath != null) {
                    final uploaded = await ref
                        .read(storageDatasourceProvider)
                        .uploadFile(attachmentPath, 'projects/$projectId/support/complaints');
                    attachments.add(uploaded);
                  }
                  final success = await ref
                      .read(projectSupportControllerProvider.notifier)
                      .addComplaint(
                        projectId,
                        ProjectComplaintEntity(
                          id: '',
                          projectId: projectId,
                          title: titleController.text.trim(),
                          description: descriptionController.text.trim(),
                          createdBy: createdBy,
                          createdByName: createdByName,
                          attachments: attachments,
                          createdAt: DateTime.now(),
                          updatedAt: DateTime.now(),
                        ),
                      );
                  if (!context.mounted || !success) return;

                  if (role == UserRole.client || role == UserRole.worker) {
                    final notifications = ref.read(notificationServiceProvider);
                    await notifications.notifyAdminOfComplaint(
                      projectId: projectId,
                      projectName: project.projectName,
                      senderName: createdByName,
                      senderId: createdBy,
                      complaintTitle: titleController.text.trim(),
                    );
                    await notifications.notifyManagersOfComplaint(
                      managerIds: project.managerIds,
                      projectId: projectId,
                      projectName: project.projectName,
                      senderName: createdByName,
                      senderId: createdBy,
                      complaintTitle: titleController.text.trim(),
                    );
                  }

                  if (!context.mounted) return;
                  Navigator.of(sheetContext).pop();
                },
                child: const Text('Submit'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
