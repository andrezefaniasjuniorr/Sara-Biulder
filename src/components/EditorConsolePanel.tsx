import React, { useMemo, useRef, useState } from 'react';
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightCode(code: string, file: FileKey): string {
  const escaped = escapeHtml(code);
  if (!escaped) return '\n';

  const lower = file.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.svg')) {
    return escaped
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-slate-500 italic">$1</span>')
      .replace(/(&quot;[^&]*?&quot;|'[^']*?')/g, '<span class="text-amber-300">$1</span>')
      .replace(/(&lt;\/?)([a-zA-Z0-9-]+)/g, '$1<span class="text-blue-400 font-semibold">$2</span>')
      .replace(/\s([a-zA-Z-:]+)=/g, ' <span class="text-purple-300">$1</span>=');
  }

  if (lower.endsWith('.css')) {
    return escaped
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-slate-500 italic">$1</span>')
      .replace(/([a-zA-Z-]+)(\s*:)/g, '<span class="text-sky-300">$1</span>$2')
      .replace(/(#[0-9a-fA-F]{3,8}\b)/g, '<span class="text-amber-300">$1</span>')
      .replace(/(\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b)/g, '<span class="text-emerald-300">$1</span>');
  }

  if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.jsx') || lower.endsWith('.tsx')) {
    return escaped
      .replace(/(\/\/[^\n]*)/g, '<span class="text-slate-500 italic">$1</span>')
      .replace(/(&quot;[^&]*?&quot;|'[^']*?'|`[^`]*?`)/g, '<span class="text-amber-300">$1</span>')
      .replace(
        /\b(const|let|var|function|return|if|else|for|while|async|await|import|from|export|try|catch|new|class|true|false|null|undefined)\b/g,
        '<span class="text-purple-400 font-semibold">$1</span>'
      )
      .replace(/\b(document|window|console|Math|JSON|localStorage|fetch)\b/g, '<span class="text-sky-300">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="text-emerald-300">$1</span>');
  }

  if (lower.endsWith('.json')) {
    return escaped
      .replace(/(&quot;[^&]+&quot;)(\s*:)/g, '<span class="text-sky-300">$1</span>$2')
      .replace(/:\s*(&quot;[^&]*?&quot;)/g, ': <span class="text-amber-300">$1</span>');
  }

  return escaped
    .replace(/^(#{1,4}\s.*)$/gm, '<span class="text-blue-400 font-bold">$1</span>')
    .replace(/(\*\*[^*]+\*\*)/g, '<span class="text-purple-300 font-semibold">$1</span>');
}

interface TreeFolder {
  name: string;
  path: string;
  folders: TreeFolder[];
  files: string[];
}

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

  // Busca no Editor e Histórico de Versões
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIdx, setSearchIdx] = useState(0);
  const [showVersions, setShowVersions] = useState(false);

  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const filePaths = useMemo(() => Object.keys(files || {}), [files]);
  const resolvedActiveFile = files[activeFile] !== undefined ? activeFile : filePaths[0] || 'index.html';
  const currentCode = files[resolvedActiveFile] ?? '';
  const lineCount = useMemo(() => Math.max(1, currentCode.split('\n').length), [currentCode]);

  const totalLinesAllFiles = useMemo(
    () =>
      Object.values(files || {}).reduce(
        (acc, content) => acc + (content ? content.split('\n').length : 0),
        0
      ),
    [files]
  );

  const highlightedHtml = useMemo(
    () => highlightCode(currentCode, resolvedActiveFile),
    [currentCode, resolvedActiveFile]
  );
  const errorCount = useMemo(
    () => consoleLogs.filter((l) => l.level === 'error').length,
    [consoleLogs]
  );
  const tree = useMemo(() => buildFolderTree(filePaths), [filePaths]);

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
    if (!searchMatches.length || !textareaRef.current) return;
    const nextIdx = (searchIdx + 1) % searchMatches.length;
    setSearchIdx(nextIdx);
    const start = searchMatches[nextIdx];
    const end = start + searchQuery.length;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(start, end);
  };

  const handleCopyFile = () => {
    navigator.clipboard?.writeText(currentCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleCopyCurrentLine = () => {
    const el = textareaRef.current;
    const cursorPos = el?.selectionStart ?? 0;
    const before = currentCode.slice(0, cursorPos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const afterIdx = currentCode.indexOf('\n', cursorPos);
    const lineEnd = afterIdx === -1 ? currentCode.length : afterIdx;
    const lineText = currentCode.slice(lineStart, lineEnd);
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

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = target.scrollTop;
      preRef.current.scrollLeft = target.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = target.scrollTop;
    }
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
            className="w-full py-1.5 pr-2 rounded-lg hover:bg-[#1F1F2E]/50 text-left flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer"
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
              return (
                <div
                  key={fullPath}
                  style={{ paddingLeft: `${(folder.path ? depth + 1 : 0) * 12 + 10}px` }}
                  className={`group pr-2 py-1.5 rounded-lg flex items-center justify-between gap-2 transition ${
                    isActive
                      ? 'bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-white'
                      : 'hover:bg-[#0A0A0F] border border-transparent text-[#A1A1AA] hover:text-white'
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
                    <FileCode2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-xs font-mono truncate">{fileName}</span>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-[#A1A1AA]/70">{bytes}B</span>
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
      className={`flex flex-col bg-[#12121A] overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-full'
      }`}
    >
      {/* Abas: Ficheiros | Editor | Console + Tela Cheia / Fechar */}
      <div className="px-2.5 py-2 border-b border-[#1F1F2E] flex items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-1 bg-[#0A0A0F] p-1 rounded-lg border border-[#1F1F2E] flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onSelectTab('files')}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'files' ? 'bg-[#1F1F2E] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Ficheiros</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('editor')}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'editor' ? 'bg-[#1F1F2E] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Editor</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('console')}
            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'console' ? 'bg-[#1F1F2E] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Console</span>
            {errorCount > 0 && (
              <span className="text-[10px] font-mono text-rose-400">({errorCount})</span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition cursor-pointer shrink-0 whitespace-nowrap ${
            isFullscreen
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-200 hover:bg-rose-500/30'
              : 'bg-[#0A0A0F] border-[#1F1F2E] text-[#A1A1AA] hover:text-white'
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
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#1F1F2E]">
            <span className="text-xs font-semibold text-[#A1A1AA]">
              Pastas & Ficheiros ({filePaths.length})
            </span>
            <div className="flex items-center gap-1">
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept=".html,.css,.js,.jsx,.ts,.tsx,.json,.txt,.md,.svg,.csv"
                onChange={handleUploadProjectFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="p-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white cursor-pointer"
                title="Importar ficheiro do Storage/Drive"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCreatingFile((v) => !v)}
                className="p-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-[#3B82F6] cursor-pointer"
                title="Novo ficheiro ou pasta (ex: src/utils/api.js)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {!isFullscreen && (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="p-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white cursor-pointer"
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
                className="flex-1 min-w-0 bg-[#0A0A0F] border border-[#3B82F6] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none"
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

      {/* Conteúdo: Editor estilo VS Code com Busca, Copiar Linha & Histórico de Versões */}
      {activeTab === 'editor' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 py-1.5 bg-[#0A0A0F] border-b border-[#1F1F2E] flex items-center justify-between gap-2 overflow-x-auto sara-scroll shrink-0">
            <div className="flex items-center gap-1">
              {filePaths.map((filePath) => (
                <button
                  key={filePath}
                  type="button"
                  onClick={() => onSelectFile(filePath)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition cursor-pointer whitespace-nowrap ${
                    resolvedActiveFile === filePath
                      ? 'bg-[#12121A] text-cyan-300 border border-cyan-500/40'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {filePath}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowSearch((v) => !v)}
                className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer ${
                  showSearch ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'text-[#A1A1AA] hover:text-white'
                }`}
                title="Buscar no código"
              >
                <Search className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={handleCopyCurrentLine}
                className="px-2 py-1 rounded text-[11px] text-[#A1A1AA] hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="Copiar linha atual do cursor"
              >
                <Scissors className="w-3 h-3" />
                <span className="hidden xl:inline">{copiedLine ? 'Linha copiada!' : 'Linha'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVersions((v) => !v)}
                className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  showVersions ? 'bg-[#8B5CF6]/20 text-[#C4B5FD]' : 'text-[#A1A1AA] hover:text-white'
                }`}
                title="Histórico de versões"
              >
                <History className="w-3 h-3" />
                <span className="hidden xl:inline">Versões ({versions.length})</span>
              </button>

              <button
                type="button"
                onClick={handleCopyFile}
                className="px-2 py-1 rounded text-[11px] text-[#A1A1AA] hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
                title="Copiar este ficheiro completo"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Barra de Busca */}
          {showSearch && (
            <div className="px-3 py-1.5 bg-[#0D111A] border-b border-[#1F1F2E] flex items-center gap-2 shrink-0">
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
                className="flex-1 min-w-0 bg-[#0A0A0F] border border-[#1F1F2E] focus:border-[#3B82F6] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                autoFocus
              />
              <span className="text-[11px] font-mono text-[#A1A1AA]">
                {searchMatches.length > 0 ? `${(searchIdx % searchMatches.length) + 1}/${searchMatches.length}` : '0/0'}
              </span>
              <button
                type="button"
                onClick={handleFindNext}
                disabled={searchMatches.length === 0}
                className="px-2 py-1 rounded bg-[#1F1F2E] text-[11px] text-white disabled:opacity-40 cursor-pointer"
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

          {/* Dropdown / Lista de Versões Anteriores */}
          {showVersions && (
            <div className="px-3 py-2 bg-[#0D111A] border-b border-[#1F1F2E] max-h-40 overflow-y-auto sara-scroll space-y-1.5 shrink-0">
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
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[11px]"
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

          <div className="flex-1 flex bg-[#0B0B11] overflow-hidden font-mono text-xs relative">
            <div
              ref={gutterRef}
              className="w-10 py-3 pr-2 text-right text-[#A1A1AA]/40 select-none bg-[#0A0A0F] border-r border-[#1F1F2E] overflow-hidden shrink-0 leading-[1.6]"
              aria-hidden="true"
            >
              {Array.from({ length: Math.min(lineCount, 1200) }, (_, idx) => (
                <div key={idx + 1}>{idx + 1}</div>
              ))}
            </div>

            <div className="relative flex-1 h-full overflow-hidden">
              <pre
                ref={preRef}
                aria-hidden="true"
                style={{ tabSize: 2, fontVariantLigatures: 'none' }}
                className="absolute inset-0 m-0 p-3 font-mono text-xs leading-[1.6] text-[#E2E8F0] whitespace-pre overflow-hidden pointer-events-none"
                dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
              />
              <textarea
                ref={textareaRef}
                value={currentCode}
                onChange={(e) => onChangeFileContent(resolvedActiveFile, e.target.value)}
                onScroll={handleEditorScroll}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                    e.preventDefault();
                    setShowSearch(true);
                  }
                }}
                spellCheck={false}
                wrap="off"
                style={{ tabSize: 2, fontVariantLigatures: 'none' }}
                className="relative z-10 w-full h-full bg-transparent text-transparent caret-[#3B82F6] p-3 outline-none resize-none leading-[1.6] font-mono text-xs sara-scroll whitespace-pre overflow-auto selection:bg-[#3B82F6]/30"
                aria-label={`Editor de código para ${resolvedActiveFile}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo: Console Real fundo preto */}
      {activeTab === 'console' && (
        <div className="flex-1 flex flex-col bg-[#050508] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#1F1F2E] bg-[#0A0A0F] flex items-center justify-between gap-2 shrink-0">
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
              className="p-1.5 rounded-lg border border-[#1F1F2E] text-[#A1A1AA] hover:text-white cursor-pointer"
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
                    : 'text-emerald-300/90 border-[#1F1F2E] bg-[#0A0A0F]';

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
            className="p-2 border-t border-[#1F1F2E] bg-[#0A0A0F] flex items-center gap-2 shrink-0"
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
              className="px-2.5 py-1 rounded bg-[#1F1F2E] hover:bg-[#3B82F6] text-white text-xs font-mono flex items-center gap-1 transition disabled:opacity-40 cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Run</span>
            </button>
          </form>
        </div>
      )}

      {/* Barra de Estatísticas no Rodapé */}
      <div className="px-3 py-1.5 bg-[#090C12] border-t border-[#1F1F2E] flex items-center justify-between gap-2 text-[10px] font-mono text-[#A1A1AA] shrink-0">
        <span>{totalLinesAllFiles} linhas</span>
        <span>·</span>
        <span>{filePaths.length} ficheiro(s)</span>
        <span>·</span>
        <span className="text-emerald-400">{errorsFixedCount} erro(s) corrigido(s)</span>
      </div>
    </section>
  );
};
