import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/domain/entities/manager_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/worker_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

final allManagersProvider = StreamProvider<List<ManagerEntity>>((ref) {
  final ds = ref.watch(workerManagerDatasourceProvider);
  return ds.watchAllManagers();
});

final allWorkersProvider = StreamProvider<List<WorkerEntity>>((ref) {
  final ds = ref.watch(workerManagerDatasourceProvider);
  return ds.watchAllWorkers();
});
