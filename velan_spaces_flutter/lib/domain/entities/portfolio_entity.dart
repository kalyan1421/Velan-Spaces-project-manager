import 'package:flutter/foundation.dart';
import 'package:velan_spaces_flutter/core/api/api_parse.dart';

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

  /// API item: `title` is the project name, `completionYear` an int.
  factory PortfolioModel.fromApi(Map<String, dynamic> j) {
    final year = apiInt(j['completionYear']);
    return PortfolioModel(
      id: apiString(j['id']),
      projectId: apiString(j['projectId']),
      projectName: apiString(j['title']),
      description: apiString(j['description']),
      category: apiString(j['category']),
      location: apiString(j['location']),
      completionYear: year == null ? '' : year.toString(),
      coverImageUrl: apiString(j['coverImageUrl']),
      imageUrls: apiStringList(j['imageUrls']),
      status: apiString(j['status'], 'draft'),
      sortOrder: apiInt(j['sortOrder']) ?? 0,
      createdAt: apiDate(j['createdAt']),
    );
  }
}
