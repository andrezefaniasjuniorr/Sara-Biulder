export type VoiceLevel = 'short' | 'medium' | 'full';

export type VoiceCommandAction =
  | { type: 'background_smalltalk'; reply: string; raw: string }
  | { type: 'silence_sara'; raw: string }
  | { type: 'voice_level'; level: VoiceLevel; raw: string }
  | { type: 'switch_manual'; raw: string }
  | { type: 'switch_automatic'; goal?: string; contextCue?: 'sleep' | 'leave'; raw: string }
  | { type: 'query_status'; raw: string }
  | { type: 'query_report'; raw: string }
  | { type: 'open_console' }
  | { type: 'fix_error' }
  | { type: 'preview_mobile' }
  | { type: 'preview_desktop' }
  | { type: 'save_project' }
  | { type: 'stop_listening' }
  | { type: 'prompt'; text: string };

function getTimePeriod(): 'morning' | 'afternoon' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  return 'night';
}

export function getInstantSmallTalkReply(normalizedLower: string): string | null {
  const period = getTimePeriod();
  const clean = normalizedLower.replace(/[!?,.;:]/g, '').trim();

  if (
    /^(ola|oi|hey|ei)(\s+sara)?$/i.test(clean) ||
    /^(bom dia|boa tarde|boa noite)(\s+sara)?$/i.test(clean)
  ) {
    if (period === 'morning') return 'Bom dia, Eletro-Jr! O que vamos criar hoje?';
    if (period === 'night') return 'Boa noite, Eletro-Jr, vamos terminar rápido para descansares. O que queres criar?';
    return 'Olá Eletro-Jr, o que vamos criar hoje?';
  }

  if (/^(como estas|tudo bem|como vai|esta tudo bem)(\s+sara)?$/i.test(clean)) {
    return 'Tudo ótimo por aqui, Eletro-Jr! Pronta para construir contigo.';
  }

  if (/^(obrigado|obrigada|valeu|muito obrigado)(\s+sara)?$/i.test(clean)) {
    return 'Sempre às ordens, Eletro-Jr!';
  }

  if (/^(tchau|ate logo|ate ja|ate amanha|adeus)(\s+sara)?$/i.test(clean)) {
    return period === 'night'
      ? 'Bom descanso, Eletro-Jr! Até amanhã.'
      : 'Até logo, Eletro-Jr!';
  }

  return null;
}

export function parseVoiceCommand(transcript: string): VoiceCommandAction {
  const clean = transcript.trim();
  const lower = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Conversa rápida em segundo plano (sem chamar IA e sem poluir o chat principal)
  const smallTalkReply = getInstantSmallTalkReply(lower);
  if (smallTalkReply) {
    return { type: 'background_smalltalk', reply: smallTalkReply, raw: clean };
  }

  // Calar a Sara imediatamente
  if (
    lower.includes('sara, cala') ||
    lower.includes('sara cala') ||
    lower.includes('cala-te') ||
    lower.includes('cala te') ||
    lower === 'cala' ||
    lower.includes('fica calada')
  ) {
    return { type: 'silence_sara', raw: clean };
  }

  // Níveis de voz
  if (lower.includes('le tudo') || lower.includes('ler tudo') || lower.includes('modo completo')) {
    return { type: 'voice_level', level: 'full', raw: clean };
  }
  if (lower.includes('explica mais') || lower === 'sara, explica' || lower === 'sara explica') {
    return { type: 'voice_level', level: 'medium', raw: clean };
  }
  if (lower.includes('modo curto') || lower.includes('so o resumo')) {
    return { type: 'voice_level', level: 'short', raw: clean };
  }

  // Parar microfone explicitamente
  if (
    lower.includes('para de ouvir') ||
    lower.includes('desliga o microfone') ||
    lower.includes('desligar microfone') ||
    lower === 'silencio'
  ) {
    return { type: 'stop_listening' };
  }

  // Perguntar progresso durante automático
  if (
    lower.includes('como esta o projeto') ||
    lower.includes('em que etapa') ||
    lower.includes('como vai o projeto') ||
    lower.includes('qual o progresso')
  ) {
    return { type: 'query_status', raw: clean };
  }

  // Perguntar relatório / se terminou
  if (
    lower.includes('terminaste') ||
    lower.includes('ja terminaste') ||
    lower.includes('o que fizeste') ||
    lower.includes('relatorio')
  ) {
    return { type: 'query_report', raw: clean };
  }

  // Ativar ou voltar para Modo Manual
  if (
    lower.includes('modo manual') ||
    lower.includes('volta para o manual') ||
    lower.includes('voltar para o manual') ||
    lower.includes('fica em manual') ||
    lower.includes('vamos fazer juntos')
  ) {
    return { type: 'switch_manual', raw: clean };
  }

  // Ativar Modo Automático
  const autoTrigger =
    lower.includes('modo automatico') ||
    lower.includes('ativa o automatico') ||
    lower.includes('ativar automatico') ||
    lower.includes('faz sozinha') ||
    lower.includes('modo autonomo');

  if (autoTrigger) {
    const contextCue: 'sleep' | 'leave' | undefined = lower.includes('dormir')
      ? 'sleep'
      : lower.includes('sair') || lower.includes('volto ja')
      ? 'leave'
      : undefined;

    const hasBuildRequest =
      /\b(cria|criar|faz|fazer|gera|gerar|constroi|construir|desenvolve|desenvolver)\b/i.test(lower);

    let extractedGoal = '';
    if (hasBuildRequest) {
      extractedGoal = clean
        .replace(/^(sara\s*,?\s*)/i, '')
        .replace(/\b(e\s+)?(ativa|ativar|liga|ligar|usa)\s+(o\s+)?(modo\s+)?autom[aá]tico.*$/i, '')
        .replace(/,?\s*(vou dormir|vou sair|faz sozinha).*$/i, '')
        .trim();
    }

    return {
      type: 'switch_automatic',
      goal: extractedGoal || undefined,
      contextCue,
      raw: clean,
    };
  }

  if (lower.includes('abre o console') || lower.includes('abrir console') || lower.includes('abrir o console')) {
    return { type: 'open_console' };
  }
  if (lower.includes('corrige o erro') || lower.includes('corrigir o erro') || lower.includes('corrigir erro')) {
    return { type: 'fix_error' };
  }
  if (lower.includes('preview em telemovel') || lower.includes('modo telemovel')) {
    return { type: 'preview_mobile' };
  }
  if (lower.includes('preview em pc') || lower.includes('modo pc')) {
    return { type: 'preview_desktop' };
  }
  if (lower.includes('salva o projeto') || lower.includes('salvar o projeto') || lower.includes('guarda o projeto')) {
    return { type: 'save_project' };
  }

  return { type: 'prompt', text: clean };
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

// Estado global de trava de eco e controlo de fala
export let saraEstaAFalar = false;
let saraSilenciada = false;
let activeRecognition: any = null;
let micShouldBeActive = false;
let resumeMicFn: (() => void) | null = null;
let restartAfterSpeechTimer: ReturnType<typeof setTimeout> | null = null;
let hardwareAudioStream: MediaStream | null = null;

const recentSpokenNormalized: string[] = [];

export function isSaraSilenced(): boolean {
  return saraSilenciada;
}

export function setSaraSilenced(silenced: boolean): void {
  saraSilenciada = silenced;
  if (silenced) {
    stopSaraSpeech();
  }
}

function normalizeForRepeatCheck(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Higieniza texto (sem código, URLs, tokens, markdown, emojis) e resume de acordo com o nível de voz.
 * Regra absoluta: VOZ = RESUMO CURTO. CHAT = DETALHE COMPLETO.
 * Substitui Eletro-Jr por Eletro-Júnior apenas no áudio.
 */
export function resumirParaVoz(
  texto: string,
  level: VoiceLevel = 'short',
  options?: { allowInfraMention?: boolean }
): string {
  if (!texto) return '';

  // Remove blocos de código, HTML/tags, URLs, tokens/chaves de API e símbolos de markdown
  let cleaned = texto
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b(AIza[0-9A-Za-z\-_]{10,}|ghp_[0-9A-Za-z_]{10,}|github_pat_[0-9A-Za-z_]{10,})\b/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/[#>|[\]{}()]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '');

  if (!options?.allowInfraMention) {
    cleaned = cleaned.replace(/\b(Firebase|sara_projetos|localStorage|pastas|estrutura de pastas)\b/gi, '');
  }

  // Deteta listas longas (> 3 itens) e resume sem ler item por item
  const lines = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const listLines = lines.filter((l) => /^([-*•]|\d+[.)])\s+/.test(l));

  if (level !== 'full' && listLines.length > 3) {
    const firstNonList = lines.find((l) => !/^([-*•]|\d+[.)])\s+/.test(l)) || '';
    let introClean = firstNonList
      .replace(/```[\s\S]*?```/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\b(AIza[0-9A-Za-z\-_]{10,}|ghp_[0-9A-Za-z_]{10,}|github_pat_[0-9A-Za-z_]{10,})\b/g, ' ')
      .replace(/[*_#>~|[\]{}()]/g, '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '');

    if (!options?.allowInfraMention) {
      introClean = introClean.replace(/\b(Firebase|sara_projetos|localStorage|pastas|estrutura de pastas)\b/gi, '');
    }
    introClean = introClean.replace(/\s+/g, ' ').replace(/\s+([!?,.;:])/g, '$1').trim();

    const summary =
      introClean && introClean.length < 70 && !/[{};=]/.test(introClean)
        ? `${introClean}${/[.!?]$/.test(introClean) ? '' : '.'} Criei ${listLines.length} itens, estão todos no chat para veres, Eletro-Júnior.`
        : `Criei ${listLines.length} itens, estão todos no chat para veres, Eletro-Júnior.`;

    return summary
      .replace(/Eletro-Jr\b/gi, 'Eletro-Júnior')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const normalizedText = cleaned
    .replace(/Eletro-Jr\b/gi, 'Eletro-Júnior')
    .replace(/\s+/g, ' ')
    .replace(/\s+([!?,.;:])/g, '$1')
    .trim();

  if (!normalizedText) return '';

  if (level === 'full') {
    return normalizedText.slice(0, 900);
  }

  const sentences = normalizedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  if (level === 'medium') {
    const med = sentences.slice(0, 3).join(' ').slice(0, 260);
    return sentences.length > 3
      ? `${med} Deixei o detalhe completo no chat, Eletro-Júnior.`
      : med;
  }

  // Modo Curto (padrão): 1 frase direta (ou saudação curta + frase principal até ~135 chars)
  let firstSentence = sentences[0] || normalizedText;
  if (firstSentence.length < 32 && sentences[1] && firstSentence.length + 1 + sentences[1].length <= 145) {
    firstSentence = `${firstSentence} ${sentences[1]}`;
  }
  if (firstSentence.length <= 145) {
    return firstSentence;
  }
  return firstSentence.slice(0, 138).replace(/\s+\S*$/, '') + '.';
}

export function sanitizeTextForSpeech(text: string): string {
  return resumirParaVoz(text, 'medium');
}

/**
 * Microfone contínuo com echoCancellation, noiseSuppression, autoGainControl e pausa automática durante fala da Sara.
 */
export function startContinuousVoiceRecognition(options: {
  shouldKeepListening: () => boolean;
  onResult: (transcript: string) => void;
  onError: (err: string) => void;
  onEnd: () => void;
}): () => void {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) {
    options.onError('Reconhecimento de voz não suportado neste navegador.');
    options.onEnd();
    return () => {};
  }

  micShouldBeActive = true;
  let manuallyStopped = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  // Ativa supressão de eco/ruído ao nível de hardware quando o navegador suportar
  if (navigator.mediaDevices?.getUserMedia && !hardwareAudioStream) {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        if (manuallyStopped || !options.shouldKeepListening()) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        hardwareAudioStream = stream;
      })
      .catch(() => {
        // segue apenas com SpeechRecognition se getUserMedia não estiver disponível
      });
  }

  const startSession = () => {
    if (manuallyStopped || !options.shouldKeepListening()) {
      micShouldBeActive = false;
      options.onEnd();
      return;
    }

    // Trava: se a Sara ainda está a falar, não liga o microfone agora (será religado 400ms após terminar)
    if (saraEstaAFalar) {
      return;
    }

    const recognition = new SR();
    activeRecognition = recognition;
    recognition.lang = 'pt-PT';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      // TRAVA ABSOLUTA: ignora qualquer captura enquanto a Sara estiver a falar
      if (saraEstaAFalar) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (!res?.isFinal) continue;
        const transcript = (res?.[0]?.transcript || '').trim();
        if (!transcript) continue;
        options.onResult(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      const errCode = event?.error || 'erro_desconhecido';
      if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
        manuallyStopped = true;
        micShouldBeActive = false;
        options.onError('Permissão de microfone recusada no navegador.');
        options.onEnd();
      } else if (errCode !== 'no-speech' && errCode !== 'aborted') {
        options.onError(`Microfone: ${errCode}`);
      }
    };

    recognition.onend = () => {
      if (activeRecognition === recognition) {
        activeRecognition = null;
      }
      // Se pausou porque a Sara começou a falar, o callback da fala religará 400ms depois do término
      if (saraEstaAFalar) {
        return;
      }
      if (!manuallyStopped && options.shouldKeepListening()) {
        restartTimer = setTimeout(startSession, 250);
      } else {
        micShouldBeActive = false;
        options.onEnd();
      }
    };

    try {
      recognition.start();
    } catch {
      if (!manuallyStopped && options.shouldKeepListening() && !saraEstaAFalar) {
        restartTimer = setTimeout(startSession, 500);
      }
    }
  };

  resumeMicFn = startSession;
  startSession();

  return () => {
    manuallyStopped = true;
    micShouldBeActive = false;
    resumeMicFn = null;
    if (restartTimer) clearTimeout(restartTimer);
    if (restartAfterSpeechTimer) {
      clearTimeout(restartAfterSpeechTimer);
      restartAfterSpeechTimer = null;
    }
    try {
      activeRecognition?.stop();
    } catch {
      // ignore
    }
    activeRecognition = null;
    if (hardwareAudioStream) {
      hardwareAudioStream.getTracks().forEach((t) => t.stop());
      hardwareAudioStream = null;
    }
  };
}

let cachedFemaleVoice: SpeechSynthesisVoice | null = null;

function pickBestFemalePortugueseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return cachedFemaleVoice;

  const ptVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'));
  if (!ptVoices.length) return null;

  const googleFemale = ptVoices.find(
    (v) =>
      /google/i.test(v.name) &&
      !/male|duarte|antonio|antónio|daniel|pedro/i.test(v.name)
  );
  if (googleFemale) {
    cachedFemaleVoice = googleFemale;
    return cachedFemaleVoice;
  }

  const preferredFemale = ptVoices.find((v) =>
    /francisca|raquel|maria|joana|luciana|vitoria|vitória|camila|ines|inês|fernanda|helena|female/i.test(
      v.name
    )
  );
  if (preferredFemale) {
    cachedFemaleVoice = preferredFemale;
    return cachedFemaleVoice;
  }

  const nonMale = ptVoices.find(
    (v) => !/duarte|antonio|antónio|daniel|pedro|ricardo|tiago|male/i.test(v.name)
  );

  cachedFemaleVoice = nonMale || ptVoices[0];
  return cachedFemaleVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    pickBestFemalePortugueseVoice();
  };
}

let speakingStateListener: ((speaking: boolean) => void) | null = null;

export function setSpeakingStateListener(cb: ((speaking: boolean) => void) | null): void {
  speakingStateListener = cb;
}

export function stopSaraSpeech(): void {
  saraEstaAFalar = false;
  speakingStateListener?.(false);
  if (restartAfterSpeechTimer) {
    clearTimeout(restartAfterSpeechTimer);
    restartAfterSpeechTimer = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export interface SpeakOptions {
  level?: VoiceLevel;
  forceSpeak?: boolean;
  isQuestionReply?: boolean;
  allowInfraMention?: boolean;
  onFinished?: () => void;
}

/**
 * Fala apenas o resumo essencial (ou detalhe se forceSpeak / level='full').
 * Pausa o microfone durante toda a fala e só religa 400ms depois de terminar.
 */
export function speakAsSara(
  text: string,
  enabled: boolean,
  onFinishedOrOptions?: (() => void) | SpeakOptions
): void {
  const opts: SpeakOptions =
    typeof onFinishedOrOptions === 'function'
      ? { onFinished: onFinishedOrOptions }
      : onFinishedOrOptions || {};

  if (!enabled || (saraSilenciada && !opts.forceSpeak)) {
    opts.onFinished?.();
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts.onFinished?.();
    return;
  }

  try {
    let spoken = resumirParaVoz(text, opts.level || 'short', {
      allowInfraMention: opts.allowInfraMention,
    });
    if (!spoken) {
      opts.onFinished?.();
      return;
    }

    // Não repetir a mesma informação já dita recentemente por voz
    const normKey = normalizeForRepeatCheck(spoken);
    if (!opts.forceSpeak && normKey && recentSpokenNormalized.includes(normKey)) {
      if (opts.isQuestionReply) {
        spoken = 'Já te disse, Eletro-Júnior, está no chat.';
      } else {
        opts.onFinished?.();
        return;
      }
    } else if (normKey) {
      recentSpokenNormalized.push(normKey);
      if (recentSpokenNormalized.length > 8) recentSpokenNormalized.shift();
    }

    if (restartAfterSpeechTimer) {
      clearTimeout(restartAfterSpeechTimer);
      restartAfterSpeechTimer = null;
    }

    // 1. Ativa trava ANTES de falar e pausa o microfone imediatamente
    saraEstaAFalar = true;
    speakingStateListener?.(true);
    try {
      activeRecognition?.stop();
    } catch {
      // ignore
    }

    window.speechSynthesis.cancel();

    const period = getTimePeriod();
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = 'pt-PT';
    // Voz natural equilibrada com adaptação subtil à hora do dia
    utterance.rate = period === 'night' ? 1.01 : 1.05;
    utterance.pitch = period === 'night' ? 1.0 : period === 'morning' ? 1.07 : 1.05;
    utterance.volume = period === 'night' ? 0.85 : 1.0;

    const voice = pickBestFemalePortugueseVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    const finishSpeech = () => {
      saraEstaAFalar = false;
      speakingStateListener?.(false);
      opts.onFinished?.();

      // Espera 400ms após terminar de falar e volta a ligar o microfone se estiver ativo
      if (micShouldBeActive && resumeMicFn) {
        restartAfterSpeechTimer = setTimeout(() => {
          if (!saraEstaAFalar && micShouldBeActive) {
            resumeMicFn?.();
          }
        }, 400);
      }
    };

    utterance.onend = finishSpeech;
    utterance.onerror = finishSpeech;

    window.speechSynthesis.speak(utterance);
  } catch {
    saraEstaAFalar = false;
    speakingStateListener?.(false);
    opts.onFinished?.();
  }
}

export function playCompletionChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const startAt = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.38);
    });
  } catch {
    // ignore audio block
  }
}
