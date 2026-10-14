/// An error response (or transport failure) from the Velan backend.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message, {this.code});

  /// HTTP status; 0 when the server could not be reached.
  final int statusCode;
  final String message;

  /// Machine-readable error name from the API envelope (e.g. FORBIDDEN).
  final String? code;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isNetwork => statusCode == 0;

  @override
  String toString() => message;
}
