import 'package:flutter/foundation.dart';

@immutable
class LeadEntity {
  const LeadEntity({
    required this.id,
    required this.clientName,
    this.clientPhone = '',
    this.area = '',
    this.projectType = '',
    this.source = '',
    this.estimatedBudget = '',
    this.notes = '',
    this.status = 'new',
    this.assignedManagerId = '',
    this.createdAt,
  });

  final String id;
  final String clientName;
  final String clientPhone;
  final String area;
  final String projectType;
  final String source;        // instagram, whatsapp, referral, website
  final String estimatedBudget;
  final String notes;
  final String status;        // new, contacted, site_visit, proposal_sent, won, lost
  final String assignedManagerId;
  final DateTime? createdAt;
}
