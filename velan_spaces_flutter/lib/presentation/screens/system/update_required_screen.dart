import 'package:flutter/material.dart';
import 'package:velan_spaces_flutter/core/app_version.dart';

/// Blocking full-screen page shown when the installed app is too old.
class UpdateRequiredScreen extends StatelessWidget {
  const UpdateRequiredScreen({required this.requirement, super.key});

  final UpdateRequirement requirement;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8F9FC),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.system_update, size: 72, color: Color(0xFFFFB347)),
                    const SizedBox(height: 24),
                    const Text('Update required',
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    Text(requirement.message,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 15, color: Colors.grey.shade700)),
                    const SizedBox(height: 8),
                    Text('Minimum version: ${requirement.minVersion}',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          final messenger = ScaffoldMessenger.of(context);
                          final ok = await openStore();
                          if (!ok) {
                            messenger.showSnackBar(const SnackBar(
                              content: Text('Open the App Store / Play Store and update Velan Spaces.'),
                            ));
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.black,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Update'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
