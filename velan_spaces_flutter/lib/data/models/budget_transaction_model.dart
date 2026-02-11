import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/budget_transaction_entity.dart';

class BudgetTransactionModel extends BudgetTransactionEntity {
  const BudgetTransactionModel({
    required super.id,
    required super.type,
    required super.amount,
    required super.description,
    required super.date,
    super.addedBy,
    super.createdAt,
  });

  factory BudgetTransactionModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return BudgetTransactionModel(
      id: snap.id,
      type: data['type'] ?? 'debit',
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      description: data['description'] ?? '',
      date: data['date'] ?? '',
      addedBy: data['addedBy'] ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'amount': amount,
      'description': description,
      'date': date,
      'addedBy': addedBy,
    };
  }
}
