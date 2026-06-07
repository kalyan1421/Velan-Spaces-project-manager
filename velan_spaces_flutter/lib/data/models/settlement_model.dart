import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/settlement_entity.dart';

class SettlementModel extends SettlementEntity {
  const SettlementModel({
    required super.id,
    required super.description,
    required super.amount,
    required super.date,
    super.paidTo,
    super.paymentMethod,
    super.addedBy,
    super.createdAt,
    super.proofUrl,
  });

  factory SettlementModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return SettlementModel(
      id: snap.id,
      description: data['description'] ?? '',
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      date: data['date'] ?? '',
      paidTo: data['paidTo'] ?? data['paidToName'] ?? '',
      paymentMethod: data['paymentMethod'] ?? data['mode'] ?? '',
      addedBy: data['addedBy'] ?? data['createdBy'] ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      proofUrl: data['proofUrl'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'description': description,
      'amount': amount,
      'date': date,
      'paidToName': paidTo, // Mapping to Web's paidToName
      'mode': paymentMethod, // Mapping to Web's mode
      'createdBy': addedBy, // Mapping to Web's createdBy
      'proofUrl': proofUrl,
    };
  }
}
