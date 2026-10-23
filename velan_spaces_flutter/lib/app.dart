import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/app_version.dart';
import 'package:velan_spaces_flutter/core/router.dart';
import 'package:velan_spaces_flutter/presentation/screens/system/update_required_screen.dart';
import 'package:velan_spaces_flutter/core/theme.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final update = ref.watch(updateRequirementProvider);

    return MaterialApp.router(
      title: 'Velan Spaces',
      debugShowCheckedModeBanner: false,
      theme: VelanTheme.lightTheme,
      darkTheme: VelanTheme.darkTheme,
      themeMode: ThemeMode.light,
      routerConfig: router,
      // Forced update: blocks every route (fail-open; null unless required).
      builder: (context, child) => update != null
          ? UpdateRequiredScreen(requirement: update)
          : (child ?? const SizedBox.shrink()),
    );
  }
}
