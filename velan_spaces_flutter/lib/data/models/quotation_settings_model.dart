import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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

  factory QuotationSettingsModel.fromJson(Map<String, dynamic> data) {
    return QuotationSettingsModel(
      companyName: apiString(data['companyName']),
      phone: apiString(data['phone']),
      email: apiString(data['email']),
      address: apiString(data['address']),
      logoUrl: apiString(data['logoUrl']),
      watermarkLogoUrl: apiString(data['watermarkLogoUrl']),
      coverImageUrl: apiString(data['coverImageUrl']),
      footerText: apiString(data['footerText']),
      defaultTerms: apiString(data['defaultTerms']),
      defaultNotIncluded: apiStringList(data['defaultNotIncluded']),
      quoteValidityDays: apiInt(data['quoteValidityDays']) ?? 15,
      quoteNumberPrefix: apiString(data['quoteNumberPrefix'], 'QUO-'),
      defaultProjectType: apiString(data['defaultProjectType'], 'Residential'),
      defaultGstPercent: apiDouble(data['defaultGstPercent']),
      roundAmounts: data['roundAmounts'] as bool? ?? true,
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
