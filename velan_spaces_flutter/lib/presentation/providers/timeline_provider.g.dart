// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'timeline_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$timelineHash() => r'0b1bcc47e276ccffaec90437b6fc60c41ce0e050';

/// Copied from Dart SDK
class _SystemHash {
  _SystemHash._();

  static int combine(int hash, int value) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + value);
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
    return hash ^ (hash >> 6);
  }

  static int finish(int hash) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x03ffffff & hash) << 3));
    // ignore: parameter_assignments
    hash = hash ^ (hash >> 11);
    return 0x1fffffff & (hash + ((0x00003fff & hash) << 15));
  }
}

abstract class _$Timeline
    extends BuildlessAutoDisposeAsyncNotifier<List<TimelinePhaseEntity>> {
  late final String projectId;

  FutureOr<List<TimelinePhaseEntity>> build(
    String projectId,
  );
}

/// See also [Timeline].
@ProviderFor(Timeline)
const timelineProvider = TimelineFamily();

/// See also [Timeline].
class TimelineFamily extends Family<AsyncValue<List<TimelinePhaseEntity>>> {
  /// See also [Timeline].
  const TimelineFamily();

  /// See also [Timeline].
  TimelineProvider call(
    String projectId,
  ) {
    return TimelineProvider(
      projectId,
    );
  }

  @override
  TimelineProvider getProviderOverride(
    covariant TimelineProvider provider,
  ) {
    return call(
      provider.projectId,
    );
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'timelineProvider';
}

/// See also [Timeline].
class TimelineProvider extends AutoDisposeAsyncNotifierProviderImpl<Timeline,
    List<TimelinePhaseEntity>> {
  /// See also [Timeline].
  TimelineProvider(
    String projectId,
  ) : this._internal(
          () => Timeline()..projectId = projectId,
          from: timelineProvider,
          name: r'timelineProvider',
          debugGetCreateSourceHash:
              const bool.fromEnvironment('dart.vm.product')
                  ? null
                  : _$timelineHash,
          dependencies: TimelineFamily._dependencies,
          allTransitiveDependencies: TimelineFamily._allTransitiveDependencies,
          projectId: projectId,
        );

  TimelineProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.projectId,
  }) : super.internal();

  final String projectId;

  @override
  FutureOr<List<TimelinePhaseEntity>> runNotifierBuild(
    covariant Timeline notifier,
  ) {
    return notifier.build(
      projectId,
    );
  }

  @override
  Override overrideWith(Timeline Function() create) {
    return ProviderOverride(
      origin: this,
      override: TimelineProvider._internal(
        () => create()..projectId = projectId,
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        projectId: projectId,
      ),
    );
  }

  @override
  AutoDisposeAsyncNotifierProviderElement<Timeline, List<TimelinePhaseEntity>>
      createElement() {
    return _TimelineProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is TimelineProvider && other.projectId == projectId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, projectId.hashCode);

    return _SystemHash.finish(hash);
  }
}

mixin TimelineRef
    on AutoDisposeAsyncNotifierProviderRef<List<TimelinePhaseEntity>> {
  /// The parameter `projectId` of this provider.
  String get projectId;
}

class _TimelineProviderElement extends AutoDisposeAsyncNotifierProviderElement<
    Timeline, List<TimelinePhaseEntity>> with TimelineRef {
  _TimelineProviderElement(super.provider);

  @override
  String get projectId => (origin as TimelineProvider).projectId;
}
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member
