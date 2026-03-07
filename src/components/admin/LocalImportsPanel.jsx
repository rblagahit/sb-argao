import { useMemo, useRef, useState } from 'react';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  addDocument,
  addDocumentImport,
  deleteDocumentImport,
  updateDocumentImport,
  useDocumentImports,
} from '../../hooks/useDocuments';
import { storage } from '../../firebaseStorage';
import { DOCUMENT_TYPES } from '../../utils/constants';
import {
  getFileExtension,
  isSupportedLocalImportFile,
  normalizeText,
  parseLocalLegislationFile,
  parseTags,
  slugifyFilePart,
} from '../../utils/helpers';

const IMPORT_NOTE =
  'Local import only creates a private draft. Upload the source file to managed cloud storage and update the public link before publishing.';

const formatBytes = (value = 0) => {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / (1024 ** index);
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const createScanRow = (candidate, index) => ({
  id: `${candidate.sourcePath || candidate.sourceFileName}-${index}`,
  selected: true,
  title: candidate.title,
  docId: candidate.docId,
  type: candidate.type,
  authorId: '',
  tags: candidate.tags.join(', '),
  contentPreview: candidate.contentPreview,
  sourcePath: candidate.sourcePath,
  sourceFileName: candidate.sourceFileName,
  sourceMimeType: candidate.sourceMimeType,
  sourceExtension: candidate.sourceExtension,
  sourceSize: candidate.sourceSize,
});

const normalizeKey = (value = '') => normalizeText(value.trim());

export default function LocalImportsPanel({ documents, members, tenantId, showToast }) {
  const fileInputRef = useRef(null);
  const queuedFileInputRef = useRef(null);
  const [scanRows, setScanRows] = useState([]);
  const [scanFiles, setScanFiles] = useState({});
  const [extractPreview, setExtractPreview] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [queuedPublishTargetId, setQueuedPublishTargetId] = useState('');
  const [editingDraftId, setEditingDraftId] = useState('');
  const [draftForm, setDraftForm] = useState(null);
  const {
    imports: queuedImports,
    loading: importsLoading,
  } = useDocumentImports(tenantId, Boolean(tenantId));

  const activeMembers = useMemo(
    () => members.filter(member => !member.isArchived),
    [members],
  );
  const memberById = useMemo(
    () => new Map(activeMembers.map(member => [member.id, member])),
    [activeMembers],
  );
  const existingDocIds = useMemo(
    () => new Set(documents.map(doc => normalizeKey(doc.docId || ''))),
    [documents],
  );
  const existingImportPaths = useMemo(
    () => new Set(queuedImports.map(entry => normalizeKey(entry.sourcePath || ''))),
    [queuedImports],
  );
  const queuedDocIds = useMemo(
    () => new Set(queuedImports.map(entry => normalizeKey(entry.docId || ''))),
    [queuedImports],
  );

  const queueDocIdCounts = useMemo(() => {
    const counts = new Map();
    scanRows.forEach(row => {
      const key = normalizeKey(row.docId || '');
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [scanRows]);

  const decoratedRows = useMemo(
    () => scanRows.map(row => {
      const issues = [];
      const docIdKey = normalizeKey(row.docId || '');
      const pathKey = normalizeKey(row.sourcePath || '');

      if (!row.title.trim()) issues.push('Missing title');
      if (!row.docId.trim()) issues.push('Missing Document ID');
      if (docIdKey && existingDocIds.has(docIdKey)) issues.push('Document ID already exists');
      if (docIdKey && queuedDocIds.has(docIdKey)) issues.push('Document ID already in draft queue');
      if (docIdKey && (queueDocIdCounts.get(docIdKey) || 0) > 1) issues.push('Duplicate Document ID in current scan');
      if (pathKey && existingImportPaths.has(pathKey)) issues.push('Source path already queued');

      return {
        ...row,
        issues,
        isReady: issues.length === 0,
      };
    }),
    [existingDocIds, existingImportPaths, queueDocIdCounts, queuedDocIds, scanRows],
  );

  const readyRows = useMemo(
    () => decoratedRows.filter(row => row.selected && row.isReady),
    [decoratedRows],
  );

  const handlePickFolder = () => {
    fileInputRef.current?.click();
  };

  const startDraftEdit = (entry) => {
    setEditingDraftId(entry.id);
    setDraftForm({
      title: entry.title || '',
      docId: entry.docId || '',
      type: entry.type || 'Ordinance',
      authorId: entry.authorId || '',
      tags: Array.isArray(entry.tags) ? entry.tags.join(', ') : '',
      contentPreview: entry.contentPreview || '',
    });
  };

  const resetDraftEdit = () => {
    setEditingDraftId('');
    setDraftForm(null);
  };

  const handleFileSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    const supportedFiles = files.filter(isSupportedLocalImportFile);
    if (supportedFiles.length === 0) {
      showToast('No supported legislative files found in the selected folder.', 'error');
      return;
    }

    if (supportedFiles.length !== files.length) {
      showToast(`Ignored ${files.length - supportedFiles.length} unsupported file(s).`, 'info');
    }

    setScanning(true);
    try {
      const candidates = await Promise.all(
        supportedFiles.map(file => parseLocalLegislationFile(file, { readPreview: extractPreview })),
      );
      setScanRows(candidates.map(createScanRow));
      setScanFiles(
        supportedFiles.reduce((acc, file, index) => {
          const candidate = candidates[index];
          acc[`${candidate.sourcePath || candidate.sourceFileName}-${index}`] = file;
          return acc;
        }, {}),
      );
      showToast(`Scanned ${candidates.length} local file(s). Review before saving drafts.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Folder scan failed.', 'error');
    } finally {
      setScanning(false);
    }
  };

  const updateRow = (rowId, field, value) => {
    setScanRows(current => current.map(row => (
      row.id === rowId ? { ...row, [field]: value } : row
    )));
  };

  const buildStoragePath = (row, file) => {
    const extension = row.sourceExtension || getFileExtension(file?.name || '') || 'bin';
    const base = slugifyFilePart(row.docId || row.title || row.sourceFileName || 'document') || 'document';
    return `lgus/${tenantId}/legislations/${base}-${Date.now()}.${extension}`;
  };

  const buildLegislationPayload = (row, author, publicUrl, storagePath) => ({
    title: row.title.trim(),
    docId: row.docId.trim(),
    type: row.type,
    authorId: row.authorId || '',
    authorName: author?.name || '',
    authorImage: author?.image || '',
    authorRole: author?.role || '',
    link: publicUrl,
    publicUrl,
    storagePath,
    tags: parseTags(row.tags),
    visibility: 'public',
    linkStatus: 'managed_public',
    sourceType: 'local',
    sourceAccess: 'private',
    sourceUrl: '',
    sourcePath: row.sourcePath,
    sourceFileName: row.sourceFileName,
    sourceMimeType: row.sourceMimeType,
    sourceExtension: row.sourceExtension,
    sourceSize: row.sourceSize,
    contentPreview: row.contentPreview || '',
    moreInfo: row.contentPreview || IMPORT_NOTE,
  });

  const upsertImportRecord = async (row, documentId, publicUrl, storagePath, existingImportId = '') => {
    const payload = {
      title: row.title.trim(),
      docId: row.docId.trim(),
      type: row.type,
      authorId: row.authorId || '',
      tags: parseTags(row.tags),
      link: publicUrl,
      publicUrl,
      visibility: 'public',
      linkStatus: 'managed_public',
      importStatus: 'promoted',
      sourceType: 'local',
      sourceAccess: 'private',
      sourceUrl: '',
      sourcePath: row.sourcePath,
      sourceFileName: row.sourceFileName,
      sourceMimeType: row.sourceMimeType,
      sourceExtension: row.sourceExtension,
      sourceSize: row.sourceSize,
      contentPreview: row.contentPreview || '',
      nextActionNote: 'Published from managed cloud storage.',
      promotedDocumentId: documentId,
      promotedAt: new Date().toISOString(),
      storagePath,
    };

    if (existingImportId) {
      await updateDocumentImport(existingImportId, payload, tenantId);
      return;
    }

    await addDocumentImport(payload, tenantId);
  };

  const publishRowToCloud = async (row, file, existingImportId = '') => {
    if (!tenantId) throw new Error('Missing tenant ID.');
    if (!file) throw new Error('No local file selected for upload.');
    if (!storage.app.options.storageBucket) throw new Error('Firebase Storage is not configured. Set VITE_FIREBASE_STORAGE_BUCKET.');

    const author = memberById.get(row.authorId);
    const storagePath = buildStoragePath(row, file);
    const uploadedRef = storageRef(storage, storagePath);

    await uploadBytes(uploadedRef, file, {
      contentType: file.type || row.sourceMimeType || undefined,
      customMetadata: {
        lguId: tenantId,
        docId: row.docId || '',
        sourceType: 'local',
      },
    });

    const publicUrl = await getDownloadURL(uploadedRef);
    const createdDoc = await addDocument(
      buildLegislationPayload(row, author, publicUrl, storagePath),
      tenantId,
    );

    await upsertImportRecord(row, createdDoc.id, publicUrl, storagePath, existingImportId);

    return createdDoc.id;
  };

  const handleSaveDrafts = async () => {
    if (readyRows.length === 0) {
      showToast('No ready rows to save. Fix the flagged items first.', 'error');
      return;
    }

    setSaving(true);
    try {
      await Promise.all(readyRows.map(async row => {
        const author = memberById.get(row.authorId);
        await addDocumentImport({
          title: row.title.trim(),
          docId: row.docId.trim(),
          type: row.type,
          authorId: row.authorId || '',
          authorName: author?.name || '',
          authorImage: author?.image || '',
          authorRole: author?.role || '',
          tags: parseTags(row.tags),
          link: '',
          visibility: 'private',
          linkStatus: 'needs_upload',
          importStatus: 'pending_review',
          sourceType: 'local',
          sourceAccess: 'private',
          sourceUrl: '',
          sourcePath: row.sourcePath,
          sourceFileName: row.sourceFileName,
          sourceMimeType: row.sourceMimeType,
          sourceExtension: row.sourceExtension,
          sourceSize: row.sourceSize,
          contentPreview: row.contentPreview || '',
          nextActionNote: IMPORT_NOTE,
          moreInfo: IMPORT_NOTE,
        }, tenantId);
      }));

      setScanRows([]);
      setScanFiles({});
      showToast(`Saved ${readyRows.length} private draft record(s).`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Draft save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishSelected = async () => {
    if (readyRows.length === 0) {
      showToast('No ready rows to publish. Fix the flagged items first.', 'error');
      return;
    }

    setPublishing(true);
    try {
      for (const row of readyRows) {
        const file = scanFiles[row.id];
        const matchingImport = queuedImports.find(entry => (
          (entry.sourcePath || '') === (row.sourcePath || '')
          || ((entry.docId || '') && entry.docId === row.docId)
        ));
        await publishRowToCloud(row, file, matchingImport?.id || '');
      }

      const publishedIds = new Set(readyRows.map(row => row.id));
      setScanRows(current => current.filter(row => !publishedIds.has(row.id)));
      setScanFiles(current => Object.fromEntries(
        Object.entries(current).filter(([key]) => !publishedIds.has(key)),
      ));
      showToast(`Published ${readyRows.length} document(s) to managed cloud storage.`, 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Unable to publish selected files.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleSelectQueuedFile = (draftId) => {
    setQueuedPublishTargetId(draftId);
    queuedFileInputRef.current?.click();
  };

  const handleQueuedFileSelection = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!queuedPublishTargetId || !file) return;

    const entry = queuedImports.find(item => item.id === queuedPublishTargetId);
    setQueuedPublishTargetId('');
    if (!entry) {
      showToast('Draft record no longer exists.', 'error');
      return;
    }

    setPublishing(true);
    try {
      await publishRowToCloud(
        {
          title: entry.title || '',
          docId: entry.docId || '',
          type: entry.type || 'Ordinance',
          authorId: entry.authorId || '',
          tags: Array.isArray(entry.tags) ? entry.tags.join(', ') : '',
          contentPreview: entry.contentPreview || '',
          sourcePath: entry.sourcePath || file.webkitRelativePath || file.name,
          sourceFileName: entry.sourceFileName || file.name,
          sourceMimeType: entry.sourceMimeType || file.type || '',
          sourceExtension: entry.sourceExtension || getFileExtension(file.name),
          sourceSize: entry.sourceSize || file.size || 0,
        },
        file,
        entry.id,
      );
      showToast('Draft uploaded and published successfully.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Unable to publish draft.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteImport = async (id) => {
    if (!window.confirm('Delete this import draft?')) return;
    try {
      await deleteDocumentImport(id, tenantId);
      showToast('Draft removed from import queue.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Unable to delete draft.', 'error');
    }
  };

  const handleSaveDraftEdit = async () => {
    if (!editingDraftId || !draftForm) return;
    if (!draftForm.title.trim() || !draftForm.docId.trim()) {
      showToast('Draft title and Document ID are required.', 'error');
      return;
    }

    try {
      const author = memberById.get(draftForm.authorId);
      await updateDocumentImport(editingDraftId, {
        title: draftForm.title.trim(),
        docId: draftForm.docId.trim(),
        type: draftForm.type,
        authorId: draftForm.authorId || '',
        authorName: author?.name || '',
        authorImage: author?.image || '',
        authorRole: author?.role || '',
        tags: parseTags(draftForm.tags),
        contentPreview: draftForm.contentPreview || '',
      }, tenantId);
      resetDraftEdit();
      showToast('Draft updated.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Unable to update draft.', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFileSelection}
        webkitdirectory=""
        directory=""
        accept=".pdf,.doc,.docx,.txt,.rtf"
      />
      <input
        ref={queuedFileInputRef}
        type="file"
        hidden
        onChange={handleQueuedFileSelection}
        accept=".pdf,.doc,.docx,.txt,.rtf"
      />

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600">
              <i className="fas fa-folder-open" /> Local Folder Import
            </p>
            <h4 className="text-2xl font-black text-slate-900">Scan a local folder into private draft records</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              The app reads filenames, folder structure, and optional text previews to prepare draft uploads.
              Imported rows stay private and are marked for cloud upload before any public link is added.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={extractPreview}
                onChange={e => setExtractPreview(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Extract text preview when possible
            </label>
            <button
              type="button"
              onClick={handlePickFolder}
              disabled={scanning}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scanning ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-folder-tree" />}
              <span>{scanning ? 'Scanning Folder…' : 'Choose Folder'}</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-slate-500 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Supported</p>
            <p className="mt-1 font-semibold text-slate-700">PDF, DOC, DOCX, TXT, RTF</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Saved As</p>
            <p className="mt-1 font-semibold text-slate-700">Private draft import records</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Next Step</p>
            <p className="mt-1 font-semibold text-slate-700">Upload source file to cloud, then publish</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-xl font-black text-slate-900">Scanned Review Queue</h4>
            <p className="text-sm text-slate-500">Review parsed metadata before creating draft records.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700">
              {readyRows.length} ready
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-bold text-amber-700">
              {decoratedRows.length - readyRows.length} flagged
            </span>
            <button
              type="button"
              onClick={() => setScanRows([])}
              disabled={scanRows.length === 0 || saving}
              className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-500 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear Scan
            </button>
            <button
              type="button"
              onClick={handleSaveDrafts}
              disabled={readyRows.length === 0 || saving || publishing}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />}
              <span>{saving ? 'Saving Drafts…' : 'Create Draft Records'}</span>
            </button>
            <button
              type="button"
              onClick={handlePublishSelected}
              disabled={readyRows.length === 0 || publishing || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-cloud-upload-alt" />}
              <span>{publishing ? 'Publishing…' : 'Upload and Publish Selected'}</span>
            </button>
          </div>
        </div>

        {decoratedRows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <i className="fas fa-inbox text-4xl" />
            <p className="mt-4 text-sm font-semibold">No folder scan loaded yet.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {decoratedRows.map(row => (
              <div key={row.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={e => updateRow(row.id, 'selected', e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-black text-slate-900">{row.sourceFileName}</p>
                      <p className="mt-1 text-xs text-slate-400">{row.sourcePath} · {formatBytes(row.sourceSize)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
                      row.isReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {row.isReady ? 'Ready' : 'Needs Review'}
                    </span>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-600">
                      Private Draft
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="xl:col-span-2">
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Title</label>
                    <input
                      value={row.title}
                      onChange={e => updateRow(row.id, 'title', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Document ID</label>
                    <input
                      value={row.docId}
                      onChange={e => updateRow(row.id, 'docId', e.target.value)}
                      placeholder="Optional draft ID"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Type</label>
                    <select
                      value={row.type}
                      onChange={e => updateRow(row.id, 'type', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    >
                      {DOCUMENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Primary Sponsor</label>
                    <select
                      value={row.authorId}
                      onChange={e => updateRow(row.id, 'authorId', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Assign later</option>
                      {activeMembers.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 xl:col-span-3">
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Tags</label>
                    <input
                      value={row.tags}
                      onChange={e => updateRow(row.id, 'tags', e.target.value)}
                      placeholder="Separate tags with commas"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Link Status</label>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-600">
                      needs_upload
                    </div>
                  </div>
                </div>

                {row.contentPreview && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">Content Preview</p>
                    <p className="text-sm leading-relaxed text-slate-600">{row.contentPreview}</p>
                  </div>
                )}

                {row.issues.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="mb-2 font-black uppercase tracking-widest text-amber-700">Review Needed</p>
                    <ul className="space-y-1">
                      {row.issues.map(issue => (
                        <li key={issue} className="flex items-center gap-2">
                          <i className="fas fa-exclamation-triangle text-xs" />
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h4 className="text-xl font-black text-slate-900">Private Import Drafts</h4>
            <p className="text-sm text-slate-500">Draft queue saved in Firestore. These records stay out of the public portal.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-500">
            {queuedImports.length} queued
          </span>
        </div>

        {importsLoading ? (
          <div className="py-12 text-center text-slate-400">
            <i className="fas fa-spinner fa-spin text-2xl" />
          </div>
        ) : queuedImports.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <i className="fas fa-box-open text-3xl" />
            <p className="mt-3 text-sm font-semibold">No private import drafts yet.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {queuedImports.map(entry => (
              <div key={entry.id} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{entry.title || entry.sourceFileName}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {entry.docId || 'No Document ID'} · {entry.type || 'Unclassified'} · {entry.sourcePath || 'No source path'}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {entry.linkStatus || 'needs_upload'} · {entry.visibility || 'private'} · {entry.importStatus || 'pending_review'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entry.importStatus !== 'promoted' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => startDraftEdit(entry)}
                        disabled={publishing}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <i className="fas fa-pen text-xs" />
                        <span>Edit Draft</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectQueuedFile(entry.id)}
                        disabled={publishing}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <i className="fas fa-cloud-upload-alt text-xs" />
                        <span>Select File & Publish</span>
                      </button>
                    </>
                  ) : (
                    <a
                      href={entry.publicUrl || entry.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50"
                    >
                      <i className="fas fa-arrow-up-right-from-square text-xs" />
                      <span>Open Public File</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteImport(entry.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <i className="fas fa-trash text-xs" />
                    <span>Delete Draft</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingDraftId && draftForm && (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xl font-black text-slate-900">Edit Draft</h4>
              <p className="text-sm text-slate-500">Update metadata before selecting the local file for publish.</p>
            </div>
            <button
              type="button"
              onClick={resetDraftEdit}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Title</label>
              <input
                value={draftForm.title}
                onChange={e => setDraftForm(current => ({ ...current, title: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Document ID</label>
              <input
                value={draftForm.docId}
                onChange={e => setDraftForm(current => ({ ...current, docId: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Type</label>
              <select
                value={draftForm.type}
                onChange={e => setDraftForm(current => ({ ...current, type: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                {DOCUMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Primary Sponsor</label>
              <select
                value={draftForm.authorId}
                onChange={e => setDraftForm(current => ({ ...current, authorId: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Assign later</option>
                {activeMembers.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Tags</label>
              <input
                value={draftForm.tags}
                onChange={e => setDraftForm(current => ({ ...current, tags: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Content Preview</label>
              <textarea
                rows={3}
                value={draftForm.contentPreview}
                onChange={e => setDraftForm(current => ({ ...current, contentPreview: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSaveDraftEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-700"
            >
              <i className="fas fa-save text-xs" />
              <span>Save Draft Changes</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
