import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:velan_spaces_flutter/core/api/api_config.dart';

/// Topic names shared by readers (polling streams) and writers (mutations), so
/// a write refreshes the screens that show it immediately instead of waiting
/// for the next poll. Use [ApiTopics.project] for anything inside a project.
class ApiTopics {
  ApiTopics._();
  static const projects = 'projects';
  static String project(String projectId) => 'project:$projectId';
}

/// Broadcasts "data under this topic changed" after successful writes.
class ApiInvalidation {
  ApiInvalidation._();
  static final ApiInvalidation instance = ApiInvalidation._();

  final _controller = StreamController<String>.broadcast();
  Stream<String> get stream => _controller.stream;

  void notify(String topic) => _controller.add(topic);

  void notifyAll(Iterable<String> topics) => topics.forEach(notify);
}

/// Pauses polling while the app is in the background (no wasted requests).
class PollingLifecycle with WidgetsBindingObserver {
  PollingLifecycle._();
  static final PollingLifecycle instance = PollingLifecycle._();

  bool _foreground = true;
  final _resumed = StreamController<void>.broadcast();

  bool get isForeground => _foreground;
  Stream<void> get onResume => _resumed.stream;

  void attach() => WidgetsBinding.instance.addObserver(this);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final wasForeground = _foreground;
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground && !wasForeground) _resumed.add(null);
  }
}

/// A stream that re-fetches [fetchJson] every [ApiConfig.pollInterval] while
/// listened to (and the app is in the foreground), immediately when one of
/// [topics] is invalidated, and on app resume. It only emits when the JSON
/// actually changed, so screens don't rebuild (or flicker) on every poll.
Stream<T> pollJson<T>({
  required Future<dynamic> Function() fetchJson,
  required T Function(dynamic json) map,
  List<String> topics = const [],
  Duration? every,
}) {
  late StreamController<T> controller;
  Timer? timer;
  StreamSubscription<String>? invalidations;
  StreamSubscription<void>? resumes;
  String? lastEncoded;
  var inFlight = false;
  var again = false;

  Future<void> tick() async {
    if (inFlight) {
      again = true; // coalesce: run once more after the current fetch
      return;
    }
    inFlight = true;
    try {
      final json = await fetchJson();
      final encoded = jsonEncode(json);
      if (encoded != lastEncoded && !controller.isClosed) {
        lastEncoded = encoded;
        controller.add(map(json));
      }
    } catch (e, st) {
      // Surface the first failure; later ones keep the last good data.
      if (lastEncoded == null && !controller.isClosed) controller.addError(e, st);
    } finally {
      inFlight = false;
      if (again && !controller.isClosed) {
        again = false;
        unawaited(tick());
      }
    }
  }

  controller = StreamController<T>(
    onListen: () {
      unawaited(tick());
      timer = Timer.periodic(every ?? ApiConfig.pollInterval, (_) {
        if (PollingLifecycle.instance.isForeground) unawaited(tick());
      });
      if (topics.isNotEmpty) {
        invalidations =
            ApiInvalidation.instance.stream.where(topics.contains).listen((_) => unawaited(tick()));
      }
      resumes = PollingLifecycle.instance.onResume.listen((_) => unawaited(tick()));
    },
    onCancel: () async {
      timer?.cancel();
      await invalidations?.cancel();
      await resumes?.cancel();
    },
  );
  return controller.stream;
}
