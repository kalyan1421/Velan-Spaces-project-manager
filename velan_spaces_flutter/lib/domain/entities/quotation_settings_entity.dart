import 'package:flutter/foundation.dart';

/// Admin-configurable defaults for every quotation (company profile, branding,
/// terms, tax/validity). Stored as a single Firestore doc `orgSettings/quotation`.
@immutable
class QuotationSettingsEntity {
  const QuotationSettingsEntity({
    this.companyName = '',
    this.phone = '',
    this.email = '',
    this.address = '',
    this.logoUrl = '',
    this.watermarkLogoUrl = '',
    this.coverImageUrl = '',
    this.footerText = '',
    this.defaultTerms = '',
    this.defaultNotIncluded = const [],
    this.quoteValidityDays = 15,
    this.quoteNumberPrefix = 'QUO-',
    this.defaultProjectType = 'Residential',
    this.defaultGstPercent = 0,
    this.roundAmounts = true,
  });

  final String companyName;
  final String phone;
  final String email;
  final String address;
  final String logoUrl;
  final String watermarkLogoUrl;
  final String coverImageUrl;
  final String footerText;
  final String defaultTerms;
  final List<String> defaultNotIncluded;
  final int quoteValidityDays;
  final String quoteNumberPrefix;
  final String defaultProjectType;
  final double defaultGstPercent;
  final bool roundAmounts;

  /// Watermark falls back to the header logo when not separately configured.
  String get effectiveWatermarkUrl =>
      watermarkLogoUrl.isNotEmpty ? watermarkLogoUrl : logoUrl;

  QuotationSettingsEntity copyWith({
    String? companyName,
    String? phone,
    String? email,
    String? address,
    String? logoUrl,
    String? watermarkLogoUrl,
    String? coverImageUrl,
    String? footerText,
    String? defaultTerms,
    List<String>? defaultNotIncluded,
    int? quoteValidityDays,
    String? quoteNumberPrefix,
    String? defaultProjectType,
    double? defaultGstPercent,
    bool? roundAmounts,
  }) {
    return QuotationSettingsEntity(
      companyName: companyName ?? this.companyName,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      address: address ?? this.address,
      logoUrl: logoUrl ?? this.logoUrl,
      watermarkLogoUrl: watermarkLogoUrl ?? this.watermarkLogoUrl,
      coverImageUrl: coverImageUrl ?? this.coverImageUrl,
      footerText: footerText ?? this.footerText,
      defaultTerms: defaultTerms ?? this.defaultTerms,
      defaultNotIncluded: defaultNotIncluded ?? this.defaultNotIncluded,
      quoteValidityDays: quoteValidityDays ?? this.quoteValidityDays,
      quoteNumberPrefix: quoteNumberPrefix ?? this.quoteNumberPrefix,
      defaultProjectType: defaultProjectType ?? this.defaultProjectType,
      defaultGstPercent: defaultGstPercent ?? this.defaultGstPercent,
      roundAmounts: roundAmounts ?? this.roundAmounts,
    );
  }
}
