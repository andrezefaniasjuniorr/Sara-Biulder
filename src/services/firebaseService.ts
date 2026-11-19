import type { ChatMessage, FirebaseUserProfile, ProjectRecord } from '../types/builder';

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
        label: 'Desligado ❌',
        detail: 'Projeto Firebase não corresponde a sara-biulder.',
      };
    }

    // Testa leitura leve na coleção sara_projetos (mesmo que vazia ou com regras restritas, valida resposta do Firestore)
    try {
      const q = firestoreMod.query(
        firestoreMod.collection(db, 'sara_projetos'),
        firestoreMod.limit(1)
      );
      await firestoreMod.getDocs(q);
      return {
        ok: true,
        label: 'Ligado a sara-biulder ✅',
        detail: 'Firestore e Auth ligados ao projeto sara-biulder.',
      };
    } catch (fireErr: any) {
      const code = String(fireErr?.code || '');
      if (code === 'permission-denied') {
        return {
          ok: true,
          label: 'Ligado a sara-biulder ✅',
          detail: 'Ligado ao projeto sara-biulder (regras de segurança ativas; faz login para gravar na nuvem).',
        };
      }
      throw fireErr;
    }
  } catch (err: any) {
    return {
      ok: false,
      label: 'Desligado ❌',
      detail: err?.message || 'Falha ao conectar ao Firebase sara-biulder.',
    };
  }
}

export async function salvarProjetoNoFirebase(
  project: ProjectRecord,
  userId?: string
): Promise<void> {
  const { firestoreMod, db, auth } = await loadFirebaseRuntime();
  const uid = userId || auth?.currentUser?.uid || 'eletro-jr-local';
  await firestoreMod.setDoc(
    firestoreMod.doc(db, 'sara_projetos', project.id),
    {
      ...project,
      ownerUid: uid,
      ownerName: 'Eletro-Jr',
      syncedToFirebase: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function buscarProjetosNoFirebase(userId?: string): Promise<ProjectRecord[]> {
  const { firestoreMod, db, auth } = await loadFirebaseRuntime();
  const uid = userId || auth?.currentUser?.uid || 'eletro-jr-local';
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
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        syncedToFirebase: true,
      });
    }
  });
  return items;
}

export async function apagarProjetoNoFirebase(projectId: string): Promise<void> {
  const { firestoreMod, db } = await loadFirebaseRuntime();
  await firestoreMod.deleteDoc(firestoreMod.doc(db, 'sara_projetos', projectId));
}

export async function salvarMensagemChatFirebase(
  message: ChatMessage,
  projectId: string,
  userId?: string
): Promise<void> {
  try {
    const { firestoreMod, db, auth } = await loadFirebaseRuntime();
    const uid = userId || auth?.currentUser?.uid || 'eletro-jr-local';
    await firestoreMod.setDoc(
      firestoreMod.doc(db, 'sara_chats', `${projectId}_${message.id}`),
      {
        id: message.id,
        projectId,
        ownerUid: uid,
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Não bloqueia o chat se o usuário ainda não fez login ou está offline
  }
}
