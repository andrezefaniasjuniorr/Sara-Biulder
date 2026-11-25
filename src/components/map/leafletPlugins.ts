import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

// Expõe L globalmente antes de carregar plugins UMD como leaflet-routing-machine
if (typeof window !== 'undefined') {
  (window as unknown as { L: typeof L }).L = L;
}

export { MarkerClusterGroup, MarkerCluster } from 'leaflet.markercluster';
export { Geocoder as GeocoderControl, geocoder, geocoders } from 'leaflet-control-geocoder';
export { HeatLayer } from 'leaflet.heat';

let routingLoaded = false;

export async function ensureLeafletRoutingMachine(): Promise<typeof L.Routing | null> {
  if (typeof window === 'undefined') return null;
  (window as unknown as { L: typeof L }).L = L;
  if (!routingLoaded && !L.Routing) {
    await import('leaflet-routing-machine');
    routingLoaded = true;
  }
  return L.Routing || null;
}

export { L };
