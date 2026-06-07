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
import 'package:velan_spaces_flutter/domain/entities/project_chat_message_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/project_complaint_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/timeline_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:velan_spaces_flutter/data/datasources/storage_datasource.dart';
import 'package:velan_spaces_flutter/data/datasources/firebase_storage_datasource.dart';
import 'package:velan_spaces_flutter/presentation/providers/worker_manager_providers.dart';
import 'package:velan_spaces_flutter/data/repositories/timeline_repository.dart';

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

final timelineRepositoryProvider = Provider<TimelineRepository>((ref) {
  return TimelineRepository(firestore: ref.watch(firestoreProvider));
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
    FutureProvider.autoDispose.family<ProjectEntity, String>(
        (ref, projectId) async {
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

final projectChatMessagesProvider =
    StreamProvider.family<List<ProjectChatMessageEntity>, String>((ref, projectId) {
  final repo = ref.watch(projectRepositoryProvider);
  return repo.watchProjectChatMessages(projectId).map(
        (either) => either.fold(
          (failure) => throw Exception("watchProjectChatMessages failed: ${failure.message}"),
          (messages) => messages,
        ),
      );
});

final projectComplaintsProvider =
    StreamProvider.family<List<ProjectComplaintEntity>, String>((ref, projectId) {
  final repo = ref.watch(projectRepositoryProvider);
  return repo.watchProjectComplaints(projectId).map(
        (either) => either.fold(
          (failure) => throw Exception("watchProjectComplaints failed: ${failure.message}"),
          (complaints) => complaints,
        ),
      );
});

class AssignedProjectTaskView {
  const AssignedProjectTaskView({
    required this.project,
    required this.phase,
    required this.task,
    this.roomName,
  });

  final ProjectEntity project;
  final TimelinePhaseEntity phase;
  final TimelineTaskEntity task;
  final String? roomName;
}

final workerAssignedTasksProvider =
    FutureProvider<List<AssignedProjectTaskView>>((ref) async {
  final meta = ref.watch(currentUserMetaProvider);
  final workerId = meta['id'] as String? ?? '';
  if (workerId.isEmpty) return const [];

  final projects = await ref.watch(allProjectsProvider.future);
  final myProjects =
      projects.where((project) => project.workerIds.contains(workerId)).toList();
  final timelineRepository = ref.watch(timelineRepositoryProvider);

  final result = <AssignedProjectTaskView>[];
  for (final project in myProjects) {
    final phases = await timelineRepository.getPhases(project.id);
    final rooms = await ref.read(projectRoomsProvider(project.id).future);
    for (final phase in phases) {
      for (final task in phase.tasks.where((item) => item.assignedWorkerId == workerId)) {
        String? roomName;
        if (task.roomId != null) {
          for (final room in rooms) {
            if (room.id == task.roomId) {
              roomName = room.name;
              break;
            }
          }
        }
        result.add(AssignedProjectTaskView(
          project: project,
          phase: phase,
          task: task,
          roomName: roomName,
        ));
      }
    }
  }

  result.sort((a, b) {
    final aDate = a.task.plannedEnd ?? a.phase.endDate;
    final bDate = b.task.plannedEnd ?? b.phase.endDate;
    return aDate.compareTo(bDate);
  });
  return result;
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

// ─── Project Update ───────────────────────────────────────────────────

final projectUpdateNotifierProvider =
    StateNotifierProvider<ProjectUpdateNotifier, AsyncValue<void>>((ref) {
  return ProjectUpdateNotifier(ref);
});

class ProjectUpdateNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  ProjectUpdateNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> updateProject(String projectId, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    final repo = _ref.read(projectRepositoryProvider);
    final result = await repo.updateProject(projectId, data);

    return result.fold(
      (failure) {
        state = AsyncValue.error(failure.message, StackTrace.current);
        return false;
      },
      (_) {
        state = const AsyncValue.data(null);
        _ref.invalidate(projectDetailProvider(projectId));
        return true;
      },
    );
  }
}

// ─── Room Updates ─────────────────────────────────────────────────────

final roomUpdateControllerProvider =
    StateNotifierProvider<RoomUpdateController, AsyncValue<void>>((ref) {
  return RoomUpdateController(ref);
});

class RoomUpdateController extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  RoomUpdateController(this._ref) : super(const AsyncValue.data(null));

  Future<bool> assignWorkersToRoom(String projectId, String roomId, List<String> workerIds) async {
    state = const AsyncValue.loading();
    final repo = _ref.read(projectRepositoryProvider);
    final result = await repo.updateRoom(projectId, roomId, {'assignedWorkerIds': workerIds});

    return result.fold(
      (failure) {
        state = AsyncValue.error(failure.message, StackTrace.current);
        return false;
      },
      (_) {
        state = const AsyncValue.data(null);
        return true;
      },
    );
  }
}

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

// ─── Add Expense ──────────────────────────────────────────────────────

final addExpenseNotifierProvider =
    StateNotifierProvider<AddExpenseNotifier, AsyncValue<void>>((ref) {
  return AddExpenseNotifier(ref);
});

class AddExpenseNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  AddExpenseNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> addExpense(String projectId, ExpenseEntity expense) async {
    state = const AsyncValue.loading();
    final repo = _ref.read(projectRepositoryProvider);
    final result = await repo.addExpense(projectId, expense);

    return result.fold(
      (failure) {
        state = AsyncValue.error(failure.message, StackTrace.current);
        return false;
      },
      (_) {
        state = const AsyncValue.data(null);
        return true;
      },
    );
  }
}

// ─── Add Settlement ───────────────────────────────────────────────────

final addSettlementNotifierProvider =
    StateNotifierProvider<AddSettlementNotifier, AsyncValue<void>>((ref) {
  return AddSettlementNotifier(ref);
});

class AddSettlementNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  AddSettlementNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> addSettlement(String projectId, SettlementEntity settlement) async {
    state = const AsyncValue.loading();
    final repo = _ref.read(projectRepositoryProvider);
    final result = await repo.addSettlement(projectId, settlement);

    return result.fold(
      (failure) {
        state = AsyncValue.error(failure.message, StackTrace.current);
        return false;
      },
      (_) {
        state = const AsyncValue.data(null);
        return true;
      },
    );
  }
}

final projectSupportControllerProvider =
    StateNotifierProvider<ProjectSupportController, AsyncValue<void>>((ref) {
  return ProjectSupportController(ref);
});

class ProjectSupportController extends StateNotifier<AsyncValue<void>> {
  ProjectSupportController(this._ref) : super(const AsyncValue.data(null));

  final Ref _ref;

  Future<bool> sendChatMessage(
    String projectId,
    ProjectChatMessageEntity message,
  ) async {
    state = const AsyncValue.loading();
    final result =
        await _ref.read(projectRepositoryProvider).addProjectChatMessage(projectId, message);
    return result.fold(
      (failure) {
        state = AsyncValue.error(failure.message, StackTrace.current);
        return false;
      },
      (_) {
        state = const AsyncValue.data(null);
        return true;
      },
    );
  }

  Future<bool> addComplaint(
    String projectId,
    ProjectComplaintEntity complaint,
  ) async {
    state = const AsyncValue.loading();
    final result =
        await _ref.read(projectRepositoryProvider).addProjectComplaint(projectId, complaint);
    return result.fold(
      (failure) {
        state = AsyncValue.error(failure.message, StackTrace.current);
        return false;
      },
      (_) {
        state = const AsyncValue.data(null);
        return true;
      },
    );
  }

  Future<bool> updateComplaint(
    String projectId,
    String complaintId,
    Map<String, dynamic> data,
  ) async {
    state = const AsyncValue.loading();
    final result = await _ref
        .read(projectRepositoryProvider)
        .updateProjectComplaint(projectId, complaintId, data);
    return result.fold(
      (failure) {
        state = AsyncValue.error(failure.message, StackTrace.current);
        return false;
      },
      (_) {
        state = const AsyncValue.data(null);
        return true;
      },
    );
  }
}
