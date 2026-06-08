import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/quotation_settings_entity.dart';

class QuotationSettingsModel extends QuotationSettingsEntity {
  const QuotationSettingsModel({
    super.companyName,
    super.phone,
    super.email,
    super.address,
    super.logoUrl,
    super.watermarkLogoUrl,
    super.coverImageUrl,
    super.footerText,
    super.defaultTerms,
    super.defaultNotIncluded,
    super.quoteValidityDays,
    super.quoteNumberPrefix,
    super.defaultProjectType,
    super.defaultGstPercent,
    super.roundAmounts,
  });

  factory QuotationSettingsModel.fromSnapshot(DocumentSnapshot snap) {
    final data = (snap.data() as Map<String, dynamic>?) ?? {};
    return QuotationSettingsModel(
      companyName: data['companyName'] ?? '',
      phone: data['phone'] ?? '',
      email: data['email'] ?? '',
      address: data['address'] ?? '',
      logoUrl: data['logoUrl'] ?? '',
      watermarkLogoUrl: data['watermarkLogoUrl'] ?? '',
      coverImageUrl: data['coverImageUrl'] ?? '',
      footerText: data['footerText'] ?? '',
      defaultTerms: data['defaultTerms'] ?? '',
      defaultNotIncluded:
          ((data['defaultNotIncluded'] as List?) ?? []).map((e) => e.toString()).toList(),
      quoteValidityDays: (data['quoteValidityDays'] as num?)?.toInt() ?? 15,
      quoteNumberPrefix: data['quoteNumberPrefix'] ?? 'QUO-',
      defaultProjectType: data['defaultProjectType'] ?? 'Residential',
      defaultGstPercent: (data['defaultGstPercent'] as num?)?.toDouble() ?? 0,
      roundAmounts: data['roundAmounts'] ?? true,
    );
  }

  factory QuotationSettingsModel.fromEntity(QuotationSettingsEntity e) =>
      QuotationSettingsModel(
        companyName: e.companyName,
        phone: e.phone,
        email: e.email,
        address: e.address,
        logoUrl: e.logoUrl,
        watermarkLogoUrl: e.watermarkLogoUrl,
        coverImageUrl: e.coverImageUrl,
        footerText: e.footerText,
        defaultTerms: e.defaultTerms,
        defaultNotIncluded: e.defaultNotIncluded,
        quoteValidityDays: e.quoteValidityDays,
        quoteNumberPrefix: e.quoteNumberPrefix,
        defaultProjectType: e.defaultProjectType,
        defaultGstPercent: e.defaultGstPercent,
        roundAmounts: e.roundAmounts,
      );

  Map<String, dynamic> toJson() => {
        'companyName': companyName,
        'phone': phone,
        'email': email,
        'address': address,
        'logoUrl': logoUrl,
        'watermarkLogoUrl': watermarkLogoUrl,
        'coverImageUrl': coverImageUrl,
        'footerText': footerText,
        'defaultTerms': defaultTerms,
        'defaultNotIncluded': defaultNotIncluded,
        'quoteValidityDays': quoteValidityDays,
        'quoteNumberPrefix': quoteNumberPrefix,
        'defaultProjectType': defaultProjectType,
        'defaultGstPercent': defaultGstPercent,
        'roundAmounts': roundAmounts,
      };
}
