import type { ChatMessage, FirebaseUserProfile, ProjectRecord } from '../types/builder';
import type { SaraProjectState } from '../utils/projectMemory';

// Configuração REAL e exclusiva do projeto Firebase sara-biulder
export const firebaseConfig = {
  apiKey: 'AIzaSyBuueGEoCkvRWUq9IOBaXgiDpelpbyWsMY',
  authDomain: 'sara-biulder.firebaseapp.com',
  projectId: 'sara-biulder',
  storageBucket: 'sara-biulder.firebasestorage.app',
  messagingSenderId: '694091222077',
  appId: '1:694091222077:web:6fe664568d354418aeee54',
  measurementId: 'G-R8Q83VLR48',
};

const CDN_BASE = 'https://www.gstatic.com/firebasejs/11.6.0';

interface FirebaseRuntime {
  appMod: any;
  authMod: any;
  firestoreMod: any;
  analyticsMod: any;
  app: any;
  auth: any;
  db: any;
  analytics: any;
}

let runtimePromise: Promise<FirebaseRuntime> | null = null;

async function loadFirebaseRuntime(): Promise<FirebaseRuntime> {
  if (runtimePromise) return runtimePromise;

  runtimePromise = (async () => {
    const [appMod, authMod, firestoreMod, analyticsMod] = await Promise.all([
      import(/* @vite-ignore */ `${CDN_BASE}/firebase-app.js`),
      import(/* @vite-ignore */ `${CDN_BASE}/firebase-auth.js`),
      import(/* @vite-ignore */ `${CDN_BASE}/firebase-firestore.js`),
      import(/* @vite-ignore */ `${CDN_BASE}/firebase-analytics.js`).catch(() => null),
    ]);

    const existingApps = appMod.getApps ? appMod.getApps() : [];
    const app = existingApps.length > 0 ? existingApps[0] : appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    const db = firestoreMod.getFirestore(app);

    let analytics: any = null;
    if (analyticsMod && typeof window !== 'undefined') {
      try {
        const supported = analyticsMod.isSupported ? await analyticsMod.isSupported() : true;
        if (supported) {
          analytics = analyticsMod.getAnalytics(app);
        }
      } catch {
        analytics = null;
      }
    }

    return { appMod, authMod, firestoreMod, analyticsMod, app, auth, db, analytics };
  })();

  return runtimePromise;
}

function resolveUid(userId?: string, auth?: any): string {
  return userId || auth?.currentUser?.uid || 'eletro-jr-local';
}

export async function loginGoogle(): Promise<FirebaseUserProfile> {
  const { authMod, auth, firestoreMod, db } = await loadFirebaseRuntime();
  const provider = new authMod.GoogleAuthProvider();
  const result = await authMod.signInWithPopup(auth, provider);
  const user = result.user;

  await firestoreMod.setDoc(
    firestoreMod.doc(db, 'sara_usuarios', user.uid),
    {
      uid: user.uid,
      email: user.email || '',
      nome: user.displayName || 'Eletro-Jr',
      photoURL: user.photoURL || '',
      ultimoAcesso: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export async function loginEmail(email: string, password: string): Promise<FirebaseUserProfile> {
  const { authMod, auth } = await loadFirebaseRuntime();
  const result = await authMod.signInWithEmailAndPassword(auth, email, password);
  const user = result.user;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export async function criarConta(
  email: string,
  password: string,
  nome = 'Eletro-Jr'
): Promise<FirebaseUserProfile> {
  const { authMod, auth, firestoreMod, db } = await loadFirebaseRuntime();
  const result = await authMod.createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;
  if (authMod.updateProfile) {
    await authMod.updateProfile(user, { displayName: nome }).catch(() => {});
  }

  await firestoreMod.setDoc(
    firestoreMod.doc(db, 'sara_usuarios', user.uid),
    {
      uid: user.uid,
      email: user.email || email,
      nome,
      criadoEm: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    uid: user.uid,
    email: user.email,
    displayName: nome,
    photoURL: user.photoURL,
  };
}

export async function logout(): Promise<void> {
  const { authMod, auth } = await loadFirebaseRuntime();
  await authMod.signOut(auth);
}

export function verificarUsuario(
  callback: (user: FirebaseUserProfile | null) => void
): () => void {
  let unsubscribe: (() => void) | null = null;
  let active = true;

  loadFirebaseRuntime()
    .then(({ authMod, auth }) => {
      if (!active) return;
      unsubscribe = authMod.onAuthStateChanged(auth, (user: any) => {
        if (!active) return;
        if (user) {
          callback({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          });
        } else {
          callback(null);
        }
      });
    })
    .catch(() => {
      if (active) callback(null);
    });

  return () => {
    active = false;
    if (unsubscribe) unsubscribe();
  };
}

export async function testarConexaoFirebase(): Promise<{ ok: boolean; label: string; detail: string }> {
  try {
    const { app, firestoreMod, db } = await loadFirebaseRuntime();
    if (!app || app.options?.projectId !== 'sara-biulder') {
      return {
        ok: false,
        label: 'Desligado',
        detail: 'Projeto Firebase não corresponde a sara-biulder.',
      };
    }

    try {
      const q = firestoreMod.query(
        firestoreMod.collection(db, 'sara_projetos'),
        firestoreMod.limit(1)
      );
      await firestoreMod.getDocs(q);
      return {
        ok: true,
        label: 'Ligado a sara-biulder',
        detail: 'Firestore e Auth ligados ao projeto sara-biulder com sincronização automática ativa.',
      };
    } catch (fireErr: any) {
      const code = String(fireErr?.code || '');
      if (code === 'permission-denied') {
        return {
          ok: true,
          label: 'Ligado a sara-biulder',
          detail: 'Ligado ao projeto sara-biulder (inicia sessão para gravar e restaurar tudo na nuvem).',
        };
      }
      throw fireErr;
    }
  } catch (err: any) {
    return {
      ok: false,
      label: 'Desligado',
      detail: err?.message || 'Falha ao conectar ao Firebase sara-biulder.',
    };
  }
}

export async function salvarProjetoNoFirebase(
  project: ProjectRecord,
  userId?: string
): Promise<void> {
  const { firestoreMod, db, auth } = await loadFirebaseRuntime();
  const uid = resolveUid(userId, auth);
  // Limita snapshots de versões enviados ao Firestore para manter o documento ágil e leve (< 1MB)
  const compactVersions = Array.isArray(project.versions) ? project.versions.slice(0, 6) : [];
  await firestoreMod.setDoc(
    firestoreMod.doc(db, 'sara_projetos', project.id),
    {
      id: project.id,
      name: project.name,
      type: project.type,
      files: project.files || {},
      versions: compactVersions,
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: project.updatedAt || new Date().toISOString(),
      ownerUid: uid,
      ownerName: 'Eletro-Jr',
      syncedToFirebase: true,
    },
    { merge: true }
  );
}

export async function buscarProjetosNoFirebase(userId?: string): Promise<ProjectRecord[]> {
  const { firestoreMod, db, auth } = await loadFirebaseRuntime();
  const uid = resolveUid(userId, auth);
  const q = firestoreMod.query(
    firestoreMod.collection(db, 'sara_projetos'),
    firestoreMod.where('ownerUid', '==', uid)
  );
  const snap = await firestoreMod.getDocs(q);
  const items: ProjectRecord[] = [];
  snap.forEach((docSnap: any) => {
    const data = docSnap.data();
    if (data && data.files) {
      items.push({
        id: docSnap.id,
        name: data.name || 'Projeto sem nome',
        type: data.type || 'Site',
        files: data.files,
        versions: Array.isArray(data.versions) ? data.versions : undefined,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        syncedToFirebase: true,
      });
    }
  });
  return items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function apagarProjetoNoFirebase(projectId: string): Promise<void> {
  const { firestoreMod, db } = await loadFirebaseRuntime();
  await Promise.allSettled([
    firestoreMod.deleteDoc(firestoreMod.doc(db, 'sara_projetos', projectId)),
    firestoreMod.deleteDoc(firestoreMod.doc(db, 'sara_estados', projectId)),
  ]);
}

export async function salvarEstadoProjetoFirebase(
  state: SaraProjectState,
  userId?: string
): Promise<void> {
  try {
    const { firestoreMod, db, auth } = await loadFirebaseRuntime();
    const uid = resolveUid(userId, auth);
    await firestoreMod.setDoc(
      firestoreMod.doc(db, 'sara_estados', state.projectId),
      {
        ...state,
        ownerUid: uid,
        updatedAt: state.updatedAt || new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Fallback local silencioso se offline ou sem permissão
  }
}

export async function buscarEstadosProjetosFirebase(
  userId?: string
): Promise<Record<string, SaraProjectState>> {
  try {
    const { firestoreMod, db, auth } = await loadFirebaseRuntime();
    const uid = resolveUid(userId, auth);
    const q = firestoreMod.query(
      firestoreMod.collection(db, 'sara_estados'),
      firestoreMod.where('ownerUid', '==', uid)
    );
    const snap = await firestoreMod.getDocs(q);
    const result: Record<string, SaraProjectState> = {};
    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      if (data && data.projectId) {
        result[data.projectId] = data as SaraProjectState;
      }
    });
    return result;
  } catch {
    return {};
  }
}

export async function salvarMensagemChatFirebase(
  message: ChatMessage,
  projectId: string,
  userId?: string
): Promise<void> {
  try {
    const { firestoreMod, db, auth } = await loadFirebaseRuntime();
    const uid = resolveUid(userId, auth);
    // Evita enviar strings base64 pesadas de imagens se excederem tamanho seguro
    const safeImageUrl =
      message.imageUrl && message.imageUrl.length < 180000 ? message.imageUrl : undefined;
    await firestoreMod.setDoc(
      firestoreMod.doc(db, 'sara_chats', `${uid}_${projectId}_${message.id}`),
      {
        id: message.id,
        projectId,
        ownerUid: uid,
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp,
        mode: message.mode || 'conversation',
        architectureSummary: message.architectureSummary || null,
        strategicImprovements: message.strategicImprovements || null,
        hasCodeUpdate: Boolean(message.hasCodeUpdate),
        engineLabel: message.engineLabel || null,
        buildSummary: message.buildSummary || null,
        ...(safeImageUrl ? { imageUrl: safeImageUrl } : {}),
        createdAtMs: Date.now(),
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Não bloqueia o chat se o utilizador ainda não fez login ou está offline
  }
}

export async function buscarMensagensChatFirebase(
  projectId: string,
  userId?: string
): Promise<ChatMessage[]> {
  try {
    const { firestoreMod, db, auth } = await loadFirebaseRuntime();
    const uid = resolveUid(userId, auth);
    const q = firestoreMod.query(
      firestoreMod.collection(db, 'sara_chats'),
      firestoreMod.where('ownerUid', '==', uid),
      firestoreMod.where('projectId', '==', projectId)
    );
    const snap = await firestoreMod.getDocs(q);
    const list: Array<ChatMessage & { _order: number }> = [];
    snap.forEach((docSnap: any) => {
      const d = docSnap.data();
      if (!d || !d.id || typeof d.text !== 'string') return;
      list.push({
        id: d.id,
        sender: d.sender === 'user' ? 'user' : 'sara',
        text: d.text,
        timestamp: d.timestamp || '',
        mode: d.mode,
        architectureSummary: d.architectureSummary || undefined,
        strategicImprovements: Array.isArray(d.strategicImprovements)
          ? d.strategicImprovements
          : undefined,
        hasCodeUpdate: Boolean(d.hasCodeUpdate),
        engineLabel: d.engineLabel || undefined,
        buildSummary: d.buildSummary || undefined,
        imageUrl: d.imageUrl || undefined,
        _order: Number(d.createdAtMs || Date.parse(d.createdAt || '') || 0),
      });
    });
    return list
      .sort((a, b) => a._order - b._order)
      .slice(-50)
      .map(({ _order, ...msg }) => msg);
  } catch {
    return [];
  }
}

export async function salvarPreferenciasUsuarioFirebase(
  prefs: {
    activeProjectId?: string;
    agentMode?: string;
    voiceLevel?: string;
    errorsFixedCount?: number;
  },
  userId?: string
): Promise<void> {
  try {
    const { firestoreMod, db, auth } = await loadFirebaseRuntime();
    const uid = resolveUid(userId, auth);
    await firestoreMod.setDoc(
      firestoreMod.doc(db, 'sara_usuarios', uid),
      {
        uid,
        preferencias: prefs,
        ultimoSync: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // ignore offline/unauth
  }
}

export async function buscarPreferenciasUsuarioFirebase(
  userId?: string
): Promise<{
  activeProjectId?: string;
  agentMode?: 'manual' | 'automatic';
  voiceLevel?: 'short' | 'medium' | 'full';
  errorsFixedCount?: number;
} | null> {
  try {
    const { firestoreMod, db, auth } = await loadFirebaseRuntime();
    const uid = resolveUid(userId, auth);
    const snap = await firestoreMod.getDoc(firestoreMod.doc(db, 'sara_usuarios', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.preferencias || null;
  } catch {
    return null;
  }
}
