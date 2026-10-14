import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:velan_spaces_flutter/core/api/api_config.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

/// One sign-in for every role: the server decides admin / manager / worker /
/// client from the account. Workers sign in with their username.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  static const _ink = Color(0xFF1A1A2E);
  static const _gold = Color(0xFFFFB347);
  static const _muted = Color(0xFFB0B0C0);
  static const _border = Color(0xFFE0E0E0);

  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscure = true;
  String? _errorMessage;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _run(Future<bool> Function() attempt) async {
    FocusScope.of(context).unfocus();
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final success = await attempt();
    if (!mounted || success) return;
    final authState = ref.read(authNotifierProvider);
    setState(() {
      _isLoading = false;
      // A cancelled Google sheet is not an error.
      _errorMessage = authState.hasError ? authState.error.toString() : null;
    });
  }

  void _signInWithPassword() => _run(() => ref
      .read(authNotifierProvider.notifier)
      .signInWithPassword(_identifierController.text, _passwordController.text));

  void _signInWithGoogle() =>
      _run(() => ref.read(authNotifierProvider.notifier).signInWithGoogle());

  InputDecoration _decoration({Widget? suffix}) {
    OutlineInputBorder border(Color c) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: c, width: 2),
        );
    return InputDecoration(
      border: border(_border),
      enabledBorder: border(_border),
      focusedBorder: border(_gold),
      contentPadding: const EdgeInsets.symmetric(vertical: 18, horizontal: 20),
      suffixIcon: suffix,
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          text,
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.5,
            color: const Color(0xFF6B7280),
          ),
        ),
      );

  Widget _shadowed(Widget child) => Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final fieldStyle = GoogleFonts.inter(fontSize: 15, color: Colors.black);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FC),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 32),
            Text(
              'ELEVATING SPACES INTO MASTERPIECES',
              style: GoogleFonts.inter(fontSize: 10, letterSpacing: 2, color: _muted),
            ),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: AutofillGroup(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(
                            child: Container(
                              width: 120,
                              height: 120,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(24),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.08),
                                    blurRadius: 20,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              padding: const EdgeInsets.all(20),
                              child: Image.asset('assets/images/logo.png', fit: BoxFit.contain),
                            ),
                          ),
                          const SizedBox(height: 40),
                          Text(
                            'Welcome back',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.lustria(
                              fontSize: 36,
                              fontWeight: FontWeight.w700,
                              color: _ink,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'SIGN IN TO YOUR WORKSPACE',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(fontSize: 11, letterSpacing: 2, color: _muted),
                          ),
                          const SizedBox(height: 40),
                          _label('EMAIL OR USERNAME'),
                          _shadowed(TextField(
                            key: const Key('login-identifier'),
                            controller: _identifierController,
                            keyboardType: TextInputType.emailAddress,
                            autocorrect: false,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.username, AutofillHints.email],
                            style: fieldStyle,
                            decoration: _decoration(),
                          )),
                          const SizedBox(height: 20),
                          _label('PASSWORD'),
                          _shadowed(TextField(
                            key: const Key('login-password'),
                            controller: _passwordController,
                            obscureText: _obscure,
                            textInputAction: TextInputAction.done,
                            autofillHints: const [AutofillHints.password],
                            style: fieldStyle,
                            decoration: _decoration(
                              suffix: IconButton(
                                tooltip: _obscure ? 'Show password' : 'Hide password',
                                icon: Icon(
                                  _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                  color: const Color(0xFF9CA3AF),
                                ),
                                onPressed: () => setState(() => _obscure = !_obscure),
                              ),
                            ),
                            onSubmitted: (_) => _signInWithPassword(),
                          )),
                          if (_errorMessage != null) ...[
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFEBEE),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFFD32F2F),
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 24),
                          ElevatedButton(
                            key: const Key('login-submit'),
                            onPressed: _isLoading ? null : _signInWithPassword,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _gold,
                              foregroundColor: _ink,
                              padding: const EdgeInsets.symmetric(vertical: 18),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              elevation: 0,
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(_ink),
                                    ),
                                  )
                                : Text(
                                    'ENTER WORKSPACE',
                                    style: GoogleFonts.outfit(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 2,
                                    ),
                                  ),
                          ),
                          if (ApiConfig.googleSignInEnabled) ...[
                            const SizedBox(height: 20),
                            Row(
                              children: [
                                const Expanded(child: Divider(color: _border)),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  child: Text(
                                    'OR',
                                    style: GoogleFonts.inter(fontSize: 10, letterSpacing: 2, color: _muted),
                                  ),
                                ),
                                const Expanded(child: Divider(color: _border)),
                              ],
                            ),
                            const SizedBox(height: 20),
                            OutlinedButton.icon(
                              key: const Key('login-google'),
                              onPressed: _isLoading ? null : _signInWithGoogle,
                              icon: const Icon(Icons.account_circle_outlined, color: _ink),
                              label: Text(
                                'CONTINUE WITH GOOGLE',
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.5,
                                  color: _ink,
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                backgroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                side: const BorderSide(color: _border, width: 2),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                            ),
                          ],
                          const SizedBox(height: 16),
                          Text(
                            'Clients: use the email address your invitation was sent to.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF9CA3AF)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 32),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(width: 40, height: 1, color: _border),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'VELAN SPACES',
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 2,
                        color: _muted,
                      ),
                    ),
                  ),
                  Container(width: 40, height: 1, color: _border),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
