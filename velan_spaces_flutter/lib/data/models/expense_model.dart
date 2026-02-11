import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/expense_entity.dart';

class ExpenseModel extends ExpenseEntity {
  const ExpenseModel({
    required super.id,
    required super.type,
    required super.amount,
    required super.date,
    required super.accountDetails,
    required super.category,
    super.createdAt,
    required super.projectId,
    required super.paymentMethod,
    super.projectName,
  });

  factory ExpenseModel.fromSnapshot(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ExpenseModel(
      id: doc.id,
      type: data['type'] ?? 'debit',
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      date: DateTime.parse(data['date'] ?? DateTime.now().toIso8601String()),
      accountDetails: data['accountDetails'] ?? '',
      category: data['category'] ?? 'other',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      projectId: data['projectId'] ?? '',
      projectName: data['projectName'] ?? '',
      paymentMethod: data['paymentMethod'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'amount': amount,
      'date': date.toIso8601String(),
      'accountDetails': accountDetails,
      'category': category,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : FieldValue.serverTimestamp(),
      'projectId': projectId,
      'projectName': projectName,
      'paymentMethod': paymentMethod,
    };
  }

  factory ExpenseModel.fromEntity(ExpenseEntity entity) {
    return ExpenseModel(
      id: entity.id,
      type: entity.type,
      amount: entity.amount,
      date: entity.date,
      accountDetails: entity.accountDetails,
      category: entity.category,
      createdAt: entity.createdAt,
      projectId: entity.projectId,
      projectName: entity.projectName,
      paymentMethod: entity.paymentMethod,
    );
  }
}
