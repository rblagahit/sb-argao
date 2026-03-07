// ─── String / HTML utilities ──────────────────────────────────────────────────

export const escapeHtml = (str = '') =>
  str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const parseTags = (raw = '') =>
  raw.split(',').map(s => s.trim()).filter(Boolean);

// ─── Name / text normalization ────────────────────────────────────────────────

export const normalizeText = (val = '') => String(val ?? '').toLowerCase().trim();

// Strips "Hon." prefix for matching (e.g. "Hon. Santos" → "santos")
export const normalizeName = (name = '') =>
  normalizeText(String(name ?? '').replace(/^hon\.?\s+/i, ''));

export const normalizeTag = (tag = '') => normalizeText(tag);

export const sanitizeLguId = (value = '') =>
  normalizeText(value).replace(/[^a-z0-9-]/g, '');

const LOCAL_FILE_TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'html', 'htm', 'rtf'];
export const LOCAL_IMPORT_ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'rtf'];

const toStartCase = (value = '') =>
  String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

export const getFileExtension = (filename = '') => {
  const parts = filename.split('.');
  return parts.length > 1 ? normalizeText(parts.at(-1)) : '';
};

export const slugifyFilePart = (value = '') =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/[\s_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export const isSupportedLocalImportFile = (file) =>
  LOCAL_IMPORT_ALLOWED_EXTENSIONS.includes(getFileExtension(file?.name || ''));

export const inferDocumentTypeFromFilename = (filename = '') => {
  const lower = normalizeText(filename);
  if (/(committee[\s_-]*report|comrep)/i.test(lower)) return 'Committee Report';
  if (/(proclamation|proc)/i.test(lower)) return 'Proclamation';
  if (/(resolution|res)/i.test(lower)) return 'Resolution';
  if (/(motion|mot)/i.test(lower)) return 'Motion';
  return 'Ordinance';
};

export const inferDocumentIdFromFilename = (filename = '', type = inferDocumentTypeFromFilename(filename)) => {
  const base = filename.replace(/\.[^.]+$/, '');
  const upperType = {
    Ordinance: 'ORD',
    Resolution: 'RES',
    Motion: 'MOT',
    Proclamation: 'PROC',
    'Committee Report': 'CR',
  }[type] || 'DOC';
  const fullMatch = base.match(/\b(?:ordinance|ord|resolution|res|motion|mot|proclamation|proc|committee[\s_-]*report|comrep)?[\s_-]*(\d{4})[\s_-]+(\d{1,4})\b/i);
  if (fullMatch) {
    return `${upperType}-${fullMatch[1]}-${fullMatch[2].padStart(3, '0')}`;
  }

  const shortMatch = base.match(/\b(?:ord|res|mot|proc|cr)[\s_-]*(\d{1,4})\b/i);
  if (shortMatch) {
    return `${upperType}-${shortMatch[1].padStart(3, '0')}`;
  }

  return '';
};

export const inferTagsFromRelativePath = (relativePath = '') =>
  relativePath
    .split('/')
    .slice(0, -1)
    .map(part => part.replace(/[_-]+/g, ' ').trim())
    .filter(Boolean)
    .map(part => toStartCase(part));

export const inferTitleFromFilename = (filename = '', type = inferDocumentTypeFromFilename(filename), docId = inferDocumentIdFromFilename(filename, type)) => {
  const base = filename.replace(/\.[^.]+$/, '');
  const cleaned = base
    .replace(new RegExp(docId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ')
    .replace(/\b(ordinance|ord|resolution|res|motion|mot|proclamation|proc|committee[\s_-]*report|comrep)\b/ig, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return toStartCase(cleaned || base.replace(/[_-]+/g, ' ').trim());
};

export const readLocalFilePreview = async (file, enabled = false) => {
  if (!enabled || !file || file.size > 2_000_000) return '';

  const extension = getFileExtension(file.name);
  try {
    if (LOCAL_FILE_TEXT_EXTENSIONS.includes(extension)) {
      const text = await file.text();
      return text.replace(/\s+/g, ' ').trim().slice(0, 320);
    }

    if (extension === 'pdf') {
      const buffer = await file.slice(0, 64 * 1024).arrayBuffer();
      const text = new TextDecoder('latin1')
        .decode(buffer)
        .replace(/[^\x20-\x7E\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.slice(0, 320);
    }
  } catch (err) {
    console.error('[readLocalFilePreview]', err);
  }

  return '';
};

export const parseLocalLegislationFile = async (file, options = {}) => {
  const type = inferDocumentTypeFromFilename(file?.name || '');
  const docId = inferDocumentIdFromFilename(file?.name || '', type);
  const contentPreview = await readLocalFilePreview(file, options.readPreview);
  const relativePath = file?.webkitRelativePath || file?.name || '';

  return {
    title: inferTitleFromFilename(file?.name || '', type, docId),
    docId,
    type,
    tags: inferTagsFromRelativePath(relativePath),
    contentPreview,
    sourcePath: relativePath,
    sourceFileName: file?.name || '',
    sourceMimeType: file?.type || '',
    sourceExtension: getFileExtension(file?.name || ''),
    sourceSize: file?.size || 0,
  };
};

// ─── Date utilities ───────────────────────────────────────────────────────────

export const formatDate = (dateStr = '') => {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  return Number.isNaN(dt.getTime())
    ? ''
    : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const isTermExpired = (member = {}) => {
  if (!member.termEnd) return false;
  const end = new Date(member.termEnd);
  if (Number.isNaN(end.getTime())) return false;
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
};

// ─── Member–document relationship ────────────────────────────────────────────

/**
 * Returns all documents related to a member by:
 *   1. Primary authorship (authorId or name match)
 *   2. Co-sponsorship (name match)
 *   3. Committee assignment (tag match)
 */
export const getMemberRelatedDocuments = (member, allDocs) => {
  const memberNameNorm = normalizeName(member.name || '');
  const committeeTags  = (member.committees || []).map(normalizeTag).filter(Boolean);

  return allDocs.filter(docData => {
    const authorNameNorm  = normalizeName(docData.authorName || '');
    const coSponsorsNorm  = (docData.coSponsors || []).map(normalizeName);
    const docTags         = (docData.tags || []).map(normalizeTag);

    const isAuthor     = docData.authorId === member.id || (!!memberNameNorm && authorNameNorm === memberNameNorm);
    const isCoSponsor  = !!memberNameNorm && coSponsorsNorm.includes(memberNameNorm);
    const isCommittee  = committeeTags.length > 0 && committeeTags.some(c => docTags.includes(c));

    return isAuthor || isCoSponsor || isCommittee;
  });
};
