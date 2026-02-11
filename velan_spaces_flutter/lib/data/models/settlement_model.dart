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
  });

  factory SettlementModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return SettlementModel(
      id: snap.id,
      description: data['description'] ?? '',
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      date: data['date'] ?? '',
      paidTo: data['paidTo'] ?? '',
      paymentMethod: data['paymentMethod'] ?? '',
      addedBy: data['addedBy'] ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'description': description,
      'amount': amount,
      'date': date,
      'paidTo': paidTo,
      'paymentMethod': paymentMethod,
      'addedBy': addedBy,
    };
  }
}
