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

}
