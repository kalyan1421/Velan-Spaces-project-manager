# Velan Spaces — Project Manager App

> Construction / interior-design **project management** app for Velan Spaces.
> Flutter front-end backed by Firebase (Auth, Firestore, Storage, Cloud Messaging).
>
> - **Package:** `velan_spaces_flutter`
> - **Version:** `1.0.1+2`
> - **Dart SDK:** `>=3.2.0 <4.0.0`
> - **Last updated:** 2026-06-08

---

## 1. Architecture

Clean-architecture-style layering under `lib/`:

```
lib/
├── core/                     # router, theme, session, services, utils
│   ├── router.dart           # GoRouter — role-based routing
│   ├── session_service.dart  # persisted login session (flutter_secure_storage)
│   └── services/             # notification, FCM, media compression
├── data/
│   ├── datasources/          # Firestore + Firebase Storage implementations
│   ├── models/               # *_model.dart  (Firestore <-> entity mapping)
│   └── repositories/         # *_repository_impl.dart
├── domain/
│   ├── entities/             # immutable business objects + UserRole enum
│   └── repositories/         # abstract repository interfaces
└── presentation/
    ├── providers/            # Riverpod providers / notifiers
    ├── screens/              # full-page screens
    └── widgets/              # tabs, shells, dialogs, reusable widgets
```

**State management:** Riverpod (`flutter_riverpod`).
**Routing:** `go_router` with a role-aware initial route + shells.
**Error type:** `Either<Failure, T>` (`dartz`) across repositories.

---

## 2. Roles & Access (`domain/entities/user_role.dart`)

| Role     | Landing route        | Shell / Nav            |
|----------|----------------------|------------------------|
| `head`   | `/admin/projects`    | AdminShell (5 tabs)    |
| `manager`| `/manager/projects`  | ManagerShell (3 tabs)  |
| `worker` | `/worker/projects`   | WorkerDashboard (none) |
| `client` | `/client/project`    | None — locked to 1 project |
| `unknown`| `/login`             | —                      |

**Admin (head) shell tabs:** Projects · Staff · Sales · Website · Profile
**Manager shell tabs:** Projects · Sales · Profile

---

## 3. Routes (`core/router.dart`)

| Path                          | Screen                       |
|-------------------------------|------------------------------|
| `/login`                      | LoginScreen                  |
| `/project/:projectId`         | ProjectDetailScreen          |
| `/project/:projectId/edit`    | EditProjectScreen            |
| `/project/:projectId/support` | ProjectSupportScreen (chat)  |
| `/create-project`             | CreateProjectScreen          |
| `/notifications`              | NotificationsScreen          |
| `/admin/*`                    | Admin shell screens          |
| `/manager/*`                  | Manager shell screens        |
| `/worker/projects`            | WorkerDashboardScreen        |
| `/client/project`             | ClientDashboardScreen → auto-redirects to `/project/:id` |

---

## 4. Project Detail — Tabs by Role (`screens/dashboard/project_detail_screen.dart`)

| Tab        | Client | Worker | Manager | Head |
|------------|:------:|:------:|:-------:|:----:|
| Updates    | ✅ view | ✅ post | ✅ post | ✅ post |
| Designs    | ✅ view | ✅ view | ✅ upload | ✅ upload |
| Timeline   | ✅ view | ✅ view | ✅ edit | ✅ edit |
| Workers    | ❌ | ❌ | ✅ | ✅ |
| Rooms      | ❌ | ❌ | ✅ | ✅ |
| Settlements| ❌ | ❌ | ✅ | ✅ |
| Budget     | ❌ | ❌ | ✅ | ✅ |

- **Progress overview card** (top of project): completion %, workers assigned, due date,
  and a **budget bar**. The budget bar is **hidden for clients** (see §7).
- Project actions menu (edit / assign manager) shown only to head & manager.

---

## 5. Feature Modules (current state)

### Updates feed (`widgets/tabs/updates_tab.dart`, `widgets/updates/`)
- Rich update cards: text, **multiple photos** or a video, category, room tag,
  tagged workers, comments.
- Media compressed before upload (`core/services/media_compression_service.dart`).
- Push notifications dispatched to managers/admins on new updates.

### Designs (`widgets/tabs/designs_tab.dart`)
- 2D Plans / 3D Renders, PDF or image. In-app viewer (`design_viewer_screen.dart`).
- **Multiple files** can be uploaded at once (one design doc per file).
- Approval-status field on each design.

### Timeline (`widgets/tabs/timeline_tab.dart`)
- Project milestones / phases.

### Workers (`widgets/tabs/workers_tab.dart`)
- Assign workers, worker bottom sheet, worker dashboard for site staff.

### Rooms (`widgets/tabs/rooms_tab.dart`)
- Room management used to tag updates.

### Budget (`widgets/tabs/budget_tab.dart`) — **head/manager only**
- Budget health (total / spent / remaining), income vs expense transactions,
  payment proofs, add/edit/delete transactions.

### Settlements (`widgets/tabs/settlements_tab.dart`) — **head/manager only**
- Vendor/worker settlements with proof images; updates project `currentSpend`.

### Sales / Leads (`screens/sales_screen.dart`)
- Lead pipeline for head & manager.

### Support chat (`screens/project/project_support_screen.dart`)
- Per-project chat with file attachments + complaints.

### Staff & Website & Portfolio
- Admin staff management, marketing website content, portfolio entities.

### Notifications (FCM)
- `core/services/fcm_service.dart`, `notification_service.dart`; token cleared on sign-out.

### Auth & Session
- Firebase Auth; **persistent login** via `SessionService` (secure storage).
- Sign-out clears FCM token + persisted session and resets role/meta.

---

## 6. Firestore Data Model

`projects/{projectId}` document, with subcollections:

```
projects/{id}
├── updates              (project updates; mediaUrls: List<String>)
├── designs              (design documents)
├── files                (general files)
├── settlements          (settlements; bumps project.currentSpend)
├── rooms                (rooms)
├── budgetTransactions   (income/expense)
├── chatMessages         (support chat)
└── complaints           (support complaints)
```

`ProjectModel.getProjectById` resolves by **doc id first**, then falls back to a
`projectCode` query (clients log in with a short project code).

---

## 7. Changes in this update (2026-06-08)

1. **Delete project for admin — now discoverable.**
   - `head_dashboard_screen.dart`: each project card has a **⋮ menu** with
     *Edit Project* / *Delete Project* (the long-press-to-delete still works).
   - `firestore_project_datasource.deleteProject` now **cascade-deletes all
     subcollections** (batched) before deleting the project doc — no more
     orphaned updates/designs/etc.

2. **Multiple-image upload.**
   - `StorageDatasource.uploadMultipleFiles(...)` added (+ Firebase impl).
   - **Updates** (`create_update_form.dart`): photo mode uses
     `pickMultiImage()`; preview shows a removable thumbnail strip with
     “Add more”; all photos compressed + uploaded into `mediaUrls`.
     (Video stays single.)
   - **Designs** (`designs_tab.dart`): file picker allows multiple files;
     one design document is created per file (`Title (1)`, `Title (2)`…).

3. **Budget hidden from clients.**
   - Clients already lacked the Budget/Settlements tabs; the **budget bar in the
     project overview is now hidden for `UserRole.client`**
     (`project_detail_screen._buildProgressOverview`). Clients see only
     completion %, workers and due date — plus Updates, Designs, Timeline.

4. **Client sign-out / switch project.**
   - `project_detail_screen.dart`: clients now get a **logout button** in the
     app bar (clients have no shell/back nav). It confirms, signs out, and
     returns to `/login` so they can open a different project code.

5. **Lint cleanup.** Removed an unused import in `sales_screen.dart`.

---

## 8. Known issues / tech debt

- **Deprecations (info-level, ~60):** widespread `Color.withOpacity()` →
  should migrate to `.withValues()`; a few `DropdownButtonFormField(value:)` →
  `initialValue:`. Non-breaking.
- **`use_build_context_synchronously`** in a few async flows
  (create/edit project, settlement/worker dialogs, website/sales) — guard
  `context` with `mounted` after awaits.
- **Cascade delete is client-side** (batched reads + deletes). For very large
  projects a Cloud Function would be more robust, but current approach is fine
  for expected data sizes.
- **No project list/search for clients** — by design they are pinned to one
  project via their login code; switching = sign out and log in with another code.

## 9. Build / run

```bash
flutter pub get
flutter analyze          # 0 errors; info/warning lints only
flutter run              # debug on connected device/emulator
flutter build apk        # Android release
```
