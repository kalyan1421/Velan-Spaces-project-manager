import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/data/models/lead_model.dart';

const String _leadsCollection = 'leads';

class LeadDatasource {
  final FirebaseFirestore _firestore;

  LeadDatasource(this._firestore);

  Stream<List<LeadModel>> watchAllLeads() {
    return _firestore
        .collection(_leadsCollection)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => LeadModel.fromSnapshot(d)).toList());
  }

  Stream<List<LeadModel>> watchLeadsByManager(String managerId) {
    return _firestore
        .collection(_leadsCollection)
        .where('assignedManagerId', isEqualTo: managerId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => LeadModel.fromSnapshot(d)).toList());
  }

  Future<String> addLead(LeadModel lead) async {
    final docRef = await _firestore.collection(_leadsCollection).add({
      ...lead.toJson(),
      'createdAt': FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  Future<void> updateLead(String leadId, Map<String, dynamic> data) async {
    await _firestore.collection(_leadsCollection).doc(leadId).update(data);
  }

  Future<void> deleteLead(String leadId) async {
    await _firestore.collection(_leadsCollection).doc(leadId).delete();
  }
}
