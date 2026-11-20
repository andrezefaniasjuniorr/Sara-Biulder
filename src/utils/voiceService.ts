export type VoiceLevel = 'short' | 'medium' | 'full';

export type VoiceCommandAction =
  | { type: 'background_smalltalk'; reply: string; raw: string }
  | { type: 'silence_sara'; raw: string }
  | { type: 'voice_level'; level: VoiceLevel; raw: string }
  | { type: 'voice_speed'; direction: 'faster' | 'slower' | 'normal'; raw: string }
  | { type: 'switch_manual'; raw: string }
  | { type: 'switch_automatic'; goal?: string; contextCue?: 'sleep' | 'leave'; raw: string }
  | { type: 'continue_project'; raw: string }
  | { type: 'query_status'; raw: string }
  | { type: 'query_report'; raw: string }
  | { type: 'open_editor' }
  | { type: 'open_editor_fullscreen' }
  | { type: 'open_files' }
  | { type: 'close_editor_or_back' }
  | { type: 'open_console' }
  | { type: 'show_preview' }
  | { type: 'fix_error' }
  | { type: 'preview_mobile' }
  | { type: 'preview_tablet' }
  | { type: 'preview_desktop' }
  | { type: 'open_deploy' }
  | { type: 'push_github' }
  | { type: 'save_project' }
  | { type: 'download_zip' }
  | { type: 'clear_chat' }
  | { type: 'open_projects' }
  | { type: 'open_settings' }
  | { type: 'start_listening' }
  | { type: 'stop_listening' }
  | { type: 'undo_version' }
  | { type: 'refresh_preview' }
  | { type: 'prompt'; text: string };

function getTimePeriod(): 'morning' | 'afternoon' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  return 'night';
}

const recentSpontaneousReplies: string[] = [];

function pickNonRepeating(options: string[]): string {
  const candidates = options.filter((opt) => !recentSpontaneousReplies.includes(opt));
  const pool = candidates.length > 0 ? candidates : options;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  recentSpontaneousReplies.push(chosen);
  if (recentSpontaneousReplies.length > 6) {
    recentSpontaneousReplies.shift();
  }
  return chosen;
}

export function getInstantSmallTalkReply(normalizedLower: string): string | null {
  const period = getTimePeriod();
  const clean = normalizedLower.replace(/[!?,.;:]/g, '').trim();

  if (
    /^(ola|oi|hey|ei)(\s+sara)?(\s+(tudo bem|como estas|como vai|esta tudo bem))?$/i.test(clean) ||
    /^(bom dia|boa tarde|boa noite)(\s+sara)?(\s+(tudo bem|como estas))?$/i.test(clean)
  ) {
    if (period === 'night') {
      return pickNonRepeating([
        'Estou acordada e ligada, Eletro-Jr! O que vamos construir antes de dormir?',
        'Cá estou eu, Eletro-Jr. Tens alguma ideia forte na cabeça hoje?',
        'Fala comigo, Eletro-Jr! Vamos montar um projeto pesado ou afinar código?',
        'Chegaste na hora certa, Eletro-Jr. Qual é a missão de hoje à noite?',
        'Olá, Eletro-Jr! Manda o desafio que eu já abri as ferramentas.',
      ]);
    }
    if (period === 'morning') {
      return pickNonRepeating([
        'Acordei pronta para codar, Eletro-Jr! O que inventamos hoje?',
        'Fala, Eletro-Jr! Qual sistema ou jogo vai sair do papel agora?',
        'Oi, Eletro-Jr! Já estou com os motores quentes — manda a tua ideia.',
        'Estou por aqui, Eletro-Jr! Hoje vamos construir algo fora da caixa?',
        'Diga lá, chefe! O que vamos arquitetar nesta manhã?',
      ]);
    }
    return pickNonRepeating([
      'Oi, Eletro-Jr! Já estava à tua espera — o que vamos construir agora?',
      'Fala, Eletro-Jr! Manda o próximo projeto que eu separo logo as pastas todas.',
      'Estou ligada, Eletro-Jr! Queres criar um site, um app ou partimos para um jogo?',
      'E aí, Eletro-Jr! Alguma ideia nova a ferver ou continuamos a programar?',
      'Pronta para a ação, Eletro-Jr! Diz-me o que tens em mente.',
      'Sempre a postos, Eletro-Jr! Vamos surpreender hoje com quê?',
    ]);
  }

  if (
    /^(sara\s+)?(estas ai|tas ai|ouves me|esta me a ouvir|sara)$/i.test(clean) ||
    /^(sara\s+)?(como estas|tudo bem|como vai|esta tudo bem)(\s+sara)?$/i.test(clean)
  ) {
    return pickNonRepeating([
      'Por aqui está tudo a mil, Eletro-Jr! E desse lado, pronto para criar?',
      'Estou impecável e cheia de ideias, Eletro-Jr. O que vamos montar?',
      'A funcionar sem nenhum erro no console! E tu, Eletro-Jr, o que trazes hoje?',
      'Tudo ótimo, Eletro-Jr! Manda código ou manda voz que eu respondo.',
    ]);
  }

  if (/^(obrigado|obrigada|valeu|muito obrigado)(\s+sara)?$/i.test(clean)) {
    return pickNonRepeating([
      'Sempre às ordens, Eletro-Jr!',
      'Tamo junto, Eletro-Jr! Precisando de mais alguma coisa, chama.',
      'Não tens de quê, Eletro-Jr. Bora para a próxima!',
      'É para isso que estou cá, Eletro-Jr!',
    ]);
  }

  if (/^(tchau|ate logo|ate ja|ate amanha|adeus)(\s+sara)?$/i.test(clean)) {
    return period === 'night'
      ? pickNonRepeating([
          'Vai descansar tranquilo, Eletro-Jr! Amanhã continuamos.',
          'Até amanhã, Eletro-Jr! Fica tudo guardado por aqui.',
        ])
      : pickNonRepeating([
          'Até já, Eletro-Jr! Quando voltares, é só chamar.',
          'Fica bem, Eletro-Jr! Estou por aqui sempre que precisares.',
        ]);
  }

  return null;
}

export function getBuildAcceptanceSpeech(prompt: string, agentMode: 'manual' | 'automatic'): string {
  const lower = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let idea = 'uma arquitetura organizada em várias pastas e lógica completa';
  if (/(loja|e-?commerce|mercado|venda|produtos|roupa)/i.test(lower)) {
    idea = 'uma loja completa com pastas separadas para catálogo, componentes, carrinho, checkout e pagamentos';
  } else if (/(escola|aluno|turma|professor|nota|academi)/i.test(lower)) {
    idea = 'um sistema escolar estruturado em pastas para alunos, notas, presenças, professores e relatórios';
  } else if (/(jogo|game|arcade|corrida|tiro|puzzle|carro)/i.test(lower)) {
    idea = 'um jogo completo separado em engine, render, components e scenes, com física, som e recordes';
  } else if (/(filme|serie|stream|video|cinema)/i.test(lower)) {
    idea = 'uma plataforma de streaming modular com pastas para catálogo, pesquisa e player';
  } else if (/(restaurante|padaria|cardapio|menu|cafe|pizza)/i.test(lower)) {
    idea = 'um sistema de pedidos completo com vitrine, filtros, carrinho e painel de encomendas';
  } else if (/(chat|mensag|conversa|whatsapp)/i.test(lower)) {
    idea = 'uma app de chat em tempo real com pastas para bolhas, contatos, voz e motor de mensagens';
  } else if (/(entrega|delivery|courier|motoboy|estafeta)/i.test(lower)) {
    idea = 'um sistema de entregas completo com rastreio, pedidos, rotas e gestão';
  } else if (/(clinica|hospital|consulta|medico|saude)/i.test(lower)) {
    idea = 'um sistema clínico com agenda, marcações e fichas completas de pacientes';
  }

  if (agentMode === 'automatic') {
    return pickNonRepeating([
      `Vamos a isso, Eletro-Jr! Já estou a montar ${idea} no automático.`,
      `Gostei desse desafio, Eletro-Jr. Vou estruturar ${idea} sozinha passo a passo.`,
      `Entendido! Já estou a desenhar ${idea} no modo automático.`,
      `Essa ideia tem força, Eletro-Jr! Vou construir ${idea} e testar tudo por ti.`,
    ]);
  }

  return pickNonRepeating([
    `Hmm, essa ideia é forte, Eletro-Jr! Estou a preparar ${idea}. Vamos pela Etapa 1 ou queres no automático?`,
    `Curti o pedido, Eletro-Jr! Já pensei em ${idea}. Começamos juntos ou passo para o automático?`,
    `Entendido, chefe! Vou estruturar ${idea}. Prefere aprovar cada etapa ou mando ver sozinha?`,
    `Ok, já visualizei a arquitetura de ${idea}. Aprovamos a primeira parte ou ativo o automático?`,
  ]);
}

export function getContinuationSpeech(projectName: string): string {
  return pickNonRepeating([
    `Já li o código de ${projectName}, Eletro-Jr. Vou acrescentar isto sem mexer no que já está bom.`,
    `Entendido! Estou a abrir os ficheiros de ${projectName} para aplicar esta melhoria agora.`,
    `Certo, Eletro-Jr — a atualizar ${projectName} em cima da estrutura atual.`,
    `Mãos à obra em ${projectName}! Já vi onde encaixa e vou programar isso agora.`,
  ]);
}

export function getModeSwitchSpeech(mode: 'manual' | 'automatic'): string {
  if (mode === 'manual') {
    return pickNonRepeating([
      'Modo manual ligado, Eletro-Jr! Vamos construir lado a lado passo a passo.',
      'Combinado, passei para o modo manual. Tu mandas o ritmo e eu executo cada etapa.',
      'Entendido, estou em modo manual agora. O que atacamos primeiro?',
    ]);
  }
  return pickNonRepeating([
    'Modo automático ligado, Eletro-Jr! Diz-me o que queres e eu construo, testo e corrijo tudo sozinha.',
    'Ativei o modo automático! Podes mandar o projeto que eu trato da arquitetura até ao teste final.',
    'Modo autónomo pronto, Eletro-Jr. Manda a missão que eu assumo daqui.',
  ]);
}

export function parseVoiceCommand(transcript: string): VoiceCommandAction {
  const clean = transcript.trim();
  const lower = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  // Conversa rápida em segundo plano (sem chamar IA e sem poluir o chat principal)
  const smallTalkReply = getInstantSmallTalkReply(lower);
  if (smallTalkReply) {
    return { type: 'background_smalltalk', reply: smallTalkReply, raw: clean };
  }

  // Calar a Sara imediatamente
  if (
    lower.includes('sara, cala') ||
    lower.includes('sara cala') ||
    lower.includes('cala a boca') ||
    lower.includes('para de falar') ||
    lower.includes('parar de falar') ||
    lower.includes('cala-te') ||
    lower.includes('cala te') ||
    lower === 'cala' ||
    lower.includes('fica calada')
  ) {
    return { type: 'silence_sara', raw: clean };
  }

  // Ajuste de velocidade da voz
  if (lower.includes('fala mais rapido') || lower.includes('mais rapido') || lower.includes('acelera a voz')) {
    return { type: 'voice_speed', direction: 'faster', raw: clean };
  }
  if (lower.includes('fala devagar') || lower.includes('fala mais devagar') || lower.includes('mais devagar')) {
    return { type: 'voice_speed', direction: 'slower', raw: clean };
  }
  if (lower.includes('velocidade normal')) {
    return { type: 'voice_speed', direction: 'normal', raw: clean };
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

  // Microfone desligar / ligar (verifica desligar primeiro para evitar colisão de 'desliga' conter 'liga')
  if (
    lower.includes('para de ouvir') ||
    lower.includes('desliga o microfone') ||
    lower.includes('desligar microfone') ||
    lower.includes('desligar o microfone') ||
    lower.includes('desativa o microfone') ||
    lower === 'silencio'
  ) {
    return { type: 'stop_listening' };
  }
  if (
    /\bliga o microfone\b/.test(lower) ||
    /\bligar (o )?microfone\b/.test(lower) ||
    /\bativa o microfone\b/.test(lower) ||
    /\bativar (o )?microfone\b/.test(lower)
  ) {
    return { type: 'start_listening' };
  }

  // Controlo total da plataforma (Editor, Ficheiros, Console, Preview, Deploy, Push, Projetos, Config)
  if (
    (lower.includes('editor') && (lower.includes('tela cheia') || lower.includes('ecra inteiro'))) ||
    lower.includes('abre o editor em tela cheia')
  ) {
    return { type: 'open_editor_fullscreen' };
  }
  if (lower.includes('fecha o editor') || lower.includes('fechar editor') || lower === 'sara, volta' || lower === 'sara volta' || lower === 'volta' || lower.includes('sair de tela cheia')) {
    return { type: 'close_editor_or_back' };
  }
  if (lower.includes('abre o editor') || lower.includes('abrir editor') || lower.includes('abrir o editor') || lower.includes('vai para o editor')) {
    return { type: 'open_editor' };
  }
  if (lower.includes('abre os ficheiros') || lower.includes('abrir ficheiros') || lower.includes('abre os arquivos') || lower.includes('abrir arquivos')) {
    return { type: 'open_files' };
  }
  if (lower.includes('abre o console') || lower.includes('abrir console') || lower.includes('abrir o console')) {
    return { type: 'open_console' };
  }
  if (lower.includes('mostra o preview') || lower.includes('abre o preview') || lower.includes('mostrar preview')) {
    return { type: 'show_preview' };
  }
  if (
    lower.includes('preview em telemovel') ||
    lower.includes('modo telemovel') ||
    lower.includes('visao telemovel') ||
    lower.includes('visao celular') ||
    lower.includes('modo celular')
  ) {
    return { type: 'preview_mobile' };
  }
  if (lower.includes('visao tablet') || lower.includes('modo tablet') || lower.includes('preview em tablet')) {
    return { type: 'preview_tablet' };
  }
  if (
    lower.includes('preview em pc') ||
    lower.includes('modo pc') ||
    lower.includes('visao pc') ||
    lower.includes('visao computador')
  ) {
    return { type: 'preview_desktop' };
  }
  if (lower.includes('faz deploy') || lower.includes('fazer deploy') || lower.includes('abre o deploy') || lower.includes('publica o site')) {
    return { type: 'open_deploy' };
  }
  if (lower.includes('faz push') || lower.includes('fazer push') || lower.includes('push para o github') || lower.includes('envia para o github')) {
    return { type: 'push_github' };
  }
  if (lower.includes('baixa o zip') || lower.includes('baixar zip') || lower.includes('baixar o zip') || lower.includes('descarrega o zip')) {
    return { type: 'download_zip' };
  }
  if (lower.includes('limpa o chat') || lower.includes('limpar chat') || lower.includes('limpar o chat')) {
    return { type: 'clear_chat' };
  }
  if (lower.includes('abre os projetos') || lower.includes('abrir projetos') || lower.includes('lista de projetos')) {
    return { type: 'open_projects' };
  }
  if (lower.includes('abre as configuracoes') || lower.includes('abrir configuracoes') || lower.includes('abre definicoes')) {
    return { type: 'open_settings' };
  }
  if (lower.includes('salva o projeto') || lower.includes('salvar o projeto') || lower.includes('guarda o projeto')) {
    return { type: 'save_project' };
  }
  if (lower.includes('corrige o erro') || lower.includes('corrigir o erro') || lower.includes('corrigir erro')) {
    return { type: 'fix_error' };
  }
  if (
    lower.includes('desfaz') ||
    lower.includes('desfazer') ||
    lower.includes('versao anterior') ||
    lower.includes('volta atras')
  ) {
    return { type: 'undo_version' };
  }
  if (
    lower.includes('atualiza o preview') ||
    lower.includes('recarrega o preview') ||
    lower.includes('recarregar preview')
  ) {
    return { type: 'refresh_preview' };
  }

  // Perguntar progresso durante automático
  if (
    lower.includes('como esta o projeto') ||
    lower.includes('em que etapa') ||
    lower.includes('como vai o projeto') ||
    lower.includes('qual o progresso') ||
    lower.includes('o que falta fazer')
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

  // Ativar ou voltar para Modo Manual (sempre imediato)
  if (
    lower.includes('modo manual') ||
    lower.includes('ativa o manual') ||
    lower.includes('ativar manual') ||
    lower.includes('muda para manual') ||
    lower.includes('muda para o manual') ||
    lower.includes('passa para manual') ||
    lower.includes('passa para o manual') ||
    lower.includes('volta para o manual') ||
    lower.includes('voltar para o manual') ||
    lower.includes('fica em manual') ||
    lower.includes('quero manual') ||
    lower.includes('vamos fazer juntos') ||
    /^(sara[,\s]+)?manual$/.test(lower)
  ) {
    return { type: 'switch_manual', raw: clean };
  }

  // Ativar Modo Automático (sempre imediato)
  const autoTrigger =
    lower.includes('modo automatico') ||
    lower.includes('ativa o automatico') ||
    lower.includes('ativar automatico') ||
    lower.includes('muda para automatico') ||
    lower.includes('muda para o automatico') ||
    lower.includes('passa para automatico') ||
    lower.includes('passa para o automatico') ||
    lower.includes('quero automatico') ||
    lower.includes('faz sozinha') ||
    lower.includes('fazer sozinha') ||
    lower.includes('modo autonomo') ||
    /^(sara[,\s]+)?automatico$/.test(lower);

  if (autoTrigger) {
    const contextCue: 'sleep' | 'leave' | undefined = lower.includes('dormir')
      ? 'sleep'
      : lower.includes('sair') || lower.includes('volto ja')
      ? 'leave'
      : undefined;

    const hasBuildRequest =
      /\b(cria|criar|faz|fazer|gera|gerar|constroi|construir|desenvolve|desenvolver)\b/i.test(lower);

    let extractedGoal = '';
    if (hasBuildRequest && !/^(sara[,\s]*)?faz sozinha$/i.test(lower)) {
      extractedGoal = clean
        .replace(/^(sara\s*,?\s*)/i, '')
        .replace(/\b(e\s+)?(ativa|ativar|liga|ligar|usa|muda\s+para|passa\s+para)\s+(o\s+)?(modo\s+)?autom[aá]tico.*$/i, '')
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

  // Continuar projeto de onde parou
  if (
    /^(sara[,\s]*)?continua(\s+o\s+projeto|\s+de\s+onde\s+parou|\s+de\s+onde\s+paramos)?$/.test(lower) ||
    lower.includes('continua de onde par') ||
    lower.includes('continuar projeto')
  ) {
    return { type: 'continue_project', raw: clean };
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
const VOICE_SPEED_KEY = 'sara_biulder_voice_speed_v1';

function loadSavedSpeechRate(): number {
  try {
    const raw = localStorage.getItem(VOICE_SPEED_KEY);
    if (raw) {
      const val = Number(raw);
      if (Number.isFinite(val) && val >= 0.75 && val <= 1.5) return val;
    }
  } catch {
    // ignore
  }
  return 1.05;
}

let customBaseRate = typeof window !== 'undefined' ? loadSavedSpeechRate() : 1.05;

export function adjustVoiceSpeed(direction: 'faster' | 'slower' | 'normal'): number {
  if (direction === 'normal') {
    customBaseRate = 1.05;
  } else if (direction === 'faster') {
    customBaseRate = Math.min(1.45, Number((customBaseRate + 0.15).toFixed(2)));
  } else {
    customBaseRate = Math.max(0.8, Number((customBaseRate - 0.15).toFixed(2)));
  }
  try {
    localStorage.setItem(VOICE_SPEED_KEY, String(customBaseRate));
  } catch {
    // ignore
  }
  return customBaseRate;
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
    // Voz natural equilibrada com ajuste de velocidade do Eletro-Jr e período do dia
    utterance.rate = period === 'night' ? Math.max(0.8, customBaseRate - 0.04) : customBaseRate;
    utterance.pitch = period === 'night' ? 1.0 : period === 'morning' ? 1.07 : 1.05;
    utterance.volume = period === 'night' ? 0.85 : 1.0;

    const voice = pickBestFemalePortugueseVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    let finished = false;
    const finishSpeech = () => {
      if (finished) return;
      finished = true;
      clearTimeout(safetyTimer);
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

    // Garantia de segurança caso o navegador bloqueie eventos onend de TTS
    const safetyMs = Math.min(7500, Math.max(1800, spoken.length * 70));
    const safetyTimer = setTimeout(finishSpeech, safetyMs);

    utterance.onend = finishSpeech;
    utterance.onerror = finishSpeech;

    window.speechSynthesis.speak(utterance);
  } catch {
    saraEstaAFalar = false;
    speakingStateListener?.(false);
    opts.onFinished?.();
  }
}

export function speakAsSaraAndWait(
  text: string,
  enabled: boolean,
  options?: Omit<SpeakOptions, 'onFinished'>
): Promise<void> {
  return new Promise((resolve) => {
    speakAsSara(text, enabled, {
      ...(options || {}),
      onFinished: resolve,
    });
  });
}

export function getSpokenBuildRecap(
  projectName?: string,
  filesCount = 0,
  voiceSummary?: string,
  strategicImprovements?: string[]
): string {
  if (voiceSummary && voiceSummary.trim().length > 10) {
    return voiceSummary.trim();
  }
  const base = projectName
    ? `Construí ${filesCount} ficheiros modulares no ${projectName}, Eletro-Júnior.`
    : `Atualizei ${filesCount} módulos do sistema no preview, Eletro-Júnior.`;
  if (strategicImprovements && strategicImprovements.length >= 2) {
    return `${base} Como próximos passos sugiro ${strategicImprovements[0]} ou ${strategicImprovements[1]}.`;
  }
  if (strategicImprovements && strategicImprovements.length === 1) {
    return `${base} Próxima melhoria recomendada: ${strategicImprovements[0]}.`;
  }
  return `${base} Podes testar tudo ao vivo ou pedir o próximo ajuste por voz.`;
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
