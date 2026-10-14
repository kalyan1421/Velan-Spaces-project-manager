import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/data/datasources/project_datasource.dart';
import 'package:velan_spaces_flutter/data/models/design_document_model.dart';
import 'package:velan_spaces_flutter/data/models/expense_model.dart';
import 'package:velan_spaces_flutter/data/models/file_model.dart';
import 'package:velan_spaces_flutter/data/models/project_chat_message_model.dart';
import 'package:velan_spaces_flutter/data/models/project_complaint_model.dart';
import 'package:velan_spaces_flutter/data/models/project_model.dart';
import 'package:velan_spaces_flutter/data/models/project_update_model.dart';
import 'package:velan_spaces_flutter/data/models/room_model.dart';
import 'package:velan_spaces_flutter/data/models/settlement_model.dart';

/// [ProjectDatasource] backed by the Velan API. "watch" methods poll (see
/// core/api/polling.dart) and refresh immediately after this app's own writes.
class ApiProjectDatasource implements ProjectDatasource {
  ApiProjectDatasource(this._api);

  final ApiClient _api;

  List<Map<String, dynamic>> _list(dynamic json) =>
      (json as List? ?? const []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();

  Stream<List<T>> _watch<T>(
    String path,
    T Function(Map<String, dynamic>) fromApi, {
    required List<String> topics,
    Map<String, String>? query,
  }) {
    return pollJson<List<T>>(
      fetchJson: () => _api.get(path, query: query),
      map: (json) => _list(json).map(fromApi).toList(),
      topics: topics,
    );
  }

  void _changed(String projectId) =>
      ApiInvalidation.instance.notifyAll([ApiTopics.project(projectId), ApiTopics.projects]);

  /// Firestore-era update maps -> API body (dates as ISO strings).
  Map<String, dynamic> _projectPatch(Map<String, dynamic> data) {
    final out = <String, dynamic>{};
    data.forEach((key, value) {
      if (value is DateTime) {
        out[key] = (key == 'startDate' || key == 'targetEndDate') ? apiDateOnly(value) : apiTimestamp(value);
      } else if (value == null || value is String || value is num || value is bool || value is List) {
        out[key] = value;
      } else {
        throw ArgumentError('Unsupported value for "$key" (${value.runtimeType})');
      }
    });
    return out;
  }

  // ------------------------------------------------------------ projects
  @override
  Stream<List<ProjectModel>> watchAllProjects() =>
      _watch('/projects', ProjectModel.fromApi, topics: [ApiTopics.projects]);

  /// The API already scopes the list to the caller's own projects.
  @override
  Stream<List<ProjectModel>> watchManagerProjects(String managerId) => watchAllProjects();

  @override
  Future<String> createProject(ProjectModel project) async {
    final res = await _api.post('/projects', {
      'projectCode': project.projectCode,
      'projectName': project.projectName,
      'clientName': project.clientName,
      'clientPhone': project.clientPhone,
      'clientEmail': project.clientEmail,
      'location': project.location,
      'budget': project.budget,
      'estimatedCost': project.estimatedCost,
      'startDate': apiDateOnly(project.startDate),
      'targetEndDate': apiDateOnly(project.targetEndDate),
      if (project.managerIds.isNotEmpty) 'managerIds': project.managerIds,
      if (project.workerIds.isNotEmpty) 'workerIds': project.workerIds,
      if (project.budgetAccessManagerIds.isNotEmpty)
        'budgetAccessManagerIds': project.budgetAccessManagerIds,
    }) as Map<String, dynamic>;
    ApiInvalidation.instance.notify(ApiTopics.projects);
    return res['id'] as String;
  }

  /// Accepts the project id. (Clients no longer look projects up by code.)
  @override
  Future<ProjectModel> getProjectById(String projectId) async {
    final res = await _api.get('/projects/$projectId') as Map<String, dynamic>;
    return ProjectModel.fromApi(res);
  }

  @override
  Future<void> updateProject(String projectId, Map<String, dynamic> data) async {
    await _api.patch('/projects/$projectId', _projectPatch(data));
    _changed(projectId);
  }

  @override
  Future<void> deleteProject(String projectId) async {
    await _api.delete('/projects/$projectId');
    ApiInvalidation.instance.notify(ApiTopics.projects);
  }

  // ------------------------------------------------------------ updates
  @override
  Stream<List<ProjectUpdateModel>> watchProjectUpdates(String projectId) => _watch(
        '/projects/$projectId/updates',
        ProjectUpdateModel.fromApi,
        topics: [ApiTopics.project(projectId)],
        query: {'limit': '100'},
      );

  @override
  Future<void> addUpdate(String projectId, ProjectUpdateModel update) async {
    await _api.post('/projects/$projectId/updates', {
      'type': update.type,
      'content': update.content,
      if (update.category != null) 'category': update.category,
      if (update.roomId != null && update.roomId!.isNotEmpty) 'roomId': update.roomId,
      'associatedWorkerIds': update.associatedWorkerIds,
      if (update.progressPercentage != null) 'progressPercentage': update.progressPercentage,
      'mediaUrls': update.mediaUrls,
      'isClientViewable': true,
    });
    _changed(projectId);
  }

  @override
  Future<void> addCommentToUpdate(String projectId, String updateId, Map<String, dynamic> comment) async {
    // Author and time are set by the server from the signed-in user.
    await _api.post('/projects/$projectId/updates/$updateId/comments', {'text': comment['text']});
    _changed(projectId);
  }

  // ------------------------------------------------------------ designs
  @override
  Stream<List<DesignDocumentModel>> watchDesigns(String projectId) =>
      _watch('/projects/$projectId/designs', DesignDocumentModel.fromApi, topics: [ApiTopics.project(projectId)]);

  @override
  Future<void> addDesign(String projectId, DesignDocumentModel design) async {
    await _api.post('/projects/$projectId/designs', {
      'title': design.title,
      'fileUrl': design.fileUrl,
      'type': design.type,
      if (design.roomName.isNotEmpty) 'roomName': design.roomName,
      'approvalRequired': design.approvalStatus.required,
    });
    _changed(projectId);
  }

  @override
  Future<void> deleteDesign(String projectId, String designId) async {
    await _api.delete('/projects/$projectId/designs/$designId');
    _changed(projectId);
  }

  /// Approval status values come from the app's design approval UI.
  @override
  Future<void> updateDesignStatus(String projectId, String designId, String status) async {
    await _api.patch('/projects/$projectId/designs/$designId', {'approvalApproved': status == 'approved'});
    _changed(projectId);
  }

  // ------------------------------------------------------------ files
  @override
  Stream<List<FileModel>> watchFiles(String projectId) =>
      _watch('/projects/$projectId/files', FileModel.fromApi, topics: [ApiTopics.project(projectId)]);

  @override
  Future<void> addFile(String projectId, FileModel file) async {
    await _api.post('/projects/$projectId/files', {
      'name': file.name,
      'title': file.title,
      'storagePath': file.storagePath,
      'category': file.category,
      'type': file.type,
      'size': file.size,
      if (file.roomName.isNotEmpty) 'roomName': file.roomName,
    });
    _changed(projectId);
  }

  @override
  Future<void> updateFile(String projectId, FileModel file) async {
    await _api.patch('/projects/$projectId/files/${file.id}', {
      'title': file.title,
      'name': file.name,
      'category': file.category,
      'storagePath': file.storagePath,
      'version': file.version,
      'size': file.size,
      'approvalStatus': file.approvalStatus,
      if (file.roomName.isNotEmpty) 'roomName': file.roomName,
    });
    _changed(projectId);
  }

  // ------------------------------------------------------------ rooms
  @override
  Stream<List<RoomModel>> watchRooms(String projectId) =>
      _watch('/projects/$projectId/rooms', RoomModel.fromApi, topics: [ApiTopics.project(projectId)]);

  @override
  Future<String> addRoom(String projectId, RoomModel room) async {
    final res = await _api.post('/projects/$projectId/rooms', {
      'name': room.name,
      'assignedWorkerIds': room.assignedWorkerIds,
    }) as Map<String, dynamic>;
    _changed(projectId);
    return res['id'] as String;
  }

  @override
  Future<void> updateRoom(String projectId, String roomId, Map<String, dynamic> data) async {
    await _api.patch('/projects/$projectId/rooms/$roomId', {
      if (data.containsKey('name')) 'name': data['name'],
      if (data.containsKey('assignedWorkerIds')) 'assignedWorkerIds': data['assignedWorkerIds'],
    });
    _changed(projectId);
  }

  @override
  Future<void> deleteRoom(String projectId, String roomId) async {
    await _api.delete('/projects/$projectId/rooms/$roomId');
    _changed(projectId);
  }

  // ------------------------------------------------------------ chat
  @override
  Stream<List<ProjectChatMessageModel>> watchProjectChatMessages(String projectId) {
    // API returns newest first (paginated); the chat UI shows oldest first.
    return pollJson<List<ProjectChatMessageModel>>(
      fetchJson: () => _api.get('/projects/$projectId/chat', query: {'limit': '100'}),
      map: (json) => _list(json).map(ProjectChatMessageModel.fromApi).toList().reversed.toList(),
      topics: [ApiTopics.project(projectId)],
      every: const Duration(seconds: 4),
    );
  }

  @override
  Future<void> addProjectChatMessage(String projectId, ProjectChatMessageModel message) async {
    await _api.post('/projects/$projectId/chat', {
      'content': message.content,
      'messageType': message.messageType.name,
      'attachmentUrls': message.attachmentUrls,
    });
    _changed(projectId);
  }

  // ------------------------------------------------------------ complaints
  @override
  Stream<List<ProjectComplaintModel>> watchProjectComplaints(String projectId) => _watch(
        '/projects/$projectId/complaints',
        ProjectComplaintModel.fromApi,
        topics: [ApiTopics.project(projectId)],
      );

  @override
  Future<void> addProjectComplaint(String projectId, ProjectComplaintModel complaint) async {
    await _api.post('/projects/$projectId/complaints', {
      'title': complaint.title,
      if (complaint.description.isNotEmpty) 'description': complaint.description,
      'attachments': complaint.attachments,
    });
    _changed(projectId);
  }

  /// The server stamps updatedAt/resolvedAt; only status and note are sent.
  @override
  Future<void> updateProjectComplaint(String projectId, String complaintId, Map<String, dynamic> data) async {
    await _api.patch('/projects/$projectId/complaints/$complaintId', {
      if (data['status'] != null) 'status': data['status'],
      if (data.containsKey('resolutionNote')) 'resolutionNote': data['resolutionNote'],
    });
    _changed(projectId);
  }

  // ------------------------------------------------------------ budget
  // Settlements and expenses move to the API in the budget module (next step).
  static UnsupportedError _budgetPending() =>
      UnsupportedError('Budget is being moved to the new server and is not available yet.');

  @override
  Stream<List<SettlementModel>> watchSettlements(String projectId) => Stream.error(_budgetPending());

  @override
  Future<void> addSettlement(String projectId, SettlementModel settlement) async => throw _budgetPending();

  @override
  Stream<List<ExpenseModel>> watchExpenses(String projectId) => Stream.error(_budgetPending());

  @override
  Future<void> addExpense(String projectId, ExpenseModel expense) async => throw _budgetPending();

  @override
  Future<void> updateExpense(String projectId, String expenseId, Map<String, dynamic> data) async =>
      throw _budgetPending();

  @override
  Future<void> deleteExpense(String projectId, String expenseId) async => throw _budgetPending();
}
