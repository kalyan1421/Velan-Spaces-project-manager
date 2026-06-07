import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/data/datasources/portfolio_datasource.dart';
import 'package:velan_spaces_flutter/domain/entities/portfolio_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

// ─── Datasource ──────────────────────────────────────────────────────────
final portfolioDatasourceProvider = Provider<PortfolioDatasource>((ref) {
  final firestore = ref.watch(firestoreProvider);
  return PortfolioDatasource(firestore);
});

// ─── Stream ──────────────────────────────────────────────────────────────
final allPortfolioProvider = StreamProvider<List<PortfolioEntity>>((ref) {
  final ds = ref.watch(portfolioDatasourceProvider);
  return ds.watchAll();
});

// ─── Controller ──────────────────────────────────────────────────────────
final portfolioControllerProvider =
    StateNotifierProvider<PortfolioController, AsyncValue<void>>((ref) {
  return PortfolioController(ref);
});

class PortfolioController extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  PortfolioController(this._ref) : super(const AsyncValue.data(null));

  PortfolioDatasource get _datasource =>
      _ref.read(portfolioDatasourceProvider);

  Future<bool> addPortfolioItem({
    required String projectName,
    String projectId = '',
    String description = '',
    String category = '',
    String location = '',
    String completionYear = '',
  }) async {
    state = const AsyncValue.loading();
    try {
      final item = PortfolioModel(
        id: '',
        projectName: projectName,
        projectId: projectId,
        description: description,
        category: category,
        location: location,
        completionYear: completionYear,
        status: 'draft',
      );
      await _datasource.add(item);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> updateStatus(String id, String newStatus) async {
    state = const AsyncValue.loading();
    try {
      await _datasource.update(id, {'status': newStatus});
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> update(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      await _datasource.update(id, data);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> delete(String id) async {
    state = const AsyncValue.loading();
    try {
      await _datasource.delete(id);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}
