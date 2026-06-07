import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/data/datasources/lead_datasource.dart';
import 'package:velan_spaces_flutter/data/models/lead_model.dart';
import 'package:velan_spaces_flutter/domain/entities/lead_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

// ─── Datasource Provider ─────────────────────────────────────────────────
final leadDatasourceProvider = Provider<LeadDatasource>((ref) {
  final firestore = ref.watch(firestoreProvider);
  return LeadDatasource(firestore);
});

// ─── All Leads Stream ────────────────────────────────────────────────────
final allLeadsProvider = StreamProvider<List<LeadEntity>>((ref) {
  final ds = ref.watch(leadDatasourceProvider);
  return ds.watchAllLeads();
});

// ─── Lead Controller ─────────────────────────────────────────────────────
final leadControllerProvider =
    StateNotifierProvider<LeadController, AsyncValue<void>>((ref) {
  return LeadController(ref);
});

class LeadController extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  LeadController(this._ref) : super(const AsyncValue.data(null));

  LeadDatasource get _datasource => _ref.read(leadDatasourceProvider);

  Future<bool> addLead({
    required String clientName,
    String clientPhone = '',
    String area = '',
    String projectType = '',
    String source = '',
    String estimatedBudget = '',
    String notes = '',
    String assignedManagerId = '',
  }) async {
    state = const AsyncValue.loading();
    try {
      final lead = LeadModel(
        id: '',
        clientName: clientName,
        clientPhone: clientPhone,
        area: area,
        projectType: projectType,
        source: source,
        estimatedBudget: estimatedBudget,
        notes: notes,
        status: 'new',
        assignedManagerId: assignedManagerId,
      );
      await _datasource.addLead(lead);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> updateLeadStatus(String leadId, String newStatus) async {
    state = const AsyncValue.loading();
    try {
      await _datasource.updateLead(leadId, {'status': newStatus});
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> updateLead(String leadId, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      await _datasource.updateLead(leadId, data);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> deleteLead(String leadId) async {
    state = const AsyncValue.loading();
    try {
      await _datasource.deleteLead(leadId);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}
