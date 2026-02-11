import 'package:flutter/foundation.dart';

@immutable
class ExpenseEntity {
  const ExpenseEntity({
    required this.id,
    required this.type, // 'credit' or 'debit'
    required this.amount,
    required this.date,
    required this.accountDetails,
    required this.category, // 'material', 'labour', 'transport', 'other'
    this.createdAt,
    required this.projectId,
    required this.paymentMethod,
    this.projectName = '',
  });

  final String id;
  final String type;
  final double amount;
  final DateTime date;
  final String paymentMethod;
  final String accountDetails;
  final String category;
  final DateTime? createdAt;
  final String projectId;
  final String projectName;
}
