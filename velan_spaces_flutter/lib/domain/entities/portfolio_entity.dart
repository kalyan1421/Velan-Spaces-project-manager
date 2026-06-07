import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

@immutable
class PortfolioEntity {
  const PortfolioEntity({
    required this.id,
    required this.projectName,
    this.projectId = '',
    this.description = '',
    this.category = '',
    this.location = '',
    this.completionYear = '',
    this.coverImageUrl = '',
    this.imageUrls = const [],
    this.status = 'draft',
    this.sortOrder = 0,
    this.createdAt,
  });

  final String id;
  final String projectId;
  final String projectName;
  final String description;
  final String category;       // residential, commercial, office, kitchen
  final String location;
  final String completionYear;
  final String coverImageUrl;
  final List<String> imageUrls;
  final String status;          // draft, published, hidden
  final int sortOrder;
  final DateTime? createdAt;

  PortfolioEntity copyWith({
    String? projectName,
    String? description,
    String? category,
    String? location,
    String? completionYear,
    String? coverImageUrl,
    List<String>? imageUrls,
    String? status,
    int? sortOrder,
  }) {
    return PortfolioEntity(
      id: id,
      projectId: projectId,
      projectName: projectName ?? this.projectName,
      description: description ?? this.description,
      category: category ?? this.category,
      location: location ?? this.location,
      completionYear: completionYear ?? this.completionYear,
      coverImageUrl: coverImageUrl ?? this.coverImageUrl,
      imageUrls: imageUrls ?? this.imageUrls,
      status: status ?? this.status,
      sortOrder: sortOrder ?? this.sortOrder,
      createdAt: createdAt,
    );
  }
}

class PortfolioModel extends PortfolioEntity {
  const PortfolioModel({
    required super.id,
    required super.projectName,
    super.projectId,
    super.description,
    super.category,
    super.location,
    super.completionYear,
    super.coverImageUrl,
    super.imageUrls,
    super.status,
    super.sortOrder,
    super.createdAt,
  });

  factory PortfolioModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return PortfolioModel(
      id: snap.id,
      projectId: data['projectId'] ?? '',
      projectName: data['projectName'] ?? '',
      description: data['description'] ?? '',
      category: data['category'] ?? '',
      location: data['location'] ?? '',
      completionYear: data['completionYear'] ?? '',
      coverImageUrl: data['coverImageUrl'] ?? '',
      imageUrls: List<String>.from(data['imageUrls'] ?? []),
      status: data['status'] ?? 'draft',
      sortOrder: data['sortOrder'] ?? 0,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'projectId': projectId,
      'projectName': projectName,
      'description': description,
      'category': category,
      'location': location,
      'completionYear': completionYear,
      'coverImageUrl': coverImageUrl,
      'imageUrls': imageUrls,
      'status': status,
      'sortOrder': sortOrder,
    };
  }
}
