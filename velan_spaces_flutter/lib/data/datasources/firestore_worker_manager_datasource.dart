import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/data/datasources/worker_manager_datasource.dart';
import 'package:velan_spaces_flutter/data/models/manager_model.dart';
import 'package:velan_spaces_flutter/data/models/worker_model.dart';

const String _managersCollection = 'managers';
const String _workersCollection = 'workers';

class FirestoreWorkerManagerDatasourceImpl implements WorkerManagerDatasource {
  final FirebaseFirestore _firestore;

  FirestoreWorkerManagerDatasourceImpl(this._firestore);

  // ─── Managers ──────────────────────────────────────────────────────────

  @override
  Stream<List<ManagerModel>> watchAllManagers() {
    return _firestore
        .collection(_managersCollection)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => ManagerModel.fromSnapshot(d)).toList());
  }

  @override
  Future<String> addManager(ManagerModel manager) async {
    final docRef =
        await _firestore.collection(_managersCollection).add(manager.toJson());
    return docRef.id;
  }

  @override
  Future<void> updateManager(
      String managerId, Map<String, dynamic> data) async {
    await _firestore
        .collection(_managersCollection)
        .doc(managerId)
        .update(data);
  }

  @override
  Future<ManagerModel?> getManagerByName(String name) async {
    final snap = await _firestore
        .collection(_managersCollection)
        .where('name', isEqualTo: name)
        .limit(1)
        .get();
    if (snap.docs.isNotEmpty) {
      return ManagerModel.fromSnapshot(snap.docs.first);
    }
    return null;
  }

  // ─── Workers ───────────────────────────────────────────────────────────

  @override
  Stream<List<WorkerModel>> watchAllWorkers() {
    return _firestore
        .collection(_workersCollection)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => WorkerModel.fromSnapshot(d)).toList());
  }

  @override
  Future<String> addWorker(WorkerModel worker) async {
    final docRef =
        await _firestore.collection(_workersCollection).add(worker.toJson());
    return docRef.id;
  }

  @override
  Future<void> updateWorker(String workerId, Map<String, dynamic> data) async {
    await _firestore
        .collection(_workersCollection)
        .doc(workerId)
        .update(data);
  }

  @override
  Future<WorkerModel?> getWorkerByName(String name) async {
    final snap = await _firestore
        .collection(_workersCollection)
        .where('name', isEqualTo: name)
        .limit(1)
        .get();
    if (snap.docs.isNotEmpty) {
      return WorkerModel.fromSnapshot(snap.docs.first);
    }
    return null;
  }
}
