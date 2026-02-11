import 'package:velan_spaces_flutter/data/models/manager_model.dart';
import 'package:velan_spaces_flutter/data/models/worker_model.dart';

abstract class WorkerManagerDatasource {
  // Managers
  Stream<List<ManagerModel>> watchAllManagers();
  Future<String> addManager(ManagerModel manager);
  Future<void> updateManager(String managerId, Map<String, dynamic> data);

  // Workers
  Stream<List<WorkerModel>> watchAllWorkers();
  Future<String> addWorker(WorkerModel worker);
  Future<void> updateWorker(String workerId, Map<String, dynamic> data);
  Future<WorkerModel?> getWorkerByName(String name);
  Future<ManagerModel?> getManagerByName(String name);
}
