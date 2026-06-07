# 📱 Velan Spaces — Project Manager App (Flutter)

> **Platform:** iOS + Android  |  **Stack:** Flutter · Firebase · Riverpod · GoRouter  |  **Status:** 🟢 Active Development
> 

---

## 🧭 Overview

Velan Spaces Project Manager is a production-grade Flutter mobile application that gives the Velan Spaces team full control over interior design projects from a phone. The app supports four user roles — **Admin (Head), Manager, Worker, and Client** — each with a tailored experience, role-based navigation, and real-time Firebase sync.

The app replaces manual coordination with a centralized, mobile-first dashboard where projects, people, budgets, and client communication all live in one place.

---

## 🏗️ Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Flutter (Dart) — iOS & Android |
| Backend / Database | Firebase Firestore (real-time NoSQL) |
| Authentication | Firebase Auth (Anonymous + role-based session) |
| File Storage | Firebase Storage (images, PDFs, videos) |
| State Management | Riverpod 2.x (reactive providers + code generation) |
| Navigation | GoRouter 14 (deep linking, shell routes, role guards) |
| Session Persistence | Flutter Secure Storage (auto login on app relaunch) |
| Architecture | Clean Architecture — Domain / Data / Presentation layers |

---

## 👥 User Roles

| Role | Access Level | Navigation |
| --- | --- | --- |
| Admin (Head) | Full access — all projects, staff, financials | 5-tab bottom nav |
| Manager | Assigned projects, updates, workers, settlements | 3-tab bottom nav |
| Worker | Assigned projects — view updates, designs, timeline | Single screen |
| Client | Own project only — updates, designs, timeline | Single project view |

---

## ✅ Features Live Now

### 🔐 Authentication & Session

- Role-based login with three entry points — Admin, Manager, Client
- Persistent login session — users stay logged in across app restarts
- Secure session storage using Flutter Secure Storage
- Role stored locally and synced with Firebase on login

### 🧭 Role-Based Bottom Navigation

- **Admin** gets a 5-tab persistent bottom nav: Projects · Staff · Sales · Website · Profile
- **Manager** gets a 3-tab persistent bottom nav: Projects · Sales · Profile
- Tab state is preserved on switch — no data loss when moving between tabs
- Deep navigation (e.g. Project Detail) pushes above the nav bar — bottom nav hides cleanly
- Logout is placed exclusively in the **Profile tab** (not scattered across every screen)

### 📂 Project Management — Admin & Manager

- Full project list with card UI showing project ID, name, location, budget
- Create new projects with multi-step form: name, client details (name, phone, email), location, budget, manager assignment
- Long-press a project card to delete (with confirmation dialog)
- Project cards show live completion percentage with a progress bar

### 📋 Project Detail Screen

- **Hero Header** — project name, status badge (Active / Completed), client name, due date, quick action buttons (Edit, Share, Archive)
- **Progress Overview** — circular progress indicator with % complete, worker count, budget spend bar (Admin/Manager only, turns red when >90% spent)
- **4-tab layout** for Admin/Manager, 3-tab layout for Worker/Client:
    - **Overview Tab** — all project metadata (client, location, manager, dates, phone, email) plus full financials breakdown (budget vs spend vs remaining)
    - **Tasks Tab** — segmented panel with Workers, Rooms, Settle, and Budget sub-sections
    - **Files Tab** — design documents, uploaded images, PDFs and videos with preview support
    - **Activity Tab** — segmented Updates feed and Timeline view
- Role-aware FAB: **Add Task** for Admin/Manager, **Log Update** for Worker

### 👷 Workers & Rooms Management

- Assign and remove workers from projects
- View worker details and contact info
- Manage project rooms/spaces with worker assignment per room
- Full CRUD on rooms inside a project

### 📸 Designs & Files

- Upload images, PDFs, and videos to a project , cam to take photos
- Photo viewer with pinch-to-zoom
- PDF viewer built-in
- Video playback with controls
- Image and video compression before upload to reduce storage cost

### 🗓️ Timeline

- Project milestone and schedule view
- Visual timeline per project
- Status tracking per milestone

### 💰 Budget & Settlements

- Budget entry and transaction tracking per project by manager and admin aslo
- Add, edit, delete budget line items
- Worker payment settlements — log and track payments per worker per project
- Budget bar shows real-time spend vs total in the Progress Overview

### 📣 Updates Feed

- Create rich project updates with text, images, video, and worker tags
- Updates visible to all assigned roles on that project
- Client sees updates — keeping them informed without full app access

### 👤 Profile Screen

- Displays user name and role badge
- Settings items: Notifications, Help & Support, About
- **Sign Out** in Profile only (with confirmation dialog)

---

## 🗺️ Upcoming Features — Roadmap

---

### 👥 Staff Module *(Admin only)*

The Staff tab gives the Admin a dedicated space to manage the entire team — both Managers and Workers — without needing to go into individual projects.

**Manager Management**

- View all managers with their name, contact, and list of assigned projects
- Add a new manager — set name, phone, login credentials
- Edit manager details
- Remove a manager (with reassignment prompt for their active projects)
- View manager workload — how many active projects they are handling

**Worker Management**

- View all workers with their name, skill, phone, and assigned projects
- Add a new worker — name, phone, skill/trade (e.g. Carpenter, Electrician, Painter)
- Edit worker details
- Remove a worker from the system
- See which projects a worker is currently assigned to

**Team Overview Dashboard**

- Total managers count and total workers count at a glance
- Filter staff by role, active project count, or availability

---

### 📊 Sales Module *(Admin + Manager)*

The Sales tab is a lead management system built specifically for interior design enquiries. Every incoming lead from a potential client gets logged, tracked, and converted from here.

**Lead Capture Fields**

- Client Name
- Client Phone Number
- Area / Location (where the project will be done)
- Project Type / Specific Requirement (e.g. Living Room, Full Home, Office, Kitchen)
- Source of lead (Instagram, WhatsApp, Referral, Website)
- Estimated Budget range
- Notes / initial brief

**Lead Status Management**

- Each lead has a status: `New` → `Contacted` → `Site Visit Scheduled` → `Proposal Sent` → `Won` → `Lost`
- Admin and Manager can both update lead status
- Color-coded status badges on the lead list for quick scanning
- Filter leads by status, date range, or assigned manager

**Lead List & Detail**

- Scrollable list of all leads with client name, requirement, status badge, and date added
- Tap a lead to see full detail and update status or notes
- Admin sees all leads across the business
- Manager sees leads assigned to them
- Swipe to archive or delete a lead

**Conversion Tracking**

- Won leads can be converted directly into a new Project with one tap — auto-fills client details from the lead

---

### 🌐 Website Module *(Admin only)*

The Website tab lets the Admin publish and manage project showcase content on the Velan Spaces public website — directly from the mobile app. No code, no desktop required.

**Project Publishing**

- Browse the list of completed projects and select which ones to publish
- For each published project, fill in:
    - **Project Name** — as it will appear publicly
    - **Project Images** — upload/select from project files, arrange order, set cover photo
    - **Case Study** — rich text write-up describing the brief, design approach, materials used, and outcome
    - **Project Category** — Residential, Commercial, Office, Kitchen, etc.
    - **Project Location** — city/area (no full address)
    - **Completion Year**
- Preview how the project page will look before publishing
- Toggle project visibility: Published / Draft / Hidden

**Portfolio Management**

- See all published projects in a grid with their live status
- Reorder projects on the website portfolio page via drag-and-drop
- Edit or unpublish any project at any time

**Content Sync**

- Changes pushed from the app sync to the website in real time via Firebase
- Website reads from the same Firestore database — no separate CMS needed

---

### 🔔 Notifications Module

In-app push notification system to keep Admin and Managers in sync without WhatsApp chasing.

**Notification Rules**

| Trigger | Who Gets Notified |
| --- | --- |
| Manager posts a project update | Admin ||
| Manager uploads a design or file | Admin | |
| Manager logs a worker settlement | Admin ||
| Manager changes a project status | Admin ||
| Admin posts a project update | Assigned Manager 
| Admin assigns a new project to Manager | Assigned Manager |
| Admin adds a worker to a project | Assigned Manager |
| Admin approves / comments on a settlement | Assigned Manager |

**Implementation Plan**

- Firebase Cloud Messaging (FCM) for push delivery
- In-app notification bell with unread badge count
- Notification history list — tap any notification to jump to the relevant project/screen
- Per-role notification preferences (opt in/out per category)

---

## 📁 Project File Structure

```
lib/
├── core/              # Router, Theme, Session Service
├── domain/            # Entities, Repository interfaces
├── data/              # Firebase datasources, Repository implementations
└── presentation/
    ├── providers/     # Riverpod state providers
    ├── screens/       # Auth, Dashboard, Profile, Staff, Sales, Website
    └── widgets/       # Shells, Tabs, Update cards, Common components
```

---

## 🔗 Related Pages

- 🔒 [Privacy Policy](https://www.notion.so/Privacy-Policy-Velan-Spaces-App-331ba05585f481a386e6c24024747ac7?pvs=21)
- 🛠️ [Support Page](https://www.notion.so/Support-Velan-Spaces-App-331ba05585f4817bb8a2d58f5f5e0a5a?pvs=21)
- ©️ [Copyright & App Store Info](https://www.notion.so/Copyright-App-Store-Submission-Info-Velan-Spaces-331ba05585f4810c9712d9a7db711e15?pvs=21)




8F:56:6D:F1:89:93:C7:E0:B9:3D:DC:A7:AF:F0:36:FB:D3:D1:8B:62:24:45:15:22:0B:7A:AB:98:EB:8D:C8:95