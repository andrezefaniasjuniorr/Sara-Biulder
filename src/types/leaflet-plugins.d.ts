import type * as L from 'leaflet';

declare module 'leaflet' {
  namespace Routing {
    interface Waypoint {
      latLng: L.LatLng;
      name?: string;
    }

    interface RouteSummary {
      totalDistance: number;
      totalTime: number;
    }

    interface Route {
      name?: string;
      coordinates?: L.LatLng[];
      summary?: RouteSummary;
    }

    interface RoutesFoundEvent {
      routes: Route[];
    }

    interface OSRMv1Options {
      serviceUrl?: string;
      profile?: string;
      timeout?: number;
    }

    function osrmv1(options?: OSRMv1Options): unknown;

    interface RoutingControlOptions {
      waypoints?: L.LatLng[];
      router?: unknown;
      routeWhileDragging?: boolean;
      addWaypoints?: boolean;
      draggableWaypoints?: boolean;
      fitSelectedRoutes?: boolean;
      showAlternatives?: boolean;
      show?: boolean;
      collapsible?: boolean;
      lineOptions?: {
        styles?: L.PathOptions[];
        extendToWaypoints?: boolean;
        missingRouteTolerance?: number;
      };
      createMarker?: () => L.Marker | null;
    }

    interface RoutingControl extends L.Control {
      setWaypoints(waypoints: L.LatLng[]): this;
      on(type: 'routesfound', fn: (ev: RoutesFoundEvent) => void): this;
      on(type: 'routingerror', fn: (ev: unknown) => void): this;
    }

    function control(options?: RoutingControlOptions): RoutingControl;
  }
}
