import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/portfolio_entity.dart';

const String _portfolioCollection = 'portfolio';

class PortfolioDatasource {
  final FirebaseFirestore _firestore;

  PortfolioDatasource(this._firestore);

  Stream<List<PortfolioModel>> watchAll() {
    return _firestore
        .collection(_portfolioCollection)
        .orderBy('sortOrder', descending: false)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => PortfolioModel.fromSnapshot(d)).toList());
  }

  Future<String> add(PortfolioModel portfolio) async {
    final docRef = await _firestore.collection(_portfolioCollection).add({
      ...portfolio.toJson(),
      'createdAt': FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  Future<void> update(String id, Map<String, dynamic> data) async {
    await _firestore.collection(_portfolioCollection).doc(id).update(data);
  }

  Future<void> delete(String id) async {
    await _firestore.collection(_portfolioCollection).doc(id).delete();
  }
}
