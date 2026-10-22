import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/data/datasources/worker_manager_datasource.dart';
import 'package:velan_spaces_flutter/data/models/manager_model.dart';
import 'package:velan_spaces_flutter/data/models/worker_model.dart';

/// Staff directory and accounts from the Velan API (`/staff`).
///
/// Managers sign in with their email, workers with a username. Passwords are
/// never readable: the admin sets an initial one, and afterwards issues a
/// one-time reset link ([createPasswordResetLink]).
class ApiWorkerManagerDatasource implements WorkerManagerDatasource {
  ApiWorkerManagerDatasource(this._api);

  final ApiClient _api;
  static const _topic = 'staff';

  Stream<List<T>> _watch<T>(String role, T Function(Map<String, dynamic>) fromApi) {
    return pollJson<List<T>>(
      fetchJson: () => _api.get('/staff', query: {'role': role}),
      map: (json) =>
          (json as List? ?? const []).whereType<Map>().map((m) => fromApi(Map<String, dynamic>.from(m))).toList(),
      topics: const [_topic, ApiTopics.projects],
      every: const Duration(seconds: 30),
    );
  }

  /// App field names -> PATCH /staff/:id body (passwords are not editable).
  Map<String, dynamic> _staffPatch(Map<String, dynamic> data) => {
        if (data.containsKey('name')) 'displayName': data['name'],
        if (data.containsKey('phone')) 'phone': data['phone'],
        if (data.containsKey('trade')) 'trade': data['trade'],
        if (data.containsKey('isSuspended')) 'isSuspended': data['isSuspended'],
        if (data.containsKey('username')) 'username': data['username'],
        if ((data['email'] as String? ?? '').isNotEmpty) 'email': data['email'],
      };

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

  /// [manager.password] is the initial password the admin shares with them.
  @override
  Future<String> addManager(ManagerModel manager) async {
    final res = await _api.post('/staff', {
      'role': 'manager',
      'displayName': manager.name,
      'email': manager.email,
      'password': manager.password,
      if (manager.phone.isNotEmpty) 'phone': manager.phone,
    }) as Map<String, dynamic>;
    ApiInvalidation.instance.notify(_topic);
    return res['id'] as String;
  }

  @override
  Future<String> addWorker(WorkerModel worker) async {
    final res = await _api.post('/staff', {
      'role': 'worker',
      'displayName': worker.name,
      'username': worker.username,
      'password': worker.password,
      if (worker.phone.isNotEmpty) 'phone': worker.phone,
      if (worker.trade.isNotEmpty) 'trade': worker.trade,
    }) as Map<String, dynamic>;
    ApiInvalidation.instance.notify(_topic);
    return res['id'] as String;
  }

  @override
  Future<void> deleteManager(String managerId) async {
    await _api.delete('/staff/$managerId');
    ApiInvalidation.instance.notifyAll([_topic, ApiTopics.projects]);
  }

  @override
  Future<void> deleteWorker(String workerId) async {
    await _api.delete('/staff/$workerId');
    ApiInvalidation.instance.notifyAll([_topic, ApiTopics.projects]);
  }

  @override
  Future<String> createPasswordResetLink(String userId) async {
    final res = await _api.post('/staff/$userId/password-reset-link') as Map<String, dynamic>;
    return res['resetUrl'] as String;
  }

  /// Name lookups only served the old name+password login.
  @override
  Future<WorkerModel?> getWorkerByName(String name) async => null;

  @override
  Future<ManagerModel?> getManagerByName(String name) async => null;
}
