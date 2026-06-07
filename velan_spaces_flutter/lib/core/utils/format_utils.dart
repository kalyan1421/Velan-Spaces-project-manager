import 'package:intl/intl.dart';

class FormatUtils {
  /// Format currency with consistent Indian Rupee format.
  /// Example: 1,00,000 -> ₹1,00,000
  static String formatCurrency(double amount) {
    if (amount < 0) {
      final formatter = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
      return '-${formatter.format(amount.abs())}';
    }
    final formatter = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return formatter.format(amount);
  }

  /// Format date consistently.
  /// Example: 2024-10-12 -> 12 Oct 2024
  static String formatDate(DateTime date) {
    return DateFormat('dd MMM yyyy').format(date);
  }

  /// Format date and time consistently.
  /// Example: 2024-10-12 17:30 -> 12 Oct 2024, 05:30 PM
  static String formatDateTime(DateTime date) {
    return DateFormat('dd MMM yyyy, hh:mm a').format(date);
  }
}
