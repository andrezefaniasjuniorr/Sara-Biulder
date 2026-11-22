import React, { useRef, useState } from 'react';
import {
  X,
  Plus,
  Upload,
  CloudUpload,
  FolderOpen,
  Copy,
  Pencil,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import type { ProjectRecord, ProjectType } from '../types/builder';
import { importProjectZip } from '../utils/zipService';

interface ProjectsModalProps {
  isOpen: boolean;
  projects: ProjectRecord[];
  currentProjectId: string;
  isSyncingFirebase: boolean;
  onClose: () => void;
  onCreateNew: (name: string, type: ProjectType) => void;
  onOpenProject: (project: ProjectRecord) => void;
  onDuplicateProject: (project: ProjectRecord) => void;
  onRenameProject: (id: string, newName: string) => void;
  onDeleteProject: (id: string) => void;
  onImportProject: (name: string, files: ProjectRecord['files']) => void;
  onSaveCurrentToFirebase: () => void;
  onLoadFromFirebase: () => void;
  isOwner?: boolean;
  callName?: string;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  projects,
  currentProjectId,
  isSyncingFirebase,
  onClose,
  onCreateNew,
  onOpenProject,
  onDuplicateProject,
  onRenameProject,
  onDeleteProject,
  onImportProject,
  onSaveCurrentToFirebase,
  onLoadFromFirebase,
  isOwner = false,
  callName = 'Utilizador',
}) => {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ProjectType>('Site');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [importError, setImportError] = useState('');
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim() || `Projeto ${projects.length + 1}`;
    onCreateNew(clean, newType);
    setNewName('');
    onClose();
  };

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const imported = await importProjectZip(file);
      onImportProject(imported.name, imported.files);
      onClose();
    } catch (err: any) {
      setImportError(err?.message || 'Não foi possível ler este ficheiro ZIP.');
    } finally {
      e.target.value = '';
    }
  };

  const confirmRename = (id: string) => {
    if (editingName.trim()) {
      onRenameProject(id, editingName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[88vh] bg-[#12121A] border border-[#1F1F2E] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F1F2E] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">
              {isOwner ? 'Projetos de Eletro-Jr' : `Projetos de ${callName}`}
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              {isOwner
                ? 'Guardados no navegador e sincronizados com sara_projetos (Firestore)'
                : 'Espaço pessoal guardado com sincronização segura'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white cursor-pointer"
            aria-label="Fechar projetos"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 sara-scroll">
          {/* Ações Principais: Novo Projeto + Importar ZIP + Firebase */}
          <div className="grid md:grid-cols-2 gap-4">
            <form
              onSubmit={handleCreate}
              className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] space-y-3"
            >
              <div className="text-xs font-semibold text-white">Novo Projeto</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Loja da Ana, Corrida Maputo..."
                  className="flex-1 min-w-0 bg-[#12121A] border border-[#1F1F2E] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-xs text-white outline-none"
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ProjectType)}
                  className="bg-[#12121A] border border-[#1F1F2E] rounded-lg px-2.5 py-2 text-xs text-white outline-none"
                >
                  <option value="Site">Site</option>
                  <option value="App">App</option>
                  <option value="Jogo">Jogo</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar Novo Projeto</span>
              </button>
            </form>

            <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] flex flex-col justify-between gap-3">
              <div className="text-xs font-semibold text-white">
                {isOwner ? 'Importação e Nuvem Firebase' : 'Importação e Backup'}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleZipChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => zipInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-[#3B82F6]/50 text-xs font-medium text-white flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Importar ZIP</span>
                </button>
                <button
                  type="button"
                  onClick={onSaveCurrentToFirebase}
                  disabled={isSyncingFirebase}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-[#8B5CF6]/50 text-xs font-medium text-white flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {isSyncingFirebase ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B5CF6]" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  )}
                  <span>{isOwner ? 'Salvar no Firebase' : 'Guardar na Nuvem'}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onLoadFromFirebase}
                disabled={isSyncingFirebase}
                className="w-full py-2 px-3 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-emerald-500/40 text-xs text-[#A1A1AA] hover:text-white transition cursor-pointer"
              >
                {isOwner ? 'Sincronizar lista de sara_projetos' : 'Sincronizar projetos guardados'}
              </button>
              {importError && <p className="text-[11px] text-rose-400">{importError}</p>}
            </div>
          </div>

          {/* Lista de Projetos */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#A1A1AA]">
              Projetos Guardados ({projects.length})
            </div>

            {projects.map((proj) => {
              const isCurrent = proj.id === currentProjectId;
              const dateLabel = new Date(proj.updatedAt).toLocaleDateString('pt-PT', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={proj.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-[#3B82F6]/10 border-[#3B82F6]/50'
                      : 'bg-[#0A0A0F] border-[#1F1F2E]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {editingId === proj.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename(proj.id);
                          }}
                          className="bg-[#12121A] border border-[#3B82F6] rounded px-2 py-1 text-xs text-white outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => confirmRename(proj.id)}
                          className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="font-semibold text-sm text-white truncate">
                        {proj.name}
                      </div>
                    )}
                    <div className="text-[11px] text-[#A1A1AA] flex items-center gap-2 mt-0.5">
                      <span>{proj.type}</span>
                      <span>·</span>
                      <span className="font-mono">{dateLabel}</span>
                      {proj.syncedToFirebase && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400">{isOwner ? 'Firebase' : 'Sincronizado'}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenProject(proj);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Abrir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateProject(proj)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-[#3B82F6]/40 text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(proj.id);
                        setEditingName(proj.name);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-[#3B82F6]/40 text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Renomear</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj.id)}
                      disabled={projects.length <= 1}
                      className="px-2.5 py-1.5 rounded-lg bg-[#12121A] border border-[#1F1F2E] hover:border-rose-500/40 text-xs text-[#A1A1AA] hover:text-rose-400 disabled:opacity-30 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Apagar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
