import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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

  factory SettlementModel.fromApi(Map<String, dynamic> j) {
    return SettlementModel(
      id: apiString(j['id']),
      description: apiString(j['description']),
      amount: apiDouble(j['amount']),
      date: apiString(j['settlementDate']),
      paidTo: apiString(j['paidToName']),
      paymentMethod: apiString(j['mode']),
      addedBy: apiString(j['createdByName']),
      createdAt: apiDate(j['createdAt']),
      proofUrl: apiString(j['proofUrl']),
    );
  }

}
