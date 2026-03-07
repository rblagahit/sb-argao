import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';

function formatTimestamp(value) {
  if (!value) return 'Unknown time';
  const dateValue = typeof value?.toDate === 'function'
    ? value.toDate()
    : value?.seconds
      ? new Date(value.seconds * 1000)
      : new Date(value);

  if (Number.isNaN(dateValue.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(dateValue);
}

export default function ActivityLogTab({ tenantId, showToast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setEntries([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, 'lgus', tenantId, 'activityLog'), orderBy('createdAt', 'desc'), limit(50)),
      (snapshot) => {
        setEntries(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoading(false);
      },
      (error) => {
        console.error('[ActivityLogTab]', error);
        showToast('Unable to load activity log.', 'error');
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [showToast, tenantId]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-black text-slate-900">Activity Log</h3>
        <p className="text-sm text-slate-500">Recent changes captured for this LGU.</p>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <i className="fas fa-spinner fa-spin text-2xl" />
          </div>
        ) : !entries.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
            <i className="fas fa-history text-2xl text-slate-300" />
            <p className="mt-4 text-sm font-semibold text-slate-500">No activity entries yet.</p>
            <p className="mt-2 text-sm text-slate-400">This tab is restored from the legacy dashboard. It will populate as audit entries are written.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-black text-slate-900">{entry.action || entry.title || 'Activity entry'}</p>
                    <p className="mt-1 text-sm text-slate-500">{entry.message || entry.description || 'No details recorded.'}</p>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {formatTimestamp(entry.createdAt || entry.timestamp)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                  {entry.actorName ? <span>By {entry.actorName}</span> : null}
                  {entry.actorEmail ? <span>{entry.actorEmail}</span> : null}
                  {entry.entityType ? <span>{entry.entityType}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
