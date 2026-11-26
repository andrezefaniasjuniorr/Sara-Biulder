// Cloudflare Pages Edge runtime vault & admin auth helper (zero Node built-ins)

export const OWNER_EMAIL = 'sarabiulderr@gmail.com';
const FIREBASE_PROJECT_ID = 'sara-biulder';
const FIRESTORE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sara_core_vault/image_engine`;
const OWNER_ACCOUNT_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sara_accounts/sarabiulderr_gmail.com`;
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let edgeMemoryVault = {
  imageKey: '',
  updatedAt: null,
  lastError: null,
  lastErrorStatus: null,
  lastErrorAt: null,
};

let jwksCache = {
  fetchedAt: 0,
  keys: [],
};

let ephemeralEdgeKeyBytes = null;

function getEdgeHmacSecretBytes(env) {
  const configured = String(env?.SARA_ADMIN_TOKEN_SECRET || '').trim();
  if (configured) return new TextEncoder().encode(configured);
  if (!ephemeralEdgeKeyBytes) {
    ephemeralEdgeKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  }
  return ephemeralEdgeKeyBytes;
}

export function maskImageKey(rawKey) {
  const clean = String(rawKey || '').trim();
  if (!clean) return null;
  const suffix = clean.length >= 4 ? clean.slice(-4) : '••••';
  return `hf_****${suffix}`;
}

export function isValidImageCoreKey(rawKey) {
  const clean = String(rawKey || '').trim();
  return clean.startsWith('hf_') && clean.length >= 10 && !/\s/.test(clean);
}

function sanitizeImageErrorMessage(rawMessage) {
  const clean = String(rawMessage || '')
    .replace(/hf_[A-Za-z0-9_-]{4,}/g, 'hf_****')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ****')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.slice(0, 320) : 'Erro desconhecido ao gerar imagem.';
}

function base64UrlToUint8Array(str) {
  const norm = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ArrayToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64UrlJson(segment) {
  const bytes = base64UrlToUint8Array(segment);
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function getGoogleSecureTokenJwks() {
  if (jwksCache.keys.length > 0 && Date.now() - jwksCache.fetchedAt < 3600 * 1000) {
    return jwksCache.keys;
  }
  const res = await fetch(GOOGLE_JWKS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) return jwksCache.keys;
  const data = await res.json();
  if (Array.isArray(data?.keys)) {
    jwksCache = { fetchedAt: Date.now(), keys: data.keys };
  }
  return jwksCache.keys;
}

export async function verifyFirebaseOwnerIdToken(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const header = decodeBase64UrlJson(parts[0]);
    const payload = decodeBase64UrlJson(parts[1]);
    const nowSec = Math.floor(Date.now() / 1000);

    if (header?.alg !== 'RS256' || !header?.kid) return null;
    if (payload?.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload?.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (!payload?.sub || typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;

    const email = String(payload?.email || '').trim().toLowerCase();
    if (email !== OWNER_EMAIL) return null;

    const keys = await getGoogleSecureTokenJwks();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = base64UrlToUint8Array(parts[2]);
    const msgBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, msgBytes);
    return verified ? { email, uid: String(payload.sub), firebaseToken: token } : null;
  } catch {
    return null;
  }
}

export async function mintHmacAdminToken(email, env) {
  const payload = {
    email: String(email || '').trim().toLowerCase(),
    role: 'owner',
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
  };
  const encoded = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    getEdgeHmacSecretBytes(env),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
  return `${encoded}.${uint8ArrayToBase64Url(new Uint8Array(sigBuf))}`;
}

export async function verifyHmacAdminToken(token, env) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const key = await crypto.subtle.importKey(
      'raw',
      getEdgeHmacSecretBytes(env),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = base64UrlToUint8Array(sig);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(encoded)
    );
    if (!valid) return null;
    const payload = decodeBase64UrlJson(encoded);
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload?.role !== 'owner' ||
      String(payload?.email || '').toLowerCase() !== OWNER_EMAIL ||
      typeof payload?.exp !== 'number' ||
      payload.exp <= nowSec
    ) {
      return null;
    }
    return { email: OWNER_EMAIL, firebaseToken: null };
  } catch {
    return null;
  }
}

export async function verifyAdminRequestAuth(authHeader, env) {
  const raw = String(authHeader || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return null;
  const token = raw.slice(7).trim();
  if (!token) return null;

  const hmacOk = await verifyHmacAdminToken(token, env);
  if (hmacOk) return hmacOk;

  const fbOk = await verifyFirebaseOwnerIdToken(token);
  if (fbOk) return fbOk;

  return null;
}

export async function verifyOwnerPasswordCredentials(email, password, env) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '');
  if (cleanEmail !== OWNER_EMAIL || !cleanPass) return false;

  try {
    const res = await fetch(OWNER_ACCOUNT_DOC_URL, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const doc = await res.json();
      const fields = doc?.fields;
      const expectedHash = String(fields?.passwordHash?.stringValue || '');
      const saltHex = String(fields?.passwordSalt?.stringValue || '');
      if (expectedHash && saltHex) {
        const saltBytes = new Uint8Array(
          (saltHex.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16) || 0)
        );
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(cleanPass),
          { name: 'PBKDF2' },
          false,
          ['deriveBits']
        );
        const bits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
          keyMaterial,
          256
        );
        const derivedHex = Array.from(new Uint8Array(bits))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        if (derivedHex.length === expectedHash.length) {
          let diff = 0;
          for (let i = 0; i < derivedHex.length; i++) {
            diff |= derivedHex.charCodeAt(i) ^ expectedHash.charCodeAt(i);
          }
          if (diff === 0) return true;
        }
      }
    }
  } catch {
    // fallback below
  }

  const envAdminPass = String(env?.SARA_ADMIN_PASSCODE || '').trim();
  if (envAdminPass && envAdminPass === cleanPass) return true;

  return false;
}

async function patchCloudErrorFields(lastError, lastErrorStatus, lastErrorAt) {
  try {
    const updateUrl =
      `${FIRESTORE_DOC_URL}?updateMask.fieldPaths=lastError` +
      `&updateMask.fieldPaths=lastErrorStatus&updateMask.fieldPaths=lastErrorAt`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          lastError: lastError ? { stringValue: lastError } : { nullValue: null },
          lastErrorStatus:
            typeof lastErrorStatus === 'number'
              ? { integerValue: String(Math.trunc(lastErrorStatus)) }
              : { nullValue: null },
          lastErrorAt: lastErrorAt ? { stringValue: lastErrorAt } : { nullValue: null },
        },
      }),
    });
  } catch {
    // ignore
  }
}

export async function getBackendImageKey(env) {
  if (isValidImageCoreKey(edgeMemoryVault.imageKey)) {
    return edgeMemoryVault;
  }

  let cloudError = null;
  let cloudErrorStatus = null;
  let cloudErrorAt = null;

  try {
    const res = await fetch(FIRESTORE_DOC_URL, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const doc = await res.json();
      const fields = doc?.fields;
      const imageKey = String(fields?.imageKey?.stringValue || '').trim();
      const updatedAt = String(fields?.updatedAt?.stringValue || '') || null;
      cloudError = String(fields?.lastError?.stringValue || '') || null;
      const rawStatus = fields?.lastErrorStatus?.integerValue;
      cloudErrorStatus =
        rawStatus !== undefined && rawStatus !== null && Number.isFinite(Number(rawStatus))
          ? Number(rawStatus)
          : null;
      cloudErrorAt = String(fields?.lastErrorAt?.stringValue || '') || null;
      if (isValidImageCoreKey(imageKey)) {
        edgeMemoryVault = {
          imageKey,
          updatedAt,
          lastError: cloudError,
          lastErrorStatus: cloudErrorStatus,
          lastErrorAt: cloudErrorAt,
        };
        return edgeMemoryVault;
      }
    }
  } catch {
    // fallback to env
  }

  const envKey = String(env?.SARA_IMAGE_KEY || env?.HF_TOKEN || '').trim();
  if (isValidImageCoreKey(envKey)) {
    return {
      imageKey: envKey,
      updatedAt: null,
      lastError: edgeMemoryVault.lastError || cloudError,
      lastErrorStatus: edgeMemoryVault.lastErrorStatus ?? cloudErrorStatus,
      lastErrorAt: edgeMemoryVault.lastErrorAt || cloudErrorAt,
    };
  }

  return {
    imageKey: '',
    updatedAt: null,
    lastError: edgeMemoryVault.lastError || cloudError,
    lastErrorStatus: edgeMemoryVault.lastErrorStatus ?? cloudErrorStatus,
    lastErrorAt: edgeMemoryVault.lastErrorAt || cloudErrorAt,
  };
}

export async function setBackendImageKey(rawKey, bearerFirebaseToken) {
  const clean = String(rawKey || '').trim();
  const nowIso = new Date().toISOString();
  edgeMemoryVault = {
    imageKey: clean,
    updatedAt: clean ? nowIso : null,
    lastError: null,
    lastErrorStatus: null,
    lastErrorAt: null,
  };

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (bearerFirebaseToken) {
      headers.Authorization = `Bearer ${bearerFirebaseToken}`;
    }
    if (!clean) {
      await fetch(FIRESTORE_DOC_URL, { method: 'DELETE', headers });
    } else {
      await fetch(FIRESTORE_DOC_URL, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fields: {
            imageKey: { stringValue: clean },
            maskedKey: { stringValue: maskImageKey(clean) || '' },
            updatedAt: { stringValue: nowIso },
            lastError: { nullValue: null },
            lastErrorStatus: { nullValue: null },
            lastErrorAt: { nullValue: null },
          },
        }),
      });
    }
  } catch {
    // ignore
  }

  return {
    configured: Boolean(clean),
    maskedKey: maskImageKey(clean),
    updatedAt: edgeMemoryVault.updatedAt,
    lastError: null,
    lastErrorStatus: null,
    lastErrorAt: null,
  };
}

/**
 * @param {string} errorMessage
 * @param {number | null} [statusCode]
 */
export async function recordBackendImageError(errorMessage, statusCode = null) {
  const cleanMsg = sanitizeImageErrorMessage(errorMessage);
  const cleanStatus =
    typeof statusCode === 'number' && Number.isFinite(statusCode) ? Math.trunc(statusCode) : null;
  const nowIso = new Date().toISOString();

  edgeMemoryVault = {
    ...edgeMemoryVault,
    lastError: cleanMsg,
    lastErrorStatus: cleanStatus,
    lastErrorAt: nowIso,
  };
  await patchCloudErrorFields(cleanMsg, cleanStatus, nowIso);
}

export async function clearBackendImageError() {
  if (!edgeMemoryVault.lastError && !edgeMemoryVault.lastErrorAt) return;
  edgeMemoryVault = {
    ...edgeMemoryVault,
    lastError: null,
    lastErrorStatus: null,
    lastErrorAt: null,
  };
  await patchCloudErrorFields(null, null, null);
}
