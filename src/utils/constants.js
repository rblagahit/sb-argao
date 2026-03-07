// ─── Download notice ──────────────────────────────────────────────────────────

export const DEFAULT_DOWNLOAD_NOTICE =
  'Downloaded documents are for reference only. Under RA 7160, they are not official or ' +
  'binding unless authenticated by the Office of the Secretary to the Sangguniang Bayan ' +
  'with official seal and signature. Certified True Copies must be requested from the ' +
  "SB Secretary's Office.";

// ─── Document type styling ────────────────────────────────────────────────────

export const TYPE_GRADIENT = {
  Ordinance:         'from-blue-600 to-blue-700',
  Resolution:        'from-purple-600 to-purple-700',
  Motion:            'from-amber-500 to-amber-600',
  Proclamation:      'from-rose-500 to-rose-600',
  'Committee Report':'from-teal-600 to-teal-700',
};

export const TYPE_GRADIENT_DEFAULT = 'from-slate-700 to-slate-800';

export const DOCUMENT_TYPES = [
  { value: 'Ordinance',        label: '📜 Ordinance' },
  { value: 'Resolution',       label: '📄 Resolution' },
  { value: 'Motion',           label: '📋 Motion' },
  { value: 'Proclamation',     label: '🏛️ Proclamation' },
  { value: 'Committee Report', label: '📑 Committee Report' },
];

export const ADMIN_PANEL_ROLES = ['superadmin', 'admin', 'editor', 'barangay_portal'];
export const PLATFORM_PANEL_ROLES = ['superadmin'];
export const SETTINGS_PANEL_ROLES = ['superadmin', 'admin'];
export const ENABLE_LOCAL_IMPORTS = false;

// ─── Firestore collection paths ───────────────────────────────────────────────
// Constructed at runtime using LGU_ID from firebase.js.
// Barangay paths extend this with: lgus/{lguId}/barangays/{barangayId}/...

export const firestorePaths = (lguId) => ({
  members:      ['lgus', lguId, 'members'],
  documents:    ['lgus', lguId, 'legislations'],
  settings:     ['lgus', lguId, 'settings', 'general'],
  barangays:    ['lgus', lguId, 'barangays'],
});
