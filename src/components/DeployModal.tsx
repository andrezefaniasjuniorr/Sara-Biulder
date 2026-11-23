import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Github,
  Cloud,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { ProjectFiles } from '../types/builder';
import { buildStandaloneHtml, downloadProjectZip } from '../utils/zipService';
import {
  formatRepoSlug,
  getSavedGitHubToken,
  pushProjectToGitHub,
} from '../utils/githubService';

interface DeployModalProps {
  isOpen: boolean;
  projectName: string;
  files: ProjectFiles;
  onClose: () => void;
  onOpenSettings: () => void;
  onNotify: (msg: string) => void;
  isOwner?: boolean;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  projectName,
  files,
  onClose,
  onOpenSettings,
  onNotify,
  isOwner = false,
}) => {
  const [repoName, setRepoName] = useState(() => formatRepoSlug(projectName));
  const [isPrivate, setIsPrivate] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; text: string; url?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCloudflareGuide, setShowCloudflareGuide] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRepoName(formatRepoSlug(projectName));
      setPushResult(null);
    }
  }, [projectName, isOpen]);

  if (!isOpen) return null;

  const handleCopyAll = () => {
    const html = buildStandaloneHtml(files, projectName);
    navigator.clipboard?.writeText(html).catch(() => {});
    setCopied(true);
    onNotify('Código completo copiado para a área de transferência.');
    setTimeout(() => setCopied(false), 1800);
  };

  const handleZip = async () => {
    await downloadProjectZip(files, projectName);
    onNotify('ZIP do projeto descarregado.');
  };

  const handlePushGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getSavedGitHubToken();
    if (!token) {
      setPushResult({
        ok: false,
        text: 'Nenhuma Chave do Cofre configurada. Clica em "Configurar Chave" nas Configurações.',
      });
      return;
    }

    setPushing(true);
    setPushResult(null);

    try {
      const result = await pushProjectToGitHub({
        projectName,
        files,
        repoName,
        isPrivate,
      });

      setPushResult({
        ok: true,
        text: `Código enviado com sucesso para o Cofre de Projetos (${result.owner}/${result.repo} • ${result.fileCount} ficheiros)!`,
        url: result.repoUrl,
      });
      onNotify(`Cofre de Projetos atualizado: ${result.owner}/${result.repo}`);
    } catch {
      setPushResult({
        ok: false,
        text: 'Núcleo offline. A tentar reconectar...',
      });
    } finally {
      setPushing(false);
    }
  };

  const hasToken = Boolean(getSavedGitHubToken());

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[88vh] bg-[#12121A] border border-[#1F1F2E] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F1F2E] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Exportar, Cofre de Projetos &amp; Publicação</h2>
            <p className="text-xs text-[#A1A1AA]">Projeto: {projectName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#0A0A0F] border border-[#1F1F2E] text-[#A1A1AA] hover:text-white cursor-pointer"
            aria-label="Fechar deploy"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 sara-scroll">
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleZip}
              className="py-3 px-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] hover:border-[#3B82F6] text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#3B82F6]" />
              <span>Baixar ZIP Completo</span>
            </button>
            <button
              type="button"
              onClick={handleCopyAll}
              className="py-3 px-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] hover:border-[#8B5CF6] text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#8B5CF6]" />}
              <span>{copied ? 'HTML Completo Copiado!' : 'Copiar Código Completo'}</span>
            </button>
          </div>

          {isOwner && (
            <form onSubmit={handlePushGitHub} className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-white" />
                  <span className="text-sm font-bold text-white">Guardar no Cofre de Projetos</span>
                </div>
                {!hasToken && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="text-xs text-[#3B82F6] hover:underline cursor-pointer"
                  >
                    Configurar Chave
                  </button>
                )}
              </div>

              {!hasToken && (
                <div className="p-3 rounded-lg bg-[#12121A] border border-amber-500/30 text-xs text-amber-200 space-y-1">
                  <div className="font-semibold">Configuração do Cofre de Projetos:</div>
                  <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-[#A1A1AA]">
                    <li>Gera uma chave pessoal de acesso de repositório com permissão de escrita.</li>
                    <li>Cola em <strong>Configurações do Sistema → Cofre de Projetos</strong> (guardada de forma privada na Memória da SARA).</li>
                  </ol>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="Nome do cofre / projeto (ex: minha-app)"
                  className="flex-1 bg-[#12121A] border border-[#1F1F2E] focus:border-[#3B82F6] rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                />
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#12121A] border border-[#1F1F2E] text-xs text-[#A1A1AA] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  <span>Privado</span>
                </label>
                <button
                  type="submit"
                  disabled={pushing}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
                  <span>Enviar ao Cofre</span>
                </button>
              </div>

              {pushResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    pushResult.ok
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div>{pushResult.text}</div>
                  {pushResult.url && (
                    <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-white">
                      <ExternalLink className="w-3 h-3" />
                      <span>{pushResult.url}</span>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          <div className="p-4 rounded-xl bg-[#0A0A0F] border border-[#1F1F2E] space-y-2.5">
            <button
              type="button"
              onClick={() => setShowCloudflareGuide((v) => !v)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#3B82F6]" />
                <span className="text-sm font-bold text-white">Guia de Publicação Web</span>
              </div>
              <span className="text-xs text-[#3B82F6]">
                {showCloudflareGuide ? 'Ocultar' : 'Ver passo a passo'}
              </span>
            </button>

            {showCloudflareGuide && (
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#A1A1AA] pt-2 border-t border-[#1F1F2E]">
                <li>
                  <strong>Publicação por Cofre:</strong> Liga o projeto enviado através de <em>Enviar ao Cofre</em> com pasta de saída <strong>/</strong>.
                </li>
                <li>
                  <strong>Estúdio SARA:</strong> Compilação com <code>npm run build</code> e pasta de saída <strong>dist</strong>.
                </li>
                <li>
                  <strong>Upload direto via ZIP:</strong> Clica em <strong>Baixar ZIP Completo</strong> acima, extrai a pasta e publica no teu alojamento web.
                </li>
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
