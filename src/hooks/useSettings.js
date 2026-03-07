import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, DEFAULT_LGU_ID } from '../firebase';
import { DEFAULT_DOWNLOAD_NOTICE } from '../utils/constants';

const settingsRef = (lguId) =>
  doc(db, 'lgus', lguId, 'settings', 'general');

const DEFAULTS = {
  downloadNotice: DEFAULT_DOWNLOAD_NOTICE,
  socialFacebook: '',
  socialTwitter:  '',
  socialEmail:    '',
  orgName:        '',
  municipality:   '',
  province:       '',
  sealUrl:        '',
  contactPhone1:  '',
  contactPhone2:  '',
  contactEmail:   '',
};

/**
 * One-time fetch for public tenant settings.
 */
export function usePublicSettings(lguId = DEFAULT_LGU_ID, enabled = true) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading]   = useState(Boolean(enabled));

  useEffect(() => {
    if (!enabled || !lguId) {
      setLoading(false);
      return undefined;
    }

    let ignore = false;

    const loadSettings = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(settingsRef(lguId));
        if (!ignore) {
          setSettings(snap.exists() ? { ...DEFAULTS, ...snap.data() } : DEFAULTS);
          setLoading(false);
        }
      } catch (err) {
        console.error('[usePublicSettings]', err);
        if (!ignore) setLoading(false);
      }
    };

    loadSettings();

    return () => {
      ignore = true;
    };
  }, [enabled, lguId]);

  return { settings, loading };
}

/**
 * Real-time listener for admin settings edits.
 * Returns current settings merged with defaults.
 */
export function useAdminSettings(lguId = DEFAULT_LGU_ID, enabled = true) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading]   = useState(Boolean(enabled));

  useEffect(() => {
    if (!enabled || !lguId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsub = onSnapshot(
      settingsRef(lguId),
      snap => {
        setSettings(snap.exists() ? { ...DEFAULTS, ...snap.data() } : DEFAULTS);
        setLoading(false);
      },
      err => { console.error('[useAdminSettings]', err); setLoading(false); },
    );
    return unsub;
  }, [enabled, lguId]);

  return { settings, loading };
}

export const useSettings = useAdminSettings;

// ─── Mutations ────────────────────────────────────────────────────────────────

export const saveSettings = (lguId = DEFAULT_LGU_ID, uid, partial) =>
  setDoc(settingsRef(lguId), { ...partial, updatedAt: serverTimestamp(), updatedBy: uid }, { merge: true });
