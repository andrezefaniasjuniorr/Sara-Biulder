import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  Copy,
  Check,
  Smartphone,
  Laptop,
  Battery,
  BatteryCharging,
  MapPin,
  Volume2,
  Lock,
  Trash2,
  ShieldAlert,
  BellRing,
  Radio,
  Power,
  MessageSquareWarning,
  Clock,
  RefreshCw,
} from 'lucide-react';
import type { SaraSession } from '../../types/auth';
import type {
  BackgroundReminder,
  BackgroundSettings,
  SaraDeviceRecord,
} from '../../types/location';
import {
  formatTimeAgoPt,
  issueRemoteDeviceCommand,
  verifyPasswordAndIssueWipeCommand,
} from '../../services/locationRadarService';
import { GoogleMapsWrapper } from '../map/GoogleMapsWrapper';
import { GoogleSaraMapView, type SaraMapMarker } from '../map/GoogleSaraMapView';

export type ProfileSubTab = 'perfil' | 'achar_celular' | 'segundo_plano';

interface ProfileAndFindPhonePanelProps {
  session: SaraSession;
  initialTab?: ProfileSubTab;
  devices: SaraDeviceRecord[];
  bgSettings: BackgroundSettings;
  reminders: BackgroundReminder[];
  notificationPermission: NotificationPermission | 'unsupported';
  onUpdateBgSettings: (patch: Partial<BackgroundSettings>) => void;
  onPermitBackground: () => Promise<void>;
  onStopBackground: () => Promise<void>;
  onRefreshDeviceNow: () => Promise<void>;
  onDeleteReminder: (id: string) => void;
  onNotify: (msg: string) => void;
  onClose?: () => void;
}

export const ProfileAndFindPhonePanel: React.FC<ProfileAndFindPhonePanelProps> = ({
  session,
  initialTab = 'perfil',
  devices,
  bgSettings,
  reminders,
  notificationPermission,
  onUpdateBgSettings,
  onPermitBackground,
  onStopBackground,
  onRefreshDeviceNow,
  onDeleteReminder,
  onNotify,
  onClose,
}) => {
  const [subTab, setSubTab] = useState<ProfileSubTab>(initialTab);
  useEffect(() => {
    setSubTab(initialTab);
  }, [initialTab]);
  const [copiedId, setCopiedId] = useState(false);
  const [refreshingPos, setRefreshingPos] = useState(false);

  // Modais de ação remota para Achar Meu Celular
  const [lockTargetDevice, setLockTargetDevice] = useState<SaraDeviceRecord | null>(null);
  const [lockMessage, setLockMessage] = useState(
    'Este telemóvel pertence ao utilizador SARA. Por favor devolva.'
  );
  const [lockPhone, setLockPhone] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [wipeTargetDevice, setWipeTargetDevice] = useState<SaraDeviceRecord | null>(null);
  const [wipePassword, setWipePassword] = useState('');
  const [wipeError, setWipeError] = useState('');

  const handleCopySaraId = () => {
    const id = session.saraId || '';
    if (!id) return;
    navigator.clipboard?.writeText(id).catch(() => {});
    setCopiedId(true);
    onNotify(`ID ${id} copiado!`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Apenas dispositivos desta conta com Achar Meu Celular ativo
  const findPhoneDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          d.ownerUid === session.userId &&
          d.findPhoneEnabled !== false
      ),
    [devices, session.userId]
  );

  const findPhoneMarkers = useMemo<SaraMapMarker[]>(() => {
    return findPhoneDevices
      .filter((d) => typeof d.lastLat === 'number' && typeof d.lastLng === 'number')
      .map((d) => ({
        id: d.deviceCode,
        lat: d.lastLat as number,
        lng: d.lastLng as number,
        title: `${d.deviceName} (${d.deviceCode})`,
        subtitle: `${d.online ? 'Online' : `Offline • Última localização ${formatTimeAgoPt(d.lastUpdatedAt)}`} • Bateria: ${
          d.batteryPct !== null ? `${d.batteryPct}%` : 'AC/N/D'
        }`,
        badge: `${d.deviceCode} • ${d.online ? 'ON' : 'OFF'}`,
        tone: d.online ? 'device_online' : 'device_offline',
      }));
  }, [findPhoneDevices]);

  const mapCenter = useMemo(() => {
    if (findPhoneMarkers.length > 0) {
      return { lat: findPhoneMarkers[0].lat, lng: findPhoneMarkers[0].lng };
    }
    return { lat: null as number | null, lng: null as number | null };
  }, [findPhoneMarkers]);

  const handleRingDevice = async (dev: SaraDeviceRecord) => {
    setActionBusyId(dev.deviceCode);
    try {
      await issueRemoteDeviceCommand({
        session,
        targetDeviceCode: dev.deviceCode,
        type: 'ring',
      });
      onNotify(
        dev.online
          ? `Alarme enviado para ${dev.deviceName} (${dev.deviceCode})!`
          : `Pedido de alarme em fila para ${dev.deviceCode} — tocará assim que ligar à rede.`
      );
    } catch (err: any) {
      onNotify(err?.message || 'Não foi possível enviar o comando.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleConfirmLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockTargetDevice) return;
    setActionBusyId(lockTargetDevice.deviceCode);
    try {
      await issueRemoteDeviceCommand({
        session,
        targetDeviceCode: lockTargetDevice.deviceCode,
        type: 'lock',
        message: lockMessage,
        contactPhone: lockPhone,
      });
      onNotify(`Bloqueio remoto enviado para ${lockTargetDevice.deviceCode}.`);
      setLockTargetDevice(null);
    } catch (err: any) {
      onNotify(err?.message || 'Falha ao enviar bloqueio.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleConfirmWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wipeTargetDevice) return;
    setWipeError('');
    setActionBusyId(wipeTargetDevice.deviceCode);
    try {
      const res = await verifyPasswordAndIssueWipeCommand({
        session,
        targetDeviceCode: wipeTargetDevice.deviceCode,
        password: wipePassword,
      });
      if (!res.ok) {
        setWipeError(res.error || 'Senha incorreta.');
        return;
      }
      onNotify(`Ordem de limpeza total enviada para ${wipeTargetDevice.deviceCode}.`);
      setWipePassword('');
      setWipeTargetDevice(null);
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#020612] text-white overflow-y-auto sara-scroll p-3 sm:p-4 space-y-4">
      {/* Cabeçalho + Sub-Abas */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-cyan-500/25">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center">
            <User className="w-4 h-4 text-[#00E5FF]" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-white">
              PERFIL, APARELHOS & SEGUNDO PLANO
            </h2>
            <p className="text-[11px] text-slate-400">
              Identidade única, Meus Aparelhos, Achar Meu Celular e Núcleo SARA sempre ativo
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-[#071125] border border-cyan-500/35 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
          >
            Voltar ao Palco
          </button>
        )}
      </div>

      {/* Navegação das 3 sub-páginas */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setSubTab('perfil')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'perfil'
              ? 'bg-cyan-500/20 border-[#00E5FF] text-cyan-100'
              : 'bg-[#071125] border-cyan-500/25 text-slate-300 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Perfil & Aparelhos</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('achar_celular')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'achar_celular'
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
              : 'bg-[#071125] border-cyan-500/25 text-slate-300 hover:text-white'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Achar Meu Celular</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('segundo_plano')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'segundo_plano'
              ? 'bg-rose-500/20 border-[#FF2A4B] text-rose-100'
              : 'bg-[#071125] border-cyan-500/25 text-slate-300 hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Definições 2.º Plano</span>
        </button>
      </div>

      {session.isGuest && (
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/45 text-xs text-amber-200">
          Modo Convidado ativo: o rastreio de aparelhos e a partilha no mapa estão desativados. Cria conta para ter ID SARA e Achar Meu Celular.
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-ABA 1: PERFIL + ID SARA-XXXX + MEUS APARELHOS (CEL-XXXX)      */}
      {/* ================================================================= */}
      {subTab === 'perfil' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#071125] border border-cyan-500/35 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                Identidade Única SARA
              </div>
              <div className="text-base font-extrabold text-white">{session.fullName}</div>
              <div className="text-xs text-slate-400">
                Chamado por: <span className="text-cyan-200 font-semibold">{session.callName}</span> •{' '}
                {session.email}
              </div>
            </div>

            {!session.isGuest && (
              <div className="flex flex-col sm:items-end gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#030815] border border-[#00E5FF]/50">
                  <span className="text-xs font-mono text-slate-300">Identificador SARA:</span>
                  <span className="text-sm font-mono font-extrabold text-[#00E5FF]">
                    {session.saraId || 'SARA-0000'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySaraId}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-cyan-500/30"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>

                <div className="text-[11px] font-mono text-slate-300">
                  Este aparelho:{' '}
                  <span className="text-emerald-300 font-bold">
                    {session.deviceCode || 'CEL-0000'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Meus Aparelhos */}
          <div className="p-4 rounded-2xl bg-[#071125] border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-cyan-300 font-bold">
                  Meus Aparelhos ({devices.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Todos os telemóveis e computadores ligados nesta mesma conta
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('achar_celular')}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-bold cursor-pointer hover:bg-emerald-500/30"
              >
                Abrir Achar Meu Celular
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#030815] border border-cyan-500/20 text-xs text-slate-400 text-center">
                Nenhum aparelho registado ainda nesta conta.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {devices.map((dev) => {
                  const isCurrent = dev.deviceCode === session.deviceCode;
                  return (
                    <div
                      key={dev.deviceCode}
                      className={`p-3 rounded-xl bg-[#030815] border space-y-2 ${
                        isCurrent ? 'border-[#00E5FF]/60' : 'border-cyan-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {dev.platform === 'Telemóvel' ? (
                            <Smartphone className="w-5 h-5 text-[#00E5FF]" />
                          ) : (
                            <Laptop className="w-5 h-5 text-cyan-300" />
                          )}
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{dev.deviceName}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-[9px] font-mono text-cyan-200">
                                  ESTE APARELHO
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{dev.model}</div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            dev.online
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                          }`}
                        >
                          {dev.online ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-slate-300 pt-1 border-t border-cyan-500/15">
                        <div>
                          ID:{' '}
                          <span className="text-cyan-300 font-bold">{dev.deviceCode}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {dev.batteryCharging ? (
                            <BatteryCharging className="w-3 h-3 text-emerald-300" />
                          ) : (
                            <Battery className="w-3 h-3 text-cyan-300" />
                          )}
                          <span>
                            {dev.batteryPct !== null ? `${dev.batteryPct}%` : 'AC/N/D'}
                          </span>
                        </div>
                        <div className="text-right text-slate-400">
                          {formatTimeAgoPt(dev.lastUpdatedAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-ABA 2: ACHAR MEU CELULAR (MAPA GRANDE + COMANDOS REMOTOS)     */}
      {/* ================================================================= */}
      {subTab === 'achar_celular' && (
        <div className="space-y-4">
          {/* Painel de Controlo e Proteção do Aparelho Atual */}
          <div className="p-3.5 rounded-2xl bg-[#071125] border border-cyan-500/35 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-white">
                  Proteção & Envio Automático (a cada 5 minutos)
                </div>
                <div className="text-[11px] text-slate-400">
                  Mostra exclusivamente aparelhos da tua conta ({session.email})
                </div>
              </div>
              <button
                type="button"
                disabled={refreshingPos || session.isGuest}
                onClick={async () => {
                  setRefreshingPos(true);
                  await onRefreshDeviceNow();
                  setRefreshingPos(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-cyan-500/30 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingPos ? 'animate-spin' : ''}`} />
                <span>Atualizar Posição Agora</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <label className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/20 flex items-center justify-between gap-2 cursor-pointer">
                <span>Achar Meu Celular Ativo</span>
                <input
                  type="checkbox"
                  checked={bgSettings.findPhoneEnabled}
                  onChange={(e) => onUpdateBgSettings({ findPhoneEnabled: e.target.checked })}
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/20 flex items-center justify-between gap-2 cursor-pointer">
                <span>Última Localização com Bateria Fraca (&lt;10%)</span>
                <input
                  type="checkbox"
                  checked={bgSettings.lowBatteryAutoLocate}
                  onChange={(e) => onUpdateBgSettings({ lowBatteryAutoLocate: e.target.checked })}
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/20 flex items-center justify-between gap-2 cursor-pointer">
                <span>SMS de Socorro (1h offline)</span>
                <input
                  type="checkbox"
                  checked={bgSettings.sosSmsEnabled}
                  onChange={(e) => onUpdateBgSettings({ sosSmsEnabled: e.target.checked })}
                  className="accent-rose-400 w-4 h-4"
                />
              </label>
            </div>

            {bgSettings.sosSmsEnabled && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                <span className="text-[11px] text-rose-200 font-semibold whitespace-nowrap">
                  Número de confiança para SMS de Socorro:
                </span>
                <input
                  type="tel"
                  value={bgSettings.sosPhoneNumber}
                  onChange={(e) => onUpdateBgSettings({ sosPhoneNumber: e.target.value })}
                  placeholder="Ex: +258841234567"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#030815] border border-rose-500/40 text-xs text-white focus:outline-none focus:border-rose-400"
                />
              </div>
            )}
          </div>

          {/* Mapa Grande no PC e Telemóvel com todos os aparelhos reais da conta */}
          <GoogleMapsWrapper>
            <GoogleSaraMapView
              centerLat={mapCenter.lat}
              centerLng={mapCenter.lng}
              zoom={14}
              viewMode="roadmap"
              markers={findPhoneMarkers}
              showPlacesSearch={false}
              heightClassName="h-[340px] sm:h-[400px] lg:h-[470px]"
              emptyNotice="A aguardar primeira posição GPS real de um dos teus aparelhos. Toca em Atualizar Posição Agora."
              onRecenterMyLocation={() => {
                void onRefreshDeviceNow();
              }}
            />
          </GoogleMapsWrapper>

          {/* Cartões dos Aparelhos com 3 botões: Tocar Alarme, Bloquear com Mensagem, Apagar Tudo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {findPhoneDevices.map((dev) => (
              <div
                key={dev.deviceCode}
                className="p-3.5 rounded-2xl bg-[#071125] border border-cyan-500/30 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <span>{dev.deviceName}</span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-mono text-cyan-200">
                        {dev.deviceCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{dev.model}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      dev.online
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                    }`}
                  >
                    {dev.online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <div className="text-xs text-slate-300 space-y-0.5">
                  <div>
                    Estado:{' '}
                    {dev.online ? (
                      <span className="text-emerald-300 font-semibold">
                        Ativo ({formatTimeAgoPt(dev.lastUpdatedAt)})
                      </span>
                    ) : (
                      <span className="text-rose-300 font-semibold">
                        Última localização {formatTimeAgoPt(dev.lastUpdatedAt)}
                      </span>
                    )}
                  </div>
                  <div>
                    Bateria:{' '}
                    <span className="font-mono text-cyan-200 font-bold">
                      {dev.batteryPct !== null ? `${dev.batteryPct}%` : 'AC / Sem sensor'}
                    </span>
                    {dev.lastLat !== null && dev.lastLng !== null && (
                      <span className="ml-2 text-slate-400 font-mono text-[11px]">
                        ({dev.lastLat.toFixed(4)}, {dev.lastLng.toFixed(4)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={actionBusyId === dev.deviceCode}
                    onClick={() => void handleRingDevice(dev)}
                    className="py-2 px-2 rounded-xl bg-amber-500/20 border border-amber-400/60 text-amber-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-amber-500/30"
                  >
                    <Volume2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Tocar Alarme</span>
                  </button>

                  <button
                    type="button"
                    disabled={actionBusyId === dev.deviceCode}
                    onClick={() => {
                      setLockTargetDevice(dev);
                      setLockPhone(bgSettings.sosPhoneNumber || '');
                    }}
                    className="py-2 px-2 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-100 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-cyan-500/30"
                  >
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Bloquear com Mensagem</span>
                  </button>

                  <button
                    type="button"
                    disabled={actionBusyId === dev.deviceCode}
                    onClick={() => {
                      setWipeTargetDevice(dev);
                      setWipePassword('');
                      setWipeError('');
                    }}
                    className="py-2 px-2 rounded-xl bg-rose-500/20 border border-rose-500/60 text-rose-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-rose-500/30"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Apagar Tudo</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-ABA 3: SEGUNDO PLANO (CELULAR + PC) + EI SARA + LEMBRETES     */}
      {/* ================================================================= */}
      {subTab === 'segundo_plano' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#071125] border border-cyan-500/35 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Segundo Plano — A SARA Nunca Dorme (Celular e PC)
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 max-w-2xl">
                  Para o serviço Achar Meu Celular enviar posição a cada 5 minutos e os lembretes funcionarem mesmo quando sais da app ou bloqueias o ecrã, é necessário permitir localização e execução em segundo plano.
                </p>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold ${
                  bgSettings.backgroundAllowed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                    : 'bg-slate-800 text-slate-300 border border-slate-600'
                }`}
              >
                {bgSettings.backgroundAllowed ? '2.º PLANO ATIVO' : '2.º PLANO PARADO'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void onPermitBackground()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-emerald-400 text-[#020612] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer hover:opacity-95"
              >
                <Radio className="w-4 h-4" />
                <span>Permitir Segundo Plano</span>
              </button>

              <button
                type="button"
                onClick={() => void onStopBackground()}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/30"
              >
                <Power className="w-4 h-4" />
                <span>Parar Segundo Plano</span>
              </button>

              <span className="text-[11px] text-slate-400">
                Notificações:{' '}
                <strong className="text-cyan-200">
                  {notificationPermission === 'granted'
                    ? 'Permitidas'
                    : notificationPermission === 'denied'
                    ? 'Bloqueadas no navegador'
                    : 'Pendentes'}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-cyan-500/20 text-xs">
              <label className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/20 flex items-center justify-between gap-2 cursor-pointer">
                <span>Comando por voz &ldquo;Ei SARA&rdquo;</span>
                <input
                  type="checkbox"
                  checked={bgSettings.eiSaraEnabled}
                  onChange={(e) => onUpdateBgSettings({ eiSaraEnabled: e.target.checked })}
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/20 flex items-center justify-between gap-2 cursor-pointer">
                <span>Modo Voz Contínua em segundo plano</span>
                <input
                  type="checkbox"
                  checked={bgSettings.continuousVoiceBg}
                  onChange={(e) => onUpdateBgSettings({ continuousVoiceBg: e.target.checked })}
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/20 flex items-center justify-between gap-2 cursor-pointer">
                <span>Notificação Persistente (&ldquo;SARA está a ouvir&rdquo;)</span>
                <input
                  type="checkbox"
                  checked={bgSettings.persistentNotification}
                  onChange={(e) => onUpdateBgSettings({ persistentNotification: e.target.checked })}
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/20 flex items-center justify-between gap-2 cursor-pointer">
                <span>Bolha Flutuante da SARA</span>
                <input
                  type="checkbox"
                  checked={bgSettings.floatingBubbleEnabled}
                  onChange={(e) => onUpdateBgSettings({ floatingBubbleEnabled: e.target.checked })}
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>

              <label className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/20 flex items-center justify-between gap-2 cursor-pointer sm:col-span-2">
                <span>Mini-janela no canto inferior direito no PC (e atalho CTRL + ESPAÇO)</span>
                <input
                  type="checkbox"
                  checked={bgSettings.pcMiniWindowEnabled}
                  onChange={(e) => onUpdateBgSettings({ pcMiniWindowEnabled: e.target.checked })}
                  className="accent-cyan-400 w-4 h-4"
                />
              </label>
            </div>
          </div>

          {/* Lembretes Agendados em Segundo Plano */}
          <div className="p-4 rounded-2xl bg-[#071125] border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-300 font-bold">
              <BellRing className="w-4 h-4" />
              <span>Lembretes em Segundo Plano ({reminders.filter((r) => !r.fired).length})</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Podes dizer por voz ou no chat: &ldquo;SARA lembra-me às 17h&rdquo; ou &ldquo;SARA lembra-me daqui a 10 minutos&rdquo;. Toca alarme, mostra notificação e fala na hora marcada.
            </p>
            {reminders.length === 0 ? (
              <div className="p-3 rounded-xl bg-[#030815] border border-cyan-500/20 text-xs text-slate-400">
                Sem lembretes agendados no momento.
              </div>
            ) : (
              <div className="space-y-1.5">
                {reminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/20 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      <span className={`truncate ${rem.fired ? 'line-through text-slate-500' : 'text-white font-semibold'}`}>
                        {rem.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-cyan-300">
                        {rem.dateIso} • {rem.timeHHmm}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteReminder(rem.id)}
                        className="text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="Remover lembrete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Bloquear com Mensagem */}
      {lockTargetDevice && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmLock}
            className="w-full max-w-md rounded-2xl bg-[#071126] border border-cyan-400/60 p-5 space-y-3 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-cyan-200 font-bold text-sm">
              <MessageSquareWarning className="w-4 h-4 text-[#00E5FF]" />
              <span>Bloquear {lockTargetDevice.deviceName} ({lockTargetDevice.deviceCode})</span>
            </div>
            <p className="text-xs text-slate-300">
              O ecrã do aparelho será bloqueado exibindo esta mensagem e número de contacto:
            </p>
            <textarea
              value={lockMessage}
              onChange={(e) => setLockMessage(e.target.value)}
              rows={3}
              required
              className="w-full p-2.5 rounded-xl bg-[#030815] border border-cyan-500/35 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
              placeholder="Mensagem para mostrar no ecrã..."
            />
            <input
              type="tel"
              value={lockPhone}
              onChange={(e) => setLockPhone(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#030815] border border-cyan-500/35 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
              placeholder="Número de telefone para contacto (ex: +25884...)"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLockTargetDevice(null)}
                className="px-3.5 py-2 rounded-xl bg-[#030815] border border-slate-600 text-xs text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-500 text-[#020612] text-xs font-extrabold cursor-pointer"
              >
                Bloquear Agora
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Apagar Tudo (exige confirmação de senha da conta!) */}
      {wipeTargetDevice && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmWipe}
            className="w-full max-w-md rounded-2xl bg-[#11060D] border border-rose-500/70 p-5 space-y-3 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-rose-200 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>Apagar Tudo — {wipeTargetDevice.deviceName} ({wipeTargetDevice.deviceCode})</span>
            </div>
            <p className="text-xs text-rose-100/85">
              Esta ação limpa os dados da Memória da SARA e termina a sessão no aparelho selecionado. Insere a tua senha da conta para confirmar:
            </p>
            <input
              type="password"
              value={wipePassword}
              onChange={(e) => setWipePassword(e.target.value)}
              required
              autoFocus
              className="w-full p-2.5 rounded-xl bg-[#050811] border border-rose-500/50 text-xs text-white focus:outline-none focus:border-rose-400"
              placeholder="Senha da tua conta SARA..."
            />
            {wipeError && <div className="text-xs text-rose-300 font-semibold">{wipeError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setWipeTargetDevice(null)}
                className="px-3.5 py-2 rounded-xl bg-[#050811] border border-slate-600 text-xs text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer"
              >
                Confirmar Limpeza Total
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
