import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/data/datasources/worker_manager_datasource.dart';
import 'package:velan_spaces_flutter/data/models/manager_model.dart';
import 'package:velan_spaces_flutter/data/models/worker_model.dart';

/// Staff directory from the Velan API (`/staff`).
class ApiWorkerManagerDatasource implements WorkerManagerDatasource {
  ApiWorkerManagerDatasource(this._api);

  final ApiClient _api;
  static const _topic = 'staff';

  Stream<List<T>> _watch<T>(String role, T Function(Map<String, dynamic>) fromApi) {
    return pollJson<List<T>>(
      fetchJson: () => _api.get('/staff', query: {'role': role}),
      map: (json) => (json as List? ?? const [])
          .whereType<Map>()
          .map((m) => fromApi(Map<String, dynamic>.from(m)))
          .toList(),
      topics: const [_topic, ApiTopics.projects],
      every: const Duration(seconds: 30),
    );
  }

  /// Firestore-era field names -> PATCH /staff/:id body.
  Map<String, dynamic> _staffPatch(Map<String, dynamic> data) => {
        if (data.containsKey('name')) 'displayName': data['name'],
        if (data.containsKey('phone')) 'phone': data['phone'],
        if (data.containsKey('trade')) 'trade': data['trade'],
        if (data.containsKey('isSuspended')) 'isSuspended': data['isSuspended'],
      };

  static UnsupportedError _accountsPending() => UnsupportedError(
        'Adding and removing staff accounts is moving to the new server and is not available yet.',
      );

  @override
  Stream<List<ManagerModel>> watchAllManagers() => _watch('manager', ManagerModel.fromApi);

  @override
  Stream<List<WorkerModel>> watchAllWorkers() => _watch('worker', WorkerModel.fromApi);

  @override
  Future<void> updateManager(String managerId, Map<String, dynamic> data) async {
    await _api.patch('/staff/$managerId', _staffPatch(data));
    ApiInvalidation.instance.notify(_topic);
  }

  @override
  Future<void> updateWorker(String workerId, Map<String, dynamic> data) async {
    await _api.patch('/staff/$workerId', _staffPatch(data));
    ApiInvalidation.instance.notify(_topic);
  }

  @override
  Future<String> addManager(ManagerModel manager) async => throw _accountsPending();

  @override
  Future<String> addWorker(WorkerModel worker) async => throw _accountsPending();

  @override
  Future<void> deleteManager(String managerId) async => throw _accountsPending();

  @override
  Future<void> deleteWorker(String workerId) async => throw _accountsPending();

  /// Name lookups only served the old name+password login.
  @override
  Future<WorkerModel?> getWorkerByName(String name) async => null;

  @override
  Future<ManagerModel?> getManagerByName(String name) async => null;
}
