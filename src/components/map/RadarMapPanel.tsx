import React, { useMemo, useState } from 'react';
import {
  MapPin,
  Search,
  Ghost,
  ShieldOff,
  Radio,
  Navigation,
  Utensils,
  Cross,
  Landmark,
  Bus,
  Store,
  Compass,
  Clock,
  Check,
  X,
  Loader2,
  UserPlus,
} from 'lucide-react';
import type { SaraSession } from '../../types/auth';
import type {
  LocationRequestItem,
  OsmPoiCategory,
  OsmPoiItem,
  SharedPeerLocation,
} from '../../types/location';
import {
  fetchNearbyOsmPois,
  formatDistancePt,
  formatRemainingTimePt,
  lookupUserCardBySaraId,
  requestCurrentCoordinates,
  respondToLocationRequest,
  sendLocationRequest,
  stopSingleShare,
} from '../../services/locationRadarService';
import { OsmMapView, type OsmMapMarker } from './OsmMapView';

// Coordenadas padrão de referência caso GPS ainda esteja a obter sinal
const DEFAULT_CENTER_LAT = -23.865;
const DEFAULT_CENTER_LNG = 35.383;

interface RadarMapPanelProps {
  session: SaraSession;
  appearOnMap: boolean;
  ghostMode: boolean;
  myCoords: { lat: number; lng: number; accuracyM?: number | null } | null;
  incomingPending: LocationRequestItem[];
  outgoingGrants: LocationRequestItem[];
  sharedPeers: SharedPeerLocation[];
  onToggleAppearOnMap: () => void;
  onActivateGhostMode: () => void;
  onStopSharingAll: () => void;
  onUpdateMyCoords: (coords: { lat: number; lng: number; accuracyM?: number | null }) => void;
  onNotify: (msg: string) => void;
  onClose?: () => void;
}

const POI_FILTERS: Array<{ id: OsmPoiCategory; label: string; icon: React.ReactNode }> = [
  { id: 'perto', label: 'Perto de Mim', icon: <Compass className="w-3.5 h-3.5" /> },
  { id: 'comida', label: 'Comida', icon: <Utensils className="w-3.5 h-3.5" /> },
  { id: 'farmacia', label: 'Farmácia', icon: <Cross className="w-3.5 h-3.5" /> },
  { id: 'atm', label: 'ATM', icon: <Landmark className="w-3.5 h-3.5" /> },
  { id: 'chapa', label: 'Chapa', icon: <Bus className="w-3.5 h-3.5" /> },
  { id: 'negocios', label: 'Negócios', icon: <Store className="w-3.5 h-3.5" /> },
];

export const RadarMapPanel: React.FC<RadarMapPanelProps> = ({
  session,
  appearOnMap,
  ghostMode,
  myCoords,
  incomingPending,
  outgoingGrants,
  sharedPeers,
  onToggleAppearOnMap,
  onActivateGhostMode,
  onStopSharingAll,
  onUpdateMyCoords,
  onNotify,
  onClose,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchCard, setSearchCard] = useState<{
    saraId: string;
    uid: string;
    callName: string;
  } | null>(null);
  const [searchFeedback, setSearchFeedback] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);

  const [activePoiCategory, setActivePoiCategory] = useState<OsmPoiCategory | null>(null);
  const [poiItems, setPoiItems] = useState<OsmPoiItem[]>([]);
  const [poiLoading, setPoiLoading] = useState(false);

  const handleSearchSaraId = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = searchInput.trim();
    if (!raw) return;
    setIsSearching(true);
    setSearchFeedback('');
    setSearchCard(null);
    try {
      const card = await lookupUserCardBySaraId(raw, session);
      if (!card) {
        setSearchFeedback('Nenhuma conta encontrada com esse ID SARA.');
      } else {
        setSearchCard(card);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchCard) return;
    if (session.isGuest) {
      onNotify('Modo Convidado não permite pedir localização.');
      return;
    }
    setRequestBusy(true);
    try {
      await sendLocationRequest(session, searchCard);
      onNotify(`Pedido enviado para ${searchCard.callName} (${searchCard.saraId}). A aguardar aceitação.`);
      setSearchFeedback('Pedido enviado! A localização só aparece se a pessoa aceitar.');
    } catch (err: any) {
      setSearchFeedback(err?.message || 'Não foi possível enviar o pedido.');
    } finally {
      setRequestBusy(false);
    }
  };

  const handleFilterPoi = async (cat: OsmPoiCategory) => {
    if (activePoiCategory === cat) {
      setActivePoiCategory(null);
      setPoiItems([]);
      return;
    }
    setActivePoiCategory(cat);
    setPoiLoading(true);
    try {
      let coords = myCoords;
      if (!coords) {
        const fresh = await requestCurrentCoordinates(true, 9000);
        if (fresh) {
          coords = fresh;
          onUpdateMyCoords(fresh);
        }
      }
      const centerLat = coords?.lat ?? DEFAULT_CENTER_LAT;
      const centerLng = coords?.lng ?? DEFAULT_CENTER_LNG;
      const list = await fetchNearbyOsmPois(centerLat, centerLng, cat);
      setPoiItems(list);
      if (list.length === 0) {
        onNotify('Sem locais encontrados nesta zona no momento.');
      }
    } finally {
      setPoiLoading(false);
    }
  };

  // O mapa começa vazio (markers = []) se ninguém aceitou, o utilizador está desligado e sem filtros ativos
  const mapMarkers = useMemo<OsmMapMarker[]>(() => {
    const list: OsmMapMarker[] = [];

    if (appearOnMap && !ghostMode && myCoords) {
      list.push({
        id: 'self_me',
        lat: myCoords.lat,
        lng: myCoords.lng,
        title: `${session.callName} (Tu)`,
        subtitle: `ID: ${session.saraId || 'SARA'} • Visível agora`,
        badge: 'Tu (AGORA)',
        tone: 'self',
      });
    }

    for (const peer of sharedPeers) {
      list.push({
        id: `peer_${peer.saraId}`,
        lat: peer.lat,
        lng: peer.lng,
        title: `${peer.callName} (${peer.saraId})`,
        subtitle:
          peer.distanceMeters !== null
            ? `Distância: ${formatDistancePt(peer.distanceMeters)} • Expira em ${formatRemainingTimePt(peer.expiresAt)}`
            : `Expira em ${formatRemainingTimePt(peer.expiresAt)}`,
        badge:
          peer.distanceMeters !== null
            ? `${peer.callName} • ${formatDistancePt(peer.distanceMeters)}`
            : peer.callName,
        tone: 'peer',
      });
    }

    for (const poi of poiItems) {
      list.push({
        id: poi.id,
        lat: poi.lat,
        lng: poi.lng,
        title: poi.name,
        subtitle: `${poi.categoryLabel} • ${formatDistancePt(poi.distanceMeters)}${
          poi.address ? ` • ${poi.address}` : ''
        }`,
        badge: `${poi.name.slice(0, 14)} (${formatDistancePt(poi.distanceMeters)})`,
        tone: 'poi',
      });
    }

    return list;
  }, [appearOnMap, ghostMode, myCoords, sharedPeers, poiItems, session.callName, session.saraId]);

  const mapCenter = useMemo(() => {
    if (sharedPeers.length > 0) {
      return { lat: sharedPeers[0].lat, lng: sharedPeers[0].lng };
    }
    if (appearOnMap && !ghostMode && myCoords) {
      return { lat: myCoords.lat, lng: myCoords.lng };
    }
    if (poiItems.length > 0 && myCoords) {
      return { lat: myCoords.lat, lng: myCoords.lng };
    }
    return {
      lat: myCoords?.lat ?? DEFAULT_CENTER_LAT,
      lng: myCoords?.lng ?? DEFAULT_CENTER_LNG,
    };
  }, [sharedPeers, appearOnMap, ghostMode, myCoords, poiItems.length]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#020612] text-white overflow-y-auto sara-scroll p-3 sm:p-4 space-y-3">
      {/* Cabeçalho + Pesquisa por ID SARA */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-cyan-500/25">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-[#00E5FF]" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-white">
              MAPA // RADAR SARA
            </h2>
            <p className="text-[11px] text-slate-400">
              Privacidade total • Apenas localização em tempo real (sem histórico)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session.saraId && (
            <span className="px-2.5 py-1 rounded-lg bg-[#071125] border border-cyan-500/35 text-[11px] font-mono text-cyan-200">
              Meu ID: <strong className="text-[#00E5FF]">{session.saraId}</strong>
            </span>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg bg-[#071125] border border-cyan-500/30 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Voltar ao Palco
            </button>
          )}
        </div>
      </div>

      {/* Barra de pesquisa no topo: "Pesquisar por ID SARA..." */}
      <form onSubmit={handleSearchSaraId} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            placeholder="Pesquisar por ID SARA..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#071125] border border-cyan-500/35 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#00E5FF]"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-xs font-bold hover:bg-cyan-500/30 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span>Pesquisar</span>
        </button>
      </form>

      {/* Cartão encontrado (NUNCA mostra coordenadas diretamente — apenas botão Pedir Localização) */}
      {(searchCard || searchFeedback) && (
        <div className="p-3 rounded-2xl bg-[#071126] border border-cyan-500/40 flex flex-wrap items-center justify-between gap-3">
          {searchCard ? (
            <>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{searchCard.callName}</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-mono text-cyan-200">
                    {searchCard.saraId}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {searchFeedback || 'Localização protegida. Envia um pedido para visualizar no mapa.'}
                </div>
              </div>
              {searchCard.saraId !== session.saraId && (
                <button
                  type="button"
                  onClick={() => void handleSendRequest()}
                  disabled={requestBusy}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-emerald-400 text-[#020612] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer hover:opacity-95 disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{requestBusy ? 'A enviar...' : 'Pedir Localização'}</span>
                </button>
              )}
            </>
          ) : (
            <span className="text-xs text-amber-300">{searchFeedback}</span>
          )}
        </div>
      )}

      {/* Pedidos de Localização recebidos: "Aceitar por 30min / 1h / Recusar" */}
      {incomingPending.length > 0 && (
        <div className="space-y-2">
          {incomingPending.map((req) => (
            <div
              key={req.id}
              className="p-3 rounded-2xl bg-[#091834] border border-[#00E5FF]/60 shadow-[0_0_20px_rgba(0,229,255,0.2)] flex flex-wrap items-center justify-between gap-2.5"
            >
              <div>
                <div className="text-xs font-bold text-white">
                  {req.fromCallName} ({req.fromSaraId}) pediu a tua localização
                </div>
                <div className="text-[11px] text-cyan-200/80">
                  Escolhe se queres partilhar em tempo real ou recusar.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    await respondToLocationRequest(req, '30m');
                    onNotify(`Partilha com ${req.fromCallName} aceite por 30min.`);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/30"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aceitar por 30min</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await respondToLocationRequest(req, '1h');
                    onNotify(`Partilha com ${req.fromCallName} aceite por 1h.`);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-cyan-500/30"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Aceitar por 1h</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await respondToLocationRequest(req, 'decline');
                    onNotify('Pedido recusado.');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/60 text-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-500/30"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Recusar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botão Grande Principal + Controlo Rápido de Desaparecer */}
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr] gap-2">
        <button
          type="button"
          onClick={onToggleAppearOnMap}
          className={`py-3 px-4 rounded-2xl border text-xs sm:text-sm font-extrabold tracking-wide flex items-center justify-center gap-2 transition cursor-pointer ${
            appearOnMap && !ghostMode
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              : 'bg-[#071126] border-cyan-500/35 text-slate-200 hover:border-cyan-400'
          }`}
        >
          <Radio className={`w-4 h-4 ${appearOnMap && !ghostMode ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
          <span>
            Aparecer no Mapa - {appearOnMap && !ghostMode ? 'LIGADO' : 'DESLIGADO'}
          </span>
        </button>

        <button
          type="button"
          onClick={onStopSharingAll}
          className="py-3 px-3 rounded-2xl bg-rose-500/15 border border-rose-500/45 text-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-rose-500/25 cursor-pointer"
        >
          <ShieldOff className="w-4 h-4" />
          <span>Parar de Partilhar</span>
        </button>

        <button
          type="button"
          onClick={onActivateGhostMode}
          className={`py-3 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
            ghostMode
              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
              : 'bg-[#071126] border-cyan-500/30 text-cyan-200 hover:border-amber-400/60'
          }`}
        >
          <Ghost className="w-4 h-4" />
          <span>Modo Fantasma</span>
        </button>
      </div>

      {/* Filtros do Mapa OpenStreetMap */}
      <div className="flex flex-wrap items-center gap-1.5">
        {POI_FILTERS.map((f) => {
          const active = activePoiCategory === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => void handleFilterPoi(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                active
                  ? 'bg-cyan-500/25 border-[#00E5FF] text-cyan-100 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                  : 'bg-[#071125] border-cyan-500/25 text-slate-300 hover:text-white hover:border-cyan-400/50'
              }`}
            >
              {f.icon}
              <span>{f.label}</span>
            </button>
          );
        })}
        {poiLoading && <Loader2 className="w-4 h-4 text-cyan-300 animate-spin ml-1" />}
      </div>

      {/* Mapa OpenStreetMap */}
      <div className="relative">
        <OsmMapView
          centerLat={mapCenter.lat}
          centerLng={mapCenter.lng}
          zoom={14}
          markers={mapMarkers}
          heightClassName="h-[320px] sm:h-[380px] lg:h-[420px]"
        />
        {mapMarkers.length === 0 && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl bg-[#030815]/90 border border-cyan-500/35 text-[11px] text-cyan-100 flex items-center justify-between">
            <span>
              Mapa vazio e privado. Liga &ldquo;Aparecer no Mapa&rdquo;, pede um ID SARA ou escolhe um filtro acima.
            </span>
          </div>
        )}
      </div>

      {/* Lista ao vivo de pessoas aceites + partilhas ativas */}
      {(sharedPeers.length > 0 || outgoingGrants.length > 0 || poiItems.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sharedPeers.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#071125] border border-emerald-500/35 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-emerald-300 font-bold flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" />
                <span>Pessoas Visíveis Agora ({sharedPeers.length})</span>
              </div>
              {sharedPeers.map((peer) => (
                <div
                  key={peer.saraId}
                  className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/25 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-white">
                      {peer.callName}{' '}
                      <span className="font-mono text-[10px] text-cyan-300">({peer.saraId})</span>
                    </div>
                    <div className="text-[11px] text-emerald-300">
                      Distância: {formatDistancePt(peer.distanceMeters)} • Expira em{' '}
                      {formatRemainingTimePt(peer.expiresAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {outgoingGrants.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#071125] border border-cyan-500/35 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-300 font-bold">
                Quem Vê a Tua Localização ({outgoingGrants.length})
              </div>
              {outgoingGrants.map((grant) => (
                <div
                  key={grant.id}
                  className="p-2.5 rounded-xl bg-[#030815] border border-cyan-500/25 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-white">
                      {grant.fromCallName} ({grant.fromSaraId})
                    </div>
                    <div className="text-[11px] text-cyan-300">
                      Restam {formatRemainingTimePt(grant.expiresAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void stopSingleShare(grant)}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 text-[11px] font-bold cursor-pointer hover:bg-rose-500/30"
                  >
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          )}

          {poiItems.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#071125] border border-amber-500/35 space-y-2 lg:col-span-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-amber-300 font-bold">
                Locais OpenStreetMap ({poiItems.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {poiItems.slice(0, 9).map((poi) => (
                  <div
                    key={poi.id}
                    className="p-2.5 rounded-xl bg-[#030815] border border-amber-500/25 text-xs"
                  >
                    <div className="font-bold text-white truncate">{poi.name}</div>
                    <div className="text-[11px] text-amber-300 font-mono">
                      {formatDistancePt(poi.distanceMeters)} • {poi.categoryLabel}
                    </div>
                    {poi.address && (
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{poi.address}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
