import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import InsightsDashboard from '../insights/InsightsDashboard';

export default function AnalyticsTab({ tenantId, documents, members, showToast }) {
  const [tier, setTier] = useState('starter');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setTier('starter');
      setLoading(false);
      return;
    }

    let ignore = false;

    const loadRegistry = async () => {
      setLoading(true);
      try {
        const snapshot = await getDoc(doc(db, 'lguRegistry', tenantId));
        if (!ignore) {
          setTier(snapshot.exists() ? (snapshot.data().tier || 'starter') : 'starter');
          setLoading(false);
        }
      } catch (error) {
        console.error('[AnalyticsTab]', error);
        if (!ignore) {
          setTier('starter');
          setLoading(false);
        }
      }
    };

    loadRegistry();
    return () => {
      ignore = true;
    };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-100 bg-white px-6 py-16 text-center text-slate-400 shadow-sm">
        <i className="fas fa-spinner fa-spin text-2xl" />
      </div>
    );
  }

  const advancedEnabled = tier === 'standard' || tier === 'premium';

  return (
    <InsightsDashboard
      documents={documents}
      members={members}
      title="Advanced Analytics"
      subtitle="Legacy recovery: in-depth legislative activity reports and exports."
      allowExport={advancedEnabled}
      showBarangayFilter={advancedEnabled}
      showToast={showToast}
      lockedMessage={advancedEnabled ? '' : 'Upgrade your plan to unlock export and barangay-level analytics filters. Basic analytics remains available below.'}
    />
  );
}
