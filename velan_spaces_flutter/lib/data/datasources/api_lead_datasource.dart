import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/data/models/lead_model.dart';

/// Leads over the Velan API (head + managers). Streams poll and refresh
/// right after this app's own writes.
class ApiLeadDatasource {
  ApiLeadDatasource(this._api);

  final ApiClient _api;

  static const topic = 'leads';

  List<LeadModel> _parse(dynamic json) => (json as List? ?? const [])
      .whereType<Map>()
      .map((m) => LeadModel.fromApi(Map<String, dynamic>.from(m)))
      .toList();

  Stream<List<LeadModel>> _watch({Map<String, String>? query}) => pollJson<List<LeadModel>>(
        fetchJson: () => _api.get('/leads', query: query),
        map: _parse,
        topics: const [topic],
      );

  /// Head and managers see every lead; newest first.
  Stream<List<LeadModel>> watchAllLeads() => _watch();

  /// The API filters by assignee (`me` = the caller).
  Stream<List<LeadModel>> watchLeadsByManager(String managerId) =>
      _watch(query: {'assignedManagerId': managerId});

  Future<String> addLead(LeadModel lead) async {
    final res = await _api.post('/leads', {
      'clientName': lead.clientName,
      if (lead.clientPhone.isNotEmpty) 'clientPhone': lead.clientPhone,
      if (lead.area.isNotEmpty) 'area': lead.area,
      if (lead.projectType.isNotEmpty) 'projectType': lead.projectType,
      if (lead.source.isNotEmpty) 'source': lead.source,
      if (lead.estimatedBudget.isNotEmpty) 'estimatedBudget': lead.estimatedBudget,
      if (lead.notes.isNotEmpty) 'notes': lead.notes,
      'status': lead.status.isEmpty ? 'new' : lead.status,
      if (lead.assignedManagerId.isNotEmpty) 'assignedManagerId': lead.assignedManagerId,
    }) as Map<String, dynamic>;
    ApiInvalidation.instance.notify(topic);
    return res['id'] as String;
  }

  /// [data] holds only the changed fields (camelCase API names). An empty
  /// string clears optional text fields and unassigns the manager.
  Future<void> updateLead(String leadId, Map<String, dynamic> data) async {
    await _api.patch('/leads/$leadId', data);
    ApiInvalidation.instance.notify(topic);
  }

  Future<void> deleteLead(String leadId) async {
    await _api.delete('/leads/$leadId');
    ApiInvalidation.instance.notify(topic);
  }
}
