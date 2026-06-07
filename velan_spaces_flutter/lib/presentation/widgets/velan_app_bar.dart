
import 'package:flutter/material.dart';

class VelanAppBar extends StatelessWidget implements PreferredSizeWidget {
  const VelanAppBar({
    super.key,
    this.showBack = false,
    this.titleWidget,
    this.actions,
    this.bottom,
  });

  final bool showBack;
  final Widget? titleWidget;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;

  @override
  Widget build(BuildContext context) {
    return AppBar(
      automaticallyImplyLeading: false, // We handle leading manually if needed
      backgroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      toolbarHeight: 80, // Taller toolbar to accommodate logo and text
      titleSpacing: 0,
      title: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: Row(
          children: [
            if (showBack)
              Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.black),
                  onPressed: () => Navigator.of(context).pop(),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  style: IconButton.styleFrom(tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                ),
              ),
            Image.asset(
              'assets/images/appstore.png',
              height: 48,
              width: 48,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) {
                return const Icon(Icons.broken_image, size: 48, color: Colors.grey);
              },
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min, // Important for Column in AppBar
                children: [
                  const Text(
                    'VELAN SPACES',
                    style: TextStyle(
                      fontFamily: 'Serif', 
                      fontWeight: FontWeight.w900,
                      fontSize: 20, // Slightly smaller to prevent overflow
                      color: Colors.black,
                      letterSpacing: 0.5,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'ELEVATING SPACES INTO MASTERPIECES',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 8,
                          color: Colors.grey[600],
                          letterSpacing: 1.0,
                          fontWeight: FontWeight.w500,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: actions,
      bottom: bottom,
    );
  }

  @override
  Size get preferredSize => Size.fromHeight(80.0 + (bottom?.preferredSize.height ?? 0));
}
