import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/data/datasources/firestore_project_datasource.dart';
import 'package:velan_spaces_flutter/data/datasources/project_datasource.dart';
import 'package:velan_spaces_flutter/data/repositories/project_repository_impl.dart';
import 'package:velan_spaces_flutter/domain/repositories/project_repository.dart';
import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/project_update_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/settlement_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/file_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/room_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/expense_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/design_document_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/worker_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:velan_spaces_flutter/data/datasources/storage_datasource.dart';
import 'package:velan_spaces_flutter/data/datasources/firebase_storage_datasource.dart';

// ─── Datasource & Repository ──────────────────────────────────────────

final firebaseStorageProvider = Provider<FirebaseStorage>((ref) {
  return FirebaseStorage.instance;
});

final storageDatasourceProvider = Provider<StorageDatasource>((ref) {
  return FirebaseStorageDatasourceImpl(ref.watch(firebaseStorageProvider));
});

final projectDatasourceProvider = Provider<ProjectDatasource>((ref) {
  return FirestoreProjectDatasourceImpl(ref.watch(firestoreProvider));
});

final projectRepositoryProvider = Provider<ProjectRepository>((ref) {
  return ProjectRepositoryImpl(
    ref.watch(projectDatasourceProvider),
    ref.watch(storageDatasourceProvider),
  );
});

// ─── Project Streams ──────────────────────────────────────────────────

final allProjectsProvider = StreamProvider<List<ProjectEntity>>((ref) {
  final repo = ref.watch(projectRepositoryProvider);
  return repo.watchAllProjects().map((either) => either.fold(
        (failure) => throw Exception("watchAllProjects failed: ${failure.message}"),
        (projects) => projects,
      ));
});


final managerProjectsProvider = StreamProvider<List<ProjectEntity>>((ref) {
  final repo = ref.watch(projectRepositoryProvider);
  final meta = ref.watch(currentUserMetaProvider);
  final managerId = meta['id'] as String? ?? '';

  if (managerId.isEmpty) return Stream.value(<ProjectEntity>[]);

  return repo.watchManagerProjects(managerId).map((either) => either.fold(
        (failure) => throw Exception("watchManagerProjects failed: ${failure.message}"),
        (projects) => projects,
      ));
});

final projectDetailProvider =
    FutureProvider.family<ProjectEntity, String>((ref, projectId) async {
  final repo = ref.watch(projectRepositoryProvider);
  final result = await repo.getProjectById(projectId);
  return result.fold(
    (failure) => throw Exception(failure.message),
    (project) => project,
  );
});

// ─── Designs ──────────────────────────────────────────────────────────

final projectDesignsProvider =
    StreamProvider.family<List<DesignDocumentEntity>, String>((ref, projectId) {
  final repo = ref.watch(projectRepositoryProvider);
  return repo.watchDesigns(projectId).map(
        (either) => either.fold(
          (failure) => throw Exception("watchDesigns failed: ${failure.message}"),
          (designs) => designs,
        ),
      );
});

// ─── Project Updates ──────────────────────────────────────────────────

final projectUpdatesProvider =
    StreamProvider.family<List<ProjectUpdateEntity>, String>((ref, projectId) {
  final repo = ref.watch(projectRepositoryProvider);
  return repo.watchProjectUpdates(projectId).map(
        (either) => either.fold(
          (failure) => throw Exception("watchProjectUpdates failed: ${failure.message}"),
          (updates) => updates,
        ),
      );
});

// ─── Files (formerly Designs) ──────────────────────────────────────────

final projectFilesProvider =
    StreamProvider.family<List<FileEntity>, String>((ref, projectId) {
  final repo = ref.watch(projectRepositoryProvider);
  return repo.watchFiles(projectId).map(
        (either) => either.fold(
          (failure) => throw Exception("watchFiles failed: ${failure.message}"),
          (files) => files,
        ),
      );
});

// ─── Settlements ──────────────────────────────────────────────────────

final projectSettlementsProvider =
    StreamProvider.family<List<SettlementEntity>, String>((ref, projectId) {
  final repo = ref.watch(projectRepositoryProvider);
  return repo.watchSettlements(projectId).map(
        (either) => either.fold(
          (failure) => throw Exception("watchSettlements failed: ${failure.message}"),
          (settlements) => settlements,
        ),
      );
});

// ─── Rooms ────────────────────────────────────────────────────────────

final projectRoomsProvider =
    StreamProvider.family<List<RoomEntity>, String>((ref, projectId) {
  final repo = ref.watch(projectRepositoryProvider);
  return repo.watchRooms(projectId).map(
        (either) => either.fold(
          (failure) => throw Exception("watchRooms failed: ${failure.message}"),
          (rooms) => rooms,
        ),
      );
});

// ─── Expenses (formerly Budget Transactions) ──────────────────────────

final projectExpensesProvider =
    StreamProvider.family<List<ExpenseEntity>, String>((ref, projectId) {
  final repo = ref.watch(projectRepositoryProvider);
  return repo.watchExpenses(projectId).map(
        (either) => either.fold(
          (failure) => throw Exception("watchExpenses failed: ${failure.message}"),
          (expenses) => expenses,
        ),
      );
});

// ─── Project Creation ─────────────────────────────────────────────────

final projectCreationNotifierProvider =
    StateNotifierProvider<ProjectCreationNotifier, AsyncValue<String?>>((ref) {
  return ProjectCreationNotifier(ref);
});

class ProjectCreationNotifier extends StateNotifier<AsyncValue<String?>> {
  final Ref _ref;

  ProjectCreationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<void> createProject(ProjectEntity project) async {
    state = const AsyncValue.loading();
    final repo = _ref.read(projectRepositoryProvider);
    final result = await repo.createProject(project);

    result.fold(
      (failure) => state = AsyncValue.error(failure.message, StackTrace.current),
      (projectId) => state = AsyncValue.data(projectId),
    );
  }
}

import 'package:velan_spaces_flutter/presentation/providers/worker_manager_providers.dart';

// ─── Workers (for tagging) ─────────────────────────────────────────────

final validProjectWorkersProvider =
    Provider.family<AsyncValue<List<WorkerEntity>>, String>((ref, projectId) {
  final allWorkersAsync = ref.watch(allWorkersProvider);
  final projectAsync = ref.watch(projectDetailProvider(projectId));

  return allWorkersAsync.when(
    data: (allWorkers) {
      return projectAsync.when(
        data: (project) {
          // Return workers who are assigned to this project
          // OR whose IDs are in the project's workerIds list
          return AsyncValue.data(allWorkers.where((w) {
            return project.workerIds.contains(w.id) || 
                   w.assignedProjects.contains(projectId);
          }).toList());
        },
        loading: () => const AsyncValue.loading(),
        error: (err, st) => AsyncValue.error(err, st),
      );
    },
    loading: () => const AsyncValue.loading(),
    error: (err, st) => AsyncValue.error(err, st),
  );
});