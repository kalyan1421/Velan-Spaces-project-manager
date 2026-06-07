import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';

/// A representative starter rate card so a new org can try the quotation flow
/// immediately. Rates are sample figures (₹) reverse-engineered from a typical
/// interior proposal — admins should review/adjust to their real pricing.
///
/// Components are priced per sq.ft, accessories per unit, services per UOM.
List<CatalogItemEntity> sampleCatalogItems() {
  CatalogItemEntity comp(String name, String section, List<CatalogVariant> v,
          {String desc = ''}) =>
      CatalogItemEntity(
        id: '',
        name: name,
        description: desc,
        itemType: CatalogItemType.component,
        defaultSection: section,
        variants: v,
      );

  CatalogItemEntity acc(String name, String section, List<CatalogVariant> v,
          {String desc = ''}) =>
      CatalogItemEntity(
        id: '',
        name: name,
        description: desc,
        itemType: CatalogItemType.accessory,
        defaultSection: section,
        variants: v,
      );

  CatalogItemEntity svc(String name, String section, String uom,
          List<CatalogVariant> v, {String desc = ''}) =>
      CatalogItemEntity(
        id: '',
        name: name,
        description: desc,
        itemType: CatalogItemType.service,
        uom: uom,
        defaultSection: section,
        variants: v,
      );

  const premiumLuxury = [
    CatalogVariant(label: 'Carcass • Premium', rate: 1650),
    CatalogVariant(label: 'Carcass • Luxury', rate: 1950),
  ];

  return [
    // ── Modular Kitchen ──────────────────────────────────────────────
    comp('Kitchen Base Unit', 'Modular Kitchen', premiumLuxury,
        desc: 'Lower cabinet for storage and countertop support'),
    comp('Kitchen Wall Unit', 'Modular Kitchen', premiumLuxury,
        desc: 'Mounted cabinet above the countertop'),
    comp('Kitchen Loft Unit', 'Modular Kitchen', const [
      CatalogVariant(label: 'Loft • Premium', rate: 1350),
      CatalogVariant(label: 'Loft • Luxury', rate: 1600),
    ], desc: 'Overhead storage above wall cabinets'),
    comp('Tall Unit', 'Modular Kitchen', premiumLuxury,
        desc: 'Floor-to-ceiling storage / pantry unit'),

    // ── Dining Area ──────────────────────────────────────────────────
    comp('Crockery Base Unit', 'Dining Area', const [
      CatalogVariant(label: 'Carcass • Premium', rate: 1500),
      CatalogVariant(label: 'Carcass • Luxury', rate: 1800),
    ], desc: 'Lower cabinet for crockery and dining essentials'),
    comp('Crockery Tall Unit', 'Dining Area', const [
      CatalogVariant(label: 'Carcass • Premium', rate: 1600),
    ], desc: 'Tall crockery cabinet with glass shutters'),

    // ── Bedroom ──────────────────────────────────────────────────────
    comp('Wardrobe - Swing Door', 'Bedroom', const [
      CatalogVariant(label: 'Carcass • Premium', rate: 1600),
      CatalogVariant(label: 'Carcass • Luxury', rate: 1900),
    ], desc: 'Wardrobe with hinged doors'),
    comp('Wardrobe Loft Unit', 'Bedroom', const [
      CatalogVariant(label: 'Loft • Premium', rate: 1350),
    ], desc: 'Overhead storage loft above the wardrobe'),
    comp('Dressing Unit', 'Bedroom', const [
      CatalogVariant(label: 'Carcass • Premium', rate: 1550),
    ], desc: 'Dressing table with mirror, drawers and storage'),

    // ── Living Room ──────────────────────────────────────────────────
    comp('TV Unit Panelling', 'Living Room', const [
      CatalogVariant(label: 'Panelling • Premium', rate: 1300),
      CatalogVariant(label: 'Panelling • Luxury', rate: 1600),
    ], desc: 'Decorative wall paneling backdrop for the TV'),

    // ── Accessories ──────────────────────────────────────────────────
    acc('Soft-Close Hinge', 'Accessories', const [
      CatalogVariant(label: 'Hettich', rate: 320),
      CatalogVariant(label: 'Hafele', rate: 380),
    ]),
    acc('Tandem Pot & Pan Drawer', 'Accessories', const [
      CatalogVariant(label: 'Hettich', rate: 8300),
    ]),
    acc('Gola Profile (L type)', 'Accessories', const [
      CatalogVariant(label: 'Hettich', rate: 2630),
    ]),

    // ── Services & Electrical ────────────────────────────────────────
    svc('Plain False Ceiling', 'False Ceiling & Electrical', 'Sq.Ft', const [
      CatalogVariant(label: 'Standard', rate: 60),
    ], desc: 'Ultra-bright channels with board'),
    svc('Wiring', 'False Ceiling & Electrical', 'Point', const [
      CatalogVariant(label: 'Finolex', rate: 650),
    ]),
    svc('Profile Lighting', 'False Ceiling & Electrical', 'Point', const [
      CatalogVariant(label: 'LED Strip + Driver', rate: 550),
    ]),
    svc('Painting (Tractor Emulsion)', 'False Ceiling & Electrical', 'Sq.Ft',
        const [
          CatalogVariant(label: 'Ceiling - 2 coat', rate: 40),
        ]),
  ];
}
