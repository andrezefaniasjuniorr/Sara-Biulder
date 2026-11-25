import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const OWNER_EMAIL = 'sarabiulderr@gmail.com';
const FIREBASE_PROJECT_ID = 'sara-biulder';
const FIRESTORE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sara_core_vault/image_engine`;
const OWNER_ACCOUNT_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sara_accounts/sarabiulderr_gmail.com`;
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const LOCAL_VAULT_PATH = path.resolve(process.cwd(), '.sara-core-vault.json');

let memoryVault = {
  imageKey: '',
  updatedAt: null,
};

let jwksCache = {
  fetchedAt: 0,
  keys: [],
};

// Segredo efémero por processo caso SARA_ADMIN_TOKEN_SECRET não esteja definido no ambiente
const ephemeralHmacSecret = crypto.randomBytes(32);

function getHmacSecret() {
  const envSecret = String(process.env.SARA_ADMIN_TOKEN_SECRET || '').trim();
  return envSecret ? Buffer.from(envSecret, 'utf8') : ephemeralHmacSecret;
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

function readLocalDiskVault() {
  try {
    if (!fs.existsSync(LOCAL_VAULT_PATH)) return null;
    const raw = fs.readFileSync(LOCAL_VAULT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.imageKey === 'string') {
      return {
        imageKey: parsed.imageKey.trim(),
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      };
    }
  } catch {
    // ignore read error
  }
  return null;
}

function writeLocalDiskVault(imageKey, updatedAt) {
  try {
    if (!imageKey) {
      if (fs.existsSync(LOCAL_VAULT_PATH)) {
        fs.unlinkSync(LOCAL_VAULT_PATH);
      }
      return;
    }
    fs.writeFileSync(
      LOCAL_VAULT_PATH,
      JSON.stringify({ imageKey, updatedAt: updatedAt || new Date().toISOString() }),
      { encoding: 'utf8', mode: 0o600 }
    );
  } catch {
    // Serverless / read-only FS ignores disk persistence gracefully
  }
}

async function fetchCloudVault(bearerFirebaseToken) {
  try {
    const headers = { Accept: 'application/json' };
    if (bearerFirebaseToken) {
      headers.Authorization = `Bearer ${bearerFirebaseToken}`;
    }
    const res = await fetch(FIRESTORE_DOC_URL, { headers });
    if (!res.ok) return null;
    const doc = await res.json();
    const fields = doc?.fields;
    if (!fields) return null;
    const imageKey = String(fields?.imageKey?.stringValue || '').trim();
    const updatedAt = String(fields?.updatedAt?.stringValue || '') || null;
    if (!imageKey) return { imageKey: '', updatedAt };
    return { imageKey, updatedAt };
  } catch {
    return null;
  }
}

async function saveCloudVault(imageKey, updatedAt, bearerFirebaseToken) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (bearerFirebaseToken) {
      headers.Authorization = `Bearer ${bearerFirebaseToken}`;
    }
    if (!imageKey) {
      await fetch(FIRESTORE_DOC_URL, { method: 'DELETE', headers });
      return true;
    }
    const res = await fetch(FIRESTORE_DOC_URL, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: {
          imageKey: { stringValue: imageKey },
          maskedKey: { stringValue: maskImageKey(imageKey) || '' },
          updatedAt: { stringValue: updatedAt || new Date().toISOString() },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getBackendImageKey() {
  if (isValidImageCoreKey(memoryVault.imageKey)) {
    return {
      imageKey: memoryVault.imageKey,
      updatedAt: memoryVault.updatedAt,
    };
  }

  const disk = readLocalDiskVault();
  if (disk && isValidImageCoreKey(disk.imageKey)) {
    memoryVault = disk;
    return disk;
  }

  const cloud = await fetchCloudVault();
  if (cloud && isValidImageCoreKey(cloud.imageKey)) {
    memoryVault = cloud;
    writeLocalDiskVault(cloud.imageKey, cloud.updatedAt);
    return cloud;
  }

  const envKey = String(process.env.SARA_IMAGE_KEY || process.env.HF_TOKEN || '').trim();
  if (isValidImageCoreKey(envKey)) {
    return { imageKey: envKey, updatedAt: null };
  }

  return { imageKey: '', updatedAt: null };
}

export async function setBackendImageKey(rawKey, bearerFirebaseToken) {
  const clean = String(rawKey || '').trim();
  const nowIso = new Date().toISOString();
  memoryVault = { imageKey: clean, updatedAt: clean ? nowIso : null };
  writeLocalDiskVault(clean, clean ? nowIso : null);
  await saveCloudVault(clean, clean ? nowIso : null, bearerFirebaseToken);
  return {
    configured: Boolean(clean),
    maskedKey: maskImageKey(clean),
    updatedAt: memoryVault.updatedAt,
  };
}

function decodeBase64UrlJson(segment) {
  const norm = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
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

    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const sigNorm = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const sigBuf = Buffer.from(sigNorm + '='.repeat((4 - (sigNorm.length % 4)) % 4), 'base64');
    const verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
      publicKey,
      sigBuf
    );
    return verified ? { email, uid: String(payload.sub), firebaseToken: token } : null;
  } catch {
    return null;
  }
}

export function mintHmacAdminToken(email) {
  const payload = {
    email: String(email || '').trim().toLowerCase(),
    role: 'owner',
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getHmacSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyHmacAdminToken(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getHmacSecret())
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
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

export async function verifyAdminRequestAuth(authHeader) {
  const raw = String(authHeader || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return null;
  const token = raw.slice(7).trim();
  if (!token) return null;

  const hmacOk = verifyHmacAdminToken(token);
  if (hmacOk) return hmacOk;

  const fbOk = await verifyFirebaseOwnerIdToken(token);
  if (fbOk) return fbOk;

  return null;
}

export async function verifyOwnerPasswordCredentials(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '');
  if (cleanEmail !== OWNER_EMAIL || !cleanPass) return false;

  // 1. Verifica contra conta do Dono no Firestore (PBKDF2-SHA256)
  try {
    const res = await fetch(OWNER_ACCOUNT_DOC_URL, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const doc = await res.json();
      const fields = doc?.fields;
      const hash = String(fields?.passwordHash?.stringValue || '');
      const saltHex = String(fields?.passwordSalt?.stringValue || '');
      if (hash && saltHex) {
        const saltBytes = Buffer.from(saltHex, 'hex');
        const derived = crypto.pbkdf2Sync(cleanPass, saltBytes, 100000, 32, 'sha256').toString('hex');
        const a = Buffer.from(derived, 'hex');
        const b = Buffer.from(hash, 'hex');
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
          return true;
        }
      }
    }
  } catch {
    // fallback below
  }

  // 2. Fallback para palavra-passe admin configurada no ambiente do servidor, se existir
  const envAdminPass = String(process.env.SARA_ADMIN_PASSCODE || '').trim();
  if (envAdminPass) {
    const a = Buffer.from(cleanPass, 'utf8');
    const b = Buffer.from(envAdminPass, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }

  return false;
}
