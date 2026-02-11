import 'package:flutter/foundation.dart';

@immutable
class BudgetTransactionEntity {
  const BudgetTransactionEntity({
    required this.id,
    required this.type,
    required this.amount,
    required this.description,
    required this.date,
    this.addedBy = '',
    this.createdAt,
  });

  final String id;
  final String type; // 'credit' or 'debit'
  final double amount;
  final String description;
  final String date;
  final String addedBy;
  final DateTime? createdAt;
}
