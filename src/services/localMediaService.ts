import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type { JarvisTrack, LocalDeviceFile, LocalMediaKind } from '../types/jarvis';

const IDB_NAME = 'sara_local_vault_db_v1';
const IDB_VERSION = 1;
const HANDLES_STORE = 'directory_handles';
const ENTRIES_STORE = 'indexed_entries';

const memoryFileMap = new Map<string, File>();
const memoryHandleMap = new Map<string, FileSystemFileHandle>();
const activeBlobUrlCache = new Map<string, string>();

const MUSIC_EXTS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac']);
const AUDIO_EXTS = new Set(['opus', 'amr', '3gp', 'weba', 'wma']);
const VIDEO_EXTS = new Set(['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']);
const DOC_EXTS = new Set([
  'pdf',
  'txt',
  'md',
  'csv',
  'json',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
]);
const SUBTITLE_EXTS = new Set(['srt', 'vtt']);

export interface LocalLibrarySnapshot {
  hasPermission: boolean;
  needsReconnect: boolean;
  folderLabel: string;
  platform: 'pc' | 'mobile';
  files: LocalDeviceFile[];
}

export interface ParsedLocalDocumentResult {
  title: string;
  mimeType: string;
  fileExtension: string;
  fileSizeBytes: number;
  lastOpenedAt: string;
  relativePath: string;
  summary: string;
  keyPoints: string[];
  extractedData: Array<{ label: string; value: string }>;
  previewUrl?: string;
  rawText?: string;
  formattedHtml?: string;
  slides?: Array<{ title: string; bullets: string[] }>;
  sheets?: Array<{ name: string; rows: string[][] }>;
  officeAppHint?: 'Word' | 'PowerPoint' | 'Excel';
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    navigator.userAgent || ''
  );
}

export function supportsDirectoryPicker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  );
}

function normalizeSearchText(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.\s/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDocumentTypeLabel(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'pdf') return 'Documento PDF';
  if (e === 'docx' || e === 'doc') return 'Microsoft Word';
  if (e === 'pptx' || e === 'ppt') return 'Microsoft PowerPoint';
  if (e === 'xlsx' || e === 'xls') return 'Microsoft Excel';
  if (e === 'csv') return 'Tabela CSV';
  if (e === 'txt' || e === 'md') return 'Texto Simples';
  return e ? e.toUpperCase() : 'Ficheiro';
}

export function getExtension(filename: string): string {
  const parts = String(filename || '').split('.');
  return parts.length > 1 ? (parts.pop() || '').toLowerCase() : '';
}

export function classifyExtension(ext: string, folderPath = ''): LocalMediaKind | null {
  const e = ext.toLowerCase();
  if (MUSIC_EXTS.has(e)) {
    const f = folderPath.toLowerCase();
    if (/(gravac|record|voice|memo|whatsapp\s*audio)/i.test(f)) return 'audio';
    return 'music';
  }
  if (AUDIO_EXTS.has(e)) return 'audio';
  if (VIDEO_EXTS.has(e)) return 'video';
  if (IMAGE_EXTS.has(e)) return 'image';
  if (DOC_EXTS.has(e)) return 'document';
  return null;
}

function guessMimeFromExt(ext: string, fallback?: string): string {
  if (fallback && fallback !== 'application/octet-stream') return fallback;
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    opus: 'audio/opus',
    mp4: 'video/mp4',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

function makeFileId(userId: string, relativePath: string): string {
  return `loc_${userId}_${relativePath.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
}

function openVaultDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HANDLES_STORE)) {
          db.createObjectStore(HANDLES_STORE, { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
          db.createObjectStore(ENTRIES_STORE, { keyPath: 'userId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openVaultDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(storeName: string, value: unknown): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

interface StoredHandleRecord {
  userId: string;
  handle: FileSystemDirectoryHandle;
  folderLabel: string;
  updatedAt: number;
}

interface StoredEntriesRecord {
  userId: string;
  folderLabel: string;
  platform: 'pc' | 'mobile';
  items: Array<{
    meta: LocalDeviceFile;
    file?: File;
  }>;
  updatedAt: number;
}

async function scanDirectoryHandleRecursive(
  dirHandle: FileSystemDirectoryHandle,
  userId: string,
  prefix = '',
  depth = 0,
  outFiles: LocalDeviceFile[] = [],
  subtitleCandidates: Map<string, { name: string; fileHandle: FileSystemFileHandle }> = new Map()
): Promise<{ files: LocalDeviceFile[]; subtitles: Map<string, { name: string; fileHandle: FileSystemFileHandle }> }> {
  if (depth > 6 || outFiles.length >= 3500) {
    return { files: outFiles, subtitles: subtitleCandidates };
  }
  const platform: 'pc' | 'mobile' = isMobileDevice() ? 'mobile' : 'pc';
  const entriesIter = (
    dirHandle as unknown as { values: () => AsyncIterable<FileSystemHandle> }
  ).values();

  for await (const entry of entriesIter) {
    if (outFiles.length >= 3500) break;
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '$RECYCLE.BIN') {
      continue;
    }
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      await scanDirectoryHandleRecursive(
        entry as FileSystemDirectoryHandle,
        userId,
        relPath,
        depth + 1,
        outFiles,
        subtitleCandidates
      );
    } else if (entry.kind === 'file') {
      const fileHandle = entry as FileSystemFileHandle;
      const ext = getExtension(entry.name);
      if (SUBTITLE_EXTS.has(ext)) {
        const stem = relPath.replace(/\.[^.]+$/, '').toLowerCase();
        subtitleCandidates.set(stem, { name: entry.name, fileHandle });
        continue;
      }
      const kind = classifyExtension(ext, prefix);
      if (!kind) continue;

      let size = 0;
      let lastModified = Date.now();
      let mimeType = guessMimeFromExt(ext);
      try {
        const f = await fileHandle.getFile();
        size = f.size;
        lastModified = f.lastModified || Date.now();
        mimeType = guessMimeFromExt(ext, f.type);
      } catch {
        // Fallback metadata only
      }

      const id = makeFileId(userId, relPath);
      memoryHandleMap.set(id, fileHandle);
      outFiles.push({
        id,
        name: entry.name,
        relativePath: relPath,
        folderPath: prefix || dirHandle.name || 'Pasta Local',
        extension: ext,
        mimeType,
        size,
        lastModified,
        kind,
        sourcePlatform: platform,
      });
    }
  }

  if (depth === 0) {
    for (const f of outFiles) {
      if (f.kind === 'video') {
        const stem = f.relativePath.replace(/\.[^.]+$/, '').toLowerCase();
        const sub = subtitleCandidates.get(stem);
        if (sub) {
          f.subtitleName = sub.name;
          memoryHandleMap.set(`${f.id}__sub`, sub.fileHandle);
        }
      }
    }
  }

  return { files: outFiles, subtitles: subtitleCandidates };
}

export async function restoreLocalLibrary(
  userId: string,
  isGuest: boolean
): Promise<LocalLibrarySnapshot> {
  const platform: 'pc' | 'mobile' = isMobileDevice() ? 'mobile' : 'pc';
  if (isGuest) {
    return {
      hasPermission: false,
      needsReconnect: false,
      folderLabel: '',
      platform,
      files: [],
    };
  }

  // 1. Check persisted DirectoryHandle first (PC Chromium)
  const handleRec = await idbGet<StoredHandleRecord>(HANDLES_STORE, userId);
  if (handleRec?.handle) {
    try {
      const h = handleRec.handle as FileSystemDirectoryHandle & {
        queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
      };
      const perm = h.queryPermission ? await h.queryPermission({ mode: 'read' }) : 'granted';
      if (perm === 'granted') {
        const { files } = await scanDirectoryHandleRecursive(handleRec.handle, userId);
        return {
          hasPermission: true,
          needsReconnect: false,
          folderLabel: handleRec.folderLabel || handleRec.handle.name || 'Armazenamento Local',
          platform,
          files,
        };
      }
      // Handle exists from a previous session, just needs 1-click browser gesture
      const cachedEntries = await idbGet<StoredEntriesRecord>(ENTRIES_STORE, userId);
      return {
        hasPermission: false,
        needsReconnect: true,
        folderLabel: handleRec.folderLabel || handleRec.handle.name || 'Pasta Local',
        platform,
        files: (cachedEntries?.items || []).map((x) => x.meta),
      };
    } catch {
      // fall through to IDB stored file blobs
    }
  }

  // 2. Fallback: IndexedDB File entries (mobile / Safari / webkitdirectory)
  const entriesRec = await idbGet<StoredEntriesRecord>(ENTRIES_STORE, userId);
  if (entriesRec?.items && entriesRec.items.length > 0) {
    const metas: LocalDeviceFile[] = [];
    for (const item of entriesRec.items) {
      if (item.file) {
        memoryFileMap.set(item.meta.id, item.file);
      }
      metas.push(item.meta);
    }
    return {
      hasPermission: true,
      needsReconnect: false,
      folderLabel: entriesRec.folderLabel || (platform === 'mobile' ? 'Pastas do Telemóvel' : 'Pasta Local'),
      platform: entriesRec.platform || platform,
      files: metas,
    };
  }

  return {
    hasPermission: false,
    needsReconnect: false,
    folderLabel: '',
    platform,
    files: [],
  };
}

export async function reconnectStoredDirectoryHandle(
  userId: string
): Promise<LocalLibrarySnapshot | null> {
  const handleRec = await idbGet<StoredHandleRecord>(HANDLES_STORE, userId);
  if (!handleRec?.handle) return null;
  try {
    const h = handleRec.handle as FileSystemDirectoryHandle & {
      requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
    };
    const perm = h.requestPermission ? await h.requestPermission({ mode: 'read' }) : 'granted';
    if (perm !== 'granted') return null;
    const { files } = await scanDirectoryHandleRecursive(handleRec.handle, userId);
    return {
      hasPermission: true,
      needsReconnect: false,
      folderLabel: handleRec.folderLabel || handleRec.handle.name || 'Pasta Local',
      platform: isMobileDevice() ? 'mobile' : 'pc',
      files,
    };
  } catch {
    return null;
  }
}

export async function requestDirectoryPermissionAndIndex(
  userId: string,
  isGuest: boolean
): Promise<LocalLibrarySnapshot | null> {
  if (!supportsDirectoryPicker()) return null;
  try {
    const picker = (
      window as unknown as {
        showDirectoryPicker: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    const dirHandle = await picker({ mode: 'read' });
    const { files } = await scanDirectoryHandleRecursive(dirHandle, userId);
    const folderLabel = dirHandle.name || 'Pasta Local';
    const platform: 'pc' | 'mobile' = isMobileDevice() ? 'mobile' : 'pc';

    if (!isGuest) {
      await idbPut(HANDLES_STORE, {
        userId,
        handle: dirHandle,
        folderLabel,
        updatedAt: Date.now(),
      } satisfies StoredHandleRecord);
      await idbPut(ENTRIES_STORE, {
        userId,
        folderLabel,
        platform,
        items: files.slice(0, 1500).map((meta) => ({ meta })),
        updatedAt: Date.now(),
      } satisfies StoredEntriesRecord);
    }

    return {
      hasPermission: true,
      needsReconnect: false,
      folderLabel,
      platform,
      files,
    };
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return null;
    return null;
  }
}

export async function indexSelectedFileList(
  fileList: FileList | File[],
  userId: string,
  isGuest: boolean,
  folderHint?: string
): Promise<LocalLibrarySnapshot> {
  const arr = Array.from(fileList || []);
  const platform: 'pc' | 'mobile' = isMobileDevice() ? 'mobile' : 'pc';
  const files: LocalDeviceFile[] = [];
  const subtitleFiles = new Map<string, File>();
  const storedItems: Array<{ meta: LocalDeviceFile; file?: File }> = [];

  for (const file of arr) {
    const rawRel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      `${folderHint || (platform === 'mobile' ? 'Telemóvel' : 'Local')}/${file.name}`;
    const ext = getExtension(file.name);
    if (SUBTITLE_EXTS.has(ext)) {
      subtitleFiles.set(rawRel.replace(/\.[^.]+$/, '').toLowerCase(), file);
      continue;
    }
    const parts = rawRel.split('/');
    const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : folderHint || 'Local';
    const kind = classifyExtension(ext, folderPath);
    if (!kind) continue;

    const id = makeFileId(userId, rawRel);
    const meta: LocalDeviceFile = {
      id,
      name: file.name,
      relativePath: rawRel,
      folderPath,
      extension: ext,
      mimeType: guessMimeFromExt(ext, file.type),
      size: file.size,
      lastModified: file.lastModified || Date.now(),
      kind,
      sourcePlatform: platform,
    };
    memoryFileMap.set(id, file);
    files.push(meta);
    // Guardar blobs até ~45MB cada no IndexedDB para funcionar offline entre sessões
    storedItems.push({
      meta,
      file: !isGuest && file.size <= 45 * 1024 * 1024 ? file : undefined,
    });
  }

  for (const f of files) {
    if (f.kind === 'video') {
      const stem = f.relativePath.replace(/\.[^.]+$/, '').toLowerCase();
      const sub = subtitleFiles.get(stem);
      if (sub) {
        f.subtitleName = sub.name;
        memoryFileMap.set(`${f.id}__sub`, sub);
      }
    }
  }

  const rootLabel =
    folderHint ||
    files[0]?.folderPath.split('/')[0] ||
    (platform === 'mobile' ? 'Pastas do Telemóvel' : 'Pasta Local');

  if (!isGuest && files.length > 0) {
    // Mescla com ficheiros anteriores do utilizador (útil no celular ao escolher Música, Vídeos, Docs separados)
    const prev = await idbGet<StoredEntriesRecord>(ENTRIES_STORE, userId);
    const mergedMap = new Map<string, { meta: LocalDeviceFile; file?: File }>();
    for (const oldItem of prev?.items || []) {
      mergedMap.set(oldItem.meta.id, oldItem);
    }
    for (const newItem of storedItems) {
      mergedMap.set(newItem.meta.id, newItem);
    }
    const mergedList = Array.from(mergedMap.values()).slice(0, 1500);
    await idbPut(ENTRIES_STORE, {
      userId,
      folderLabel: rootLabel,
      platform,
      items: mergedList,
      updatedAt: Date.now(),
    } satisfies StoredEntriesRecord);

    return {
      hasPermission: true,
      needsReconnect: false,
      folderLabel: rootLabel,
      platform,
      files: mergedList.map((x) => x.meta),
    };
  }

  return {
    hasPermission: files.length > 0,
    needsReconnect: false,
    folderLabel: rootLabel,
    platform,
    files,
  };
}

export async function revokeLocalStorageAccess(userId: string): Promise<void> {
  await idbDelete(HANDLES_STORE, userId);
  await idbDelete(ENTRIES_STORE, userId);
  for (const [key, url] of activeBlobUrlCache.entries()) {
    if (key.startsWith(`loc_${userId}_`)) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      activeBlobUrlCache.delete(key);
    }
  }
}

export async function getLocalFileObject(userId: string, fileId: string): Promise<File | null> {
  const cached = memoryFileMap.get(fileId);
  if (cached) return cached;

  const handle = memoryHandleMap.get(fileId);
  if (handle) {
    try {
      const f = await handle.getFile();
      memoryFileMap.set(fileId, f);
      return f;
    } catch {
      // ignore
    }
  }

  const entries = await idbGet<StoredEntriesRecord>(ENTRIES_STORE, userId);
  const found = entries?.items?.find((x) => x.meta.id === fileId);
  if (found?.file) {
    memoryFileMap.set(fileId, found.file);
    return found.file;
  }
  return null;
}

export async function createLocalBlobUrl(userId: string, fileId: string): Promise<string | null> {
  const existing = activeBlobUrlCache.get(fileId);
  if (existing) return existing;
  const file = await getLocalFileObject(userId, fileId);
  if (!file) return null;
  const url = URL.createObjectURL(file);
  activeBlobUrlCache.set(fileId, url);
  return url;
}

function convertSrtToVtt(srtText: string): string {
  const vttBody = String(srtText || '')
    .replace(/\r+/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${vttBody}`;
}

export async function getLocalSubtitleUrl(userId: string, videoFileId: string): Promise<string | undefined> {
  const subKey = `${videoFileId}__sub`;
  const existing = activeBlobUrlCache.get(subKey);
  if (existing) return existing;

  const subFile = await getLocalFileObject(userId, subKey);
  if (!subFile) return undefined;
  try {
    const raw = await subFile.text();
    const ext = getExtension(subFile.name);
    const vttText = ext === 'srt' ? convertSrtToVtt(raw) : raw;
    const blob = new Blob([vttText], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    activeBlobUrlCache.set(subKey, url);
    return url;
  } catch {
    return undefined;
  }
}

export async function buildLocalTrackFromFile(
  userId: string,
  file: LocalDeviceFile
): Promise<JarvisTrack | null> {
  const url = await createLocalBlobUrl(userId, file.id);
  if (!url) return null;
  const subtitleUrl = file.kind === 'video' ? await getLocalSubtitleUrl(userId, file.id) : undefined;
  const cleanTitle = file.name.replace(/\.[^.]+$/, '');
  return {
    id: file.id,
    title: cleanTitle,
    artist: file.folderPath || 'Armazenamento Local',
    source: 'local',
    localFileId: file.id,
    localUrl: url,
    subtitleUrl,
    extension: file.extension,
    sizeBytes: file.size,
    folderPath: file.folderPath,
    kind: file.kind === 'video' ? 'video' : file.kind === 'audio' ? 'audio' : 'music',
  };
}

export function triggerDeviceOfficeAppAttempt(file: LocalDeviceFile, blobUrl?: string): void {
  const ext = file.extension.toLowerCase();
  // Tenta abrir em aplicativo associado do dispositivo ou dispara abertura direta
  if (blobUrl) {
    try {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      a.rel = 'noopener noreferrer';
      a.click();
    } catch {
      // silent fallback
    }
  }
  void ext;
}

export async function parseLocalDocumentForReader(
  userId: string,
  docMeta: LocalDeviceFile
): Promise<ParsedLocalDocumentResult | null> {
  const file = await getLocalFileObject(userId, docMeta.id);
  if (!file) return null;

  const ext = docMeta.extension.toLowerCase();
  const nowIso = new Date().toISOString();
  const baseData: Array<{ label: string; value: string }> = [
    { label: 'Tipo', value: formatDocumentTypeLabel(ext) },
    { label: 'Nome', value: docMeta.name },
    { label: 'Tamanho', value: formatFileSize(docMeta.size) },
    { label: 'Pasta', value: docMeta.folderPath || 'Local' },
  ];

  // 1. PDF
  if (ext === 'pdf') {
    const url = await createLocalBlobUrl(userId, docMeta.id);
    return {
      title: docMeta.name,
      mimeType: 'application/pdf',
      fileExtension: ext,
      fileSizeBytes: docMeta.size,
      lastOpenedAt: nowIso,
      relativePath: docMeta.relativePath,
      summary: `Documento PDF aberto diretamente do dispositivo (${formatFileSize(docMeta.size)}).`,
      keyPoints: ['Leitura rápida offline no leitor integrado SARA.', 'Podes pedir para ler em voz alta ou expandir o ecrã.'],
      extractedData: baseData,
      previewUrl: url || undefined,
    };
  }

  // 2. TXT / MD / CSV / JSON
  if (ext === 'txt' || ext === 'md' || ext === 'json') {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return {
      title: docMeta.name,
      mimeType: docMeta.mimeType,
      fileExtension: ext,
      fileSizeBytes: docMeta.size,
      lastOpenedAt: nowIso,
      relativePath: docMeta.relativePath,
      summary: lines.slice(0, 3).join(' ').slice(0, 260) || 'Ficheiro de texto aberto.',
      keyPoints: [`${lines.length} linhas de texto`, `Codificação local UTF-8`],
      extractedData: [...baseData, { label: 'Linhas', value: String(lines.length) }],
      rawText: text.slice(0, 120000),
    };
  }

  // 3. Word (.docx / .doc)
  if (ext === 'docx' || ext === 'doc') {
    const url = await createLocalBlobUrl(userId, docMeta.id);
    if (ext === 'docx') {
      try {
        const buffer = await file.arrayBuffer();
        const [htmlRes, rawRes] = await Promise.all([
          mammoth.convertToHtml({ arrayBuffer: buffer }),
          mammoth.extractRawText({ arrayBuffer: buffer }),
        ]);
        const plain = (rawRes.value || '').trim();
        const previewLines = plain
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        return {
          title: docMeta.name,
          mimeType: docMeta.mimeType,
          fileExtension: ext,
          fileSizeBytes: docMeta.size,
          lastOpenedAt: nowIso,
          relativePath: docMeta.relativePath,
          summary: previewLines.slice(0, 3).join(' ').slice(0, 280) || 'Documento Word carregado no leitor SARA.',
          keyPoints: previewLines.slice(0, 5),
          extractedData: [...baseData, { label: 'Palavras aprox.', value: String(plain.split(/\s+/).filter(Boolean).length) }],
          previewUrl: url || undefined,
          rawText: plain.slice(0, 100000),
          formattedHtml: htmlRes.value || undefined,
          officeAppHint: 'Word',
        };
      } catch {
        // Fallback below
      }
    }
    // Legacy .doc fallback: extract readable ASCII/Latin strings
    const buffer = await file.arrayBuffer();
    const decoded = new TextDecoder('latin1').decode(new Uint8Array(buffer));
    const readable = decoded
      .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 25000);
    return {
      title: docMeta.name,
      mimeType: docMeta.mimeType,
      fileExtension: ext,
      fileSizeBytes: docMeta.size,
      lastOpenedAt: nowIso,
      relativePath: docMeta.relativePath,
      summary: 'Documento Microsoft Word pronto. Usa "Abrir no Word" se quiseres editar ou consulta o conteúdo abaixo.',
      keyPoints: ['Formato Word (.doc)', 'Disponível no leitor local SARA e para abertura no Microsoft Word'],
      extractedData: baseData,
      previewUrl: url || undefined,
      rawText: readable || 'Conteúdo binário .doc disponível para abertura no Microsoft Word.',
      officeAppHint: 'Word',
    };
  }

  // 4. Excel / CSV (.xlsx / .xls / .csv)
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const url = await createLocalBlobUrl(userId, docMeta.id);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheets: Array<{ name: string; rows: string[][] }> = [];
      let totalRows = 0;

      for (const sheetName of workbook.SheetNames.slice(0, 8)) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        const cleanRows = aoa
          .slice(0, 200)
          .map((row) =>
            (Array.isArray(row) ? row : []).slice(0, 20).map((cell) => String(cell ?? '').trim())
          )
          .filter((row) => row.some((c) => c.length > 0));
        totalRows += cleanRows.length;
        sheets.push({ name: sheetName, rows: cleanRows });
      }

      return {
        title: docMeta.name,
        mimeType: docMeta.mimeType,
        fileExtension: ext,
        fileSizeBytes: docMeta.size,
        lastOpenedAt: nowIso,
        relativePath: docMeta.relativePath,
        summary: `Folha de cálculo com ${sheets.length} separador(es) e ${totalRows} linhas visíveis.`,
        keyPoints: sheets.map((s) => `Folha "${s.name}": ${s.rows.length} linhas`),
        extractedData: [
          ...baseData,
          { label: 'Folhas', value: String(sheets.length) },
          { label: 'Registos', value: String(totalRows) },
        ],
        previewUrl: url || undefined,
        sheets,
        officeAppHint: 'Excel',
      };
    } catch {
      return {
        title: docMeta.name,
        mimeType: docMeta.mimeType,
        fileExtension: ext,
        fileSizeBytes: docMeta.size,
        lastOpenedAt: nowIso,
        relativePath: docMeta.relativePath,
        summary: 'Tabela carregada do dispositivo.',
        keyPoints: ['Disponível para abertura no Microsoft Excel.'],
        extractedData: baseData,
        previewUrl: url || undefined,
        officeAppHint: 'Excel',
      };
    }
  }

  // 5. PowerPoint (.pptx / .ppt)
  if (ext === 'pptx' || ext === 'ppt') {
    const url = await createLocalBlobUrl(userId, docMeta.id);
    if (ext === 'pptx') {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const slidePaths = Object.keys(zip.files)
          .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
          .sort((a, b) => {
            const na = Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0);
            const nb = Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0);
            return na - nb;
          });

        const slides: Array<{ title: string; bullets: string[] }> = [];
        for (let i = 0; i < slidePaths.length; i++) {
          const xml = await zip.files[slidePaths[i]].async('string');
          const matches = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)).map((m) =>
            m[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .trim()
          );
          const nonEmpty = matches.filter(Boolean);
          slides.push({
            title: nonEmpty[0] || `Diapositivo ${i + 1}`,
            bullets: nonEmpty.slice(1, 14),
          });
        }

        return {
          title: docMeta.name,
          mimeType: docMeta.mimeType,
          fileExtension: ext,
          fileSizeBytes: docMeta.size,
          lastOpenedAt: nowIso,
          relativePath: docMeta.relativePath,
          summary: `Apresentação PowerPoint com ${slides.length} diapositivo(s).`,
          keyPoints: slides.slice(0, 6).map((s, idx) => `Slide ${idx + 1}: ${s.title}`),
          extractedData: [...baseData, { label: 'Diapositivos', value: String(slides.length) }],
          previewUrl: url || undefined,
          slides,
          rawText: slides.map((s, i) => `Slide ${i + 1}: ${s.title}\n${s.bullets.join('\n')}`).join('\n\n'),
          officeAppHint: 'PowerPoint',
        };
      } catch {
        // Fallback below
      }
    }

    return {
      title: docMeta.name,
      mimeType: docMeta.mimeType,
      fileExtension: ext,
      fileSizeBytes: docMeta.size,
      lastOpenedAt: nowIso,
      relativePath: docMeta.relativePath,
      summary: 'Apresentação PowerPoint carregada do dispositivo.',
      keyPoints: ['Clica em "Abrir no PowerPoint" para edição nativa ou navega no leitor.'],
      extractedData: baseData,
      previewUrl: url || undefined,
      officeAppHint: 'PowerPoint',
    };
  }

  return null;
}

export function searchLocalFiles(
  files: LocalDeviceFile[],
  options: {
    kind?: LocalMediaKind | 'any';
    docCategory?: 'pdf' | 'word' | 'ppt' | 'excel' | 'recent' | 'any';
    query?: string;
    folderOrDate?: string;
    favoritesSet?: Set<string>;
    onlyFavorites?: boolean;
    onlyRecents?: boolean;
  }
): LocalDeviceFile[] {
  let pool = [...files];

  if (options.onlyFavorites && options.favoritesSet) {
    pool = pool.filter((f) => options.favoritesSet!.has(f.id) || options.favoritesSet!.has(f.relativePath));
  }

  if (options.onlyRecents || options.docCategory === 'recent') {
    pool = pool
      .filter((f) => Boolean(f.lastOpenedAt) || f.lastModified > 0)
      .sort((a, b) => {
        const ta = a.lastOpenedAt ? Date.parse(a.lastOpenedAt) : a.lastModified;
        const tb = b.lastOpenedAt ? Date.parse(b.lastOpenedAt) : b.lastModified;
        return tb - ta;
      });
  }

  if (options.kind && options.kind !== 'any') {
    if (options.kind === 'music') {
      pool = pool.filter((f) => f.kind === 'music' || f.kind === 'audio');
    } else {
      pool = pool.filter((f) => f.kind === options.kind);
    }
  }

  if (options.docCategory && options.docCategory !== 'any' && options.docCategory !== 'recent') {
    if (options.docCategory === 'pdf') {
      pool = pool.filter((f) => f.extension === 'pdf');
    } else if (options.docCategory === 'word') {
      pool = pool.filter((f) => f.extension === 'doc' || f.extension === 'docx');
    } else if (options.docCategory === 'ppt') {
      pool = pool.filter((f) => f.extension === 'ppt' || f.extension === 'pptx');
    } else if (options.docCategory === 'excel') {
      pool = pool.filter((f) => f.extension === 'xls' || f.extension === 'xlsx' || f.extension === 'csv');
    }
  }

  if (options.folderOrDate) {
    const fd = normalizeSearchText(options.folderOrDate);
    if (fd) {
      pool = pool.filter((f) => {
        const d = new Date(f.lastModified);
        const dateStr = `${d.getFullYear()} ${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}`;
        const haystack = normalizeSearchText(`${f.folderPath} ${f.name} ${dateStr}`);
        return fd.split(' ').every((tok) => haystack.includes(tok));
      });
    }
  }

  if (options.query) {
    const qNorm = normalizeSearchText(options.query);
    if (qNorm) {
      // Sinónimos inteligentes de documentos comuns
      const expandedQueries = [qNorm];
      if (qNorm.includes('relatorio')) expandedQueries.push('report', 'relat', 'balanco');
      if (qNorm.includes('trabalho')) expandedQueries.push('projeto', 'tcc', 'trab', 'tarefa');
      if (qNorm.includes('apresentacao')) expandedQueries.push('slides', 'apresent', 'ppt');
      if (qNorm.includes('tabela')) expandedQueries.push('planilha', 'mapa', 'orcamento', 'xls');

      const scored = pool
        .map((f) => {
          const hay = normalizeSearchText(`${f.name} ${f.folderPath} ${f.extension}`);
          let score = 0;
          for (const candidate of expandedQueries) {
            if (hay.includes(candidate)) score += 10;
            const tokens = candidate.split(' ').filter((t) => t.length >= 2);
            const matchedTokens = tokens.filter((t) => hay.includes(t));
            score += matchedTokens.length * 3;
          }
          return { file: f, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || b.file.lastModified - a.file.lastModified);

      if (scored.length > 0) {
        return scored.map((s) => s.file);
      }
      // Se pesquisou algo específico sem correspondência exata, retorna lista vazia (para fallback inteligente)
      return [];
    }
  }

  return pool;
}
