import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  String _selectedTab = 'CLIENT'; // CLIENT, MANAGER, ADMIN
  final _idController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _idController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final notifier = ref.read(authNotifierProvider.notifier);
    bool success = false;

    switch (_selectedTab) {
      case 'ADMIN':
        success = await notifier.signInAsHead(_passwordController.text);
        break;
      case 'MANAGER':
        // For manager, we'll use the ID and password
        success = await notifier.signInAsManager(
          _idController.text,
          password: _passwordController.text,
        );
        break;
      case 'CLIENT':
        success = await notifier.signInAsClient(_idController.text);
        break;
    }

    if (!success && mounted) {
      final authState = ref.read(authNotifierProvider);
      setState(() {
        _isLoading = false;
        _errorMessage = authState.hasError
            ? authState.error.toString()
            : 'Invalid credentials. Please try again.';
      });
    }
  }

  Widget _buildTabButton(String label, String tab) {
    final isActive = _selectedTab == tab;
    return InkWell(
      onTap: () => setState(() {
        _selectedTab = tab;
        _idController.clear();
        _passwordController.clear();
        _errorMessage = null;
      }),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isActive)
            Container(
              width: 6,
              height: 6,
              margin: const EdgeInsets.only(right: 8),
              decoration: const BoxDecoration(
                color: Color(0xFFFFB347), // gold
                shape: BoxShape.circle,
              ),
            ),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
              color: isActive ? const Color(0xFF1A1A2E) : const Color(0xFFB0B0C0),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Determine heading and subtitle based on selected tab
    String heading;
    String subtitle;
    switch (_selectedTab) {
      case 'CLIENT':
        heading = 'View Project';
        subtitle = 'ENTER YOUR ID TO TRACK PROGRESS';
        break;
      case 'MANAGER':
        heading = 'Manager Portal';
        subtitle = 'SIGN IN TO MANAGE WORKSPACE';
        break;
      case 'ADMIN':
        heading = 'Admin Access';
        subtitle = 'SIGN IN TO MANAGE WORKSPACE';
        break;
      default:
        heading = 'View Project';
        subtitle = 'ENTER YOUR ID TO TRACK PROGRESS';
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FC), // lightBg
      body: SafeArea(
        child: Column(
          children: [
            // ─── Header with Logo and Tabs ────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(32, 32, 32, 0),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  // If width is constrained (mobile), use Column
                  // 600 is a common breakpoint
                  bool isMobile = MediaQuery.of(context).size.width < 600;
                  
                  if (isMobile) {
                    return Column(
                      children: [
                        // Velan Logo
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.05),
                                    blurRadius: 10,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              padding: const EdgeInsets.all(4),
                              child: Image.asset(
                                'assets/images/logo.png',
                                fit: BoxFit.contain,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'VELAN',
                                  style: GoogleFonts.outfit(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1,
                                    color: const Color(0xFF1A1A2E),
                                  ),
                                ),
                                Text(
                                  'SPACES',
                                  style: GoogleFonts.outfit(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1,
                                    color: const Color(0xFF1A1A2E),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        // Tab buttons - wrap in SingleChildScrollView for safety on very small screens
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _buildTabButton('Client', 'CLIENT'),
                              const SizedBox(width: 24),
                              _buildTabButton('Manager', 'MANAGER'),
                              const SizedBox(width: 24),
                              _buildTabButton('Admin', 'ADMIN'),
                            ],
                          ),
                        ),
                      ],
                    );
                  } else {
                    // Desktop/Tablet Row layout
                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Velan Logo
                        Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.05),
                                    blurRadius: 10,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              padding: const EdgeInsets.all(4),
                              child: Image.asset(
                                'assets/images/logo.png',
                                fit: BoxFit.contain,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'VELAN',
                                  style: GoogleFonts.outfit(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1,
                                    color: const Color(0xFF1A1A2E),
                                  ),
                                ),
                                Text(
                                  'SPACES',
                                  style: GoogleFonts.outfit(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1,
                                    color: const Color(0xFF1A1A2E),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        // Tab buttons
                        Row(
                          children: [
                            _buildTabButton('Client', 'CLIENT'),
                            const SizedBox(width: 24),
                            _buildTabButton('Manager', 'MANAGER'),
                            const SizedBox(width: 24),
                            _buildTabButton('Admin', 'ADMIN'),
                          ],
                        ),
                      ],
                    );
                  }
                }
              ),
            ),

            const SizedBox(height: 12),
            Text(
              'ELEVATING SPACES INTO MASTERPIECES',
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w400,
                letterSpacing: 2,
                color: const Color(0xFFB0B0C0),
              ),
            ),

            // ─── Main Content ──────────────────────────────────────────
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // House Icon
                        Container(
                          width: 120,
                          height: 120,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.08),
                                blurRadius: 20,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          padding: const EdgeInsets.all(20),
                          child: Image.asset(
                            'assets/images/logo.png',
                            fit: BoxFit.contain,
                          ),
                        ),

                        const SizedBox(height: 48),

                        // Heading
                        Text(
                          heading,
                          style: GoogleFonts.lustria(
                            fontSize: 36,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF1A1A2E),
                          ),
                        ),

                        const SizedBox(height: 8),

                        // Subtitle
                        Text(
                          subtitle,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w400,
                            letterSpacing: 2,
                            color: const Color(0xFFB0B0C0),
                          ),
                        ),

                        const SizedBox(height: 48),

                        // Input Fields
                        if (_selectedTab == 'CLIENT')
                          // Client: Only PRJ-ID
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFFFB347).withOpacity(0.15),
                                  blurRadius: 30,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: TextField(
                              controller: _idController,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.lustria(
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 4,
                                color: const Color(0xFF1A1A2E),
                              ),
                              decoration: InputDecoration(
                                hintText: 'PRJ-ID',
                                hintStyle: GoogleFonts.lustria(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 4,
                                  color: const Color(0xFFE0E0E0),
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(
                                    color: Color(0xFFE0E0E0),
                                    width: 2,
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(
                                    color: Color(0xFFE0E0E0),
                                    width: 2,
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(
                                    color: Color(0xFFFFB347),
                                    width: 2,
                                  ),
                                ),
                                contentPadding: const EdgeInsets.symmetric(
                                  vertical: 20,
                                  horizontal: 24,
                                ),
                              ),
                              onSubmitted: (_) => _handleLogin(),
                            ),
                          )
                        else
                          // Manager/Admin: ID/Username + Password
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Label
                              Text(
                                _selectedTab == 'MANAGER' ? 'MANAGER ID' : 'USERNAME',
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 1.5,
                                  color: const Color(0xFF6B7280),
                                ),
                              ),
                              const SizedBox(height: 8),
                              // Input
                              Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.05),
                                      blurRadius: 10,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: TextField(
                                  controller: _idController,
                                  style: GoogleFonts.inter(
                                    fontSize: 15,
                                    color: Colors.white,
                                  ),
                                  decoration: InputDecoration(
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(16),
                                      borderSide: const BorderSide(
                                        color: Color(0xFFE0E0E0),
                                        width: 2,
                                      ),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(16),
                                      borderSide: const BorderSide(
                                        color: Color(0xFFE0E0E0),
                                        width: 2,
                                      ),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(16),
                                      borderSide: const BorderSide(
                                        color: Color(0xFFFFB347),
                                        width: 2,
                                      ),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                      vertical: 18,
                                      horizontal: 20,
                                    ),
                                  ),
                                ),
                              ),

                              const SizedBox(height: 20),

                              // Password Label
                              Text(
                                'PASSWORD',
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 1.5,
                                  color: const Color(0xFF6B7280),
                                ),
                              ),
                              const SizedBox(height: 8),
                              // Password Input
                              Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.05),
                                      blurRadius: 10,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: TextField(
                                  controller: _passwordController,
                                  obscureText: true,
                                  style: GoogleFonts.inter(
                                    fontSize: 15,
                                    color: Colors.white,
                                  ),
                                  decoration: InputDecoration(
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(16),
                                      borderSide: const BorderSide(
                                        color: Color(0xFFE0E0E0),
                                        width: 2,
                                      ),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(16),
                                      borderSide: const BorderSide(
                                        color: Color(0xFFE0E0E0),
                                        width: 2,
                                      ),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(16),
                                      borderSide: const BorderSide(
                                        color: Color(0xFFFFB347),
                                        width: 2,
                                      ),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                      vertical: 18,
                                      horizontal: 20,
                                    ),
                                  ),
                                  onSubmitted: (_) => _handleLogin(),
                                ),
                              ),
                            ],
                          ),

                        // Error Message
                        if (_errorMessage != null) ...[
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              vertical: 8,
                              horizontal: 16,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFEBEE),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              _errorMessage!,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.2,
                                color: const Color(0xFFD32F2F),
                              ),
                            ),
                          ),
                        ],

                        const SizedBox(height: 24),

                        // Enter Workspace Button
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _handleLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFFFB347),
                              foregroundColor: const Color(0xFF1A1A2E),
                              padding: const EdgeInsets.symmetric(vertical: 18),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              elevation: 0,
                              shadowColor: const Color(0xFFFFB347).withOpacity(0.3),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        Color(0xFF1A1A2E),
                                      ),
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
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // ─── Footer ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.only(bottom: 32),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 40,
                    height: 1,
                    color: const Color(0xFFE0E0E0),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'VELAN SPACES',
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 2,
                        color: const Color(0xFFB0B0C0),
                      ),
                    ),
                  ),
                  Container(
                    width: 40,
                    height: 1,
                    color: const Color(0xFFE0E0E0),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
