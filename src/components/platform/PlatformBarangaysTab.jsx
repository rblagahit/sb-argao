import { useEffect, useMemo, useState } from 'react';
import { collectionGroup, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../firebase';

export default function PlatformBarangaysTab({ showToast }) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const loadBarangays = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(query(collectionGroup(db, 'barangays'), limit(300)));
        if (!ignore) {
          setRows(snapshot.docs.map((docSnap) => {
            const path = docSnap.ref.path.split('/');
            return {
              id: docSnap.id,
              lguId: path[1] || '',
              ...docSnap.data(),
            };
          }));
          setLoading(false);
        }
      } catch (error) {
        console.error('[PlatformBarangaysTab]', error);
        if (!ignore) {
          showToast('Unable to load platform barangays.', 'error');
          setLoading(false);
        }
      }
    };

    loadBarangays();
    return () => {
      ignore = true;
    };
  }, [showToast]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...rows]
      .filter((row) => !term || [row.name, row.code, row.lguId, row.secretaryEmail].join(' ').toLowerCase().includes(term))
      .sort((a, b) => (a.name || a.code || a.id).localeCompare(b.name || b.code || b.id));
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search barangay, LGU, or email..."
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
      />

      {loading ? (
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-16 text-center text-slate-400 shadow-sm">
          <i className="fas fa-spinner fa-spin text-2xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredRows.map((row) => (
            <div key={`${row.lguId}-${row.id}`} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black text-slate-900">{row.name || row.code || row.id}</p>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-purple-700">{row.lguId}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">Code: {row.code || row.id}</p>
              <p className="mt-1 text-sm text-slate-500">Captain: {row.captain || 'Not set'}</p>
              <p className="mt-1 text-sm text-slate-500">Secretary: {row.secretaryName || 'Not set'}{row.secretaryEmail ? ` · ${row.secretaryEmail}` : ''}</p>
            </div>
          ))}
          {!filteredRows.length ? (
            <div className="lg:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <i className="fas fa-map-marker-alt text-3xl text-slate-300" />
              <p className="mt-4 text-sm font-semibold text-slate-500">No barangays match the current filter.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
