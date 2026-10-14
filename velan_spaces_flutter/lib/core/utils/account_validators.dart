/// Form validators matching the server's account rules.
class AccountValidators {
  AccountValidators._();

  static final RegExp _username = RegExp(r'^[a-z0-9][a-z0-9._-]{2,31}$');
  static final RegExp _email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  /// Workers sign in with a username: 3-32 chars, letters/numbers/. _ -
  static String? username(String? v) {
    final u = (v ?? '').trim().toLowerCase();
    if (u.isEmpty) return 'Required';
    if (!_username.hasMatch(u)) {
      return '3-32 characters: letters, numbers, dot, dash or underscore';
    }
    return null;
  }

  static String? email(String? v, {bool required = true}) {
    final e = (v ?? '').trim();
    if (e.isEmpty) return required ? 'Required' : null;
    return _email.hasMatch(e) ? null : 'Enter a valid email';
  }

  /// Initial / new passwords (Supabase Auth limit is 72 bytes).
  static String? newPassword(String? v) {
    final p = v ?? '';
    if (p.isEmpty) return 'Required';
    if (p.length < 8) return 'At least 8 characters';
    if (p.length > 72) return 'At most 72 characters';
    return null;
  }
}
