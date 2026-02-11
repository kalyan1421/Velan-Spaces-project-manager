import 'package:velan_spaces_flutter/data/models/project_model.dart';
import 'package:velan_spaces_flutter/data/models/project_update_model.dart';
import 'package:velan_spaces_flutter/data/models/settlement_model.dart';
import 'package:velan_spaces_flutter/data/models/file_model.dart';
import 'package:velan_spaces_flutter/data/models/room_model.dart';
import 'package:velan_spaces_flutter/data/models/design_document_model.dart';
import 'package:velan_spaces_flutter/data/models/expense_model.dart';

abstract class ProjectDatasource {
  // Projects
  Stream<List<ProjectModel>> watchAllProjects();
  Stream<List<ProjectModel>> watchManagerProjects(String managerId);
  Future<String> createProject(ProjectModel project);
  Future<ProjectModel> getProjectById(String projectId);
  Future<void> updateProject(String projectId, Map<String, dynamic> data);

  // Updates
  Stream<List<ProjectUpdateModel>> watchProjectUpdates(String projectId);
  Future<void> addUpdate(String projectId, ProjectUpdateModel update);
  Future<void> addCommentToUpdate(String projectId, String updateId, Map<String, dynamic> comment);

  // Designs
  Stream<List<DesignDocumentModel>> watchDesigns(String projectId);
  Future<void> addDesign(String projectId, DesignDocumentModel design);
  Future<void> deleteDesign(String projectId, String designId);

  // Files (formerly Designs)
  Stream<List<FileModel>> watchFiles(String projectId);
  Future<void> addFile(String projectId, FileModel file);
  Future<void> updateFile(String projectId, FileModel file); // For updates like versioning
  Future<void> updateDesignStatus(String projectId, String designId, String status);

  // Settlements
  Stream<List<SettlementModel>> watchSettlements(String projectId);
  Future<void> addSettlement(String projectId, SettlementModel settlement);

  // Rooms
  Stream<List<RoomModel>> watchRooms(String projectId);
  Future<String> addRoom(String projectId, RoomModel room);
  Future<void> updateRoom(String projectId, String roomId, Map<String, dynamic> data);

  // Expenses (formerly Budget Transactions)
  Stream<List<ExpenseModel>> watchExpenses(String projectId);
  Future<void> addExpense(String projectId, ExpenseModel expense);
}