# Project Review & Development Roadmap
## Sangguniang Bayan of Argao — Legislative Information System

> Last updated: March 2026
> Stack: Vanilla HTML/CSS/JS · Firebase Auth · Cloud Firestore · Firebase Hosting
> Live: https://sb-argao.web.app · https://multi-legislative.web.app

---

## 1. Current State Assessment

### Architecture at a Glance

| Aspect | Current State | Target State |
|---|---|---|
| Stack | Single `index.html` (~5,400 lines) with CDN imports | Componentized React app (Vite already configured) |
| Auth model | Role-based: superadmin → admin → editor → viewer | ✅ Done (Firestore-sourced roles) |
| Admin roles | Custom Claims NOT used — roles in `users/{uid}.role` | JWT Custom Claims (Phase 1 stretch goal) |
| Firestore rules | Role + LGU-scoped rules | ✅ Done |
| Data path | `lgus/{lguId}/*` multi-tenant ready | ✅ Done |
| User management | `users/{uid}` collection, invite system, approval flow | ✅ Done |
| Admin UI | Top tab bar, inline collapsible forms | Sidebar nav, list-first, drawer-based forms (Phase 3) |

### What Works Well

- Real-time Firestore listeners for instant UI updates
- Clean public-facing view (search, members, stats)
- XSS-safe HTML escaping on rendered content
- Batch CSV import for documents
- View tracking with atomic `increment()` operations
- Multi-tenant data model (`lgus/{lguId}/*`)
- Registration → approval workflow (pending → admin approves)
- Invite system (`userInvites/{email}`)
- Tier system (starter/standard/premium) with feature flags per LGU
- Advanced Analytics tab (tier-gated)
- Superadmin Platform panel (LGUs, Users, Analytics, Barangays)
- Per-LGU branding isolation (fixed: unique `lguId` slug enforced on registration)
- Password show/hide on registration

---

## 2. Role Hierarchy (Implemented)

```
superadmin
  └── Platform owner; manages all LGUs, all users, feature flags, tiers

  Admin (per LGU)
    ├── Full Admin   → docs, members, settings, barangays, users, analytics, pricing
    ├── Editor       → docs, members, settings, profile only
    └── Viewer       → docs only (read-only)

  Pending / Rejected
    └── No panel access; pending shown in Platform > Users for approval

Public User
  └── Anonymous visitor — browse, search, request document copies
```

### Tab Access (implemented in `TAB_ACCESS`)

| Role | Tabs Accessible |
|---|---|
| superadmin | Redirected to Platform view (no LGU tabs) |
| admin | docs, members, barangay, settings, profile, users, analytics, pricing |
| editor | docs, members, settings, profile |
| viewer | docs |
| pending/rejected | None (redirect to pending view) |

---

## 3. Firestore Data Model (Current)

### Collections in Use

```
setup/bootstrapped              ← First-admin lock; prevents second superadmin

users/{uid}
  ├── email, name, role, lguId
  ├── barangayId, barangayName  ← for barangay-scoped editors
  ├── status, isComplete
  ├── requestedLguSlug          ← submitted at registration (NEW)
  ├── orgLgu, position, phone   ← submitted at registration (NEW)
  └── pendingNotification       ← in-app toast on approval/rejection

userInvites/{email}
  ├── role, lguId, barangayId
  └── status: 'pending' | 'accepted'

lguRegistry/{lguId}
  ├── tier: 'starter' | 'standard' | 'premium'
  ├── paid: bool
  ├── features.advancedAnalytics: bool
  └── features.additionalUsers: bool

lgus/{lguId}/
  ├── legislations/{docId}      ← documents (public read)
  ├── members/{memberId}        ← members (public read)
  ├── settings/general          ← branding, social, download notice
  └── barangays/{barangayId}/*  ← barangay sub-portals

featureRequests/{reqId}
  ├── lguId, type, status
  └── requestedBy, requestedAt
```

---

## 4. Firestore Security Rules (Current)

Rules are role + LGU-scoped. Key helper functions:

- `isSuperAdmin()` — role == 'superadmin' OR bootstrapped first admin
- `isAdmin(lguId)` — role == 'admin' + LGU match (superadmin bypasses)
- `isEditor(lguId)` — role in ['admin','editor'] + LGU match
- `isBarangayAdmin(lguId, barangayId)` — editor scoped to a barangay

All LGU data (`lgus/{lguId}/*`) requires LGU scope match. Settings require admin or above. Documents and members are public-readable, write-restricted.

---

## 5. Development Phases — Current Status

---

### ✅ PHASE 0 — Quick Wins (95% Complete)

| # | Task | Status |
|---|---|---|
| 0.1 | Tighten Firestore rules | ✅ Done |
| 0.2 | Move Firebase config to `.env` | ✅ Done (Vite `%VITE_*%` placeholders) |
| 0.3 | Remove disabled Email Service block | ✅ Done |
| 0.4 | Collapse Add Document form | ✅ Done |
| 0.5 | Collapse Add Member form | ✅ Done |
| 0.6 | Settings accordion | ✅ Done |
| 0.7 | Optional fields (co-sponsors, tags) collapsed | ⚠️ Partial — visible but no toggle |

---

### ✅ PHASE 1 — Foundation: Roles & Secure Rules (75% Complete)

| # | Task | Status |
|---|---|---|
| 1.1 | `users/{uid}` collection | ✅ Done |
| 1.2 | Firebase Cloud Functions | ❌ Not started — role changes done via client writes |
| 1.3 | Promote first admin to role via script | ✅ Done (bootstrap on first signup) |
| 1.4 | Deploy updated Firestore rules | ✅ Done |
| 1.5 | Read role from auth token | ⚠️ Partial — reads from Firestore doc, not JWT claims |

> **Note:** Phase 1.2 (Cloud Functions) is a stretch goal. The current Firestore-sourced role model is secure enough for the current use case. Custom Claims via Cloud Functions is a future hardening step.

---

### ✅ PHASE 2 — Multi-Admin (85% Complete)

| # | Task | Status |
|---|---|---|
| 2.1 | Users tab in admin panel | ✅ Done |
| 2.2 | Invite by email flow | ✅ Done |
| 2.3 | User list: active, pending, rejected | ✅ Done (no "suspended" state yet) |
| 2.4 | Role-gated UI | ✅ Done |
| 2.5 | Activity log collection | ❌ Not started |

---

### 🚧 PHASE 2.5 — Multi-Tenancy Fixes (NEW — In Progress)

These are issues discovered after Phase 2 that must be resolved before Phase 3.

| # | Task | Status |
|---|---|---|
| 2.5.1 | Per-LGU branding isolation (bug fix) | ✅ Done |
| 2.5.2 | Registration captures LGU slug | ✅ Done |
| 2.5.3 | Approval pre-fills LGU ID, format-validated | ✅ Done |
| 2.5.4 | Duplicate slug warning on approval | ✅ Done |
| 2.5.5 | Subdomain / hash-based LGU routing | ⬜ Next |
| 2.5.6 | "Your Public URL" shown to admin after login | ⬜ Next |

---

### 🔲 PHASE 3 — Admin Panel Redesign (25% Complete)

> **Prerequisite:** Phases 0–2.5 should be stable first.

| # | Task | Status |
|---|---|---|
| 3.1 | Migrate `index.html` to React components | ❌ Not started |
| 3.2 | Left sidebar navigation | ❌ Not started (still top tab bar) |
| 3.3 | Slide-in drawer component | ❌ Not started (still inline panels) |
| 3.4 | Settings accordion component | ✅ Done (already in HTML) |
| 3.5 | Activity log view in sidebar | ❌ Not started |

---

### 🔲 PHASE 4 — Super Admin Dashboard (60% Complete)

| # | Task | Status |
|---|---|---|
| 4.1 | `/platform` super admin view | ✅ Done |
| 4.2 | LGU management (create, assign tier) | ✅ Done |
| 4.3 | Global user management | ✅ Done |
| 4.4 | System-wide settings | ⚠️ Partial — feature flags per LGU done; global defaults missing |
| 4.5 | Firebase App Check | ❌ Not started |

---

### 🔲 PHASE 5 — Multi-Tenant (60% Complete)

| # | Task | Status |
|---|---|---|
| 5.1 | Migrate data paths to `lgus/{lguId}/*` | ✅ Done |
| 5.2 | LGU selector on login or subdomain routing | ⚠️ Partial — no UI; LGU assigned by admin |
| 5.3 | Per-LGU branding isolation | ✅ Done (bug fixed in 2.5.1) |
| 5.4 | Cross-LGU search (Super Admin only) | ❌ Not started |

---

## 6. Tier Model

| Feature | Starter (Free) | Standard | Premium |
|---|---|---|---|
| Public legislative page | ✓ | ✓ | ✓ |
| Documents + Members | ✓ | ✓ | ✓ |
| Basic branding | ✓ | ✓ | ✓ |
| 1 admin user | ✓ | ✓ | ✓ |
| Basic analytics | ✓ | ✓ | ✓ |
| Advanced analytics + export | — | ✓ | ✓ |
| Up to 5 users (editors) | — | ✓ | ✓ |
| Barangay-level editors | — | — | ✓ |
| Custom domain | — | — | ✓ |
| Priority support | — | — | ✓ |

### Enforcement (how it works)
- `lguRegistry/{lguId}.tier` = tier string
- `lguRegistry/{lguId}.features` = `{ advancedAnalytics: bool, additionalUsers: bool }`
- Analytics tab checks tier before rendering; locked banner shown for Starter
- Superadmin toggles features and tier manually from Platform > LGUs tab

### Still Needed
- User count enforcement (block adding users when tier limit exceeded)
- "Your Plan" panel in LGU Settings showing what's active/locked
- `paidUntil` timestamp + auto-downgrade warning
- Pending feature requests badged in Platform > LGUs

---

## 7. Next Priority Queue

```
Priority 1 — Phase 2.5 (Multi-tenancy cleanup)
  ► 2.5.5: Hash-based public URL per LGU (window.location.hash)
  ► 2.5.6: Show admin "Your public portal URL" after login

Priority 2 — Phase 0.7
  ► Collapse optional fields (co-sponsors, tags, more info) under toggle

Priority 3 — Phase 2 activity log
  ► lgus/{lguId}/activityLog collection
  ► Lightweight write on doc/member add/edit/delete

Priority 4 — Phase 3 (React migration + sidebar)
  ► This is the big lift; plan separately

Priority 5 — Phase 4.5 Firebase App Check
  ► 1-2 hour addition; high security value
```

---

## 8. File / Folder Structure (Target — Phase 3+)

```
erp-legislative/
├── src/
│   ├── main.jsx
│   ├── firebase.js              ← config from .env
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminSidebar.jsx
│   │   │   ├── Drawer.jsx
│   │   │   └── Toast.jsx
│   │   ├── admin/
│   │   │   ├── DocumentsTab.jsx
│   │   │   ├── MembersTab.jsx
│   │   │   ├── SettingsTab.jsx
│   │   │   ├── ProfileTab.jsx
│   │   │   ├── UsersTab.jsx
│   │   │   └── AnalyticsTab.jsx
│   │   └── public/
│   │       ├── PublicView.jsx
│   │       ├── ContactView.jsx
│   │       └── MemberCard.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useDocuments.js
│   │   └── useMembers.js
│   └── views/
│       ├── AdminView.jsx
│       ├── PlatformView.jsx
│       ├── PublicView.jsx
│       └── LoginView.jsx
├── functions/                   ← Phase 1 stretch (Firebase Cloud Functions)
│   ├── index.js
│   └── setUserRole.js
├── firestore.rules
├── .env
├── .env.example
└── package.json
```

---

*Document maintained by the development team. Update phase status as tasks are completed.*
