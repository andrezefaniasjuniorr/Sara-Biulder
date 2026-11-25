// Motor de Geocoding & Rotas Abertas focado em Moçambique (Nominatim + Photon + OSRM)
// Zero chaves pagas, zero dependências Node built-in (compatível com Node, Vercel e Cloudflare Edge)

const MZ_BOUNDS = {
  minLat: -26.95,
  maxLat: -10.35,
  minLng: 30.15,
  maxLng: 41.05,
};

// Bounding box prioritário Maputo + Matola
const MAPUTO_MATOLA_VIEWBOX = '32.30,-26.15,32.78,-25.75';

function isInsideMozambiqueBounds(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= MZ_BOUNDS.minLat &&
    lat <= MZ_BOUNDS.maxLat &&
    lng >= MZ_BOUNDS.minLng &&
    lng <= MZ_BOUNDS.maxLng
  );
}

export async function reverseGeocodeMozambique(lat, lng) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'pt');

    const geoRes = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'SARA-OS-Radar/2.0 (Nucleo SARA Open Map)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!geoRes.ok) {
      return {
        formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        street: '',
        neighborhood: '',
        city: '',
        country: '',
      };
    }

    const data = await geoRes.json();
    const addr = data?.address || {};
    const street = [
      addr.road || addr.pedestrian || addr.footway || addr.path || addr.cycleway || '',
      addr.house_number || '',
    ]
      .filter(Boolean)
      .join(', ');
    const neighborhood =
      addr.suburb ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.city_district ||
      addr.residential ||
      addr.hamlet ||
      '';
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      addr.state ||
      '';
    const country = addr.country || '';
    const compactParts = [street, neighborhood, city, country].filter(Boolean);

    return {
      formattedAddress:
        compactParts.length > 0
          ? compactParts.join(', ')
          : data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      street,
      neighborhood,
      city,
      country,
    };
  } catch {
    clearTimeout(timer);
    return {
      formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      street: '',
      neighborhood: '',
      city: '',
      country: '',
    };
  }
}

export async function searchPlacesMozambique(rawQuery, lat, lng) {
  const query = String(rawQuery || '').trim();
  if (query.length < 2 || query.length > 160) {
    return { results: [], notFoundMessage: '' };
  }

  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const biasLat = hasCoords && isInsideMozambiqueBounds(lat, lng) ? lat : -25.9692;
  const biasLng = hasCoords && isInsideMozambiqueBounds(lat, lng) ? lng : 32.5732;

  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
  nominatimUrl.searchParams.set('format', 'jsonv2');
  nominatimUrl.searchParams.set('q', query);
  nominatimUrl.searchParams.set('countrycodes', 'mz');
  nominatimUrl.searchParams.set('addressdetails', '1');
  nominatimUrl.searchParams.set('accept-language', 'pt');
  nominatimUrl.searchParams.set('limit', '8');
  if (hasCoords && isInsideMozambiqueBounds(lat, lng)) {
    nominatimUrl.searchParams.set(
      'viewbox',
      `${(lng - 0.35).toFixed(4)},${(lat + 0.35).toFixed(4)},${(lng + 0.35).toFixed(4)},${(lat - 0.35).toFixed(4)}`
    );
    nominatimUrl.searchParams.set('bounded', '0');
  } else {
    nominatimUrl.searchParams.set('viewbox', MAPUTO_MATOLA_VIEWBOX);
    nominatimUrl.searchParams.set('bounded', '0');
  }

  const photonUrl = new URL('https://photon.komoot.io/api/');
  photonUrl.searchParams.set('q', query);
  photonUrl.searchParams.set('lat', String(biasLat));
  photonUrl.searchParams.set('lon', String(biasLng));
  photonUrl.searchParams.set('limit', '10');
  photonUrl.searchParams.set('lang', 'en');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);

  const [nomRes, phoRes] = await Promise.allSettled([
    fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'SARA-OS-Radar/2.0 (Nucleo SARA Open Map)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    }).then((r) => (r.ok ? r.json() : [])),
    fetch(photonUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).then((r) => (r.ok ? r.json() : { features: [] })),
  ]);
  clearTimeout(timer);

  const collected = [];

  if (nomRes.status === 'fulfilled' && Array.isArray(nomRes.value)) {
    nomRes.value.forEach((item, idx) => {
      const rLat = Number(item?.lat);
      const rLng = Number(item?.lon);
      if (!isInsideMozambiqueBounds(rLat, rLng)) return;
      const addr = item.address || {};
      const shortName =
        item.name ||
        addr.road ||
        addr.suburb ||
        addr.neighbourhood ||
        (item.display_name ? item.display_name.split(',')[0] : query);
      collected.push({
        id: String(item.place_id || `nom_${idx}_${Date.now()}`),
        name: String(shortName || query).trim(),
        address: item.display_name || undefined,
        lat: rLat,
        lng: rLng,
        categoryLabel: item.type || item.category || undefined,
      });
    });
  }

  if (phoRes.status === 'fulfilled' && Array.isArray(phoRes.value?.features)) {
    phoRes.value.features.forEach((feat, idx) => {
      const coords = feat?.geometry?.coordinates;
      const props = feat?.properties || {};
      if (!Array.isArray(coords) || coords.length < 2) return;
      const rLng = Number(coords[0]);
      const rLat = Number(coords[1]);
      const cc = String(props.countrycode || '').toUpperCase();
      const country = String(props.country || '').toLowerCase();
      const isMz =
        cc === 'MZ' ||
        country.includes('mozambique') ||
        country.includes('moçambique') ||
        isInsideMozambiqueBounds(rLat, rLng);
      if (!isMz || !isInsideMozambiqueBounds(rLat, rLng)) return;

      const name = String(props.name || props.street || props.district || query).trim();
      const addrParts = [props.street, props.district || props.locality, props.city || props.county, props.country]
        .filter(Boolean);
      collected.push({
        id: String(props.osm_id ? `pho_${props.osm_id}` : `pho_${idx}_${Date.now()}`),
        name,
        address: addrParts.length > 0 ? addrParts.join(', ') : undefined,
        lat: rLat,
        lng: rLng,
        categoryLabel: props.osm_value || props.type || undefined,
      });
    });
  }

  // Deduplica por proximidade (< 40m) e prioriza Maputo/Matola + centro atual
  const deduped = [];
  for (const item of collected) {
    const duplicate = deduped.some(
      (existing) =>
        Math.abs(existing.lat - item.lat) < 0.0004 &&
        Math.abs(existing.lng - item.lng) < 0.0004 &&
        existing.name.toLowerCase() === item.name.toLowerCase()
    );
    if (!duplicate) deduped.push(item);
  }

  deduped.sort((a, b) => {
    const aText = `${a.name} ${a.address || ''}`.toLowerCase();
    const bText = `${b.name} ${b.address || ''}`.toLowerCase();
    const aPri = /maputo|matola/.test(aText) ? 0 : 1;
    const bPri = /maputo|matola/.test(bText) ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    const da = (a.lat - biasLat) ** 2 + (a.lng - biasLng) ** 2;
    const db = (b.lat - biasLat) ** 2 + (b.lng - biasLng) ** 2;
    return da - db;
  });

  const finalResults = deduped.slice(0, 8);
  return {
    results: finalResults,
    notFoundMessage: finalResults.length === 0 ? 'Não encontrado em Moçambique' : '',
  };
}

export async function computeRouteMozambique(origin, destination) {
  const oLat = Number(origin?.lat);
  const oLng = Number(origin?.lng);
  const dLat = Number(destination?.lat);
  const dLng = Number(destination?.lng);

  if (
    !Number.isFinite(oLat) ||
    !Number.isFinite(oLng) ||
    !Number.isFinite(dLat) ||
    !Number.isFinite(dLng)
  ) {
    return { status: 400, payload: { ok: false, error: 'Coordenadas de rota inválidas.' } };
  }

  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dPhi = toRad(dLat - oLat);
  const dLambda = toRad(dLng - oLng);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(toRad(oLat)) * Math.cos(toRad(dLat)) * Math.sin(dLambda / 2) ** 2;
  const straightMeters = Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
    const routeRes = await fetch(osrmUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (routeRes.ok) {
      const data = await routeRes.json();
      const first = data?.routes?.[0];
      const coords = first?.geometry?.coordinates;
      if (first && Array.isArray(coords) && coords.length >= 2) {
        const path = coords.map(([lngVal, latVal]) => [latVal, lngVal]);
        return {
          status: 200,
          payload: {
            ok: true,
            distanceMeters: Math.round(Number(first.distance ?? straightMeters)),
            durationSeconds: Math.max(60, Math.round(Number(first.duration ?? straightMeters / 8))),
            path,
          },
        };
      }
    }
  } catch {
    clearTimeout(timer);
  }

  return {
    status: 200,
    payload: {
      ok: true,
      fallback: true,
      distanceMeters: straightMeters,
      durationSeconds: Math.max(60, Math.round(straightMeters / 8.5)),
      path: [
        [oLat, oLng],
        [dLat, dLng],
      ],
    },
  };
}
