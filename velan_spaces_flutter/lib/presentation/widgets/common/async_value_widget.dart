import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AsyncValueWidget<T> extends StatelessWidget {
  const AsyncValueWidget({
    super.key,
    required this.value,
    required this.data,
    this.emptyMessage = 'No data found',
    this.showEmptyState = true,
  });

  final AsyncValue<T> value;
  final Widget Function(T) data;
  final String emptyMessage;
  final bool showEmptyState;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: (T item) {
        if (showEmptyState && 
            (item == null || 
            (item is List && item.isEmpty) || 
            (item is Map && item.isEmpty))) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.inbox, size: 48, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  Text(
                    emptyMessage,
                    style: TextStyle(color: Colors.grey.shade600),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          );
        }
        return data(item);
      },
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: CircularProgressIndicator(),
        ),
      ),
      error: (e, st) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text(
                'An error occurred:\\n$e',
                style: const TextStyle(color: Colors.red),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
