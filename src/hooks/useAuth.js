import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

/**
 * Tracks Firebase auth state and exposes helpers.
 * Role and lguId are read from users/{uid} in Firestore (not Custom Claims).
 * @returns {{ user, userRole, userLguId, loading, logout }}
 */
export function useAuth() {
  const [user, setUser]           = useState(null);
  const [userRole, setUserRole]   = useState(null);
  const [userLguId, setUserLguId] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          if (snap.exists()) {
            const d = snap.data();
            setUserRole(d.role   || null);
            setUserLguId(d.lguId || null);
          } else {
            setUserRole(null);
            setUserLguId(null);
          }
        } catch {
          setUserRole(null);
          setUserLguId(null);
        }
      } else {
        setUserRole(null);
        setUserLguId(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const logout = () =>
    signOut(auth).catch(err => console.error('[auth] logout error:', err));

  return { user, userRole, userLguId, loading, logout };
}

/**
 * Checks whether the admin profile document exists and is complete at users/{uid}.
 */
export async function checkAdminProfileComplete(user) {
  if (!user) return false;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    return snap.exists() && snap.data().isComplete === true;
  } catch {
    return false;
  }
}
