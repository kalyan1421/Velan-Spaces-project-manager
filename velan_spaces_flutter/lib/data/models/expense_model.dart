import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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
    super.proofUrl,
  });

  factory ExpenseModel.fromApi(Map<String, dynamic> j) {
    return ExpenseModel(
      id: apiString(j['id']),
      type: apiString(j['type'], 'debit').toLowerCase(),
      amount: apiDouble(j['amount']),
      date: apiDate(j['expenseDate']) ?? apiDate(j['createdAt']) ?? DateTime.now(),
      accountDetails: apiString(j['accountDetails']),
      category: apiString(j['category'], 'other'),
      createdAt: apiDate(j['createdAt']),
      projectId: apiString(j['projectId']),
      projectName: '',
      paymentMethod: apiString(j['paymentMethod']),
      proofUrl: apiString(j['proofUrl']),
    );
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
      proofUrl: entity.proofUrl,
    );
  }
}
