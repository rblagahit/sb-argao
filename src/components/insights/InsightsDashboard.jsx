import { useMemo, useState } from 'react';
import { formatDate, normalizeTag, normalizeText } from '../../utils/helpers';

const MONTH_OPTIONS = [
  { value: '', label: 'All months' },
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
];

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value?.seconds) {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toCsv(rows) {
  return rows.map((row) => row.map((cell) => {
    const text = String(cell ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  }).join(',')).join('\n');
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, helper, icon, tone }) {
  const toneMap = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    violet: 'bg-violet-50 border-violet-100 text-violet-700',
  };
  const classes = toneMap[tone] || 'bg-slate-50 border-slate-100 text-slate-700';

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${classes}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
          {helper ? <p className="mt-2 text-sm font-semibold">{helper}</p> : null}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-lg shadow-sm">
          <i className={`fas ${icon}`} />
        </div>
      </div>
    </div>
  );
}

export default function InsightsDashboard({
  documents,
  members,
  title,
  subtitle,
  showBack = false,
  onBack,
  allowExport = false,
  showBarangayFilter = false,
  showToast,
  lockedMessage = '',
}) {
  const [filters, setFilters] = useState({
    year: '',
    month: '',
    sponsor: '',
    committee: '',
    documentId: '',
    type: '',
    barangayId: '',
  });

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const docMeta = useMemo(() => documents.map((doc) => {
    const timestamp = toDate(doc.timestamp || doc.updatedAt || doc.createdAt);
    const sponsor = memberMap.get(doc.authorId);
    const committees = new Set([
      ...(doc.tags || []).map(normalizeTag),
      ...((sponsor?.committees || []).map(normalizeTag)),
    ]);

    return {
      ...doc,
      timestamp,
      year: timestamp?.getFullYear() || null,
      month: timestamp?.getMonth() ?? null,
      sponsorLabel: doc.authorName || sponsor?.name || 'Unassigned',
      committeeTags: [...committees].filter(Boolean),
      barangayLabel: doc.barangayName || doc._barangayName || doc.barangayId || '',
    };
  }), [documents, memberMap]);

  const yearOptions = useMemo(() => {
    const years = [...new Set(docMeta.map((doc) => doc.year).filter(Boolean))].sort((a, b) => b - a);
    return years.map((year) => ({ value: String(year), label: String(year) }));
  }, [docMeta]);

  const sponsorOptions = useMemo(() => {
    const sponsors = [...new Set(docMeta.map((doc) => doc.sponsorLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return sponsors;
  }, [docMeta]);

  const committeeOptions = useMemo(() => {
    const committeeSet = new Set();
    docMeta.forEach((doc) => {
      doc.committeeTags.forEach((tag) => committeeSet.add(tag));
    });
    return [...committeeSet].sort((a, b) => a.localeCompare(b));
  }, [docMeta]);

  const documentOptions = useMemo(() => (
    [...docMeta]
      .sort((a, b) => (a.title || a.docId || '').localeCompare(b.title || b.docId || ''))
      .map((doc) => ({ value: doc.id, label: `${doc.docId || 'DOC'} · ${doc.title || 'Untitled'}` }))
  ), [docMeta]);

  const barangayOptions = useMemo(() => {
    const values = [...new Set(docMeta.map((doc) => doc.barangayLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return values;
  }, [docMeta]);

  const filteredDocs = useMemo(() => docMeta.filter((doc) => {
    if (filters.year && String(doc.year) !== filters.year) return false;
    if (filters.month && String(doc.month) !== filters.month) return false;
    if (filters.sponsor && doc.sponsorLabel !== filters.sponsor) return false;
    if (filters.committee && !doc.committeeTags.includes(normalizeTag(filters.committee))) return false;
    if (filters.documentId && doc.id !== filters.documentId) return false;
    if (filters.type && normalizeText(doc.type) !== normalizeText(filters.type)) return false;
    if (filters.barangayId && doc.barangayLabel !== filters.barangayId) return false;
    return true;
  }), [docMeta, filters]);

  const stats = useMemo(() => {
    const totalViews = filteredDocs.reduce((sum, doc) => sum + Number(doc.views || 0), 0);
    const sponsorCount = new Set(filteredDocs.map((doc) => doc.sponsorLabel).filter(Boolean)).size;
    const avgViews = filteredDocs.length ? Math.round(totalViews / filteredDocs.length) : 0;
    const committeeCount = new Set(filteredDocs.flatMap((doc) => doc.committeeTags)).size;
    return { totalViews, sponsorCount, avgViews, committeeCount };
  }, [filteredDocs]);

  const topDocuments = useMemo(() => (
    [...filteredDocs]
      .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
      .slice(0, 6)
  ), [filteredDocs]);

  const sponsorRankings = useMemo(() => {
    const map = new Map();
    filteredDocs.forEach((doc) => {
      const key = doc.sponsorLabel || 'Unassigned';
      const entry = map.get(key) || { name: key, docs: 0, views: 0 };
      entry.docs += 1;
      entry.views += Number(doc.views || 0);
      map.set(key, entry);
    });

    return [...map.values()]
      .sort((a, b) => (b.docs - a.docs) || (b.views - a.views))
      .slice(0, 6);
  }, [filteredDocs]);

  const committeeRankings = useMemo(() => {
    const map = new Map();
    filteredDocs.forEach((doc) => {
      doc.committeeTags.forEach((tag) => {
        const entry = map.get(tag) || { label: tag, docs: 0, views: 0 };
        entry.docs += 1;
        entry.views += Number(doc.views || 0);
        map.set(tag, entry);
      });
    });
    return [...map.values()]
      .sort((a, b) => (b.docs - a.docs) || (b.views - a.views))
      .slice(0, 6);
  }, [filteredDocs]);

  const timeline = useMemo(() => {
    const map = new Map();
    filteredDocs.forEach((doc) => {
      const label = doc.timestamp
        ? `${doc.timestamp.getFullYear()}-${String(doc.timestamp.getMonth() + 1).padStart(2, '0')}`
        : 'Undated';
      map.set(label, (map.get(label) || 0) + 1);
    });
    return [...map.entries()]
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.label.localeCompare(a.label))
      .slice(0, 8);
  }, [filteredDocs]);

  const resetFilters = () => {
    setFilters({
      year: '',
      month: '',
      sponsor: '',
      committee: '',
      documentId: '',
      type: '',
      barangayId: '',
    });
  };

  const exportReport = () => {
    if (!filteredDocs.length) {
      showToast?.('No analytics rows to export.', 'info');
      return;
    }

    const rows = [
      ['Title', 'Document ID', 'Type', 'Sponsor', 'Views', 'Date', 'Tags', 'Barangay'],
      ...filteredDocs.map((doc) => [
        doc.title || '',
        doc.docId || '',
        doc.type || '',
        doc.sponsorLabel || '',
        Number(doc.views || 0),
        doc.timestamp ? formatDate(doc.timestamp.toISOString()) : '',
        (doc.tags || []).join('; '),
        doc.barangayLabel || '',
      ]),
    ];
    downloadTextFile('legislative-analytics-report.csv', toCsv(rows));
    showToast?.('Analytics report exported.', 'success');
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-blue-600">{title}</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Legislative Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {allowExport ? (
            <button
              type="button"
              onClick={exportReport}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700"
            >
              <i className="fas fa-download mr-2 text-xs" />
              Export Report
            </button>
          ) : null}
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:border-blue-300 hover:text-blue-700"
            >
              <i className="fas fa-arrow-left mr-2 text-xs" />
              Back
            </button>
          ) : null}
        </div>
      </div>

      {lockedMessage ? (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
          <p className="font-black">Starter plan analytics mode</p>
          <p className="mt-1">{lockedMessage}</p>
        </div>
      ) : null}

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className={`grid gap-3 ${showBarangayFilter ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-6' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-5'}`}>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Year</label>
            <select
              value={filters.year}
              onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">All years</option>
              {yearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Month</label>
            <select
              value={filters.month}
              onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              {MONTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Sponsor / Author</label>
            <select
              value={filters.sponsor}
              onChange={(event) => setFilters((current) => ({ ...current, sponsor: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">All sponsors</option>
              {sponsorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Committee</label>
            <select
              value={filters.committee}
              onChange={(event) => setFilters((current) => ({ ...current, committee: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">All committees</option>
              {committeeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Document</label>
            <select
              value={filters.documentId}
              onChange={(event) => setFilters((current) => ({ ...current, documentId: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">All documents</option>
              {documentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          {showBarangayFilter ? (
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Barangay</label>
              <select
                value={filters.barangayId}
                onChange={(event) => setFilters((current) => ({ ...current, barangayId: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">All barangays</option>
                {barangayOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200"
          >
            <i className="fas fa-rotate-left mr-1 text-[10px]" />
            Reset Filters
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Filtered Docs" value={filteredDocs.length} helper="Documents matching your filters" icon="fa-file-alt" tone="blue" />
        <StatCard label="Total Views" value={stats.totalViews} helper="Public views across the result set" icon="fa-eye" tone="emerald" />
        <StatCard label="Avg Views" value={stats.avgViews} helper="Average views per document" icon="fa-gauge-high" tone="amber" />
        <StatCard label="Active Sponsors" value={stats.sponsorCount} helper={`${stats.committeeCount} committees represented`} icon="fa-users" tone="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Top Documents</h3>
              <p className="text-sm text-slate-500">Highest-view records in the current result set.</p>
            </div>
          </div>
          <div className="space-y-3">
            {!topDocuments.length ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No documents match the current filters.</p>
            ) : topDocuments.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{doc.title || 'Untitled document'}</p>
                    <p className="mt-1 text-sm text-slate-500">{doc.docId || 'No ID'} · {doc.type || 'Unclassified'}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-blue-700">
                    {Number(doc.views || 0)} views
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
                  <span>{doc.sponsorLabel}</span>
                  {doc.timestamp ? <span>{formatDate(doc.timestamp.toISOString())}</span> : null}
                  {doc.barangayLabel ? <span>{doc.barangayLabel}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Sponsor Activity</h3>
            <p className="text-sm text-slate-500">Sponsors ranked by volume and total views.</p>
            <div className="mt-4 space-y-3">
              {!sponsorRankings.length ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No sponsor activity for the current filters.</p>
              ) : sponsorRankings.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-bold text-slate-900">{entry.name}</p>
                    <p className="text-sm text-slate-500">{entry.docs} document{entry.docs === 1 ? '' : 's'}</p>
                  </div>
                  <span className="text-sm font-black text-blue-700">{entry.views} views</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Committee Trends</h3>
            <p className="text-sm text-slate-500">Committees inferred from document tags and sponsor assignments.</p>
            <div className="mt-4 space-y-3">
              {!committeeRankings.length ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No committee signals in the filtered documents.</p>
              ) : committeeRankings.map((entry) => (
                <div key={entry.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-bold text-slate-900">{entry.label}</p>
                    <p className="text-sm text-slate-500">{entry.docs} linked document{entry.docs === 1 ? '' : 's'}</p>
                  </div>
                  <span className="text-sm font-black text-violet-700">{entry.views} views</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Publication Timeline</h3>
        <p className="text-sm text-slate-500">Most recent document periods in the filtered set.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {!timeline.length ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No timeline data for the selected filters.</p>
          ) : timeline.map((entry) => (
            <div key={entry.label} className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">{entry.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{entry.total}</p>
              <p className="text-sm text-slate-500">document{entry.total === 1 ? '' : 's'}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
