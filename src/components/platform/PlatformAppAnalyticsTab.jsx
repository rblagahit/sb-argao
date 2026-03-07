import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../firebase';

function toDate(value) {
  if (!value) return null;
  const parsed = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function PlatformAppAnalyticsTab({ showToast }) {
  const [windowDays, setWindowDays] = useState('30');
  const [loading, setLoading] = useState(true);
  const [dailyRows, setDailyRows] = useState([]);
  const [searchRows, setSearchRows] = useState([]);

  useEffect(() => {
    let ignore = false;

    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const [dailySnap, searchSnap] = await Promise.all([
          getDocs(query(collection(db, 'appAnalyticsDaily'), limit(180))),
          getDocs(query(collection(db, 'appSearchTermsDaily'), limit(500))),
        ]);
        if (!ignore) {
          setDailyRows(dailySnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
          setSearchRows(searchSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
          setLoading(false);
        }
      } catch (error) {
        console.error('[PlatformAppAnalyticsTab]', error);
        if (!ignore) {
          showToast('Unable to load app analytics.', 'error');
          setLoading(false);
        }
      }
    };

    loadAnalytics();
    return () => {
      ignore = true;
    };
  }, [showToast]);

  const cutoffMs = Date.now() - (Number(windowDays) * 24 * 60 * 60 * 1000);

  const recentDaily = useMemo(() => (
    dailyRows
      .filter((row) => {
        const rowDate = toDate(row.date || row.updatedAt || row.createdAt || row.id);
        return !rowDate || rowDate.getTime() >= cutoffMs;
      })
      .sort((a, b) => String(b.id).localeCompare(String(a.id)))
  ), [cutoffMs, dailyRows]);

  const totals = useMemo(() => recentDaily.reduce((acc, row) => {
    acc.searches += Number(row.searches || row.totalSearches || 0);
    acc.views += Number(row.documentViews || row.views || 0);
    acc.visits += Number(row.visits || row.sessions || 0);
    return acc;
  }, { searches: 0, views: 0, visits: 0 }), [recentDaily]);

  const topSearchTerms = useMemo(() => (
    [...searchRows]
      .sort((a, b) => Number(b.count || b.total || 0) - Number(a.count || a.total || 0))
      .slice(0, 10)
  ), [searchRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">App Analytics</h3>
          <p className="text-sm text-slate-500">Global app activity and top public search terms.</p>
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">Window</label>
          <select value={windowDays} onChange={(event) => setWindowDays(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-purple-400 focus:ring-4 focus:ring-purple-100">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-16 text-center text-slate-400 shadow-sm">
          <i className="fas fa-spinner fa-spin text-2xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Searches</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{totals.searches}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Document Views</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{totals.views}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Visits</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{totals.visits}</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <h4 className="text-lg font-black text-slate-900">Recent Daily Activity</h4>
              <div className="mt-4 space-y-3">
                {!recentDaily.length ? (
                  <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No analytics rows in the selected window.</p>
                ) : recentDaily.slice(0, 12).map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-900">{row.id}</p>
                      <p className="text-sm text-slate-500">Searches {Number(row.searches || row.totalSearches || 0)} · Views {Number(row.documentViews || row.views || 0)}</p>
                    </div>
                    <span className="text-sm font-black text-blue-700">{Number(row.visits || row.sessions || 0)} visits</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <h4 className="text-lg font-black text-slate-900">Top Search Terms</h4>
              <div className="mt-4 space-y-3">
                {!topSearchTerms.length ? (
                  <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No recorded search terms yet.</p>
                ) : topSearchTerms.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-900">{row.term || row.searchTerm || row.id.split('__').at(-1)}</p>
                      <p className="text-sm text-slate-500">{row.id}</p>
                    </div>
                    <span className="text-sm font-black text-purple-700">{Number(row.count || row.total || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
