import 'package:fpdart/fpdart.dart';
import 'package:velan_spaces_flutter/core/errors/failures.dart';
import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/project_update_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/settlement_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/file_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/room_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/design_document_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/expense_entity.dart';

abstract class ProjectRepository {
  // Projects
  Stream<Either<Failure, List<ProjectEntity>>> watchAllProjects();
  Stream<Either<Failure, List<ProjectEntity>>> watchManagerProjects(String managerId);
  Future<Either<Failure, String>> createProject(ProjectEntity project);
  Future<Either<Failure, ProjectEntity>> getProjectById(String projectId);
  Future<Either<Failure, void>> updateProject(String projectId, Map<String, dynamic> data);

  // Updates
  Stream<Either<Failure, List<ProjectUpdateEntity>>> watchProjectUpdates(String projectId);
  Future<Either<Failure, void>> addUpdate(String projectId, ProjectUpdateEntity update);
  Future<Either<Failure, void>> addCommentToUpdate(String projectId, String updateId, Map<String, dynamic> comment);

  // Designs
  Stream<Either<Failure, List<DesignDocumentEntity>>> watchDesigns(String projectId);
  Future<Either<Failure, void>> addDesign(String projectId, DesignDocumentEntity design, {String? filePath});
  Future<Either<Failure, void>> deleteDesign(String projectId, String designId, String fileUrl);

  // Files (formerly Designs)
  Stream<Either<Failure, List<FileEntity>>> watchFiles(String projectId);
  Future<Either<Failure, void>> addFile(String projectId, FileEntity file);
  Future<Either<Failure, void>> updateFile(String projectId, FileEntity file);
  Future<Either<Failure, void>> updateDesignStatus(
      String projectId, String designId, String status);

  // Settlements
  Stream<Either<Failure, List<SettlementEntity>>> watchSettlements(String projectId);
  Future<Either<Failure, void>> addSettlement(String projectId, SettlementEntity settlement);

  // Rooms
  Stream<Either<Failure, List<RoomEntity>>> watchRooms(String projectId);
  Future<Either<Failure, String>> addRoom(String projectId, RoomEntity room);
  Future<Either<Failure, void>> updateRoom(String projectId, String roomId, Map<String, dynamic> data);

  // Expenses (formerly Budget Transactions)
  Stream<Either<Failure, List<ExpenseEntity>>> watchExpenses(String projectId);
  Future<Either<Failure, void>> addExpense(String projectId, ExpenseEntity expense);
}