import 'package:fpdart/fpdart.dart';
import 'package:velan_spaces_flutter/core/errors/failures.dart';
import 'package:velan_spaces_flutter/data/datasources/project_datasource.dart';
import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';
import 'package:velan_spaces_flutter/domain/repositories/project_repository.dart';
import 'package:velan_spaces_flutter/data/models/project_model.dart';
import 'package:velan_spaces_flutter/domain/entities/project_update_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/settlement_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/file_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/room_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/expense_entity.dart';
import 'package:velan_spaces_flutter/data/models/project_update_model.dart';
import 'package:velan_spaces_flutter/data/models/settlement_model.dart';
import 'package:velan_spaces_flutter/data/models/file_model.dart';
import 'package:velan_spaces_flutter/data/models/room_model.dart';
import 'package:velan_spaces_flutter/data/models/expense_model.dart';
import 'package:velan_spaces_flutter/data/datasources/storage_datasource.dart';
import 'package:velan_spaces_flutter/domain/entities/design_document_entity.dart';
import 'package:velan_spaces_flutter/data/models/design_document_model.dart';
import 'package:velan_spaces_flutter/domain/entities/project_chat_message_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/project_complaint_entity.dart';
import 'package:velan_spaces_flutter/data/models/project_chat_message_model.dart';
import 'package:velan_spaces_flutter/data/models/project_complaint_model.dart';

class ProjectRepositoryImpl implements ProjectRepository {
  final ProjectDatasource datasource;
  final StorageDatasource storageDatasource;

  ProjectRepositoryImpl(this.datasource, this.storageDatasource);

  @override
  Stream<Either<Failure, List<ProjectEntity>>> watchAllProjects() {
    try {
      return datasource.watchAllProjects().map(
            (projects) => right<Failure, List<ProjectEntity>>(projects),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Stream<Either<Failure, List<ProjectEntity>>> watchManagerProjects(String managerId) {
    try {
      return datasource.watchManagerProjects(managerId).map(
            (projects) => right<Failure, List<ProjectEntity>>(projects),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Future<Either<Failure, String>> createProject(ProjectEntity project) async {
    try {
      final projectModel = ProjectModel(
        id: project.id,
        projectCode: project.projectCode,
        projectName: project.projectName,
        clientName: project.clientName,
        clientPhone: project.clientPhone,
        clientEmail: project.clientEmail,
        location: project.location,
        budget: project.budget,
        estimatedCost: project.estimatedCost,
        currentSpend: project.currentSpend,
        completionPercentage: project.completionPercentage,
        isComplete: project.isComplete,
        managerIds: project.managerIds,
        workerIds: project.workerIds,
      );
      final projectId = await datasource.createProject(projectModel);
      return right(projectId);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, ProjectEntity>> getProjectById(String projectId) async {
    try {
      final project = await datasource.getProjectById(projectId);
      return right(project);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> updateProject(
      String projectId, Map<String, dynamic> data) async {
    try {
      await datasource.updateProject(projectId, data);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> deleteProject(String projectId) async {
    try {
      await datasource.deleteProject(projectId);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  // ─── Updates ─────────────────────────────────────────────────────────

  @override
  Stream<Either<Failure, List<ProjectUpdateEntity>>> watchProjectUpdates(
      String projectId) {
    try {
      return datasource.watchProjectUpdates(projectId).map(
            (updates) => right<Failure, List<ProjectUpdateEntity>>(updates),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Future<Either<Failure, void>> addUpdate(
      String projectId, ProjectUpdateEntity update) async {
    try {
      final model = ProjectUpdateModel(
        id: '',
        postedBy: update.postedBy,
        role: update.role,
        type: update.type,
        content: update.content,
        timestamp: update.timestamp,
        category: update.category,
        roomId: update.roomId,
        associatedWorkerIds: update.associatedWorkerIds,
        mediaUrls: update.mediaUrls,
      );
      await datasource.addUpdate(projectId, model);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> addCommentToUpdate(
      String projectId, String updateId, Map<String, dynamic> comment) async {
    try {
      await datasource.addCommentToUpdate(projectId, updateId, comment);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  // ─── Designs ─────────────────────────────────────────────────────────

  @override
  Stream<Either<Failure, List<DesignDocumentEntity>>> watchDesigns(String projectId) {
    try {
      return datasource.watchDesigns(projectId).map(
            (designs) => right<Failure, List<DesignDocumentEntity>>(designs),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Future<Either<Failure, void>> addDesign(
      String projectId, DesignDocumentEntity design,
      {String? filePath}) async {
    try {
      String fileUrl = design.fileUrl;
      if (filePath != null) {
        fileUrl = await storageDatasource.uploadFile(
            filePath, 'projects/$projectId/designs');
      }

      final model = DesignDocumentModel(
        id: design.id,
        title: design.title,
        fileUrl: fileUrl,
        type: design.type,
        approvalStatus: design.approvalStatus,
        postedBy: design.postedBy,
        timestamp: design.timestamp,
        roomName: design.roomName,
        projectId: projectId,
      );

      await datasource.addDesign(projectId, model);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }



  @override
  Future<Either<Failure, void>> deleteDesign(String projectId, String designId, String fileUrl) async {
    try {
      if (fileUrl.isNotEmpty) {
        await storageDatasource.deleteFile(fileUrl);
      }
      await datasource.deleteDesign(projectId, designId);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  // ─── Files (formerly Designs) ─────────────────────────────────────────

  @override
  Stream<Either<Failure, List<FileEntity>>> watchFiles(
      String projectId) {
    try {
      return datasource.watchFiles(projectId).map(
            (files) => right<Failure, List<FileEntity>>(files),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Future<Either<Failure, void>> addFile(
      String projectId, FileEntity file) async {
    try {
      final model = FileModel.fromEntity(file);
      await datasource.addFile(projectId, model);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> updateFile(
      String projectId, FileEntity file) async {
    try {
      final model = FileModel.fromEntity(file);
      await datasource.updateFile(projectId, model);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> updateDesignStatus(
      String projectId, String designId, String status) async {
    try {
      await datasource.updateDesignStatus(projectId, designId, status);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  // ─── Settlements ─────────────────────────────────────────────────────

  @override
  Stream<Either<Failure, List<SettlementEntity>>> watchSettlements(
      String projectId) {
    try {
      return datasource.watchSettlements(projectId).map(
            (items) => right<Failure, List<SettlementEntity>>(items),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Future<Either<Failure, void>> addSettlement(
      String projectId, SettlementEntity settlement) async {
    try {
      final model = SettlementModel(
        id: '',
        description: settlement.description,
        amount: settlement.amount,
        date: settlement.date,
        paidTo: settlement.paidTo,
        paymentMethod: settlement.paymentMethod,
        addedBy: settlement.addedBy,
        proofUrl: settlement.proofUrl,
      );
      await datasource.addSettlement(projectId, model);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  // ─── Rooms ───────────────────────────────────────────────────────────

  @override
  Stream<Either<Failure, List<RoomEntity>>> watchRooms(String projectId) {
    try {
      return datasource.watchRooms(projectId).map(
            (rooms) => right<Failure, List<RoomEntity>>(rooms),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Future<Either<Failure, String>> addRoom(
      String projectId, RoomEntity room) async {
    try {
      final model = RoomModel(
        id: '',
        name: room.name,
        assignedWorkerIds: room.assignedWorkerIds,
      );
      final roomId = await datasource.addRoom(projectId, model);
      return right(roomId);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> updateRoom(
      String projectId, String roomId, Map<String, dynamic> data) async {
    try {
      await datasource.updateRoom(projectId, roomId, data);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  // ─── Expenses (formerly Budget Transactions) ─────────────────────────

  @override
  Stream<Either<Failure, List<ExpenseEntity>>> watchExpenses(
      String projectId) {
    try {
      return datasource.watchExpenses(projectId).map(
            (expenses) => right<Failure, List<ExpenseEntity>>(expenses),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Future<Either<Failure, void>> addExpense(
      String projectId, ExpenseEntity expense) async {
    try {
      final model = ExpenseModel.fromEntity(expense);
      await datasource.addExpense(projectId, model);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> deleteRoom(
      String projectId, String roomId) async {
    try {
      await datasource.deleteRoom(projectId, roomId);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> updateExpense(
      String projectId, String expenseId, Map<String, dynamic> data) async {
    try {
      await datasource.updateExpense(projectId, expenseId, data);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> deleteExpense(
      String projectId, String expenseId) async {
    try {
      await datasource.deleteExpense(projectId, expenseId);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Stream<Either<Failure, List<ProjectChatMessageEntity>>> watchProjectChatMessages(
    String projectId,
  ) {
    try {
      return datasource.watchProjectChatMessages(projectId).map(
            (messages) =>
                right<Failure, List<ProjectChatMessageEntity>>(messages),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Future<Either<Failure, void>> addProjectChatMessage(
    String projectId,
    ProjectChatMessageEntity message,
  ) async {
    try {
      await datasource.addProjectChatMessage(
        projectId,
        ProjectChatMessageModel(
          id: message.id,
          projectId: message.projectId,
          senderId: message.senderId,
          senderName: message.senderName,
          senderRole: message.senderRole,
          content: message.content,
          messageType: message.messageType,
          attachmentUrls: message.attachmentUrls,
          readBy: message.readBy,
          createdAt: message.createdAt,
        ),
      );
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Stream<Either<Failure, List<ProjectComplaintEntity>>> watchProjectComplaints(
    String projectId,
  ) {
    try {
      return datasource.watchProjectComplaints(projectId).map(
            (complaints) =>
                right<Failure, List<ProjectComplaintEntity>>(complaints),
          );
    } catch (e) {
      return Stream.value(left(ServerFailure(e.toString())));
    }
  }

  @override
  Future<Either<Failure, void>> addProjectComplaint(
    String projectId,
    ProjectComplaintEntity complaint,
  ) async {
    try {
      await datasource.addProjectComplaint(
        projectId,
        ProjectComplaintModel(
          id: complaint.id,
          projectId: complaint.projectId,
          title: complaint.title,
          description: complaint.description,
          createdBy: complaint.createdBy,
          createdByName: complaint.createdByName,
          status: complaint.status,
          attachments: complaint.attachments,
          resolutionNote: complaint.resolutionNote,
          createdAt: complaint.createdAt,
          updatedAt: complaint.updatedAt,
          resolvedAt: complaint.resolvedAt,
        ),
      );
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> updateProjectComplaint(
    String projectId,
    String complaintId,
    Map<String, dynamic> data,
  ) async {
    try {
      await datasource.updateProjectComplaint(projectId, complaintId, data);
      return right(null);
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }
}
