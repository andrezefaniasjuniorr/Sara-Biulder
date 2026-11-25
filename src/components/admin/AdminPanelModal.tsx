import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCheck,
  Clock,
  Eye,
  EyeOff,
  FileBarChart2,
  Image as ImageIcon,
  KeyRound,
  Lock,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  Unlock,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import {
  blockUserById,
  deleteUserById,
  fetchAllAdminData,
  generateDailyAdminReport,
  kickUserById,
  markAllAlertsRead,
} from '../../services/authService';
import {
  clearAdminImageCoreKey,
  fetchAdminImageCoreStatus,
  maskImageKeyPreview,
  saveAdminImageCoreKey,
  unlockAdminImageCoreWithPassword,
  type AdminImageCoreStatus,
} from '../../services/imageGenService';
import type {
  AdminDashboardSnapshot,
  DailyAdminReport,
  SaraSession,
  SessionAccessLog,
} from '../../types/auth';

interface AdminPanelModalProps {
  session: SaraSession;
  onClose: () => void;
  onAlertsUpdated?: () => void;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(rem).padStart(2, '0')}s`;
  return `${rem}s`;
}

function formatTimeShort(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  session,
  onClose,
  onAlertsUpdated,
}) => {
  // Segurança em profundidade: nunca renderiza se não for o Dono
  if (!session?.isOwner) return null;

  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot>({
    accounts: [],
    sessions: [],
    stats: [],
    alerts: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [report, setReport] = useState<DailyAdminReport | null>(null);
  const [selectedUserIdReport, setSelectedUserIdReport] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Estado privado do Núcleo SARA (Geração de Imagens — exclusivo Admin)
  const [coreImageStatus, setCoreImageStatus] = useState<AdminImageCoreStatus | null>(null);
  const [coreImageLoading, setCoreImageLoading] = useState(true);
  const [coreImageDraft, setCoreImageDraft] = useState('');
  const [showMaskedPreview, setShowMaskedPreview] = useState(false);
  const [coreImageSaving, setCoreImageSaving] = useState(false);
  const [coreImageFeedback, setCoreImageFeedback] = useState<string | null>(null);
  const [adminUnlockPass, setAdminUnlockPass] = useState('');
  const [adminUnlockBusy, setAdminUnlockBusy] = useState(false);

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const refreshCoreImageStatus = useCallback(async () => {
    setCoreImageLoading(true);
    try {
      const status = await fetchAdminImageCoreStatus();
      setCoreImageStatus(status);
    } finally {
      setCoreImageLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const data = await fetchAllAdminData(session);
      setSnapshot(data);
      setReport(generateDailyAdminReport(data));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refreshData();
    void refreshCoreImageStatus();
    const timer = setInterval(() => {
      void refreshData();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshData, refreshCoreImageStatus]);

  // Gráfico Chart.js de sessões por hora hoje
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas || !report) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const labels = report.hourlyBuckets.map((_, i) => `${String(i).padStart(2, '0')}h`);
    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Acessos / Hora',
            data: report.hourlyBuckets,
            backgroundColor: 'rgba(34, 211, 238, 0.45)',
            borderColor: 'rgba(34, 211, 238, 0.95)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 9 }, precision: 0 },
            grid: { color: 'rgba(51, 65, 85, 0.35)' },
          },
        },
      },
    });

    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, [report]);

  const unreadAlertsCount = useMemo(
    () => snapshot.alerts.filter((a) => !a.read).length,
    [snapshot.alerts]
  );

  // Consolida vista por usuário para a Coluna 2 (conta + última sessão + métricas agregadas)
  const userRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const latestSessionByUser = new Map<string, SessionAccessLog>();
    for (const s of snapshot.sessions) {
      if (!latestSessionByUser.has(s.userId)) {
        latestSessionByUser.set(s.userId, s);
      }
    }

    const rows = snapshot.accounts.map((acc) => {
      const latestSess = latestSessionByUser.get(acc.uid);
      const st = snapshot.stats.find((x) => x.userId === acc.uid);
      return {
        uid: acc.uid,
        name: acc.callName || acc.fullName,
        fullName: acc.fullName,
        email: acc.email,
        isOwner: acc.role === 'owner',
        blocked: acc.blocked,
        status: acc.blocked ? ('Bloqueado' as const) : latestSess?.status || ('Saiu' as const),
        loginAt: latestSess?.loginAt || acc.lastLoginAt,
        durationSeconds: latestSess?.durationSeconds || 0,
        currentActivity: latestSess?.currentActivity || 'Inativo',
        sitesBuilt: st?.sitesBuilt || 0,
        explanationsCount: st?.explanationsCount || 0,
        musicCount: st?.musicCount || 0,
        calculationsCount: st?.calculationsCount || 0,
      };
    });

    // Inclui convidados online recentes na lista de controlo
    for (const s of snapshot.sessions) {
      if (s.role === 'guest' && s.status !== 'Saiu') {
        rows.push({
          uid: s.userId,
          name: `${s.name} (Temporário)`,
          fullName: 'Visitante Temporário',
          email: 'Modo Convidado (5m)',
          isOwner: false,
          blocked: false,
          status: s.status,
          loginAt: s.loginAt,
          durationSeconds: s.durationSeconds,
          currentActivity: s.currentActivity,
          sitesBuilt: 0,
          explanationsCount: 0,
          musicCount: 0,
          calculationsCount: 0,
        });
      }
    }

    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    );
  }, [snapshot, searchQuery]);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = snapshot.sessions.slice(0, 80);
    if (!q) return list;
    return list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [snapshot.sessions, searchQuery]);

  const selectedUserReportRow = useMemo(() => {
    if (!selectedUserIdReport || !report) return null;
    const fromReport = report.users.find((u) => u.userId === selectedUserIdReport);
    const acc = snapshot.accounts.find((a) => a.uid === selectedUserIdReport);
    const st = snapshot.stats.find((s) => s.userId === selectedUserIdReport);
    if (fromReport) return fromReport;
    if (!acc) return null;
    return {
      userId: acc.uid,
      name: acc.callName || acc.fullName,
      email: acc.email,
      sessionsCount: snapshot.sessions.filter((s) => s.userId === acc.uid).length,
      totalMinutes: Math.round(
        snapshot.sessions
          .filter((s) => s.userId === acc.uid)
          .reduce((accSec, x) => accSec + (x.durationSeconds || 0), 0) / 60
      ),
      topActivity: 'A conversar',
      sitesBuilt: st?.sitesBuilt || 0,
      explanationsCount: st?.explanationsCount || 0,
      musicCount: st?.musicCount || 0,
      calculationsCount: st?.calculationsCount || 0,
    };
  }, [selectedUserIdReport, report, snapshot]);

  const handleBlockToggle = async (uid: string, currentlyBlocked: boolean) => {
    setActionBusyId(uid);
    try {
      await blockUserById(session, uid, !currentlyBlocked);
      await refreshData();
    } finally {
      setActionBusyId(null);
    }
  };

  const handleKick = async (uid: string) => {
    setActionBusyId(uid);
    try {
      await kickUserById(session, uid);
      await refreshData();
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (confirmDeleteUserId !== uid) {
      setConfirmDeleteUserId(uid);
      return;
    }
    setActionBusyId(uid);
    try {
      await deleteUserById(session, uid);
      setConfirmDeleteUserId(null);
      await refreshData();
    } finally {
      setActionBusyId(null);
    }
  };

  const handleMarkAlertsRead = async () => {
    await markAllAlertsRead(session);
    await refreshData();
    onAlertsUpdated?.();
  };

  const handleUnlockCoreVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUnlockPass.trim()) return;
    setAdminUnlockBusy(true);
    setCoreImageFeedback(null);
    try {
      const res = await unlockAdminImageCoreWithPassword(session.email, adminUnlockPass);
      if (!res.ok) {
        setCoreImageFeedback(res.error || 'Senha de administrador inválida.');
        return;
      }
      setAdminUnlockPass('');
      await refreshCoreImageStatus();
    } finally {
      setAdminUnlockBusy(false);
    }
  };

  const handleSaveCoreImageKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = coreImageDraft.trim();
    if (!trimmed) {
      setCoreImageFeedback('Cola a credencial de imagem antes de guardar.');
      return;
    }
    setCoreImageSaving(true);
    setCoreImageFeedback(null);
    try {
      const res = await saveAdminImageCoreKey(trimmed);
      setCoreImageStatus(res);
      if (res.ok) {
        setCoreImageDraft('');
        setShowMaskedPreview(false);
        setCoreImageFeedback('Credencial guardada com segurança no Núcleo SARA.');
      } else {
        setCoreImageFeedback(res.error || 'Não foi possível guardar no Núcleo SARA.');
      }
    } finally {
      setCoreImageSaving(false);
    }
  };

  const handleClearCoreImageKey = async () => {
    setCoreImageSaving(true);
    setCoreImageFeedback(null);
    try {
      const res = await clearAdminImageCoreKey();
      setCoreImageStatus(res);
      if (res.ok) {
        setCoreImageDraft('');
        setCoreImageFeedback('Credencial removida do Núcleo SARA.');
      } else {
        setCoreImageFeedback(res.error || 'Não foi possível remover.');
      }
    } finally {
      setCoreImageSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[#020612]/92 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[1440px] h-[92vh] bg-[#040a17] border border-cyan-500/30 rounded-2xl shadow-[0_24px_90px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-slate-100">
        {/* Top Bar Admin */}
        <header className="px-4 py-3 border-b border-slate-800/90 bg-[#050d1e] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/12 border border-cyan-400/35 flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wider text-white uppercase">
                  Painel Admin JARVIS
                </h2>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[10px] font-semibold tracking-wider uppercase">
                  DONO: Eletro-Júnior • ADMIN ATIVO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Controlo de acessos, métricas por categoria e segurança (privacidade de conversas preservada)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar nome ou email..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#081226] border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-48"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedUserIdReport(null);
                setReport(generateDailyAdminReport(snapshot));
              }}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <FileBarChart2 className="w-3.5 h-3.5" />
              GERAR RELATÓRIO
            </button>

            <button
              type="button"
              onClick={() => void refreshData()}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-200 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition"
            >
              <X className="w-4 h-4" />
              FECHAR
            </button>
          </div>
        </header>

        {/* 3-Column Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 overflow-hidden">
          {/* COLUNA 1: NÚCLEO SARA + VISÃO GERAL + GRÁFICO + RELATÓRIO */}
          <section className="lg:col-span-4 flex flex-col min-h-0 overflow-y-auto p-4 gap-4 bg-[#030814]">
            {/* Secção Privada Núcleo SARA — Exclusiva Admin */}
            <div className="p-3.5 rounded-xl bg-[#071022] border border-purple-500/35 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-purple-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-300" />
                  Núcleo SARA
                </span>
                {coreImageLoading ? (
                  <span className="text-[10px] font-mono text-slate-400">A verificar...</span>
                ) : coreImageStatus?.configured ? (
                  <span className="text-[10px] font-mono text-emerald-300">
                    Ativo · {coreImageStatus.maskedKey || 'hf_****'}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-amber-300">Não configurado</span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Configuração privada do motor de criação de imagens. Todos os utilizadores geram imagens em segundo plano sem acesso a credenciais.
              </p>

              {coreImageStatus?.needsUnlock ? (
                <form onSubmit={(e) => void handleUnlockCoreVault(e)} className="space-y-2">
                  <div className="text-[11px] text-amber-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Confirma a tua senha Admin para desbloquear esta secção privada.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={adminUnlockPass}
                      onChange={(e) => setAdminUnlockPass(e.target.value)}
                      placeholder="Senha da conta Admin..."
                      autoComplete="current-password"
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#040916] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="submit"
                      disabled={adminUnlockBusy || !adminUnlockPass.trim()}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {adminUnlockBusy ? 'A validar...' : 'Desbloquear'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={(e) => void handleSaveCoreImageKey(e)} className="space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Credencial de Imagem SARA
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <KeyRound className="w-3.5 h-3.5 text-purple-300 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        value={coreImageDraft}
                        onChange={(e) => setCoreImageDraft(e.target.value)}
                        placeholder={
                          coreImageStatus?.configured && coreImageStatus.maskedKey
                            ? `Guardada (${coreImageStatus.maskedKey}) — cola nova para atualizar`
                            : 'Cola aqui a nova credencial (hf_...)'
                        }
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[#040916] border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMaskedPreview((v) => !v)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      title={showMaskedPreview ? 'Esconder pré-visualização' : 'Mostrar pré-visualização mascarada'}
                    >
                      {showMaskedPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showMaskedPreview ? 'Esconder' : 'Mostrar'}</span>
                    </button>
                  </div>

                  {showMaskedPreview && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-[#040916] border border-cyan-500/30 text-[11px] font-mono text-cyan-200 flex items-center justify-between">
                      <span>Máscara ativa:</span>
                      <span className="font-bold">
                        {coreImageDraft.trim()
                          ? maskImageKeyPreview(coreImageDraft)
                          : coreImageStatus?.maskedKey || 'Sem credencial'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="submit"
                      disabled={coreImageSaving || !coreImageDraft.trim()}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{coreImageSaving ? 'A guardar...' : 'Guardar'}</span>
                    </button>

                    {coreImageStatus?.configured && (
                      <button
                        type="button"
                        disabled={coreImageSaving}
                        onClick={() => void handleClearCoreImageKey()}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </form>
              )}

              {coreImageFeedback && (
                <div className="text-[11px] text-cyan-200 pt-0.5">{coreImageFeedback}</div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-cyan-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Visão Geral &amp; Métricas
              </span>
              <span className="text-[11px] text-slate-500 font-mono">{report?.dateKey}</span>
            </div>

            {/* 4 KPIs */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-[#071022] border border-slate-800/90">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  Total Usuários
                </span>
                <div className="text-xl font-bold text-white font-mono tabular-nums mt-0.5">
                  {report?.totalUsers ?? snapshot.accounts.length}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#071022] border border-slate-800/90">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  Online Agora
                </span>
                <div className="text-xl font-bold text-emerald-400 font-mono tabular-nums mt-0.5">
                  {report?.onlineNow ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#071022] border border-slate-800/90">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  Sessões Hoje
                </span>
                <div className="text-xl font-bold text-cyan-300 font-mono tabular-nums mt-0.5">
                  {report?.activeSessionsToday ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#071022] border border-slate-800/90">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  Tempo Hoje
                </span>
                <div className="text-xl font-bold text-amber-300 font-mono tabular-nums mt-0.5">
                  {report?.totalMinutesToday ?? 0}m
                </div>
              </div>
            </div>

            {/* Chart.js Acessos por Hora */}
            <div className="p-3 rounded-xl bg-[#071022] border border-slate-800/90">
              <div className="text-[11px] font-semibold text-slate-300 mb-2">
                Acessos por Hora (Hoje)
              </div>
              <div className="h-36 w-full">
                <canvas ref={chartCanvasRef} />
              </div>
            </div>

            {/* Relatório Diário / Individual */}
            <div className="p-3.5 rounded-xl bg-[#071022] border border-cyan-500/20 flex-1 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  {selectedUserReportRow
                    ? `Relatório: ${selectedUserReportRow.name}`
                    : 'Relatório do Dia'}
                </span>
                {selectedUserReportRow && (
                  <button
                    type="button"
                    onClick={() => setSelectedUserIdReport(null)}
                    className="text-[10px] text-slate-400 hover:text-white underline"
                  >
                    Ver todos
                  </button>
                )}
              </div>

              {selectedUserReportRow ? (
                <div className="text-xs text-slate-300 space-y-1.5">
                  <div className="text-slate-400">{selectedUserReportRow.email}</div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono tabular-nums">
                    <div>Sessões: {selectedUserReportRow.sessionsCount}</div>
                    <div>Tempo: {selectedUserReportRow.totalMinutes} min</div>
                    <div>Sites/Apps: {selectedUserReportRow.sitesBuilt}</div>
                    <div>Explicações: {selectedUserReportRow.explanationsCount}</div>
                    <div>Músicas: {selectedUserReportRow.musicCount}</div>
                    <div>Cálculos: {selectedUserReportRow.calculationsCount}</div>
                  </div>
                  <div className="pt-1 text-[11px] text-cyan-300">
                    Atividade principal: {selectedUserReportRow.topActivity}
                  </div>
                </div>
              ) : report && report.users.length > 0 ? (
                <div className="space-y-1.5 overflow-y-auto max-h-52 pr-1">
                  {report.users.map((u) => (
                    <div
                      key={u.userId}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/70 last:border-0"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-slate-200 truncate">{u.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{u.topActivity}</div>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0 text-[11px] text-cyan-300">
                        {u.totalMinutes}m • {u.sessionsCount}x
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Ainda sem acessos registados hoje.</p>
              )}
            </div>
          </section>

          {/* COLUNA 2: USUÁRIOS ONLINE + CONTROLO + ATIVIDADE POR USUÁRIO */}
          <section className="lg:col-span-4 flex flex-col min-h-0 overflow-y-auto p-4 gap-3 bg-[#040a17]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-cyan-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Usuários &amp; Controlo ({userRows.length})
              </span>
              <span className="text-[10px] text-slate-400">Tempo real</span>
            </div>

            <div className="space-y-2.5">
              {userRows.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Nenhum utilizador corresponde ao filtro.
                </div>
              ) : (
                userRows.map((u) => {
                  const statusTone =
                    u.status === 'Online'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                      : u.status === 'Ausente'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                      : u.status === 'Bloqueado'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                      : 'bg-slate-800 text-slate-400 border-slate-700';

                  return (
                    <div
                      key={u.uid}
                      className="p-3 rounded-xl bg-[#071124] border border-slate-800/90 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{u.name}</span>
                            {u.isOwner && (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                                DONO
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${statusTone}`}
                        >
                          {u.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 bg-[#050c1a] px-2.5 py-1.5 rounded-lg border border-slate-800/70">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          Entrou: <strong className="text-slate-200 font-mono">{formatTimeShort(u.loginAt)}</strong>
                        </span>
                        <span className="font-mono tabular-nums text-cyan-300">
                          {formatDuration(u.durationSeconds)}
                        </span>
                        <span className="text-[10px] text-emerald-300 truncate">
                          {u.currentActivity}
                        </span>
                      </div>

                      {/* Atividade agregada por usuário (zero queries/conversas) */}
                      <div className="grid grid-cols-4 gap-1.5 text-center font-mono tabular-nums">
                        <div className="py-1 rounded bg-[#050c1a] border border-slate-800/70">
                          <div className="text-[9px] text-slate-500">Sites</div>
                          <div className="text-xs font-semibold text-white">{u.sitesBuilt}</div>
                        </div>
                        <div className="py-1 rounded bg-[#050c1a] border border-slate-800/70">
                          <div className="text-[9px] text-slate-500">Explicações</div>
                          <div className="text-xs font-semibold text-white">{u.explanationsCount}</div>
                        </div>
                        <div className="py-1 rounded bg-[#050c1a] border border-slate-800/70">
                          <div className="text-[9px] text-slate-500">Músicas</div>
                          <div className="text-xs font-semibold text-white">{u.musicCount}</div>
                        </div>
                        <div className="py-1 rounded bg-[#050c1a] border border-slate-800/70">
                          <div className="text-[9px] text-slate-500">Cálculos</div>
                          <div className="text-xs font-semibold text-white">{u.calculationsCount}</div>
                        </div>
                      </div>

                      {/* Botões de Controlo */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUserIdReport(u.uid)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1 transition"
                        >
                          <FileBarChart2 className="w-3 h-3 text-cyan-400" />
                          VER RELATÓRIO
                        </button>

                        {!u.isOwner && !u.uid.startsWith('guest_') && (
                          <>
                            <button
                              type="button"
                              disabled={actionBusyId === u.uid}
                              onClick={() => void handleBlockToggle(u.uid, u.blocked)}
                              className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition ${
                                u.blocked
                                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200'
                                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200'
                              }`}
                            >
                              {u.blocked ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  DESBLOQUEAR
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3 h-3" />
                                  BLOQUEAR USUÁRIO
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={actionBusyId === u.uid || u.status === 'Saiu'}
                              onClick={() => void handleKick(u.uid)}
                              className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 text-rose-200 text-[10px] font-semibold flex items-center gap-1 transition"
                            >
                              <UserX className="w-3 h-3" />
                              EXPULSAR AGORA
                            </button>

                            <button
                              type="button"
                              disabled={actionBusyId === u.uid}
                              onClick={() => void handleDeleteUser(u.uid)}
                              className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition ${
                                confirmDeleteUserId === u.uid
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-800 hover:bg-rose-500/25 text-slate-300 hover:text-rose-200'
                              }`}
                            >
                              <Trash2 className="w-3 h-3" />
                              {confirmDeleteUserId === u.uid ? 'CONFIRMAR APAGAR?' : 'APAGAR CONTA'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* COLUNA 3: HISTÓRICO DE ACESSOS + ALERTAS DE SEGURANÇA */}
          <section className="lg:col-span-4 flex flex-col min-h-0 overflow-hidden bg-[#030814]">
            {/* Alertas */}
            <div className="p-4 border-b border-slate-800/80 flex flex-col gap-2.5 max-h-[44%] overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Alertas de Segurança ({unreadAlertsCount} novos)
                </span>
                {unreadAlertsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkAlertsRead()}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1 transition"
                  >
                    <CheckCheck className="w-3 h-3 text-emerald-400" />
                    MARCAR LIDOS
                  </button>
                )}
              </div>

              {snapshot.alerts.length === 0 ? (
                <div className="p-3 rounded-xl bg-[#071022] border border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  Sem incidentes ou tentativas não autorizadas.
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshot.alerts.slice(0, 25).map((al) => (
                    <div
                      key={al.id}
                      className={`p-2.5 rounded-xl border text-xs ${
                        al.read
                          ? 'bg-[#060d1c] border-slate-800/70 text-slate-400'
                          : 'bg-rose-500/10 border-rose-500/35 text-rose-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="font-bold uppercase tracking-wider text-rose-300">
                          {al.type.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-slate-400">
                          {formatDateShort(al.timestamp)} {formatTimeShort(al.timestamp)}
                        </span>
                      </div>
                      <p className="leading-snug">{al.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Histórico de Acessos */}
            <div className="flex-1 min-h-0 flex flex-col p-4 overflow-hidden">
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-cyan-300 mb-2.5">
                Histórico de Acessos ({filteredHistory.length})
              </div>
              <div className="flex-1 overflow-auto rounded-xl border border-slate-800/90 bg-[#071022]">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="sticky top-0 bg-[#0a152b] text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-2.5">Nome / Email</th>
                      <th className="py-2 px-2">Data</th>
                      <th className="py-2 px-2">In / Out</th>
                      <th className="py-2 px-2">Dur.</th>
                      <th className="py-2 px-2">Disp.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {filteredHistory.map((h) => (
                      <tr key={h.sessionId} className="hover:bg-slate-800/35">
                        <td className="py-2 px-2.5 font-sans">
                          <div className="font-medium text-slate-200 truncate max-w-[130px]">{h.name}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[130px]">{h.email}</div>
                        </td>
                        <td className="py-2 px-2 text-slate-300 whitespace-nowrap">
                          {formatDateShort(h.loginAt)}
                        </td>
                        <td className="py-2 px-2 text-slate-300 whitespace-nowrap">
                          {formatTimeShort(h.loginAt)} / {h.logoutAt ? formatTimeShort(h.logoutAt) : 'Ativo'}
                        </td>
                        <td className="py-2 px-2 text-cyan-300 whitespace-nowrap">
                          {formatDuration(h.durationSeconds)}
                        </td>
                        <td className="py-2 px-2 text-slate-300 whitespace-nowrap">{h.device}</td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                          Sem histórico registado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
