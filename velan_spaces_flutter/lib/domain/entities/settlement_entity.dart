import 'package:flutter/foundation.dart';

@immutable
class SettlementEntity {
  const SettlementEntity({
    required this.id,
    required this.description,
    required this.amount,
    required this.date,
    this.paidTo = '',
    this.paymentMethod = '',
    this.addedBy = '',
    this.createdAt,
  });

  final String id;
  final String description;
  final double amount;
  final String date;
  final String paidTo;
  final String paymentMethod;
  final String addedBy;
  final DateTime? createdAt;
}
