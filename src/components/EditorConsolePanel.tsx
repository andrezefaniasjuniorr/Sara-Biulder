import React, { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import {
  FileCode2,
  Folder,
  FolderOpen,
  Code2,
  Terminal,
  Copy,
  Check,
  Wand2,
  Trash2,
  Play,
  Plus,
  Upload,
  ChevronRight,
  ChevronDown,
  Maximize2,
  X,
  Search,
  History,
  Scissors,
} from 'lucide-react';
import type {
  ConsoleEntry,
  FileKey,
  ProjectFiles,
  RightPanelTab,
  VersionSnapshot,
} from '../types/builder';

interface EditorConsolePanelProps {
  files: ProjectFiles;
  activeFile: FileKey;
  activeTab: RightPanelTab;
  consoleLogs: ConsoleEntry[];
  versions: VersionSnapshot[];
  errorsFixedCount: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onRestoreVersion: (versionId: string) => void;
  onSelectFile: (file: FileKey) => void;
  onSelectTab: (tab: RightPanelTab) => void;
  onChangeFileContent: (file: FileKey, content: string) => void;
  onCreateFile: (filePath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onUploadFilesToProject: (files: Array<{ path: string; content: string }>) => void;
  onRunConsoleJs: (code: string) => void;
  onClearConsole: () => void;
  onSaraFixError: (errorSummary?: string) => void;
}

interface TreeFolder {
  name: string;
  path: string;
  folders: TreeFolder[];
  files: string[];
}

function getFileVisualMeta(filePath: string): { label: string; colorClass: string } {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return { label: 'HTML', colorClass: 'text-orange-400' };
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return { label: 'CSS', colorClass: 'text-sky-400' };
  if (lower.endsWith('.tsx')) return { label: 'TSX', colorClass: 'text-cyan-400' };
  if (lower.endsWith('.ts')) return { label: 'TS', colorClass: 'text-blue-400' };
  if (lower.endsWith('.jsx')) return { label: 'JSX', colorClass: 'text-amber-300' };
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return { label: 'JS', colorClass: 'text-yellow-300' };
  if (lower.endsWith('.kts')) return { label: 'KTS', colorClass: 'text-indigo-400' };
  if (lower.endsWith('.kt')) return { label: 'KT', colorClass: 'text-violet-400' };
  if (lower.endsWith('.xml')) return { label: 'XML', colorClass: 'text-orange-300' };
  if (lower.endsWith('.py')) return { label: 'PY', colorClass: 'text-emerald-400' };
  if (lower.endsWith('.sql')) return { label: 'SQL', colorClass: 'text-purple-400' };
  if (lower.endsWith('.json')) return { label: 'JSON', colorClass: 'text-amber-400' };
  if (lower.endsWith('.svg')) return { label: 'SVG', colorClass: 'text-pink-400' };
  if (lower.endsWith('.md')) return { label: 'MD', colorClass: 'text-slate-300' };
  return { label: 'TXT', colorClass: 'text-slate-400' };
}

function getLanguageExtension(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.svg') || lower.endsWith('.xml')) {
    return html({ matchClosingTags: true, autoCloseTags: true });
  }
  if (lower.endsWith('.css') || lower.endsWith('.scss')) {
    return css();
  }
  if (lower.endsWith('.tsx')) {
    return javascript({ jsx: true, typescript: true });
  }
  if (lower.endsWith('.ts')) {
    return javascript({ typescript: true });
  }
  if (lower.endsWith('.jsx')) {
    return javascript({ jsx: true });
  }
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return javascript();
  }
  if (lower.endsWith('.json')) {
    return json();
  }
  if (lower.endsWith('.py')) {
    return python();
  }
  if (lower.endsWith('.sql')) {
    return sql();
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return markdown();
  }
  return javascript();
}

const vsCodeThemeOverrides = EditorView.theme(
  {
    '&': {
      backgroundColor: '#0D1117',
      color: '#E6EDF3',
      height: '100%',
      fontSize: '12.5px',
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    '.cm-scroller': {
      overflow: 'auto',
      lineHeight: '1.65',
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    '.cm-content': {
      padding: '10px 0',
      caretColor: '#38BDF8',
    },
    '.cm-gutters': {
      backgroundColor: '#0A0D12',
      color: '#4B5563',
      borderRight: '1px solid #1E2433',
      minWidth: '42px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#161B26',
      color: '#93C5FD',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(56, 189, 248, 0.06)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(59, 130, 246, 0.28) !important',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(56, 189, 248, 0.22)',
      outline: '1px solid rgba(56, 189, 248, 0.45)',
    },
  },
  { dark: true }
);

function buildFolderTree(paths: string[]): TreeFolder {
  const root: TreeFolder = { name: 'raiz', path: '', folders: [], files: [] };

  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  for (const fullPath of sorted) {
    const parts = fullPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      root.files.push(fullPath);
      continue;
    }

    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      const folderPath = parts.slice(0, i + 1).join('/');
      let child = current.folders.find((f) => f.name === seg);
      if (!child) {
        child = { name: seg, path: folderPath, folders: [], files: [] };
        current.folders.push(child);
      }
      current = child;
    }
    current.files.push(fullPath);
  }

  return root;
}

export const EditorConsolePanel: React.FC<EditorConsolePanelProps> = ({
  files,
  activeFile,
  activeTab,
  consoleLogs,
  versions,
  errorsFixedCount,
  isFullscreen,
  onToggleFullscreen,
  onRestoreVersion,
  onSelectFile,
  onSelectTab,
  onChangeFileContent,
  onCreateFile,
  onDeleteFile,
  onUploadFilesToProject,
  onRunConsoleJs,
  onClearConsole,
  onSaraFixError,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedLine, setCopiedLine] = useState(false);
  const [jsCommand, setJsCommand] = useState('');
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [cursorCoords, setCursorCoords] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  // Busca no Editor e Histórico de Versões
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIdx, setSearchIdx] = useState(0);
  const [showVersions, setShowVersions] = useState(false);

  const editorViewRef = useRef<EditorView | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const filePaths = useMemo(() => Object.keys(files || {}), [files]);
  const resolvedActiveFile = files[activeFile] !== undefined ? activeFile : filePaths[0] || 'index.html';
  const currentCode = files[resolvedActiveFile] ?? '';
  const activeMeta = useMemo(() => getFileVisualMeta(resolvedActiveFile), [resolvedActiveFile]);

  const editorExtensions = useMemo(
    () => [getLanguageExtension(resolvedActiveFile), vsCodeThemeOverrides],
    [resolvedActiveFile]
  );

  const totalLinesAllFiles = useMemo(
    () =>
      Object.values(files || {}).reduce(
        (acc, content) => acc + (content ? content.split('\n').length : 0),
        0
      ),
    [files]
  );

  const errorCount = useMemo(
    () => consoleLogs.filter((l) => l.level === 'error').length,
    [consoleLogs]
  );
  const tree = useMemo(() => buildFolderTree(filePaths), [filePaths]);
  const folderSignature = useMemo(() => tree.folders.map((f) => f.path).join('|'), [tree]);

  useEffect(() => {
    setCollapsedFolders({});
  }, [folderSignature]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const text = currentCode.toLowerCase();
    const indices: number[] = [];
    let pos = 0;
    while (pos < text.length) {
      const found = text.indexOf(q, pos);
      if (found === -1) break;
      indices.push(found);
      pos = found + q.length;
    }
    return indices;
  }, [currentCode, searchQuery]);

  const handleFindNext = () => {
    if (!searchMatches.length || !editorViewRef.current) return;
    const nextIdx = (searchIdx + 1) % searchMatches.length;
    setSearchIdx(nextIdx);
    const start = searchMatches[nextIdx];
    const end = start + searchQuery.length;
    const view = editorViewRef.current;
    view.focus();
    view.dispatch({
      selection: { anchor: start, head: end },
      scrollIntoView: true,
    });
  };

  const handleCopyFile = () => {
    navigator.clipboard?.writeText(currentCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleCopyCurrentLine = () => {
    const view = editorViewRef.current;
    let lineText = '';
    if (view) {
      const head = view.state.selection.main.head;
      lineText = view.state.doc.lineAt(head).text;
    } else {
      lineText = currentCode.split('\n')[0] || '';
    }
    navigator.clipboard?.writeText(lineText).catch(() => {});
    setCopiedLine(true);
    setTimeout(() => setCopiedLine(false), 1500);
  };

  const handleExecuteJs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsCommand.trim()) return;
    onRunConsoleJs(jsCommand.trim());
    setJsCommand('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFilePath.trim().replace(/^\/+/, '');
    if (!clean) return;
    onCreateFile(clean);
    setNewFilePath('');
    setCreatingFile(false);
    onSelectTab('editor');
  };

  const handleUploadProjectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const loaded: Array<{ path: string; content: string }> = [];
    for (const f of selected) {
      try {
        const content = await f.text();
        loaded.push({ path: f.name, content });
      } catch {
        // ignore binary
      }
    }
    if (loaded.length > 0) {
      onUploadFilesToProject(loaded);
    }
    e.target.value = '';
  };

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

  const renderTreeFolder = (folder: TreeFolder, depth = 0): React.ReactNode => {
    const isCollapsed = Boolean(collapsedFolders[folder.path]);

    return (
      <div key={folder.path || 'root'} className="space-y-0.5">
        {folder.path && (
          <button
            type="button"
            onClick={() => toggleFolder(folder.path)}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className="w-full py-1.5 pr-2 rounded-lg hover:bg-[#1E2433]/60 text-left flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
            )}
            {isCollapsed ? (
              <Folder className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
            )}
            <span className="font-mono font-medium truncate">{folder.name}/</span>
          </button>
        )}

        {!isCollapsed && (
          <>
            {folder.folders.map((sub) => renderTreeFolder(sub, depth + 1))}
            {folder.files.map((fullPath) => {
              const fileName = fullPath.split('/').pop() || fullPath;
              const isActive = resolvedActiveFile === fullPath;
              const bytes = new Blob([files[fullPath] || '']).size;
              const meta = getFileVisualMeta(fullPath);
              return (
                <div
                  key={fullPath}
                  style={{ paddingLeft: `${(folder.path ? depth + 1 : 0) * 12 + 10}px` }}
                  className={`group pr-2 py-1.5 rounded-lg flex items-center justify-between gap-2 transition ${
                    isActive
                      ? 'bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-white'
                      : 'hover:bg-[#0D1117] border border-transparent text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectFile(fullPath);
                      onSelectTab('editor');
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${meta.colorClass}`} />
                    <span className="text-xs font-mono truncate">{fileName}</span>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-mono font-bold ${meta.colorClass}`}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-mono text-[#A1A1AA]/70 tabular-nums">{bytes}B</span>
                    {filePaths.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteFile(fullPath)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-[#A1A1AA] hover:text-rose-400 transition cursor-pointer"
                        title={`Apagar ${fullPath}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <section
      className={`flex flex-col bg-[#11141D] overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-full'
      }`}
    >
      {/* Abas: Ficheiros | Editor | Console + Tela Cheia / Fechar */}
      <div className="px-2.5 py-2 border-b border-[#1E2433] flex items-center justify-between gap-1.5 shrink-0 bg-[#0D1017]">
        <div className="flex items-center gap-1 bg-[#090B10] p-1 rounded-lg border border-[#1E2433] flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onSelectTab('files')}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'files' ? 'bg-[#1E2433] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Ficheiros</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('editor')}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'editor' ? 'bg-[#1E2433] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Editor</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('console')}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'console' ? 'bg-[#1E2433] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Console</span>
            {errorCount > 0 && (
              <span className="text-[10px] font-mono text-rose-400 tabular-nums">({errorCount})</span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition cursor-pointer shrink-0 whitespace-nowrap ${
            isFullscreen
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-200 hover:bg-rose-500/30'
              : 'bg-[#090B10] border-[#1E2433] text-[#A1A1AA] hover:text-white'
          }`}
          title={isFullscreen ? 'Fechar Tela Cheia' : 'Tela Cheia (Ctrl+E)'}
        >
          {isFullscreen ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>Fechar</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Tela Cheia</span>
            </>
          )}
        </button>
      </div>

      {/* Conteúdo: Explorador Dinâmico de Pastas e Ficheiros */}
      {activeTab === 'files' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 sara-scroll">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#1E2433]">
            <span className="text-xs font-semibold text-[#A1A1AA]">
              Pastas &amp; Ficheiros ({filePaths.length})
            </span>
            <div className="flex items-center gap-1">
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept=".html,.css,.js,.jsx,.ts,.tsx,.json,.txt,.md,.svg,.csv,.py,.sql,.kt,.kts,.xml"
                onChange={handleUploadProjectFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="p-1.5 rounded-lg bg-[#090B10] border border-[#1E2433] text-[#A1A1AA] hover:text-white cursor-pointer"
                title="Importar ficheiro do Storage/Drive"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCreatingFile((v) => !v)}
                className="p-1.5 rounded-lg bg-[#090B10] border border-[#1E2433] text-[#A1A1AA] hover:text-[#3B82F6] cursor-pointer"
                title="Novo ficheiro ou pasta (ex: src/utils/api.js)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {!isFullscreen && (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="p-1.5 rounded-lg bg-[#090B10] border border-[#1E2433] text-[#A1A1AA] hover:text-white cursor-pointer"
                  title="Abrir Ficheiros em Tela Cheia"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {creatingFile && (
            <form onSubmit={handleCreateSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                placeholder="ex: src/components/card.js"
                className="flex-1 min-w-0 bg-[#090B10] border border-[#3B82F6] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-[#3B82F6] text-white text-xs font-semibold cursor-pointer"
              >
                Criar
              </button>
            </form>
          )}

          <div className="space-y-0.5">{renderTreeFolder(tree)}</div>
        </div>
      )}

      {/* Conteúdo: Editor VS Code Real (CodeMirror 6 One Dark Pro) */}
      {activeTab === 'editor' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0D1117]">
          <div className="px-2 py-1.5 bg-[#0A0D12] border-b border-[#1E2433] flex items-center justify-between gap-2 overflow-x-auto sara-scroll shrink-0">
            <div className="flex items-center gap-1">
              {filePaths.map((filePath) => {
                const meta = getFileVisualMeta(filePath);
                return (
                  <button
                    key={filePath}
                    type="button"
                    onClick={() => onSelectFile(filePath)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                      resolvedActiveFile === filePath
                        ? 'bg-[#0D1117] text-white border border-[#3B82F6]/45 border-t-2 border-t-[#38BDF8]'
                        : 'text-[#8B949E] hover:text-white hover:bg-[#161B26]'
                    }`}
                  >
                    <span className={`text-[9px] font-bold ${meta.colorClass}`}>{meta.label}</span>
                    <span>{filePath}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowSearch((v) => !v)}
                className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer ${
                  showSearch ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'text-[#8B949E] hover:text-white'
                }`}
                title="Buscar no código (Ctrl+F)"
              >
                <Search className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={handleCopyCurrentLine}
                className="px-2 py-1 rounded text-[11px] text-[#8B949E] hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="Copiar linha atual do cursor"
              >
                <Scissors className="w-3 h-3" />
                <span className="hidden xl:inline">{copiedLine ? 'Linha copiada!' : 'Linha'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVersions((v) => !v)}
                className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  showVersions ? 'bg-[#8B5CF6]/20 text-[#C4B5FD]' : 'text-[#8B949E] hover:text-white'
                }`}
                title="Histórico de versões"
              >
                <History className="w-3 h-3" />
                <span className="hidden xl:inline">Versões ({versions.length})</span>
              </button>

              <button
                type="button"
                onClick={handleCopyFile}
                className="px-2 py-1 rounded text-[11px] text-[#8B949E] hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
                title="Copiar este ficheiro completo"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Barra de Busca */}
          {showSearch && (
            <div className="px-3 py-1.5 bg-[#0D111A] border-b border-[#1E2433] flex items-center gap-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-[#3B82F6]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFindNext();
                  }
                }}
                placeholder="Procurar no ficheiro..."
                className="flex-1 min-w-0 bg-[#090B10] border border-[#1E2433] focus:border-[#3B82F6] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                autoFocus
              />
              <span className="text-[11px] font-mono text-[#A1A1AA] tabular-nums">
                {searchMatches.length > 0 ? `${(searchIdx % searchMatches.length) + 1}/${searchMatches.length}` : '0/0'}
              </span>
              <button
                type="button"
                onClick={handleFindNext}
                disabled={searchMatches.length === 0}
                className="px-2 py-1 rounded bg-[#1E2433] text-[11px] text-white disabled:opacity-40 cursor-pointer"
              >
                Próxima
              </button>
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                className="text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Lista de Versões Anteriores */}
          {showVersions && (
            <div className="px-3 py-2 bg-[#0D111A] border-b border-[#1E2433] max-h-40 overflow-y-auto sara-scroll space-y-1.5 shrink-0">
              <div className="flex items-center justify-between text-[11px] text-[#A1A1AA]">
                <span className="font-semibold text-white">Histórico de Versões Guardadas</span>
                <button
                  type="button"
                  onClick={() => setShowVersions(false)}
                  className="text-[#A1A1AA] hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {versions.length === 0 ? (
                <p className="text-[11px] text-[#A1A1AA]">Nenhuma versão anterior guardada ainda.</p>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#090B10] border border-[#1E2433] text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{ver.label}</div>
                      <div className="text-[#A1A1AA] font-mono text-[10px]">{ver.timestamp}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onRestoreVersion(ver.id);
                        setShowVersions(false);
                      }}
                      className="px-2 py-1 rounded bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/35 border border-[#8B5CF6]/40 text-[#C4B5FD] text-[10px] font-semibold shrink-0 cursor-pointer"
                    >
                      Voltar para esta versão
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <div
            className="flex-1 min-h-0 overflow-hidden bg-[#0D1117]"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                setShowSearch(true);
              }
            }}
          >
            <CodeMirror
              value={currentCode}
              height="100%"
              className="h-full text-xs"
              theme={oneDark}
              extensions={editorExtensions}
              onChange={(val) => onChangeFileContent(resolvedActiveFile, val)}
              onCreateEditor={(view) => {
                editorViewRef.current = view;
              }}
              onUpdate={(update) => {
                editorViewRef.current = update.view;
                if (update.selectionSet) {
                  const head = update.state.selection.main.head;
                  const lineObj = update.state.doc.lineAt(head);
                  setCursorCoords({
                    line: lineObj.number,
                    col: head - lineObj.from + 1,
                  });
                }
              }}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightSpecialChars: true,
                foldGutter: true,
                drawSelection: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                syntaxHighlighting: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                tabSize: 2,
              }}
            />
          </div>
        </div>
      )}

      {/* Conteúdo: Console Real fundo preto */}
      {activeTab === 'console' && (
        <div className="flex-1 flex flex-col bg-[#050508] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#1E2433] bg-[#0A0D12] flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSaraFixError()}
              className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:opacity-95 whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Sara, corrige isto</span>
            </button>
            <button
              type="button"
              onClick={onClearConsole}
              className="p-1.5 rounded-lg border border-[#1E2433] text-[#A1A1AA] hover:text-white cursor-pointer"
              title="Limpar console"
              aria-label="Limpar console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-xs sara-scroll">
            {consoleLogs.length === 0 ? (
              <div className="text-[#A1A1AA] text-xs py-4">
                Console pronto. Logs do preview e comandos JS aparecem aqui.
              </div>
            ) : (
              consoleLogs.map((entry) => {
                const colorClass =
                  entry.level === 'error'
                    ? 'text-red-400 border-red-500/20 bg-red-950/20'
                    : entry.level === 'warn'
                    ? 'text-amber-300 border-amber-500/20 bg-amber-950/20'
                    : entry.level === 'success'
                    ? 'text-emerald-400 border-emerald-500/20 bg-emerald-950/15'
                    : entry.level === 'command'
                    ? 'text-blue-400 border-blue-500/20 bg-blue-950/15'
                    : 'text-emerald-300/90 border-[#1E2433] bg-[#0A0D12]';

                return (
                  <div
                    key={entry.id}
                    className={`px-2.5 py-1.5 rounded border ${colorClass} break-words`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] opacity-70 mb-0.5">
                      <span className="uppercase">{entry.level}</span>
                      <span>{entry.timestamp}</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                      {entry.message}
                    </pre>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={handleExecuteJs}
            className="p-2 border-t border-[#1E2433] bg-[#0A0D12] flex items-center gap-2 shrink-0"
          >
            <span className="font-mono text-xs text-emerald-400 pl-1 select-none">&gt;</span>
            <input
              type="text"
              value={jsCommand}
              onChange={(e) => setJsCommand(e.target.value)}
              placeholder="Escreve código JS para testar (a Sara vê tudo)..."
              className="flex-1 min-w-0 bg-transparent text-xs font-mono text-white placeholder-[#A1A1AA]/50 outline-none"
            />
            <button
              type="submit"
              disabled={!jsCommand.trim()}
              className="px-2.5 py-1 rounded bg-[#1E2433] hover:bg-[#3B82F6] text-white text-xs font-mono flex items-center gap-1 transition disabled:opacity-40 cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Run</span>
            </button>
          </form>
        </div>
      )}

      {/* Barra de Status estilo VS Code */}
      <div className="px-3 py-1.5 bg-[#090C12] border-t border-[#1E2433] flex items-center justify-between gap-2 text-[10px] font-mono text-[#8B949E] shrink-0 tabular-nums">
        <div className="flex items-center gap-2">
          <span className={`font-bold ${activeMeta.colorClass}`}>{activeMeta.label}</span>
          <span>·</span>
          <span>
            Ln {cursorCoords.line}, Col {cursorCoords.col}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>{totalLinesAllFiles} linhas</span>
          <span>·</span>
          <span>{filePaths.length} ficheiro(s)</span>
          <span>·</span>
          <span className="text-emerald-400">{errorsFixedCount} corrigido(s)</span>
        </div>
      </div>
    </section>
  );
};
