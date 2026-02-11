import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/data/models/timeline_model.dart';
import 'package:velan_spaces_flutter/domain/entities/timeline_entity.dart';

class TimelineRepository {
  final FirebaseFirestore _firestore;

  TimelineRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  Future<List<TimelinePhaseEntity>> getPhases(String projectId) async {
    try {
      final snapshot = await _firestore
          .collection('projects')
          .doc(projectId)
          .collection('phases')
          .orderBy('orderIndex')
          .get();

      return snapshot.docs
          .map((doc) => TimelinePhaseModel.fromJson(doc.data()))
          .toList();
    } catch (e) {
      throw Exception('Failed to fetch timeline: $e');
    }
  }

  Future<void> savePhases(String projectId, List<TimelinePhaseEntity> phases) async {
    final batch = _firestore.batch();
    final collectionRef = _firestore
        .collection('projects')
        .doc(projectId)
        .collection('phases');

    // For simplicity in MVP: Delete all and re-add to ensure order/updates are synced
    // In production, you would diff the lists to minimize writes.
    final existingDocs = await collectionRef.get();
    for (var doc in existingDocs.docs) {
      batch.delete(doc.reference);
    }

    for (var phase in phases) {
      // Convert Entity to Model for JSON serialization
      final model = TimelinePhaseModel(
        id: phase.id,
        name: phase.name,
        startDate: phase.startDate,
        endDate: phase.endDate,
        status: phase.status,
        tasks: phase.tasks,
        orderIndex: phase.orderIndex,
      );
      
      // Use phase.id as doc ID
      batch.set(collectionRef.doc(phase.id), model.toJson());
    }

    await batch.commit();
  }
}
