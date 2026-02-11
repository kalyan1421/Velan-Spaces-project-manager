import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/data/datasources/project_datasource.dart';
import 'package:velan_spaces_flutter/data/models/project_model.dart';
import 'package:velan_spaces_flutter/data/models/project_update_model.dart';
import 'package:velan_spaces_flutter/data/models/settlement_model.dart';
import 'package:velan_spaces_flutter/data/models/design_document_model.dart';
import 'package:velan_spaces_flutter/data/models/file_model.dart';
import 'package:velan_spaces_flutter/data/models/room_model.dart';
import 'package:velan_spaces_flutter/data/models/expense_model.dart';

// New Schema Path
const String _orgProjectsCollection = 'projects';
const String _updatesSubcollection = 'updates';
const String _filesSubcollection = 'files';
const String _designsSubcollection = 'designs';
const String _settlementsSubcollection = 'settlements';
const String _roomsSubcollection = 'rooms';
const String _expensesSubcollection = 'expenses';

class FirestoreProjectDatasourceImpl implements ProjectDatasource {
  final FirebaseFirestore _firestore;

  FirestoreProjectDatasourceImpl(this._firestore);

  // ─── Projects ──────────────────────────────────────────────────────────

  @override
  Stream<List<ProjectModel>> watchAllProjects() {
    return _firestore
        .collection(_orgProjectsCollection) // Updated path
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) => ProjectModel.fromSnapshot(doc)).toList();
    });
  }

  @override
  Stream<List<ProjectModel>> watchManagerProjects(String managerId) {
    return _firestore
        .collection(_orgProjectsCollection)
        .where('managerIds', arrayContains: managerId)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) => ProjectModel.fromSnapshot(doc)).toList();
    });
  }

  @override
  Future<String> createProject(ProjectModel project) async {
    final docRef = await _firestore.collection(_orgProjectsCollection).add(
      {
        ...project.toJson(),
        'createdAt': FieldValue.serverTimestamp(),
      },
    );
    return docRef.id;
  }

  @override
  Future<ProjectModel> getProjectById(String projectId) async {
    final docSnap = await _firestore.collection(_orgProjectsCollection).doc(projectId).get();
    if (docSnap.exists) {
      return ProjectModel.fromSnapshot(docSnap);
    } else {
      throw Exception('Project not found');
    }
  }

  @override
  Future<void> updateProject(String projectId, Map<String, dynamic> data) async {
    await _firestore.collection(_orgProjectsCollection).doc(projectId).update(data);
  }

  // ─── Updates ───────────────────────────────────────────────────────────

  @override
  Stream<List<ProjectUpdateModel>> watchProjectUpdates(String projectId) {
    return _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_updatesSubcollection)
        .orderBy('timestamp', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) => ProjectUpdateModel.fromSnapshot(doc)).toList();
    });
  }

  @override
  Future<void> addUpdate(String projectId, ProjectUpdateModel update) async {
    final updatesColl = _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_updatesSubcollection);

    if (update.progressPercentage != null) {
      await _firestore.collection(_orgProjectsCollection).doc(projectId).update({
        'completionPercentage': update.progressPercentage,
      });
    }

    await updatesColl.add({
      ...update.toJson(),
      'timestamp': FieldValue.serverTimestamp(),
      'comments': [],
    });
  }

  @override
  Future<void> addCommentToUpdate(
      String projectId, String updateId, Map<String, dynamic> comment) async {
    final updateRef = _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_updatesSubcollection)
        .doc(updateId);

    await updateRef.update({
      'comments': FieldValue.arrayUnion([comment]),
    });
  }

  // ─── Designs ──────────────────────────────────────────────────────────

  @override
  Stream<List<DesignDocumentModel>> watchDesigns(String projectId) {
    return _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_designsSubcollection)
        .orderBy('timestamp', descending: true)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => DesignDocumentModel.fromSnapshot(d)).toList());
  }

  @override
  Future<void> addDesign(String projectId, DesignDocumentModel design) async {
    await _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_designsSubcollection)
        .add({
      ...design.toJson(),
      'timestamp': FieldValue.serverTimestamp(),
    });
  }

  @override
  Future<void> deleteDesign(String projectId, String designId) async {
    await _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_designsSubcollection)
        .doc(designId)
        .delete();
  }

  // ─── Files (formerly Designs) ──────────────────────────────────────────

  @override
  Stream<List<FileModel>> watchFiles(String projectId) {
    return _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_filesSubcollection)
        .orderBy('uploadedAt', descending: true)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => FileModel.fromSnapshot(d)).toList());
  }

  @override
  Future<void> addFile(String projectId, FileModel file) async {
    await _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_filesSubcollection)
        .add({
      ...file.toJson(),
      'uploadedAt': FieldValue.serverTimestamp(),
    });
  }

  @override
  Future<void> updateFile(String projectId, FileModel file) async {
     // Implementation for update if needed, e.g. rename or version bump
     await _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_filesSubcollection)
        .doc(file.id)
        .update(file.toJson());
  }

  @override
  Future<void> updateDesignStatus(
      String projectId, String designId, String status) async {
    await _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_filesSubcollection)
        .doc(designId)
        .update({'approvalStatus': status});
  }

  // ─── Settlements ──────────────────────────────────────────────────────

  @override
  Stream<List<SettlementModel>> watchSettlements(String projectId) {
    return _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_settlementsSubcollection)
        .orderBy('date', descending: true)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => SettlementModel.fromSnapshot(d)).toList());
  }

  @override
  Future<void> addSettlement(String projectId, SettlementModel settlement) async {
    await _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_settlementsSubcollection)
        .add({
      ...settlement.toJson(),
      'createdAt': FieldValue.serverTimestamp(),
    });

    // Also update project's currentSpend
    final projRef = _firestore.collection(_orgProjectsCollection).doc(projectId);
    final pSnap = await projRef.get();
    if (pSnap.exists) {
      final current = (pSnap.data()?['currentSpend'] as num?)?.toDouble() ?? 0;
      await projRef.update({'currentSpend': current + settlement.amount});
    }
  }

  // ─── Rooms ─────────────────────────────────────────────────────────────

  @override
  Stream<List<RoomModel>> watchRooms(String projectId) {
    return _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_roomsSubcollection)
        .orderBy('name')
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => RoomModel.fromSnapshot(d)).toList());
  }

  @override
  Future<String> addRoom(String projectId, RoomModel room) async {
    final docRef = await _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_roomsSubcollection)
        .add(room.toJson());
    return docRef.id;
  }

  @override
  Future<void> updateRoom(
      String projectId, String roomId, Map<String, dynamic> data) async {
    await _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_roomsSubcollection)
        .doc(roomId)
        .update(data);
  }

  // ─── Expenses (formerly Budget Transactions) ──────────────────────────

  @override
  Stream<List<ExpenseModel>> watchExpenses(String projectId) {
    return _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_expensesSubcollection)
        .orderBy('date', descending: false)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => ExpenseModel.fromSnapshot(d)).toList());
  }

  @override
  Future<void> addExpense(String projectId, ExpenseModel expense) async {
    await _firestore
        .collection(_orgProjectsCollection)
        .doc(projectId)
        .collection(_expensesSubcollection)
        .add({
      ...expense.toJson(),
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}

