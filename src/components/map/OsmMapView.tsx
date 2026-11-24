import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface OsmMapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  badge?: string;
  tone: 'self' | 'peer' | 'poi' | 'device_online' | 'device_offline';
}

interface OsmMapViewProps {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  markers: OsmMapMarker[];
  heightClassName?: string;
  onSelectMarker?: (markerId: string) => void;
}

function buildMarkerPinHtml(tone: OsmMapMarker['tone'], label: string): string {
  const palette: Record<OsmMapMarker['tone'], { bg: string; ring: string; text: string }> = {
    self: { bg: '#00E5FF', ring: 'rgba(0,229,255,0.4)', text: '#020612' },
    peer: { bg: '#10B981', ring: 'rgba(16,185,129,0.45)', text: '#020612' },
    poi: { bg: '#F59E0B', ring: 'rgba(245,158,11,0.4)', text: '#020612' },
    device_online: { bg: '#00E5FF', ring: 'rgba(0,229,255,0.45)', text: '#020612' },
    device_offline: { bg: '#FF2A4B', ring: 'rgba(255,42,75,0.4)', text: '#FFFFFF' },
  };
  const p = palette[tone] || palette.self;
  const safeLabel = label
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 18);

  return `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
      <div style="padding:2px 7px;border-radius:999px;background:${p.bg};color:${p.text};font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 0 12px ${p.ring};border:1px solid #040916;">
        ${safeLabel}
      </div>
      <div style="width:10px;height:10px;border-radius:999px;background:${p.bg};border:2px solid #FFFFFF;margin-top:2px;box-shadow:0 0 10px ${p.ring};"></div>
    </div>
  `;
}

export const OsmMapView: React.FC<OsmMapViewProps> = ({
  centerLat,
  centerLng,
  zoom = 14,
  markers,
  heightClassName = 'h-[340px]',
  onSelectMarker,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [centerLat, centerLng],
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const validMarkers = markers.filter(
      (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)
    );

    for (const m of validMarkers) {
      const icon = L.divIcon({
        className: 'sara-osm-marker',
        html: buildMarkerPinHtml(m.tone, m.badge || m.title),
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(group);

      const popupEl = document.createElement('div');
      popupEl.className = 'text-xs text-slate-900 space-y-0.5';
      const titleEl = document.createElement('div');
      titleEl.className = 'font-bold';
      titleEl.textContent = m.title;
      popupEl.appendChild(titleEl);
      if (m.subtitle) {
        const subEl = document.createElement('div');
        subEl.className = 'text-[11px] text-slate-600';
        subEl.textContent = m.subtitle;
        popupEl.appendChild(subEl);
      }

      marker.bindPopup(popupEl);
      if (onSelectMarker) {
        marker.on('click', () => onSelectMarker(m.id));
      }
    }

    if (validMarkers.length > 1) {
      const bounds = L.latLngBounds(validMarkers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.25), { maxZoom: 16 });
    } else if (validMarkers.length === 1) {
      map.setView([validMarkers[0].lat, validMarkers[0].lng], Math.max(zoom, 14));
    } else {
      map.setView([centerLat, centerLng], zoom);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 80);
  }, [markers, centerLat, centerLng, zoom, onSelectMarker]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-cyan-500/35 bg-[#030815]">
      <div ref={containerRef} className={`w-full ${heightClassName} z-0`} />
    </div>
  );
};
