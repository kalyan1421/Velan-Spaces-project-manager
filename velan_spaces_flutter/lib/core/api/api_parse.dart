/// Small, forgiving readers for API JSON (dates arrive as ISO strings,
/// numeric(14,2) money arrives as a number or a numeric string).
DateTime? apiDate(dynamic v) {
  if (v == null) return null;
  if (v is DateTime) return v;
  if (v is String && v.isNotEmpty) return DateTime.tryParse(v)?.toLocal();
  return null;
}

double apiDouble(dynamic v, [double fallback = 0]) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? fallback;
  return fallback;
}

int? apiInt(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v);
  return null;
}

String apiString(dynamic v, [String fallback = '']) => v == null ? fallback : v.toString();

List<String> apiStringList(dynamic v) =>
    v is List ? v.where((e) => e != null).map((e) => e.toString()).toList() : <String>[];

/// ISO date (yyyy-MM-dd) for `date` columns such as project start/end.
String? apiDateOnly(DateTime? d) {
  if (d == null) return null;
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}-${two(d.month)}-${two(d.day)}';
}

/// UTC ISO-8601 timestamp for `timestamptz` columns.
String? apiTimestamp(DateTime? d) => d?.toUtc().toIso8601String();
