import type { ProjectType } from '../types/builder';
import { extractImageGenRequest, parseImageVoiceCommand } from '../services/imageGenService';

export type VoiceLevel = 'short' | 'medium' | 'full';

export type VoiceCommandAction =
  | { type: 'background_smalltalk'; reply: string; raw: string }
  | { type: 'interrupt_sara'; trailingCommand?: string; raw: string }
  | { type: 'silence_sara'; raw: string }
  | { type: 'unsilence_sara'; raw: string }
  | {
      type: 'enter_call_mode';
      reason?: 'chamada' | 'reuniao' | 'aula' | 'ocupado';
      raw: string;
    }
  | { type: 'stop_all_and_pause'; raw: string }
  | { type: 'pause_current_activity'; raw: string }
  | { type: 'show_builder_progress'; raw: string }
  | { type: 'confirm_pending'; raw: string }
  | { type: 'cancel_pending'; raw: string }
  | { type: 'voice_level'; level: VoiceLevel; raw: string }
  | { type: 'voice_speed'; direction: 'faster' | 'slower' | 'normal'; raw: string }
  | { type: 'switch_manual'; raw: string }
  | { type: 'switch_automatic'; goal?: string; contextCue?: 'sleep' | 'leave'; raw: string }
  | { type: 'pause_mission' }
  | { type: 'resume_mission' }
  | { type: 'open_report' }
  | { type: 'continue_project'; raw: string }
  | { type: 'query_status'; raw: string }
  | { type: 'query_report'; raw: string }
  | { type: 'open_editor' }
  | { type: 'open_editor_fullscreen' }
  | { type: 'open_files' }
  | { type: 'focus_file'; filePath: string }
  | { type: 'delete_file'; filePath: string }
  | { type: 'close_editor_or_back' }
  | { type: 'open_console' }
  | { type: 'show_preview' }
  | { type: 'open_preview_fullscreen' }
  | { type: 'toggle_presentation' }
  | { type: 'fix_error' }
  | { type: 'preview_mobile' }
  | { type: 'preview_tablet' }
  | { type: 'preview_desktop' }
  | { type: 'open_deploy' }
  | { type: 'push_github'; preAuthorized?: boolean }
  | { type: 'save_project' }
  | { type: 'download_zip' }
  | { type: 'clear_chat'; preAuthorized?: boolean }
  | { type: 'open_projects' }
  | { type: 'create_project'; name?: string; projectType?: ProjectType }
  | { type: 'open_named_project'; name: string }
  | { type: 'delete_project'; name?: string }
  | { type: 'duplicate_project'; name?: string }
  | { type: 'rename_project'; name: string }
  | { type: 'open_settings' }
  | { type: 'start_listening' }
  | { type: 'stop_listening' }
  | { type: 'undo_version' }
  | { type: 'refresh_preview' }
  | { type: 'open_builder_mode'; raw: string }
  | { type: 'open_jarvis_mode'; raw: string }
  | {
      type: 'open_jarvis_module';
      moduleTab: 'voz' | 'sistema' | 'agenda' | 'musica' | 'documentos' | 'tarefas';
      raw: string;
    }
  | { type: 'open_panel'; raw: string }
  | { type: 'close_panel'; raw: string }
  | { type: 'pause_music'; raw: string }
  | { type: 'resume_music'; raw: string }
  | { type: 'close_music'; raw: string }
  | { type: 'volume_up'; raw: string }
  | { type: 'volume_down'; raw: string }
  | { type: 'close_stage'; raw: string }
  | { type: 'repeat_sara'; raw: string }
  | { type: 'continue_sara'; raw: string }
  | { type: 'pause_reading'; raw: string }
  | { type: 'resume_reading'; raw: string }
  | { type: 'stop_reading'; raw: string }
  | { type: 'focus_mode_on'; raw: string }
  | { type: 'focus_mode_off'; raw: string }
  | { type: 'open_admin'; raw: string }
  | { type: 'logout_session'; raw: string }
  | { type: 'wake_ack'; reply: string; raw: string }
  | { type: 'unintelligible_clarify'; reply: string; raw: string }
  | { type: 'next_music'; raw: string }
  | { type: 'prev_music'; raw: string }
  | { type: 'mute_music'; raw: string }
  | { type: 'shuffle_music'; raw: string }
  | { type: 'loop_music'; raw: string }
  | { type: 'like_music'; raw: string }
  | { type: 'identify_music'; raw: string }
  | {
      type: 'smart_home_control';
      device: 'luz' | 'ventoinha' | 'ac' | 'porta' | 'tomada' | 'modo';
      state: 'on' | 'off' | 'scene';
      room?: string;
      sceneName?: string;
      reply: string;
      raw: string;
    }
  | {
      type: 'electric_calc';
      voltage?: number;
      current?: number;
      resistance?: number;
      power?: number;
      reconstructed: string;
      raw: string;
    }
  | { type: 'switch_media_source'; source: 'internet' | 'local'; raw: string }
  | {
      type: 'play_local_media';
      kind: 'music' | 'video' | 'image' | 'audio' | 'any';
      query?: string;
      folderOrDate?: string;
      raw: string;
    }
  | {
      type: 'open_local_document';
      docCategory: 'pdf' | 'word' | 'ppt' | 'excel' | 'recent' | 'any';
      query?: string;
      raw: string;
    }
  | {
      type: 'filter_local_library';
      filter: 'all' | 'pdfs' | 'videos' | 'music' | 'images' | 'documents' | 'recents' | 'favorites';
      query?: string;
      raw: string;
    }
  | { type: 'media_seek'; seconds: number; raw: string }
  | { type: 'media_fullscreen'; enabled: boolean; raw: string }
  | { type: 'ask_media_source_ambiguity'; query?: string; kind: 'music' | 'video'; raw: string }
  | { type: 'open_radar_map'; raw: string }
  | { type: 'open_profile_devices'; raw: string }
  | { type: 'open_find_phone'; raw: string }
  | { type: 'open_background_settings'; raw: string }
  | { type: 'stop_location_sharing'; raw: string }
  | { type: 'activate_ghost_mode'; raw: string }
  | { type: 'show_on_map_on'; raw: string }
  | { type: 'enable_background_mode'; raw: string }
  | { type: 'stop_background_mode'; raw: string }
  | { type: 'radar_track_target'; query: string; raw: string }
  | { type: 'radar_view_mode'; mode: 'roadmap' | 'hybrid' | 'terrain'; raw: string }
  | { type: 'radar_ask_target_street'; raw: string }
  | { type: 'radar_show_route'; raw: string }
  | { type: 'radar_stop_tracking'; raw: string }
  | { type: 'prompt'; text: string };

export type VoiceDomainTopic =
  | 'music'
  | 'builder'
  | 'electricity'
  | 'home'
  | 'study'
  | 'agenda'
  | 'system'
  | 'general';

export interface VoiceParseContext {
  workspaceMode?: 'jarvis' | 'builder';
  activeTab?: 'files' | 'editor' | 'console';
  previewDevice?: 'desktop' | 'tablet' | 'mobile';
  isEditorFullscreen?: boolean;
  isPreviewFullscreen?: boolean;
  hasOpenOverlay?: boolean;
  hasPendingConfirm?: boolean;
  hasActiveMedia?: boolean;
  mediaSource?: 'youtube' | 'local';
  isMediaPaused?: boolean;
  hasActiveStage?: boolean;
  activeLocalKind?: 'music' | 'video' | 'image' | 'document' | 'browser';
  hasActiveReading?: boolean;
  isReadingPaused?: boolean;
  hasLocalPermission?: boolean;
  preferredMediaSource?: 'internet' | 'local';
  isOffline?: boolean;
  projectFiles?: string[];
  availableProjects?: string[];
  isMissionActive?: boolean;
  isMissionPaused?: boolean;
  recentUserUtterances?: string[];
  lastTopic?: VoiceDomainTopic;
  lastTrackTitle?: string;
  lastTrackArtist?: string;
  isOwner?: boolean;
  callName?: string;
  isSilenced?: boolean;
  isCallMode?: boolean;
}

export interface ReconstructedVoiceResult {
  original: string;
  cleaned: string;
  reconstructed: string;
  wasDistorted: boolean;
  domainHint: VoiceDomainTopic;
  unintelligible: boolean;
  clarifierSpeech?: string;
}

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

export function getLoginGreetingSpeech(
  callName: string,
  isOwner: boolean,
  unreadAlertsCount = 0,
  isGuest = false,
  isNewAccount = false
): string {
  if (isOwner) {
    if (unreadAlertsCount > 0) {
      return `Bem-vindo de volta, chefe. Tens ${unreadAlertsCount} alerta${unreadAlertsCount > 1 ? 's' : ''} de segurança para ver no Admin.`;
    }
    return 'Bem-vindo de volta, chefe. Todos os sistemas estão prontos.';
  }
  if (isGuest) {
    return 'Modo convidado ativo por cinco minutos. Podes conversar ou explorar à vontade.';
  }
  const cleanName = callName.trim() || 'visitante';
  if (isNewAccount) {
    return `Olá, ${cleanName}! Conta criada. O que vamos fazer hoje?`;
  }
  const welcomeWord = cleanName.toLowerCase().endsWith('a') ? 'bem-vinda' : 'bem-vindo';
  return pickNonRepeating([
    `Olá, ${cleanName}, ${welcomeWord} de volta!`,
    `Olá, ${cleanName}, o que vamos fazer hoje?`,
  ]);
}

export function getInactivityLogoutSpeech(): string {
  return 'Sessão encerrada por inatividade.';
}

export function getGuestExpirySpeech(): string {
  return 'O tempo do modo convidado terminou. Até à próxima.';
}

export function getInstantSmallTalkReply(
  normalizedLower: string,
  callName?: string,
  isOwner = false
): string | null {
  const period = getTimePeriod();
  const clean = normalizedLower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[!?,.;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const safeName = callName?.trim();
  const nameChunk = safeName ? `, ${safeName}` : '';

  // Chamamentos rápidos e alertas de presença
  if (
    /^(ei|pssst|psst|olha|escuta|acorda|acorda sara|sara acorda|sou eu|chefe aqui)$/i.test(clean)
  ) {
    if (isOwner) {
      if (clean === 'chefe aqui') {
        return pickNonRepeating([
          'Sempre a postos, chefe! Manda vir.',
          'Às ordens, Senhor Júnior! Que cena vamos atacar?',
        ]);
      }
      return pickNonRepeating([
        'Estou ligada, chefe! Manda vir.',
        'Sempre a postos, Senhor Júnior! Que cena vamos atacar?',
        'Estou aqui a ouvir-te. Podes mandar.',
        'Acordada e pronta! Bora lá.',
      ]);
    }
    return pickNonRepeating([
      `Estou aqui${nameChunk}! Podes falar.`,
      `A ouvir-te${nameChunk}. Que precisas agora?`,
      'Ligada e pronta! Manda vir.',
    ]);
  }

  if (
    /^(ola|oi|hey|ei)(\s+sara)?(\s+(tudo bem|como estas|como vai|esta tudo bem|ta se bem|tasse bem))?$/i.test(
      clean
    ) ||
    /^(bom dia|boa tarde|boa noite)(\s+sara)?(\s+(tudo bem|como estas|ta se bem))?$/i.test(clean)
  ) {
    if (!isOwner) {
      if (period === 'night') {
        return pickNonRepeating([
          `Olá${nameChunk}! Estou por aqui. O que vamos fazer esta noite?`,
          `Boa noite${nameChunk}! Diz-me o que precisas agora.`,
        ]);
      }
      if (period === 'morning') {
        return pickNonRepeating([
          `Bom dia${nameChunk}! O que vamos fazer hoje?`,
          `Olá${nameChunk}! Pronta para te ajudar — por onde começamos?`,
        ]);
      }
      return pickNonRepeating([
        `Olá${nameChunk}! O que vamos fazer hoje?`,
        `Oi${nameChunk}! Em que posso ajudar agora?`,
      ]);
    }
    if (period === 'night') {
      return pickNonRepeating([
        'Estou acordada e ligada. O que vamos criar hoje à noite?',
        'Cá estou eu, chefe. Tens alguma ideia forte em mente?',
        'Fala comigo! Vamos resolver algum mambo ou programar algo novo?',
        'Chegaste na hora certa, Senhor Júnior. Qual é a missão agora?',
        'Olá! Manda o desafio que os sistemas já estão quentes.',
      ]);
    }
    if (period === 'morning') {
      return pickNonRepeating([
        'Bom dia! Acordei pronta — o que inventamos hoje?',
        'Fala, chefe! Qual sistema ou ideia vai sair do papel agora?',
        'Oi! Já estou com os motores prontos — diz-me o plano.',
        'Estou por aqui. Hoje vamos construir algo fora da caixa?',
        'Bom dia, Senhor Júnior! Por onde queres arrancar nesta manhã?',
      ]);
    }
    return pickNonRepeating([
      'Oi! Já estava à tua espera — o que vamos fazer agora?',
      'Fala comigo! Manda o próximo desafio que eu entro logo em ação.',
      'Estou ligada! Queres música, estudo ou construir algum projeto?',
      'E aí, chefe! Alguma cena nova a ferver?',
      'Pronta para a ação. Diz-me o que tens em mente.',
      'Sempre a postos, Senhor Júnior! Vamos surpreender hoje com quê?',
    ]);
  }

  // Gírias moçambicanas / expressões de confirmação casual / energia
  if (
    /^(sara\s+)?(ya|yeah|pode ser|exato|isso mesmo|e isso|dale|bora|bora la|manda vir|toca a fazer|ta se bem|ta-se bem|tasse bem|tasse|esta bem|na boa|fixe|nice|top|dope|ta a bater|bater maningue|maningue fixe|bue fixe)$/i.test(
      clean
    )
  ) {
    if (isOwner) {
      return pickNonRepeating([
        'Tá-se bem, chefe! Manda o próximo comando.',
        'Fixe! É mesmo esse o espírito — estou a postos.',
        'Bora lá! O que queres atacar agora?',
        'Top! Diz-me só a próxima cena que eu executo já.',
      ]);
    }
    return pickNonRepeating([
      `Fixe${nameChunk}! O que fazemos a seguir?`,
      'Tá-se bem! Manda o próximo pedido.',
      'Bora lá! Estou pronta para ajudar.',
    ]);
  }

  if (/^(epa|ih|jura|serio|estas a ver|tas a ver)(\s+sara)?$/i.test(clean)) {
    return isOwner
      ? pickNonRepeating([
          'Juro mesmo, chefe! Estou aqui ligada contigo.',
          'Epa, conta-me lá essa cena!',
          'Estou a ver, sim! Continua.',
        ])
      : pickNonRepeating([
          'Estou a acompanhar-te! Conta-me mais.',
          'Epa, diz-me o que aconteceu!',
        ]);
  }

  if (
    /^(deixa|deixa la|deixa pra la|nao e isso|nao era isso|errado|nao|nada|esquece|cancela|chega|basta|ja chega)(\s+sara)?$/i.test(
      clean
    )
  ) {
    return pickNonRepeating([
      'Tranquilo, deixei isso para lá.',
      'Sem stress, parei por aqui. Manda outra cena quando quiseres.',
      'Na boa, esquecido! O que fazemos agora?',
    ]);
  }

  if (/^(vou bazar|bazar|estou a bazar|to a bazar)(\s+sara)?$/i.test(clean)) {
    return isOwner
      ? pickNonRepeating([
          'Vai lá tranquilo, chefe! Quando voltares, é só chamar.',
          'Fica bem, Senhor Júnior! Deixo tudo guardado por aqui.',
        ])
      : pickNonRepeating([
          `Vai na boa${nameChunk}! Até já.`,
          'Fica bem! Quando voltares, chama.',
        ]);
  }

  if (/^(nao ta a dar|nao esta a dar|ta dificil|esta dificil)(\s+sara)?$/i.test(clean)) {
    return isOwner
      ? pickNonRepeating([
          'Epa, não stressa chefe — diz-me qual é o mambo que a gente resolve já.',
          'Calma! Mostra-me onde trancou que eu ajudo-te a destravar isso agora.',
        ])
      : pickNonRepeating([
          'Calma, diz-me o que não está a dar que eu ajudo a resolver agora.',
          'Sem stress — explica-me onde encravou e vamos desbloquear isso.',
        ]);
  }

  if (
    /^(sara\s+)?(estas ai|tas ai|ouves me|esta me a ouvir|me ouves|sara)$/i.test(clean) ||
    /^(sara\s+)?(como estas|tudo bem|como vai|esta tudo bem|como tas)(\s+sara)?$/i.test(clean)
  ) {
    return isOwner
      ? pickNonRepeating([
          'Por aqui está tudo a bater forte! E desse lado, tudo fixe?',
          'Estou impecável e cheia de ideias. O que trazes hoje?',
          'A funcionar sem nenhum erro! Conta-me lá o que precisas.',
          'Tudo ótimo, chefe! Manda voz ou texto que eu respondo já.',
        ])
      : pickNonRepeating([
          `Estou aqui${nameChunk}! O que precisas agora?`,
          'Tudo ótimo por aqui! Conta-me o que queres fazer.',
        ]);
  }

  if (/^(obrigado|obrigada|valeu|muito obrigado|brigad[oa])(\s+sara)?$/i.test(clean)) {
    return pickNonRepeating([
      'Sempre às ordens!',
      'De nada! Precisando de mais alguma cena, chama.',
      'Não tens de quê. Bora para a próxima!',
      'É para isso que estou cá!',
    ]);
  }

  if (/^(tchau|ate logo|ate ja|ate amanha|adeus)(\s+sara)?$/i.test(clean)) {
    if (!isOwner) {
      return pickNonRepeating([
        `Até já${nameChunk}! Quando precisares, é só chamar.`,
        'Fica bem! Estou por aqui.',
      ]);
    }
    return period === 'night'
      ? pickNonRepeating([
          'Vai descansar tranquilo! Amanhã continuamos.',
          'Até amanhã, Senhor Júnior! Fica tudo guardado por aqui.',
        ])
      : pickNonRepeating([
          'Até já! Quando voltares, é só chamar.',
          'Fica bem! Estou por aqui sempre que precisares.',
        ]);
  }

  return null;
}

export function getBuildAcceptanceSpeech(
  prompt: string,
  agentMode: 'manual' | 'automatic',
  isOwner = false
): string {
  const lower = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let coreIdea = 'uma arquitetura modular organizada por pastas';
  let suggestion = 'posso incluir um layout responsivo mobile-first e animações suaves para dar fluidez';

  if (/(loja|e-?commerce|mercado|venda|produtos|roupa|padaria|restaurante)/i.test(lower)) {
    coreIdea = 'uma loja completa separada em catálogo, carrinho, checkout e serviços';
    suggestion = 'sugiro adicionarmos filtros rápidos por categoria, carrinho persistente e resumo de encomenda por WhatsApp';
  } else if (/(escola|aluno|turma|professor|nota|academi)/i.test(lower)) {
    coreIdea = 'um sistema escolar estruturado por alunos, notas, presenças e relatórios';
    suggestion = 'vale muito a pena colocar gráficos de desempenho e fichas pesquisáveis em tempo real';
  } else if (/(jogo|game|arcade|corrida|tiro|puzzle|carro|nave)/i.test(lower)) {
    coreIdea = 'um jogo modular com engine de física, áudio, cenas e sistema de recordes';
    suggestion = 'posso colocar efeitos sonoros sintetizados, partículas no impacto e ranking local de pontuação máxima';
  } else if (/(dashboard|painel|financeir|analytics|grafico|kpi|relatorio)/i.test(lower)) {
    coreIdea = 'um painel analítico profissional com módulos de dados, KPIs e gráficos interativos';
    suggestion = 'recomendo gráficos interativos com alternância de tema e exportação rápida';
  } else if (/(filme|serie|stream|video|cinema|musica)/i.test(lower)) {
    coreIdea = 'uma plataforma de streaming organizada com catálogo, pesquisa e player dinâmico';
    suggestion = 'podemos destacar um banner principal dinâmico, filtros instantâneos e lista de favoritos';
  } else if (/(chat|mensag|conversa|whatsapp)/i.test(lower)) {
    coreIdea = 'uma aplicação de mensagens em tempo real dividida por contactos, bolhas e serviços';
    suggestion = 'sugiro suporte a estados de leitura, pesquisa de conversas e atalhos rápidos de voz';
  } else if (/(clinica|hospital|consulta|medico|saude)/i.test(lower)) {
    coreIdea = 'um sistema clínico com agenda de marcações, fichas de pacientes e painel diário';
    suggestion = 'posso organizar calendário visual, alertas de próximas consultas e histórico limpo';
  }

  if (agentMode === 'automatic') {
    const opts = [
      `Aceitei o desafio! Vou montar ${coreIdea}, e ${suggestion}. Assumo tudo sozinha agora e testo no preview.`,
      `Bora lá! Para esse projeto vamos usar ${coreIdea}, e ${suggestion}. Já entro em ação no modo automático.`,
    ];
    if (isOwner) {
      opts.push(
        `Boa ideia, chefe! Estou a estruturar ${coreIdea}, onde ${suggestion}. Fica tranquilo que construo e valido etapa por etapa.`
      );
    }
    return pickNonRepeating(opts);
  }

  const manualOpts = [
    `Curti muito essa proposta! Pensei em ${coreIdea}, e ${suggestion}. Concordas em avançarmos com a primeira etapa ou queres ajustar algo antes?`,
    `Vamos construir isto juntos! Proponho ${coreIdea}, e ${suggestion}. Aprovas o plano para eu codar a primeira parte?`,
  ];
  if (isOwner) {
    manualOpts.push(
      `Excelente pedido, Senhor Júnior! A minha sugestão é estruturar ${coreIdea}, além disso ${suggestion}. Posso começar pela Etapa 1 ou preferes mudar algum detalhe?`
    );
  }
  return pickNonRepeating(manualOpts);
}

export function getContinuationSpeech(
  projectName: string,
  agentMode: 'manual' | 'automatic' = 'automatic',
  isOwner = false
): string {
  if (agentMode === 'manual') {
    return pickNonRepeating([
      `Já analisei os ficheiros atuais de ${projectName}, mantendo tudo o que já funciona. Posso aplicar esta evolução por etapas contigo agora ou queres ajustar algum ponto primeiro?`,
      `Estou por dentro da estrutura de ${projectName}! Vou integrar esta melhoria sem estragar o código existente. Aprovas avançar já?`,
    ]);
  }
  const opts = [
    `Já li os ficheiros atuais de ${projectName} e vou integrar isto mantendo toda a base intacta e responsiva. Começo já a atualizar e testar no preview!`,
    `Mãos à obra em ${projectName}! Vou preservar o que já está bom, reforçar o visual e testar no console.`,
  ];
  if (isOwner) {
    opts.push(
      `Entendido, chefe! Analisei a estrutura de ${projectName} para encaixar esta novidade de forma limpa. Vou aplicar as mudanças e validar tudo agora.`
    );
  }
  return pickNonRepeating(opts);
}

export function getManualStepApprovalSpeech(stepTitle: string, isOwner = false): string {
  const opts = [
    `Combinado! A construir agora a etapa ${stepTitle} no editor e preview.`,
    `Vamos a isso! Estou a implementar ${stepTitle} passo a passo.`,
  ];
  if (isOwner) {
    opts.push(`Aprovado, chefe! Já estou a gerar o código completo de ${stepTitle}.`);
  }
  return pickNonRepeating(opts);
}

export function getPlatformCommandSpeech(action: string, detail?: string): string {
  switch (action) {
    case 'open_editor':
      return pickNonRepeating(['Editor aberto.', 'Abri o editor de código aqui ao lado.', 'Pronto, já estás no editor.']);
    case 'open_editor_fullscreen':
      return pickNonRepeating(['Editor em ecrã inteiro.', 'Expandi o editor para trabalhares à vontade.']);
    case 'open_files':
      return pickNonRepeating(['Aqui tens os ficheiros do projeto.', 'Abri a árvore de ficheiros.']);
    case 'open_console':
      return pickNonRepeating(['Console aberto.', 'Mostrei o console de execução.']);
    case 'show_preview':
      return pickNonRepeating(['Preview ao vivo focado.', 'Aqui está o preview atualizado.']);
    case 'open_preview_fullscreen':
      return pickNonRepeating(['Preview em tela cheia.', 'Expandi o preview ao máximo.']);
    case 'close_editor_or_back':
      return pickNonRepeating(['Fechei e voltei para a vista principal.', 'Já recuei para o painel principal.']);
    case 'preview_mobile':
      return pickNonRepeating(['Preview mudado para telemóvel.', 'Agora estás a ver a versão mobile.']);
    case 'preview_tablet':
      return pickNonRepeating(['Preview ajustado para tablet.', 'Vista de tablet ativa.']);
    case 'preview_desktop':
      return pickNonRepeating(['Voltei para a vista de computador.', 'Preview em ecrã desktop.']);
    case 'save_project':
      return pickNonRepeating(['Projeto guardado na nuvem.', 'Tudo salvo com segurança.']);
    case 'open_projects':
      return pickNonRepeating(['Aqui estão os teus projetos.', 'Abri a lista de projetos.']);
    case 'open_settings':
      return pickNonRepeating(['Definições abertas.', 'Aqui estão as configurações.']);
    case 'open_deploy':
      return pickNonRepeating(['Painel de deploy aberto.', 'Abri a área de publicação.']);
    case 'refresh_preview':
      return pickNonRepeating(['Preview atualizado.', 'Recarreguei a vista do site.']);
    default:
      return detail || 'Feito.';
  }
}

export function getWorkspaceSwitchSpeech(target: 'jarvis' | 'builder', projectName?: string): string {
  if (target === 'builder') {
    return pickNonRepeating([
      projectName && projectName !== 'Novo Projeto'
        ? `Entrei no Estúdio SARA com ${projectName}. Que queres construir ou ajustar agora?`
        : 'Estúdio SARA aberto. Diz-me o que vamos construir.',
      'Cá estamos no Estúdio SARA. Pronta para pôr as mãos no código.',
      'Mudei para o Estúdio SARA. Podes acompanhar tudo por aqui.',
    ]);
  }
  return pickNonRepeating([
    'Voltei para o Assistente. Em que posso ajudar?',
    'Estamos no modo Assistente outra vez. Fala comigo.',
    'Cá estou de volta no palco principal. Qual é a próxima?',
  ]);
}

export function getBackgroundBuildAckSpeech(goal: string): string {
  const shortTopic = goal.trim().slice(0, 48);
  return pickNonRepeating([
    `Boa ideia! Já pus o Estúdio SARA a construir isso em segundo plano (${shortTopic}) enquanto continuamos a conversar aqui.`,
    `Aceite! O Estúdio SARA já arrancou em segundo plano para montar esse projeto — fico contigo aqui no Assistente e aviso assim que terminar.`,
    `Bora lá! Deixei o Estúdio SARA a trabalhar em segundo plano nesse pedido. Podes continuar a falar comigo normalmente.`,
  ]);
}

export function getBackgroundBuildDoneSpeech(projectName: string, isOwner = false): string {
  const opts = [
    `Terminei! O projeto ${projectName} já está pronto no Estúdio SARA — queres ver?`,
    `Missão cumprida em segundo plano: ${projectName} está concluído e testado. Queres dar uma olhadela?`,
  ];
  if (isOwner) {
    opts.push(
      `Chefe, o trabalho no Estúdio SARA ficou pronto (${projectName}). Queres abrir para ver como ficou?`
    );
  }
  return pickNonRepeating(opts);
}

export function getHumanChoice(options: string[]): string {
  return pickNonRepeating(options);
}

export function getModeSwitchSpeech(mode: 'manual' | 'automatic'): string {
  if (mode === 'manual') {
    return pickNonRepeating([
      'Modo manual ligado! Vamos decidir juntos e aprovo contigo antes de construir cada etapa.',
      'Combinado, passei para o modo manual. Eu sugiro a arquitetura, pergunto-te primeiro e avançamos passo a passo.',
      'Modo colaborativo ativo! Diz-me o que queres construir que eu planeio e confirmo contigo.',
    ]);
  }
  return pickNonRepeating([
    'Modo automático ligado! Alinho as ideias contigo logo no início e depois construo, testo e corrijo sozinha.',
    'Ativei o modo automático! Manda o objetivo que eu executo etapa por etapa até ao teste final.',
    'Modo autónomo pronto. Manda a missão que eu assumo daqui.',
  ]);
}

/**
 * Infere o domínio principal de uma frase (música, builder, eletricidade, casa, estudo, agenda, sistema)
 */
export function inferDomainFromText(text: string): VoiceDomainTopic {
  const lower = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (
    /\b(musica|som|toca|amapiano|afro|marrabenta|kizomba|youtube|pausa|volume|playlist|faixa|canta|shuffle|baralha|loop)\b/i.test(
      lower
    )
  ) {
    return 'music';
  }
  if (
    /\b(volt|volts|ampere|amperes|watt|watts|kw|kva|ohm|ohms|resistencia|tensao|corrente|potencia|disjuntor|fusivel|contactor|rele|trifasico|monofasico|220|380|230|400|curto|aterramento|fase|neutro|quadro\s+eletrico|inversor|solar|multimetro|alicate|edm|kwh|cabo|seccao|eletric)/i.test(
      lower
    )
  ) {
    return 'electricity';
  }
  if (
    /\b(site|website|app|aplicativo|aplicacao|sistema|jogo|loja|portfolio|builder|codigo|editor|cor|layout|botao|html)\b/i.test(
      lower
    )
  ) {
    return 'builder';
  }
  if (
    /\b(luz|luzes|lujo|ventoinha|ventilador|ar\s+condicionado|porta|tranca|destranca|tomada|modo\s+(noite|estudo|festa|dormir|relax))\b/i.test(
      lower
    )
  ) {
    return 'home';
  }
  if (
    /\b(explica|cubo|esfera|cilindro|cone|piramide|prisma|calcula|equacao|matematica|fisica|teste|quiz|flashcards|mapa\s+mental|resumo|traduz)\b/i.test(
      lower
    )
  ) {
    return 'study';
  }
  if (/\b(agenda|alarme|lembra|lembrete|anota|marca|tarefa|reuniao|prazo)\b/i.test(lower)) {
    return 'agenda';
  }
  if (/\b(painel|menu|admin|volume|bateria|wifi|internet|sistema|microfone|clima|tempo)\b/i.test(lower)) {
    return 'system';
  }
  return 'general';
}

/**
 * Corrige erros fonéticos frequentes do Google SpeechRecognition e da API em pt-PT / Moçambique.
 */
export function normalizePhoneticVoiceTranscript(transcript: string): string {
  let out = String(transcript || '')
    // Passo 1 base: remove artefactos estranhos e espaços múltiplos
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[~^*_|\\<>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!out) return out;

  // Passo 1b: limpa hesitações de preenchimento isoladas ("uhm", "ah", "eh", "hmm")
  out = out.replace(/^(?:uhm+|hum+|hmm+|ah+|eh+|oh+)\b[\s,]*/gi, '').trim();
  out = out.replace(/\b(?:uhm+|hmm+|aaa+)\b/gi, ' ').replace(/\s+/g, ' ').trim();

  // Passo 1c: remove palavras gaguejadas / repetidas consecutivamente (ex: "sara sara", "toca toca")
  out = out.replace(/\b([a-zà-ÿ0-9]{2,})\s+\1\b/gi, '$1');

  // Passo 2: Correção fonética do nome "Sara" (início da frase ou isolado)
  out = out.replace(
    /^(?:sera|será|cara|sarah|zara|sala|sar|saara|cera|lara|çara|seara|saia|saraa)(?=[\s,]+|$)/i,
    'Sara'
  );
  // Também no meio se vier depois de saudação ("oi sala" -> "oi Sara")
  out = out.replace(
    /\b(oi|ola|ei|hey|bora|toca|abre|fecha|calcula|explica|faz|liga|desliga)\s+(?:sera|será|cara|sarah|zara|sala|saara|cera|lara|çara|seara)\b/gi,
    '$1 Sara'
  );

  // Correções fonéticas e vocabulares de alta frequência (Google STT + API distorcida)
  const replacements: Array<[RegExp, string]> = [
    [/\b(pai\s+nel|painer|painel|panel|pano)\b(?=\s|$|[,!?.])/gi, 'painel'],
    [/\b(bilder|bulder|bilda|bilde|biuder|biulder|builder\s*pro)\b/gi, 'builder'],
    [/\b(assistent|acistente|assistenta|assistencia)\b/gi, 'assistente'],
    [/\b(jarves|javis|jarvis)\b/gi, 'jarvis'],
    [/\b(seiti|saiti|saite|sait|web\s*site|uebsite)\b/gi, 'site'],
    [/\b(aplicassao|aplicacao|aplicat[ií]v[oa]?|apli)\b/gi, 'aplicativo'],
    [/\b(lujo|lujos|lus|lúz)\b/gi, 'luz'],
    [/\b(calcu|calca|calq|calcul)\b(?=\s+\d|\s+(?:potencia|ohm|tensao|corrente|area|volume|$))/gi, 'calcula'],
    [/\b(inhamban|inhanbane|inhanban|imbanbane|imbane)\b/gi, 'Inhambane'],
    [/\b(matol)\b/gi, 'Matola'],
    [/\b(maput)\b/gi, 'Maputo'],
    [/\b(inhac)\b/gi, 'Inhaca'],
    [/\b(noit|noiti)\b/gi, 'noite'],
    [/\b(amapian|mapiano|a\s+ma\s+piano|ama\s+piano)\b/gi, 'Amapiano'],
    [/\b(marabenta|maraventa)\b/gi, 'Marrabenta'],
    [/\b(kizomb)\b/gi, 'Kizomba'],
    [/\b(ventoinh|bentoinha)\b/gi, 'ventoinha'],
    [/\b(tomad)\b/gi, 'tomada'],
    [/\b(disjutor|disjuntô|disjuntores)\b/gi, 'disjuntor'],
    [/\b(tencao|tenção)\b/gi, 'tensão'],
    [/\b(voltes|voltz|vólts)\b/gi, 'volts'],
    [/\b(amper|ampere|ampéres)\b/gi, 'amperes'],
    [/\b(priviu|perviu|pr[eé]vio|pre viu)\b/gi, 'preview'],
    [/\b(consola|consolo|conselho)\b/gi, 'console'],
    [/\b(heitor|aditor|edito|edictor)\b/gi, 'editor'],
    [/\b(feicheiros|fixeiros)\b/gi, 'ficheiros'],
    [/\b(proj[eé]to|progeto)\b/gi, 'projeto'],
    [/\b(matem[aá]ticas?)\b/gi, 'matemática'],
    [/\b(progre[sç]o|progre[cç]ao)\b/gi, 'progresso'],
    [/\b(por\s*cento|porcento)\b/gi, 'porcento'],
    [/\b(deploi|de\s+poi|dip[l]?oy)\b/gi, 'deploy'],
    [/\b(fire\s*base|faire\s*base|faribase)\b/gi, 'firebase'],
    [/\b(puxa|puxe|puche|pux)\b(?=\s+(para|pro|github|git|agora|$))/gi, 'push'],
    [/\b(faz|fazer|envia|manda)\s+(puxa|puxe|puche|pux)\b/gi, '$1 push'],
    [/\b(zipe|sipe|sip)\b(?=\s|$)/gi, 'zip'],
    [/\b(disfaz|des\s+faz)\b/gi, 'desfaz'],
    [/\b(manoel|manuais)\b/gi, 'manual'],
    [/\b(automato|autom[aá]ticos)\b/gi, 'automático'],
    [/\b(tabrete|tablate|t[aá]blete)\b/gi, 'tablet'],
    [/\b(tela\s+cheia|ecra\s+inteiro|ekra\s+inteiro)\b/gi, 'tela cheia'],
    [/\b(git\s*hub|guit\s*hub|jithub)\b/gi, 'github'],
    [/\b(chart\s*js|xart\s*js|shart)\b/gi, 'chart.js'],
    [/\b(abri|abr)\b(?=\s+(o|a|os|as|painel|builder|agenda|musica|editor))/gi, 'abre'],
    [/\b(feich|feixa|fech)\b(?=\s+(o|a|painel|editor|porta|musica))/gi, 'fecha'],
    [/\b(ascende|asende)\b/gi, 'acende'],
  ];

  for (const [pattern, target] of replacements) {
    out = out.replace(pattern, target);
  }

  return out.replace(/\s+/g, ' ').trim();
}

/**
 * MODO RECONSTRUÇÃO EM 5 PASSOS (Detetive de Voz):
 * 1. Limpa ruído/gaguez/pontuação estranha
 * 2. Extrai palavras-chave e corrige fonética Google/API
 * 3. Liga com o contexto (últimas 5 falas + estado da app/média/build)
 * 4. Reescreve silenciosamente num português limpo e direto
 * 5. Só sinaliza unintelligible se tiver 0% de sentido mesmo após o contexto
 */
export function reconstructDistortedVoiceInput(
  rawTranscript: string,
  context?: VoiceParseContext
): ReconstructedVoiceResult {
  const original = String(rawTranscript || '').trim();
  const cleaned = normalizePhoneticVoiceTranscript(original);
  const lower = cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  if (!lower) {
    return {
      original,
      cleaned,
      reconstructed: '',
      wasDistorted: original.length > 0,
      domainHint: context?.lastTopic || 'general',
      unintelligible: true,
      clarifierSpeech: 'Quiseste dizer...? Podes repetir o comando?',
    };
  }

  const domainHint = inferDomainFromText(cleaned);
  const effectiveDomain: VoiceDomainTopic =
    domainHint !== 'general' ? domainHint : context?.lastTopic || 'general';

  // Verifica se é ruído puro 0% entendível (apenas tosse/hesitação ou sequência sem vogais reais)
  const words = lower.split(/\s+/).filter(Boolean);
  const hasRealVowelWord =
    /\b(sh{2,}|xiu)\b/i.test(lower) ||
    words.some((w) => /[aeiouy0-9]/.test(w) && w.length >= 1);

  if (!hasRealVowelWord || NOISE_OR_COUGH_ONLY_REGEX.test(lower)) {
    return {
      original,
      cleaned,
      reconstructed: cleaned,
      wasDistorted: true,
      domainHint: effectiveDomain,
      unintelligible: true,
      clarifierSpeech: 'Queres falar de algum tema ou abrir alguma função?',
    };
  }

  let reconstructed = cleaned;

  // Passo 3 + 4: Reconstrução contextual silenciosa
  // Caso A: fragmento elétrico com números (ex: "sara calcula 220 10" / "220 10" / "sara ohm 12 4")
  const twoNums = cleaned.match(
    /\b(\d+(?:[.,]\d+)?)\s*(?:v|volts?|a|amp(?:eres?)?|w|watts?|ohms?)?(?:\s*(?:e|por|com|\/|x|,)\s*|\s+)(\d+(?:[.,]\d+)?)\s*(?:v|volts?|a|amp(?:eres?)?|w|watts?|ohms?)?\b/i
  );
  if (
    twoNums &&
    !/\b(segundos?|minutos?|horas?|adianta|volta|recua|atrasa)\b/i.test(lower) &&
    (/\b(calcula|conta|ohm|eletric\w*|volts?\b|voltagem|amper\w*|watts?\b|potencia|220|380|230|400)\b/i.test(
      lower
    ) ||
      effectiveDomain === 'electricity')
  ) {
    reconstructed = `Calcula potência e resistência elétrica para ${twoNums[1]} e ${twoNums[2]} passo a passo.`;
  } else if (/^(?:sara[,\s]+)?faz\s+site\s+(.+)$/i.test(lower) && !/\bum\b/i.test(lower)) {
    const rest = cleaned.replace(/^(?:sara[,\s]+)?faz\s+site\s+/i, '').trim();
    reconstructed = `Sara, faz um site de ${rest}`;
  } else if (/\btoca\s+musica\s+noite\s+inhambane\b/i.test(lower)) {
    reconstructed = 'Sara, toca música noite de Inhambane';
  } else if (
    effectiveDomain === 'builder' &&
    /^(?:sara[,\s]+)?(?:mete\s+mais\s+bonito|deixa\s+mais\s+bonito|muda\s+a\s+cor|mete\s+mais\s+detalhes|melhora\s+isso|melhora\s+isto|continua\s+isso)$/i.test(
      lower
    )
  ) {
    reconstructed = `No projeto atual do Estúdio SARA, ${cleaned.replace(/^sara[,\s]+/i, '')}`;
  } else if (
    (effectiveDomain === 'electricity' ||
      (context?.recentUserUtterances || []).some((u) => inferDomainFromText(u) === 'electricity')) &&
    /^(?:sara[,\s]+)?(?:e\s+se\s+for|com|agora\s+com|muda\s+para)\s+\d+/i.test(lower)
  ) {
    const prevElec = [...(context?.recentUserUtterances || [])]
      .reverse()
      .find((u) => inferDomainFromText(u) === 'electricity');
    reconstructed = prevElec
      ? `Continuando o cálculo anterior (${prevElec}): agora ${cleaned}`
      : cleaned;
  }

  return {
    original,
    cleaned,
    reconstructed,
    wasDistorted: reconstructed.toLowerCase() !== original.toLowerCase(),
    domainHint: effectiveDomain,
    unintelligible: false,
  };
}

/**
 * Deteta se o utilizador (mesmo estando dentro do Builder) está a pedir uma explicação geral / matemática / eletricidade / estudo para a Assistente.
 */
export function isAssistantExplanationIntent(text: string): boolean {
  const repaired = normalizePhoneticVoiceTranscript(text);
  const lower = repaired
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!lower) return false;

  if (extractImageGenRequest(text) || parseImageVoiceCommand(text)) {
    return false;
  }

  // Se pede alteração explícita no código/site/projeto atual, fica no Builder
  if (
    /\b(no\s+(site|projeto|app|codigo|editor|preview)|adiciona|implementa|cria\s+uma?\s+(pagina|tela|botao|seccao|componente)|corrige\s+(o\s+)?erro)\b/i.test(
      lower
    )
  ) {
    return false;
  }

  return (
    /\b(me\s+explica|explica[-\s]?me|podes\s+explicar|explica\s+(isso|isto|sobre|a\s+materia|matematica|fisica|quimica|biologia|historia|eletricidade|como)|explica\s+de\s+outro\s+jeito)\b/i.test(
      lower
    ) ||
    /^(sara[,\s]+)?(o\s+que\s+e|como\s+funciona|qual\s+e\s+a\s+formula|resolve\s+esta?\s+(equacao|conta|calculo)|calcula\s+(o\s+volume|a\s+area|a\s+potencia|a\s+corrente|a\s+resistencia|a\s+queda|o\s+cabo|o\s+disjuntor)|faz\s+um\s+(teste|quiz|flashcards|resumo|mapa\s+mental))\b/i.test(
      lower
    )
  );
}

/**
 * Deteta se a frase pede criação ou modificação de app/sistema (para nunca ser confundida com comando simples da IDE).
 */
function hasExplicitAppFeatureEdit(lower: string): boolean {
  if (
    /\b(adiciona|acrescenta|implementa|corrige|conserta|estiliza|refatora|coloca|inclui|programa)\b/i.test(
      lower
    ) &&
    !/\b(corrige\s+(o\s+)?erro)\b/i.test(lower)
  ) {
    return true;
  }
  if (
    /\b(cria|criar|faz|fazer|gera|gerar|constroi|construir|desenvolve|desenvolver|monta|montar)\b.*\b(site|sistema|app|aplicativo|aplicacao|jogo|game|loja|ecommerce|dashboard|painel|portal|landing|portfolio|blog|pagina|formulario|grafico|tabela|chat|restaurante|clinica|escola)\b/i.test(
      lower
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Deteta pedidos destrutivos ou ambíguos quando já existe código funcional no projeto.
 */
export function detectAmbiguousOrDangerousPrompt(
  prompt: string,
  hasExistingCode: boolean
): { requiresConfirmation: boolean; title: string; question: string } | null {
  const lower = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!lower) return null;

  if (/\b(confirmo|autorizo|pode\s+apagar|sim\s+apaga|tenho\s+certeza)\b/i.test(lower)) {
    return null;
  }

  if (
    hasExistingCode &&
    /\b(apaga\s+tudo|apagar\s+tudo|limpa\s+o\s+projeto|limpar\s+projeto|recria\s+do\s+zero|comeca\s+do\s+zero|reseta\s+tudo|remove\s+toda\s+a\s+logica|apaga\s+o\s+codigo|elimina\s+tudo)\b/i.test(
      lower
    )
  ) {
    return {
      requiresConfirmation: true,
      title: 'Confirmar alteração destrutiva',
      question:
        'Já tens código funcional neste projeto. Queres mesmo apagar ou reiniciar a estrutura atual? Diz "Sim, confirmo" ou "Não".',
    };
  }

  return null;
}

function parseLocalizedNumber(raw: string): number {
  return Number(String(raw || '').replace(',', '.'));
}

export function parseVoiceCommand(
  transcript: string,
  context?: VoiceParseContext
): VoiceCommandAction {
  const recon = reconstructDistortedVoiceInput(transcript, context);
  const clean = recon.reconstructed || recon.cleaned || String(transcript || '').trim();
  const lower = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  if (extractImageGenRequest(clean) || parseImageVoiceCommand(clean)) {
    return { type: 'prompt', text: clean };
  }

  if (recon.unintelligible) {
    return {
      type: 'unintelligible_clarify',
      reply: recon.clarifierSpeech || 'Quiseste dizer...? Podes repetir o comando?',
      raw: transcript,
    };
  }

  // Confirmação / cancelamento imediato quando há uma pergunta de segurança pendente
  if (context?.hasPendingConfirm) {
    const cleanWords = lower.replace(/[,.;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (
      /^(sara\s+)?(sim|ya|yeah|confirmo|confirmar|autorizo|ok|claro|avanca|manda\s+ver|manda\s+vir|dale|bora|toca\s+a\s+fazer|executa|faz\s+isso|pode\s+ser|e\s+isso|isso\s+mesmo|exato|pode\s+(fazer|ir|enviar|apagar|limpar))(\s+(sim|ya|confirmo|autorizo|sara))*$/i.test(
        cleanWords
      )
    ) {
      return { type: 'confirm_pending', raw: clean };
    }
    if (
      /^(sara\s+)?(nao|nada|deixa|deixa\s+pra\s+la|nao\s+e\s+isso|nao\s+era\s+isso|errado|cancela|cancelar|aborta|abortar|esquece|para|chega|basta|ja\s+chega|deixa\s+estar)(\s+(nao|cancela|cancelar|esquece|sara))*$/i.test(
        cleanWords
      )
    ) {
      return { type: 'cancel_pending', raw: clean };
    }
  }

  // Comandos de Admin e Logout (validados estritamente contra isOwner na camada de aplicação)
  if (
    /^(sara[,\s]+)?(abre|abrir|mostra|mostrar|entra|entrar\s+no)\s+(o\s+|no\s+)?(painel\s+)?admin$/i.test(
      lower
    ) ||
    lower === 'painel admin' ||
    lower === 'admin'
  ) {
    return { type: 'open_admin', raw: clean };
  }
  if (/^(sara[,\s]+)?(terminar\s+sessao|encerrar\s+sessao|faz\s+logout|logout|sair\s+da\s+conta)$/i.test(lower)) {
    return { type: 'logout_session', raw: clean };
  }

  // Modo Chamada / Ocupado (tem prioridade sobre silêncio simples quando menciona chamada/reunião/aula/ocupado)
  if (
    /\b(estou|to|tou|entrei|entrando|vou\s+entrar|fui\s+para|atendendo|atender)\s+(?:n?uma\s+|em\s+|na\s+|no\s+)?(chamada|ligacao|reuniao|aula|videochamada|call)\b/i.test(
      lower
    ) ||
    /\b(estou|to|tou|fico|vou\s+ficar)\s+(ao\s+telefone|ocupad[oa]|numa\s+consulta|em\s+atendimento)\b/i.test(
      lower
    ) ||
    /\b(estou|to|tou)\s+(a\s+falar|falando|conversando|em\s+conversa)\s+com\s+(alguem|uma\s+pessoa)\b/i.test(
      lower
    ) ||
    /\bmodo\s+(chamada|ocupado|reuniao|nao\s+atrapalhe|nao\s+perturbe)\b/i.test(lower) ||
    (/\bnao\s+(me\s+)?atrapalhes?\b/i.test(lower) &&
      /\b(chamada|ligacao|reuniao|aula|ocupad[oa]|alguem|telefone)\b/i.test(lower))
  ) {
    const reason: 'chamada' | 'reuniao' | 'aula' | 'ocupado' = /\breuniao\b/i.test(lower)
      ? 'reuniao'
      : /\baula\b/i.test(lower)
      ? 'aula'
      : /\bocupad[oa]|alguem\b/i.test(lower)
      ? 'ocupado'
      : 'chamada';
    return { type: 'enter_call_mode', reason, raw: clean };
  }

  // "Sara, para tudo" = Para a voz + Para música / vídeo / leitura (fica tudo em pausa)
  if (
    /^(?:sara[,\s]+)?(?:para|pare|stop|encerra|corta)\s+tudo(?:\s+agora)?$/i.test(lower) ||
    /\bpara\s+tudo\b/i.test(lower)
  ) {
    return { type: 'stop_all_and_pause', raw: clean };
  }

  // Interrupção imediata ("SARA para", "SARA cala", "SARA espera", "SARA ouve", "SARA para de falar")
  const quickInterrupt = parseInterruptionIntent(clean, saraEstaAFalar, currentUtteranceNormalized);
  if (quickInterrupt) {
    return quickInterrupt;
  }

  // Silêncio persistente explícito ("modo silêncio", "fica calada", "não fales mais")
  if (isSilenceCommandPhrase(lower, saraEstaAFalar, currentUtteranceNormalized)) {
    return { type: 'silence_sara', raw: clean };
  }

  // "Sara, pausa" = Pausa o que está a fazer mas continua a ouvir
  if (/^(?:sara[,\s]+)?(pausa|pausar)(?:\s+(?:tudo|isso|agora))?$/i.test(lower)) {
    return { type: 'pause_current_activity', raw: clean };
  }

  // Voltar a falar / Sair do Modo Silêncio ou Modo Chamada (só quando o utilizador chamar explicitamente)
  if (
    /^(?:(?:ok|oky|okay|pronto|ei|olha|entao)[,\s]+)*(?:sara[,\s]+)?(?:podes\s+falar(?:\s+agora)?|pode\s+falar(?:\s+agora)?|ja\s+podes\s+falar|ja\s+pode\s+falar|volta\s+a\s+falar|reativa\s+a\s+voz|ativa\s+a\s+voz|liga\s+a\s+voz|fala(?:\s+agora|\s+comigo)?|ja\s+estou\s+aqui|voltei|estou\s+de\s+volta|to\s+de\s+volta|tou\s+de\s+volta|ja\s+voltei|ja\s+acabei(?:\s+(?:a\s+|o\s+)?(?:chamada|ligacao|reuniao|aula))?|acabei(?:\s+(?:a\s+|o\s+)?(?:chamada|ligacao|reuniao|aula))|terminei(?:\s+(?:a\s+|o\s+)?(?:chamada|ligacao|reuniao|aula))?|ja\s+terminei(?:\s+(?:a\s+|o\s+)?(?:chamada|ligacao|reuniao|aula))?|desliguei(?:\s+a\s+chamada)?|sai\s+da\s+(?:chamada|reuniao|aula)|estou\s+livre|to\s+livre|tou\s+livre|ja\s+estou\s+livre|podes\s+voltar|pode\s+voltar)(?:[,\s]+sara)?$/i.test(
      lower
    ) ||
    ((context?.isSilenced || context?.isCallMode) &&
      (/^(?:(?:ok|oky|okay)[,\s]+)*(?:sara[,\s]+)?(?:volta|estou\s+aqui)(?:[,\s]+sara)?$/i.test(
        lower
      ) ||
        /\b(?:sara[,\s]+voltei|voltei[,\s]+sara|sara[,\s]+ja\s+acabei|sara[,\s]+podes\s+falar|sara[,\s]+estou\s+livre|sara[,\s]+volta|sara[,\s]+fala|fala[,\s]+sara)\b/i.test(
          lower
        ))) ||
    lower.includes('sara, fala') ||
    lower.includes('sara fala')
  ) {
    return { type: 'unsilence_sara', raw: clean };
  }

  // Ajuste de velocidade da voz e pedidos de clareza ("mais devagar", "repete", "explica de outro jeito")
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

  // Microfone desligar / ligar (apenas pedidos explícitos de desligar microfone; "SARA para" nunca desliga o microfone)
  if (
    /^(?:sara[,\s]+)?(?:para\s+de\s+ouvir|para\s+de\s+escutar|para\s+microfone)$/i.test(lower) ||
    lower.includes('para de ouvir') ||
    lower.includes('para de escutar') ||
    lower.includes('desliga o microfone') ||
    lower.includes('desligar microfone') ||
    lower.includes('desligar o microfone') ||
    lower.includes('desativa o microfone')
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

  // Mostrar o progresso visual do que está a ser construído no Builder
  if (
    /\b(mostra|mostrar|exibe|ver|abre)\s+(o\s+que\s+estas\s+a\s+fazer|o\s+trabalho|a\s+construcao|o\s+progresso)\s+(no\s+|do\s+)?builder\b/.test(
      lower
    ) ||
    /\bmostra\s+o\s+que\s+(estas|ta|tas)\s+a\s+fazer\s+no\s+builder\b/.test(lower)
  ) {
    return { type: 'show_builder_progress', raw: clean };
  }

  // Troca de Modo Principal: Assistente JARVIS <-> Builder
  if (
    /\b(abre|abrir|vai\s+para|muda\s+para|passa\s+para|entra\s+no|ativa|ativar|quero)\s+(o\s+)?(modo\s+)?(builder|construtor)\b/.test(
      lower
    ) ||
    /^(sara[,\s]+)?(modo\s+)?builder$/.test(lower)
  ) {
    return { type: 'open_builder_mode', raw: clean };
  }

  if (
    /\b(volta\s+para|volta\s+ao|abre|abrir|vai\s+para|muda\s+para|passa\s+para|ativa|ativar|quero)\s+(o\s+)?(modo\s+)?(assistente|jarvis|modo\s+normal)\b/.test(
      lower
    ) ||
    /\b(sai\s+do|sair\s+do|fecha\s+o)\s+builder\b/.test(lower) ||
    /^(sara[,\s]+)?(modo\s+)?(assistente|jarvis)$/.test(lower)
  ) {
    return { type: 'open_jarvis_mode', raw: clean };
  }

  if (
    /\b(desativa|desativar|sai\s+do|sair\s+do|fecha\s+o|desliga)\s+(o\s+)?(modo\s+)?foco\b/.test(
      lower
    )
  ) {
    return { type: 'focus_mode_off', raw: clean };
  }

  if (/\b(ativa|ativar|liga|ligar|entra\s+no|quero\s+o)\s+(o\s+)?(modo\s+)?foco\b|^modo\s+foco$/.test(lower)) {
    return { type: 'focus_mode_on', raw: clean };
  }

  // Controlo avançado de Música (baralhar, loop, curtir, identificar, próxima, anterior, mudo, volume)
  if (
    /\b(baralha|mistura|shuffle|modo\s+aleatorio|aleatorio)\b/.test(lower) &&
    (context?.hasActiveMedia || context?.lastTopic === 'music' || /\b(musica|som|playlist|faixa)\b/.test(lower))
  ) {
    return { type: 'shuffle_music', raw: clean };
  }

  if (
    (/\b(loop|em\s+loop|toca\s+outra\s+vez|repete\s+a\s+musica|repetir\s+musica)\b/.test(lower) ||
      ((context?.hasActiveMedia || context?.lastTopic === 'music') &&
        /^(sara[,\s]+)?(loop|repete|outra\s+vez|de\s+novo)$/i.test(lower)))
  ) {
    return { type: 'loop_music', raw: clean };
  }

  if (
    /\b(gostei\s+dessa|gostei\s+desta|curti|guarda\s+essa|guarda\s+esta|guarda\s+nos\s+favoritos|guarda\s+nas\s+favoritas|mete\s+nas\s+gostadas|favorita\s+essa|adiciona\s+aos\s+favoritos)\b/.test(
      lower
    )
  ) {
    return { type: 'like_music', raw: clean };
  }

  if (
    /\b(que\s+musica\s+e\s+essa|qual\s+e\s+essa\s+musica|quem\s+canta\s+isso|quem\s+canta|qual\s+e\s+o\s+nome\s+da\s+musica|que\s+som\s+e\s+esse)\b/.test(
      lower
    )
  ) {
    return { type: 'identify_music', raw: clean };
  }

  if (
    /\b(mete\s+no\s+mudo|tira\s+o\s+som|sem\s+som|silencia\s+o\s+som|silenciar|muta)\b|^mudo$/.test(lower)
  ) {
    return { type: 'mute_music', raw: clean };
  }

  // Adiantar / Voltar tempo na reprodução local (ex: "adianta", "adianta 1 minuto", "volta 10 segundos")
  const seekForwardMatch = lower.match(
    /^(?:sara[,\s]+)?(?:adianta|avanca|pula\s+para\s+frente)(?:\s+(\d+)\s*(min(?:uto)?s?|seg(?:undo)?s?|m|s))?$/i
  );
  if (seekForwardMatch) {
    const val = seekForwardMatch[1] ? Number(seekForwardMatch[1]) : 0;
    const unit = (seekForwardMatch[2] || '').toLowerCase();
    let seconds = context?.activeLocalKind === 'video' ? 60 : 10;
    if (val > 0) {
      seconds = unit.startsWith('m') ? val * 60 : val;
    }
    return { type: 'media_seek', seconds, raw: clean };
  }

  const seekBackwardMatch = lower.match(
    /^(?:sara[,\s]+)?(?:volta|recua|atrasa)\s+(\d+)\s*(min(?:uto)?s?|seg(?:undo)?s?|m|s)$/i
  );
  if (seekBackwardMatch) {
    const val = Number(seekBackwardMatch[1]) || 10;
    const unit = (seekBackwardMatch[2] || '').toLowerCase();
    const seconds = -(unit.startsWith('m') ? val * 60 : val);
    return { type: 'media_seek', seconds, raw: clean };
  }
  if (/^(?:sara[,\s]+)?(?:recua|atrasa|volta\s+um\s+pouco)$/i.test(lower)) {
    return { type: 'media_seek', seconds: -10, raw: clean };
  }

  // Tela cheia / Sair da tela cheia para leitor/galeria JARVIS
  if (
    context?.workspaceMode === 'jarvis' &&
    /^(?:sara[,\s]+)?(sai|sair|fecha|fechar|minimiza|reduz)\s+(?:da\s+|a\s+)?(tela\s+cheia|ecra\s+inteiro)$/i.test(
      lower
    )
  ) {
    return { type: 'media_fullscreen', enabled: false, raw: clean };
  }
  if (
    context?.workspaceMode === 'jarvis' &&
    /^(?:sara[,\s]+)?(?:abre\s+|poe\s+|mete\s+|entra\s+em\s+)?(tela\s+cheia|ecra\s+inteiro)$/i.test(
      lower
    )
  ) {
    return { type: 'media_fullscreen', enabled: true, raw: clean };
  }

  if (
    /\b(proxima|seguinte|passa\s+a\s+musica|pula\s+a\s+musica|proxima\s+musica|proximo\s+video|manda\s+outra|outra\s+musica)\b/.test(
      lower
    ) ||
    ((context?.hasActiveMedia || context?.activeLocalKind === 'image' || context?.lastTopic === 'music') &&
      /^(sara[,\s]+)?(passa|pula|saltar|salta|outra|proxima|proximo|seguinte|next|muda)$/i.test(lower))
  ) {
    return { type: 'next_music', raw: clean };
  }

  if (
    /\b(musica\s+anterior|video\s+anterior|foto\s+anterior|volta\s+a\s+musica|a\s+de\s+tras|anterior)\b/.test(
      lower
    ) ||
    ((context?.hasActiveMedia || context?.activeLocalKind === 'image' || context?.lastTopic === 'music') &&
      /^(sara[,\s]+)?(volta|a\s+de\s+tras|anterior|volta\s+atras)$/i.test(lower))
  ) {
    return { type: 'prev_music', raw: clean };
  }

  // Repetir última resposta ou pedido de clarificação ("não percebi", "não ouvi", "repete", "fala de novo")
  if (
    /^(?:(?:ei|olha|epa|desculpa)[,\s]+)*(?:sara[,\s]+)?(?:repete(?:\s+(?:la|isso|por\s+favor))?|podes\s+repetir|pode\s+repetir|diz\s+(?:outra\s+vez|de\s+novo)|o\s+que\s+disseste|o\s+que\s+e\s+que\s+disseste|fala\s+(?:de\s+novo|outra\s+vez)|nao\s+percebi(?:\s+bem)?|nao\s+ouvi(?:\s+bem)?|nao\s+entendi(?:\s+bem)?|como\s+assim|como|o\s+que|ha)(?:[,\s]+sara)?$/i.test(
      lower
    ) ||
    /\b(?:fala\s+de\s+novo|repete\s+la|repete\s+isso|nao\s+percebi|nao\s+ouvi|diz\s+outra\s+vez|podes\s+repetir)\b/i.test(
      lower
    )
  ) {
    return { type: 'repeat_sara', raw: clean };
  }
  if (/\bexplica\s+(de\s+outro\s+jeito|mais\s+simples|outra\s+vez)\b/.test(lower)) {
    return { type: 'prompt', text: 'Explica o ponto anterior de outro jeito mais simples e com um exemplo prático.' };
  }

  // [SISTEMA] Leitura em voz alta (pausar e retomar do ponto exato mesmo noutras abas/modos)
  if (
    /\b(pausa|pausar|para|parar)\s+(a\s+)?leitura\b/.test(lower) ||
    (context?.hasActiveReading &&
      !context?.isReadingPaused &&
      /^(sara[,\s]+)?(pausa|pausar|para|espera)$/i.test(lower))
  ) {
    return { type: 'pause_reading', raw: clean };
  }

  if (
    /\b(continua|retoma|retomar|segue)\s+(a\s+)?leitura\b/.test(lower) ||
    (context?.hasActiveReading &&
      context?.isReadingPaused &&
      /^(sara[,\s]+)?(continua|retoma|retomar|prossegue|segue)$/i.test(lower))
  ) {
    return { type: 'resume_reading', raw: clean };
  }

  if (/\b(para\s+de\s+ler|fecha\s+(a\s+)?leitura|encerra\s+(a\s+)?leitura)\b/.test(lower)) {
    return { type: 'stop_reading', raw: clean };
  }

  // [SISTEMA] Controlo de mídia YouTube & Palco (pausa/stop/tocar/volume)
  if (
    /^(sara[,\s]+)?(pausa|pausar|pause|para|stop)(\s+(a|o)\s+(musica|som|audio|video|player))?$/i.test(
      lower
    ) ||
    /\b(pausa|pausar|para|stop)\s+(a\s+musica|o\s+video|o\s+som|o\s+player|esta\s+musica)\b/.test(lower)
  ) {
    if (context?.hasActiveMedia || /\b(musica|video|som|player)\b/.test(lower)) {
      return { type: 'pause_music', raw: clean };
    }
  }

  if (
    /\b(fecha|fechar|para\s+e\s+fecha|tira|remove|encerra)\s+(a\s+musica|o\s+video|o\s+player|o\s+som)\b/.test(
      lower
    )
  ) {
    return { type: 'close_music', raw: clean };
  }

  if (
    /\b(aumenta|aumentar|sobe|subir|mais\s+alto|ergue|maningue\s+alto)\s+(o\s+)?(volume|som)\b|^volume\s*(\+|mais|alto)$/.test(
      lower
    ) ||
    /^(sara[,\s]+)?(aumenta|sobe|mais\s+alto)(\s+o\s+som|\s+isso)?$/i.test(lower)
  ) {
    return { type: 'volume_up', raw: clean };
  }

  if (
    /\b(diminui|diminuir|baixa|baixar|desce|descer|reduz|reduzir|mais\s+baixo)\s+(o\s+)?(volume|som)\b|^volume\s*(-|menos|baixo)$/.test(
      lower
    ) ||
    /^(sara[,\s]+)?(diminui|baixa|desce|mais\s+baixo)(\s+o\s+som|\s+isso)?$/i.test(lower)
  ) {
    return { type: 'volume_down', raw: clean };
  }

  if (
    context?.hasActiveMedia &&
    (/^(sara[,\s]+)?(continua|retoma|retomar|toca|play|despausa)(\s+(a\s+musica|o\s+video|o\s+som))?$/i.test(
      lower
    ) ||
      /\b(continua|retoma)\s+(a\s+musica|o\s+video|essa\s+musica)\b/.test(lower))
  ) {
    return { type: 'resume_music', raw: clean };
  }

  // =========================================================================
  // ACESSO TOTAL LOCAL + INTERNET (Diferenciação espontânea sem frase exata)
  // =========================================================================
  // 1. Alternância explícita de fonte ("volta para a internet" vs "volta para as minhas", ou resposta direta à ambiguidade)
  if (
    /^(?:sara[,\s]+)?(?:da\s+|na\s+|a\s+)?internet$/i.test(lower) ||
    /\b(volta|voltar|muda|mudar|passa|passar|vai|ir)\s+(para\s+)?(a\s+|o\s+)?internet\b|\btoca\s+(da|na)\s+internet\b|\bmodo\s+internet\b/i.test(
      lower
    )
  ) {
    return { type: 'switch_media_source', source: 'internet', raw: clean };
  }
  if (
    /^(?:sara[,\s]+)?(?:do\s+|no\s+|das\s+|dos\s+)?(?:local|meu|minha|meus|minhas)$/i.test(lower) ||
    /\b(volta|voltar|muda|mudar|passa|passar|vai|ir)\s+(para\s+)?((as\s+)?minhas|(os\s+)?meus|(o\s+)?local|armazenamento\s+local)\b|\btoca\s+das\s+minhas\b|\bmodo\s+local\b/i.test(
      lower
    )
  ) {
    return { type: 'switch_media_source', source: 'local', raw: clean };
  }

  // 2. Filtros rápidos por voz da biblioteca local
  if (
    /\b(mostra|ver|lista|abre)\s+todos\s+(os\s+)?(meus\s+)?(ficheiros|arquivos|locais)\b/i.test(
      lower
    )
  ) {
    return { type: 'filter_local_library', filter: 'all', raw: clean };
  }
  if (/\b(abre|mostra|ver|lista)\s+(os\s+|as\s+)?(meus\s+|minhas\s+)?recentes\b|^recentes$/i.test(lower)) {
    return { type: 'filter_local_library', filter: 'recents', raw: clean };
  }
  if (/\b(abre|mostra|ver|lista)\s+(os\s+|as\s+)?(meus\s+|minhas\s+)?favorit(os|as)\b|^favorit(os|as)$/i.test(lower)) {
    return { type: 'filter_local_library', filter: 'favorites', raw: clean };
  }
  if (/\b(mostra|ver|lista|abre)\s+(so\s+)?(os\s+|as\s+)?(meus\s+|minhas\s+)?pdfs?\b/i.test(lower)) {
    return { type: 'filter_local_library', filter: 'pdfs', raw: clean };
  }
  if (/\b(mostra|ver|lista|abre)\s+so\s+(os\s+)?(meus\s+)?videos\b/i.test(lower)) {
    return { type: 'filter_local_library', filter: 'videos', raw: clean };
  }
  const onlyMusicFilter = lower.match(
    /\b(?:mostra|lista|ver|filtra)\s+so\s+(?:as\s+)?(?:minhas\s+)?musicas?(?:\s+de\s+(.+))?$/i
  );
  if (onlyMusicFilter) {
    return {
      type: 'filter_local_library',
      filter: 'music',
      query: onlyMusicFilter[1]?.trim(),
      raw: clean,
    };
  }

  // 3. Documentos locais & Procura de ficheiros no dispositivo
  const searchLocalMatch = lower.match(
    /^(?:sara[,\s]+)?(?:procura|busca|encontra|acha)\s+(?:o\s+|a\s+)?(?:ficheiro|arquivo|documento|pasta|foto|video|musica)\s+(?:com\s+|chamado\s+|sobre\s+|de\s+)?(.+)$/i
  );
  if (searchLocalMatch) {
    return {
      type: 'open_local_document',
      docCategory: 'any',
      query: searchLocalMatch[1].trim(),
      raw: clean,
    };
  }

  const hasLocalOwnershipCue =
    /\b(meu|minha|meus|minhas|local|locais|do\s+meu\s+pc|no\s+meu\s+pc|do\s+pc|do\s+meu\s+telemovel|no\s+telemovel|do\s+celular|no\s+celular|do\s+dispositivo|offline|daqui|guardado|guardada|guardados|guardadas|da\s+minha\s+pasta)\b/i.test(
      lower
    );

  // Fotos / Imagens locais (ex: "mostra as minhas fotos", "mostra fotos de 2025", "mostra fotos da pasta viagens")
  const photosMatch = lower.match(
    /\b(?:mostra|abre|ver|exibe)\s+(?:as\s+|os\s+)?(?:minhas\s+)?(?:fotos|imagens)(?:\s+(?:de|da|do)\s+(.+))?$/i
  );
  if (photosMatch && (hasLocalOwnershipCue || photosMatch[1] || /\bfotos\b/i.test(lower))) {
    return {
      type: 'play_local_media',
      kind: 'image',
      folderOrDate: photosMatch[1]?.trim(),
      raw: clean,
    };
  }

  // Documentos locais explícitos ou com pista de propriedade ("abre o meu relatório", "abre o trabalho", "abre o último documento")
  if (
    /\b(abre|abrir|mostra|ver|le)\s+(o\s+|a\s+)?(ultimo\s+documento|trabalho)\b/i.test(lower) ||
    (hasLocalOwnershipCue &&
      /\b(documento|relatorio|apresentacao|tabela|planilha|pdf|word|excel|powerpoint|ficheiro|arquivo)\b/i.test(
        lower
      ))
  ) {
    let docCategory: 'pdf' | 'word' | 'ppt' | 'excel' | 'recent' | 'any' = 'any';
    if (/\bultimo\s+documento\b/.test(lower)) docCategory = 'recent';
    else if (/\bpdf\b/.test(lower)) docCategory = 'pdf';
    else if (/\b(word|docx?)\b/.test(lower)) docCategory = 'word';
    else if (/\b(apresentacao|slides|powerpoint|pptx?)\b/.test(lower)) docCategory = 'ppt';
    else if (/\b(tabela|planilha|excel|xlsx?|csv)\b/.test(lower)) docCategory = 'excel';

    let query = lower
      .replace(/^(?:sara[,\s]+)?(?:abre|abrir|mostra|ver|le)\s+(?:o\s+|a\s+|os\s+|as\s+)?/i, '')
      .replace(/\b(aquele|aquela|meu|minha|meus|minhas|do\s+meu\s+pc|do\s+pc|do\s+meu\s+telemovel|do\s+celular|local|offline|daqui|guardado|guardada|ultimo\s+documento)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (/\b(documento|ficheiro|arquivo|pdf|word|excel|powerpoint)\b/i.test(query) && query.split(' ').length <= 1) {
      query = '';
    }

    return {
      type: 'open_local_document',
      docCategory,
      query: query || undefined,
      raw: clean,
    };
  }

  // 4. Música / Áudio / Vídeo / Filme local (somente quando há pista local OU preferência ativa em modo local!)
  if (
    (hasLocalOwnershipCue || (context?.preferredMediaSource === 'local' && !/\binternet|youtube\b/i.test(lower))) &&
    /\b(toca|tocar|mete|poe|por|bota|solta|abre|abrir|reproduz|ouvir|mostra|ver)\b/i.test(lower) &&
    !hasExplicitAppFeatureEdit(lower) &&
    !/\b(painel|editor|builder|projeto|site|app|jogo|loja|agenda|tarefas|sistema|voz|admin|perfil|conta|configuracoes|modulo)\b/i.test(
      lower
    )
  ) {
    let kind: 'music' | 'video' | 'image' | 'audio' | 'any' = 'any';
    if (/\b(video|filme|clip|serie)\b/i.test(lower)) kind = 'video';
    else if (/\b(gravacao|gravacoes|audio|nota\s+de\s+voz)\b/i.test(lower)) kind = 'audio';
    else if (/\b(foto|fotos|imagem|imagens)\b/i.test(lower)) kind = 'image';
    else if (/\b(musica|musicas|som|sons|faixa|cancao|aquela\s+minha|uma\s+minha)\b/i.test(lower)) kind = 'music';

    const cleanedQuery = lower
      .replace(
        /^(?:sara[,\s]+)?(?:toca|tocar|mete|poe|por|bota|solta|abre|abrir|reproduz|ouvir|mostra|ver)\s+/i,
        ''
      )
      .replace(
        /\b(uma|um|a|o|as|os|aquela|aquele|minha|meu|minhas|meus|ai|agora|por\s+favor|do\s+meu\s+pc|no\s+meu\s+pc|do\s+pc|do\s+meu\s+telemovel|no\s+telemovel|do\s+celular|no\s+celular|do\s+dispositivo|offline|local|locais|daqui|guardado|guardada|da|do|de|musica|musicas|som|video|filme|audio|gravacao|ficheiro|arquivo)\b/gi,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();

    if (
      kind !== 'any' ||
      /\bficheiro|arquivo|pasta\b/i.test(lower) ||
      (hasLocalOwnershipCue && /\b(toca|tocar|mete|poe|por|bota|solta|reproduz|ouvir)\b/i.test(lower)) ||
      context?.preferredMediaSource === 'local'
    ) {
      return {
        type: 'play_local_media',
        kind:
          kind === 'any' && /\b(toca|tocar|mete|poe|por|bota|solta|ouvir)\b/i.test(lower)
            ? 'music'
            : kind,
        query: cleanedQuery || undefined,
        raw: clean,
      };
    }
  }

  // 5. Ambiguidade real quando não diz se é local nem internet nem um artista/género concreto
  if (
    !hasLocalOwnershipCue &&
    !context?.hasActiveMedia &&
    !context?.preferredMediaSource &&
    /^(?:sara[,\s]+)?(?:toca|mete|poe|abre)\s+(?:aquela|aquela\s+musica|aquele\s+video|esse\s+som)$/i.test(
      lower
    )
  ) {
    return {
      type: 'ask_media_source_ambiguity',
      kind: /\bvideo\b/i.test(lower) ? 'video' : 'music',
      raw: clean,
    };
  }

  // Casa / Luz / Aparelhos / Cenas (execução espontânea com feedback visual no palco)
  const sceneMatch = lower.match(/\bmodo\s+(noite|estudo|festa|dormir|relax)\b/i);
  if (sceneMatch && !/\bmodo\s+(manual|automatico|foco|builder|assistente|curto|completo|convidado)\b/i.test(lower)) {
    const sc = sceneMatch[1].toLowerCase();
    const sceneReplies: Record<string, string> = {
      noite: 'Boa, modo noite ligado — luzes suaves e som relaxado.',
      estudo: 'Modo estudo ativado! Tudo pronto para foco total.',
      festa: 'Bora! Modo festa ligado — som em alta e ambiente pronto.',
      dormir: 'Modo dormir ativo — luzes desligadas e silêncio tranquilo.',
      relax: 'Modo relax ligado. Podes descansar à vontade.',
    };
    return {
      type: 'smart_home_control',
      device: 'modo',
      state: 'scene',
      sceneName: sc,
      reply: sceneReplies[sc] || `Modo ${sc} ativado.`,
      raw: clean,
    };
  }

  const homeDeviceMatch = lower.match(
    /\b(liga|ligar|acende|acender|abre|abrir|destranca|destrancar|desliga|desligar|apaga|apagar|fecha|fechar|tranca|trancar)\s+(?:a|o|as|os)?\s*(luz|luzes|ventoinha|ventilador|ar\s+condicionado|ar|porta|tomada)(?:\s+(?:(?:da|do|de|na|no|em)\s+)?([a-z0-9\s]+))?/i
  );
  if (homeDeviceMatch && !/\b(painel|editor|builder|microfone|projeto|musica|player)\b/i.test(lower)) {
    const verb = homeDeviceMatch[1].toLowerCase();
    const rawDev = homeDeviceMatch[2].toLowerCase();
    const room = homeDeviceMatch[3]?.trim();
    const isOn = /^(liga|ligar|acende|acender|abre|abrir|destranca|destrancar)$/.test(verb);
    const dev: 'luz' | 'ventoinha' | 'ac' | 'porta' | 'tomada' = rawDev.startsWith('luz')
      ? 'luz'
      : rawDev.startsWith('vent')
      ? 'ventoinha'
      : rawDev.startsWith('ar')
      ? 'ac'
      : rawDev.startsWith('porta')
      ? 'porta'
      : 'tomada';
    const roomLabel = room ? ` da ${room}` : '';
    const reply =
      dev === 'porta'
        ? isOn
          ? `Feito, abri e destranquei a porta${roomLabel}.`
          : `Trancado! Fechei a porta${roomLabel}.`
        : dev === 'luz'
        ? isOn
          ? `Feito, luz${roomLabel} ligada.`
          : `Luz${roomLabel} desligada.`
        : dev === 'ventoinha'
        ? isOn
          ? `Boa, ventoinha${roomLabel} a rodar.`
          : `Ventoinha${roomLabel} desligada.`
        : dev === 'ac'
        ? isOn
          ? `Ar condicionado${roomLabel} ligado.`
          : `Ar condicionado${roomLabel} desligado.`
        : isOn
        ? `Tomada${roomLabel} ligada.`
        : `Tomada${roomLabel} desligada.`;
    return {
      type: 'smart_home_control',
      device: dev,
      state: isOn ? 'on' : 'off',
      room,
      reply,
      raw: clean,
    };
  }

  // Cálculo elétrico rápido / frases distorcidas ("sara calcu 220 10" -> calcula potência P = V*I e R = V/I passo a passo!)
  const elecShortcut = lower.match(
    /^(?:sara[,\s]+)?(?:calcula(?:\s+(?:a\s+)?(?:potencia|ohm|corrente|resistencia|energia))?|conta|quanto\s+da|lei\s+de\s+ohm)\s+(?:potencia\s+e\s+resistencia\s+eletrica\s+para\s+)?(\d+(?:[.,]\d+)?)\s*(v|volts?|a|amp(?:eres?)?|w|watts?|ohms?)?\s*(?:e|por|com|x|\*|\/)?\s*(\d+(?:[.,]\d+)?)\s*(v|volts?|a|amp(?:eres?)?|w|watts?|ohms?)?(?:\s+passo\s+a\s+passo)?$/i
  );
  if (elecShortcut && !hasExplicitAppFeatureEdit(lower)) {
    const n1 = parseLocalizedNumber(elecShortcut[1]);
    const u1 = (elecShortcut[2] || '').toLowerCase();
    const n2 = parseLocalizedNumber(elecShortcut[3]);
    const u2 = (elecShortcut[4] || '').toLowerCase();
    if (Number.isFinite(n1) && Number.isFinite(n2) && n1 > 0 && n2 > 0) {
      let voltage: number | undefined;
      let current: number | undefined;
      let resistance: number | undefined;
      let power: number | undefined;

      if (u1.startsWith('w') || u2.startsWith('w')) {
        power = u1.startsWith('w') ? n1 : n2;
        voltage = u1.startsWith('w') ? n2 : n1;
      } else if (u1.startsWith('o') || u2.startsWith('o')) {
        resistance = u1.startsWith('o') ? n1 : n2;
        voltage = u1.startsWith('o') ? n2 : n1;
      } else if (u1.startsWith('a') && u2.startsWith('v')) {
        current = n1;
        voltage = n2;
      } else {
        // Default: V and A (ex: 220V e 10A)
        voltage = n1;
        current = n2;
      }

      return {
        type: 'electric_calc',
        voltage,
        current,
        resistance,
        power,
        reconstructed: clean,
        raw: transcript,
      };
    }
  }

  // [SISTEMA:ABRIR_EDITOR / SISTEMA] Comandos universais da plataforma (mesmo estando no Modo Assistente!)
  if (
    !hasExplicitAppFeatureEdit(lower) &&
    !/\b(no\s+site|na\s+pagina|no\s+app|no\s+projeto)\b/.test(lower)
  ) {
    if (
      /\b(abre|abrir|vai\s+para|entra\s+no|mostra)\s+(o\s+)?(editor|codigo)\s+(em\s+)?(tela\s+cheia|ecra\s+inteiro|grande)\b/.test(
        lower
      )
    ) {
      return { type: 'open_editor_fullscreen' };
    }
    if (
      /^(sara[,\s]+)?(abre|abrir|abres|vai\s+para|entra\s+no|muda\s+para|passa\s+para|mostra|quero\s+abrir)\s+(o\s+)?(editor|codigo)(\s+do\s+sistema)?$/i.test(
        lower
      )
    ) {
      return { type: 'open_editor' };
    }
    if (/^(sara[,\s]+)?(abre|abrir|mostra|ver)\s+(os\s+)?projetos$/i.test(lower)) {
      return { type: 'open_projects' };
    }
    if (/^(sara[,\s]+)?(salva|salvar|guarda|guardar)\s+(o\s+)?projeto$/i.test(lower)) {
      return { type: 'save_project' };
    }
  }

  // Abrir ou fechar o Menu Deslizante [☰ PAINEL]
  if (
    /^(sara[,\s]+)?(abre|abrir|abres|mostra|mostrar|exibe|ver)\s+(o\s+)?(painel|menu)(\s+(lateral|de\s+modulos|jarvis))?$/i.test(
      lower
    ) ||
    lower === 'painel' ||
    lower === 'menu'
  ) {
    return { type: 'open_panel', raw: clean };
  }

  if (
    /^(sara[,\s]+)?(fecha|fechar|esconde|esconder|oculta|ocultar)\s+(o\s+)?(painel|menu)(\s+(lateral|de\s+modulos|jarvis))?$/i.test(
      lower
    )
  ) {
    return { type: 'close_panel', raw: clean };
  }

  // Módulos do Painel JARVIS acessíveis por voz em QUALQUER modo (Assistente ou Builder)
  if (!hasExplicitAppFeatureEdit(lower)) {
    if (/\b(abre|abrir|mostra|vai\s+para|muda\s+para|entra\s+em|ver)\s+(a\s+|o\s+|os\s+)?musica(s)?\b|^musica$/.test(lower)) {
      return { type: 'open_jarvis_module', moduleTab: 'musica', raw: clean };
    }
    if (/\b(abre|abrir|mostra|vai\s+para|muda\s+para|ver)\s+(a\s+|o\s+)?(agenda|alarmes?)\b|^agenda$/.test(lower)) {
      return { type: 'open_jarvis_module', moduleTab: 'agenda', raw: clean };
    }
    if (/\b(abre|abrir|mostra|vai\s+para|muda\s+para|ver)\s+(os\s+|o\s+)?(documentos?|docs?)\b|^documentos$|^docs$/.test(lower)) {
      return { type: 'open_jarvis_module', moduleTab: 'documentos', raw: clean };
    }
    if (/\b(abre|abrir|mostra|vai\s+para|muda\s+para|ver)\s+(as\s+|a\s+)?tarefas?\b|^tarefas$/.test(lower)) {
      return { type: 'open_jarvis_module', moduleTab: 'tarefas', raw: clean };
    }
    if (/\b(abre|abrir|mostra|vai\s+para|muda\s+para|ver)\s+(o\s+)?sistema\b|^sistema$/.test(lower)) {
      return { type: 'open_jarvis_module', moduleTab: 'sistema', raw: clean };
    }
    if (/\b(abre|abrir|mostra|vai\s+para|muda\s+para|ver)\s+(a\s+|o\s+)?voz\b/.test(lower)) {
      return { type: 'open_jarvis_module', moduleTab: 'voz', raw: clean };
    }

    // Mapa / Radar / Perfil / Meus Aparelhos / Achar Meu Celular / Segundo Plano
    if (
      /\b(para(?:r)?\s+(?:de\s+)?rastrear|para(?:r)?\s+(?:o\s+)?rastreamento|desliga(?:r)?\s+(?:o\s+)?rastreamento|para(?:r)?\s+(?:o\s+)?sonar)\b/i.test(
        lower
      )
    ) {
      return { type: 'radar_stop_tracking', raw: clean };
    }

    const radarViewMatch =
      lower.match(
        /\b(?:mostra(?:r)?|abre|abrir|ativa(?:r)?|muda(?:r)?\s+para|vai\s+para|coloca|mete|poe)\s+(?:a\s+|o\s+)?(?:vista\s+(?:de\s+)?|modo\s+(?:de\s+)?)?(satelite|terreno|ruas)\b/i
      ) ||
      lower.match(
        /^(?:sara[,\s]+)?(?:vista\s+(?:de\s+)?|modo\s+(?:de\s+)?)(satelite|terreno|ruas)(?:\s+no\s+(?:mapa|radar))?$/i
      );
    if (radarViewMatch) {
      const token = radarViewMatch[1].toLowerCase();
      const mode: 'roadmap' | 'hybrid' | 'terrain' =
        token === 'satelite' ? 'hybrid' : token === 'terreno' ? 'terrain' : 'roadmap';
      return { type: 'radar_view_mode', mode, raw: clean };
    }

    if (
      /\b(leva[-\s]?me\s+ate\s+la|mostra(?:r)?\s+(?:a\s+)?rota|traca(?:r)?\s+(?:a\s+)?rota|rota\s+ate\s+la|calcula(?:r)?\s+(?:a\s+)?rota|como\s+chegar\s+(?:la|ate\s+la))\b/i.test(
        lower
      )
    ) {
      return { type: 'radar_show_route', raw: clean };
    }

    if (
      /\b(achar\s+(o\s+)?meu\s+celular|encontrar\s+(o\s+)?meu\s+(celular|telemovel|telefone)|onde\s+(esta|ta)\s+(o\s+)?meu\s+(celular|telemovel|telefone)|rastrear\s+(o\s+)?(meu\s+)?(celular|telemovel|telefone))\b/i.test(
        lower
      )
    ) {
      return { type: 'open_find_phone', raw: clean };
    }

    if (
      /\b(qual\s+(?:e\s+)?(?:a\s+rua|o\s+bairro|o\s+endereco)(?:\s+onde\s+(?:ele|ela)\s+(?:esta|ta)|(?:\s+d[eo]\s+alvo|\s+del[ea]))?|em\s+que\s+rua\s+(?:ele|ela)\s+(?:esta|ta)|onde\s+(?:ele|ela)\s+(?:esta|ta)\s+agora)\b/i.test(
        lower
      )
    ) {
      return { type: 'radar_ask_target_street', raw: clean };
    }

    const trackTargetMatch = lower.match(
      /^(?:sara[,\s]+)?(?:rastreia|rastrea|rastrear|localiza|localizar|procura\s+no\s+radar|acha\s+no\s+radar)\s+(?:o\s+|a\s+)?(.+)$/i
    );
    if (trackTargetMatch && trackTargetMatch[1]?.trim()) {
      const targetQuery = clean
        .replace(
          /^(?:sara[,\s]+)?(?:rastreia|rastrea|rastrear|localiza|localizar|procura\s+no\s+radar|acha\s+no\s+radar)\s+(?:o\s+|a\s+)?/i,
          ''
        )
        .replace(/[.!?]+$/g, '')
        .trim();
      if (targetQuery) {
        return { type: 'radar_track_target', query: targetQuery, raw: clean };
      }
    }

    if (
      /^(sara[,\s]+)?(abre|abrir|abres|mostra|vai\s+para|entra\s+no|muda\s+para|ver)\s+(o\s+|a\s+)?(mapa|radar|aba\s+do\s+mapa)(\s+da\s+sara)?$/i.test(
        lower
      ) ||
      lower === 'mapa' ||
      lower === 'radar'
    ) {
      return { type: 'open_radar_map', raw: clean };
    }

    if (
      /\b(abre|abrir|mostra|ver|vai\s+para)\s+(o\s+|os\s+)?(meu\s+perfil|perfil|meus\s+aparelhos|meus\s+dispositivos)\b/i.test(
        lower
      )
    ) {
      return { type: 'open_profile_devices', raw: clean };
    }

    if (
      /\b(modo\s+fantasma|ativa(r)?\s+(o\s+)?modo\s+fantasma|fica(r)?\s+invisivel\s+no\s+mapa)\b/i.test(
        lower
      )
    ) {
      return { type: 'activate_ghost_mode', raw: clean };
    }

    if (
      /\b(para(r)?\s+de\s+partilhar|desliga(r)?\s+(a\s+)?localizacao|esconde(r)?\s+(a\s+)?minha\s+localizacao|aparecer\s+no\s+mapa\s+desligado|sai(r)?\s+do\s+mapa)\b/i.test(
        lower
      )
    ) {
      return { type: 'stop_location_sharing', raw: clean };
    }

    if (
      /\b(aparecer\s+no\s+mapa|liga(r)?\s+(a\s+)?localizacao\s+no\s+mapa|fica(r)?\s+visivel\s+no\s+mapa)\b/i.test(
        lower
      )
    ) {
      return { type: 'show_on_map_on', raw: clean };
    }

    if (
      /\b(para(r)?\s+(o\s+)?segundo\s+plano|desativa(r)?\s+(o\s+)?segundo\s+plano|desliga(r)?\s+(o\s+)?segundo\s+plano)\b/i.test(
        lower
      )
    ) {
      return { type: 'stop_background_mode', raw: clean };
    }

    if (
      /\b(ativa(r)?|liga(r)?|permiti(r)?)\s+(o\s+)?segundo\s+plano\b/i.test(lower)
    ) {
      return { type: 'enable_background_mode', raw: clean };
    }

    if (
      /\b(abre|abrir|mostra|ver)\s+(as\s+definicoes\s+do\s+|o\s+)?segundo\s+plano\b/i.test(lower)
    ) {
      return { type: 'open_background_settings', raw: clean };
    }
  }

  // Perguntar progresso durante construção em segundo plano / automático (funciona no Assistente e no Builder)
  if (
    lower.includes('como esta o projeto') ||
    lower.includes('como esta o progresso') ||
    lower.includes('progresso do website') ||
    lower.includes('progresso do site') ||
    lower.includes('progresso do builder') ||
    lower.includes('como esta o website') ||
    lower.includes('como vai o website') ||
    lower.includes('como vai o site') ||
    lower.includes('em que etapa') ||
    lower.includes('em que porcento') ||
    lower.includes('quantos porcento') ||
    lower.includes('como vai o projeto') ||
    lower.includes('qual o progresso') ||
    lower.includes('o que falta fazer') ||
    ((context?.lastTopic === 'builder' || context?.isMissionActive) &&
      /^(sara[,\s]+)?(como\s+ta|como\s+esta|ta\s+pronto|ja\s+acabou|como\s+vai)$/i.test(lower))
  ) {
    return { type: 'query_status', raw: clean };
  }

  // Chamamentos puros e saudações / gírias rápidas antes de enviar à IA
  const smallTalk = getInstantSmallTalkReply(lower, context?.callName, Boolean(context?.isOwner));
  if (smallTalk) {
    return {
      type: /^(ei|pssst|psst|olha|escuta|acorda|sou eu|chefe aqui)/i.test(lower)
        ? 'wake_ack'
        : 'background_smalltalk',
      reply: smallTalk,
      raw: clean,
    };
  }

  // No Modo Assistente JARVIS: fechar conteúdo no Preview ou continuar explicação
  if (context?.workspaceMode === 'jarvis') {
    if (
      context?.hasActiveStage &&
      /^(sara[,\s]+)?(fecha|fechar|fecha\s+isso|fecha\s+isto|esconde|esconde\s+isso|tira\s+isso|volta|voltar|volta\s+para\s+o\s+centro|sair)$/i.test(
        lower
      )
    ) {
      return { type: 'close_stage', raw: clean };
    }
    if (/^(sara[,\s]+)?(continua|continua\s+a\s+falar|prossegue|segue)$/i.test(lower)) {
      return { type: 'continue_sara', raw: clean };
    }
    if (lower.includes('configuracoes') || lower.includes('definicoes')) {
      return { type: 'open_settings' };
    }
    return { type: 'prompt', text: clean };
  }

  // Pausar / retomar missão automática e relatório
  if (
    lower.includes('pausa o automatico') ||
    lower.includes('pausar automatico') ||
    lower.includes('pausa a missao')
  ) {
    return { type: 'pause_mission' };
  }
  if (
    lower.includes('retoma o automatico') ||
    lower.includes('retomar automatico') ||
    lower.includes('retoma a missao')
  ) {
    return { type: 'resume_mission' };
  }
  if (lower.includes('abre o relatorio') || lower.includes('mostra o relatorio') || lower.includes('ver relatorio')) {
    return { type: 'open_report' };
  }

  // Frases compostas (ex: "apaga X e abre o editor") ou frases de edição de app
  const hasCompoundConnector = /\s+e\s+(abre|abrir|fecha|fechar|apaga|cria|mostra|muda|salva|guarda|duplica|limpa)\b/i.test(lower);
  const isAppEdit = hasExplicitAppFeatureEdit(lower);

  if (!hasCompoundConnector && !isAppEdit) {
    // Controlo total da plataforma (Editor, Ficheiros, Console, Preview, Apresentação, Projetos, CRUD)
    if (
      (lower.includes('preview') &&
        (lower.includes('tela cheia') ||
          lower.includes('ecra inteiro') ||
          lower.includes('maximiza') ||
          lower.includes('grande') ||
          lower.includes('fullscreen'))) ||
      lower.includes('maximiza o preview') ||
      lower.includes('maximizar preview') ||
      lower.includes('preview grande')
    ) {
      return { type: 'open_preview_fullscreen' };
    }

    if (
      ((lower.includes('editor') || lower.includes('codigo')) &&
        (lower.includes('tela cheia') ||
          lower.includes('ecra inteiro') ||
          lower.includes('maximiza') ||
          lower.includes('grande') ||
          lower.includes('fullscreen'))) ||
      lower.includes('maximiza o editor') ||
      lower.includes('maximizar editor') ||
      lower.includes('editor grande')
    ) {
      return { type: 'open_editor_fullscreen' };
    }

    if (
      lower.includes('fecha o editor') ||
      lower.includes('fechar editor') ||
      lower.includes('fecha o codigo') ||
      lower.includes('fecha o preview') ||
      lower.includes('fechar preview') ||
      lower.includes('minimiza o preview') ||
      lower.includes('fecha os projetos') ||
      lower.includes('sai dos projetos') ||
      lower.includes('fecha as configuracoes') ||
      lower.includes('fecha definicoes') ||
      lower.includes('fecha o deploy') ||
      lower.includes('fecha o modal') ||
      lower.includes('fecha a apresentacao') ||
      lower.includes('sai de tela cheia') ||
      lower.includes('sair de tela cheia') ||
      lower.includes('minimiza o editor') ||
      lower === 'sara volta' ||
      lower === 'sara, volta' ||
      lower === 'volta' ||
      ((context?.isEditorFullscreen ||
        context?.isPreviewFullscreen ||
        context?.activeTab === 'editor' ||
        context?.hasOpenOverlay) &&
        /^(sara[,\s]+)?(fecha|fechar|sair|sai|fecha isto|fecha isso|minimiza|volta)$/.test(lower))
    ) {
      return { type: 'close_editor_or_back' };
    }

    // Abrir / ir para o Editor ou Código (mesmo com "quero", "podes", "por favor", "lá")
    if (
      /\b(abre|abrir|abres|mostra|mostrar|mostra-me|mostra me|vai\s+para|vai\s+ao|entra\s+no|muda\s+para|passa\s+para|foca|ver|quero\s+ver|quero\s+abrir|podes?\s+abrir|pode\s+abrir)\s+(?:la\s+)?(?:o\s+|a\s+|no\s+)?(editor|codigo)\b/.test(
        lower
      ) ||
      /^(?:sara[,\s]+)?(?:o\s+)?(editor|codigo)(\s+por\s+favor)?$/.test(lower)
    ) {
      return { type: 'open_editor' };
    }

    if (
      lower.includes('modo apresentacao') ||
      lower.includes('abre a apresentacao') ||
      lower.includes('abrir apresentacao') ||
      lower.includes('mostra em apresentacao') ||
      lower === 'apresentacao'
    ) {
      return { type: 'toggle_presentation' };
    }

    // Apagar ficheiro específico
    if (context?.projectFiles?.length && /\b(apaga|apagar|elimina|eliminar|remove|remover)\s+((o|a)\s+)?(ficheiro|arquivo)\b/.test(lower)) {
      const fileToDel = context.projectFiles.find((fp) => {
        const base = fp.split('/').pop()?.toLowerCase() || fp.toLowerCase();
        const stem = base.replace(/\.[a-z0-9]+$/, '');
        return lower.includes(fp.toLowerCase()) || lower.includes(base) || (stem.length >= 3 && lower.includes(stem));
      });
      if (fileToDel) {
        return { type: 'delete_file', filePath: fileToDel };
      }
    }

    // Abrir ficheiro específico do projeto por voz (ex: "abre o ficheiro style.css", "foca motor.js")
    if (context?.projectFiles?.length && /\b(abre|abrir|foca|mostra|edita)\b/.test(lower)) {
      const fileMatch = context.projectFiles.find((fp) => {
        const base = fp.split('/').pop()?.toLowerCase() || fp.toLowerCase();
        const stem = base.replace(/\.[a-z0-9]+$/, '');
        return lower.includes(fp.toLowerCase()) || lower.includes(base) || (stem.length >= 3 && lower.includes(`ficheiro ${stem}`));
      });
      if (fileMatch) {
        return { type: 'focus_file', filePath: fileMatch };
      }
    }

    // CRUD de Projetos: Apagar / Abrir / Criar / Duplicar / Renomear projeto
    const delProjMatch = clean.match(
      /^(?:sara[,\s]+)?(?:apaga|apagar|elimina|eliminar|remove|remover|deita fora|tira)\s+(?:o\s+|a\s+|aquele\s+|este\s+)?projeto(?:\s+chamado)?(?:\s+["']?(.+?)["']?)?$/i
    );
    if (delProjMatch) {
      return {
        type: 'delete_project',
        name: delProjMatch[1]?.trim() || undefined,
      };
    }

    const openProjMatch = clean.match(
      /^(?:sara[,\s]+)?(?:abre|abrir|carrega|carregar|vai\s+para|muda\s+para|entra\s+no|seleciona)\s+(?:o\s+)?projeto\s+["']?(.+?)["']?$/i
    );
    if (openProjMatch && openProjMatch[1]) {
      return {
        type: 'open_named_project',
        name: openProjMatch[1].trim(),
      };
    }

    const renameProjMatch = clean.match(
      /^(?:sara[,\s]+)?(?:renomeia|renomear|muda\s+o\s+nome\s+(?:do\s+projeto\s+)?para)\s+(?:o\s+projeto\s+para\s+)?["']?(.+?)["']?$/i
    );
    if (renameProjMatch && renameProjMatch[1]) {
      return {
        type: 'rename_project',
        name: renameProjMatch[1].trim(),
      };
    }

    if (/\b(duplica|duplicar|clona|clonar|copia)\s+((o|este)\s+)?projeto\b/.test(lower)) {
      return { type: 'duplicate_project' };
    }

    const createProjMatch = clean.match(
      /^(?:sara[,\s]+)?(?:cria|criar|abre\s+um\s+novo|novo)\s+(?:um\s+)?projeto(?:\s+(?:chamado|com\s+o\s+nome|nome)\s+["']?(.+?)["']?|\s+["']?(.+?)["']?)?$/i
    );
    if (createProjMatch) {
      const rawName = (createProjMatch[1] || createProjMatch[2] || '').trim();
      const detectedType: ProjectType | undefined = /\bjogo\b/i.test(rawName)
        ? 'Jogo'
        : /\bapp\b/i.test(rawName)
        ? 'App'
        : undefined;
      return {
        type: 'create_project',
        name: rawName || undefined,
        projectType: detectedType,
      };
    }

    if (
      /\b(abre|abrir|abres|mostra|mostrar|vai\s+para|entra\s+n[ao]s?|muda\s+para|ver|quero\s+ver|quero\s+abrir|podes?\s+abrir)\s+(?:o[s]?\s+|a[s]?\s+)?(ficheiros|arquivos|pastas|pasta|arvore)\b/.test(
        lower
      )
    ) {
      return { type: 'open_files' };
    }
    if (
      /\b(abre|abrir|abres|mostra|mostrar|vai\s+para|entra\s+n[ao]|muda\s+para|ver|quero\s+ver|quero\s+abrir|podes?\s+abrir)\s+(?:o\s+|a\s+)?(console|terminal)\b/.test(
        lower
      )
    ) {
      return { type: 'open_console' };
    }
    if (
      /\b(abre|abrir|abres|mostra|mostra-me|mostra me|mostrar|exibe|exibir|vai\s+para|vai\s+ao|passa\s+para|muda\s+para|mete\s+no|poe\s+no|ver|quero\s+ver|quero\s+abrir|podes?\s+abrir)\s+(?:o\s+|a\s+|no\s+)?(preview|resultado|pre-visualizacao)\b/.test(
        lower
      ) ||
      /^(sara[,\s]+)?(o\s+)?preview(\s+por\s+favor)?$/.test(lower)
    ) {
      return { type: 'show_preview' };
    }
    if (
      lower.includes('preview em telemovel') ||
      lower.includes('modo telemovel') ||
      lower.includes('visao telemovel') ||
      lower.includes('versao telemovel') ||
      lower.includes('versao mobile') ||
      lower.includes('muda para telemovel') ||
      lower.includes('muda para mobile') ||
      lower.includes('poe no telemovel') ||
      lower.includes('no telemovel') ||
      lower.includes('no celular') ||
      lower.includes('visao celular') ||
      lower.includes('modo celular') ||
      lower.includes('versao celular') ||
      lower.includes('muda para celular') ||
      lower === 'telemovel' ||
      lower === 'celular'
    ) {
      return { type: 'preview_mobile' };
    }
    if (
      lower.includes('visao tablet') ||
      lower.includes('modo tablet') ||
      lower.includes('versao tablet') ||
      lower.includes('muda para tablet') ||
      lower.includes('poe no tablet') ||
      lower.includes('no tablet') ||
      lower.includes('preview em tablet') ||
      lower === 'tablet'
    ) {
      return { type: 'preview_tablet' };
    }
    if (
      lower.includes('preview em pc') ||
      lower.includes('modo pc') ||
      lower.includes('visao pc') ||
      lower.includes('versao pc') ||
      lower.includes('versao desktop') ||
      lower.includes('muda para pc') ||
      lower.includes('muda para desktop') ||
      lower.includes('volta para pc') ||
      lower.includes('no pc') ||
      lower.includes('no computador') ||
      lower.includes('visao computador') ||
      lower === 'pc' ||
      lower === 'desktop'
    ) {
      return { type: 'preview_desktop' };
    }
    if (
      lower.includes('faz deploy') ||
      lower.includes('fazer deploy') ||
      lower.includes('abre o deploy') ||
      lower.includes('abrir deploy') ||
      lower.includes('quero abrir o deploy') ||
      lower.includes('publica o site') ||
      lower.includes('publicar site')
    ) {
      return { type: 'open_deploy' };
    }
    if (lower.includes('faz push') || lower.includes('fazer push') || lower.includes('push para o github') || lower.includes('envia para o github') || lower.includes('autorizo o push') || lower.includes('pode fazer push')) {
      const preAuthorized = /\b(autorizo|confirmo|pode\s+fazer|podes\s+fazer|sim)\b/i.test(lower);
      return { type: 'push_github', preAuthorized };
    }
    if (lower.includes('baixa o zip') || lower.includes('baixar zip') || lower.includes('baixar o zip') || lower.includes('descarrega o zip')) {
      return { type: 'download_zip' };
    }
    if (lower.includes('limpa o chat') || lower.includes('limpar chat') || lower.includes('limpar o chat')) {
      const preAuthorized = /\b(autorizo|confirmo|pode\s+limpar)\b/i.test(lower);
      return { type: 'clear_chat', preAuthorized };
    }
    if (
      lower.includes('abre os projetos') ||
      lower.includes('abrir projetos') ||
      lower.includes('abrir os projetos') ||
      lower.includes('quero ver os projetos') ||
      lower.includes('lista de projetos') ||
      lower.includes('mostra os projetos') ||
      lower.includes('ver projetos') ||
      lower.includes('meus projetos')
    ) {
      return { type: 'open_projects' };
    }
    if (
      lower.includes('abre as configuracoes') ||
      lower.includes('abrir configuracoes') ||
      lower.includes('abrir as configuracoes') ||
      lower.includes('abre configuracoes') ||
      lower.includes('abre definicoes') ||
      lower.includes('abre as definicoes') ||
      lower.includes('abrir definicoes') ||
      lower.includes('mostra configuracoes') ||
      lower.includes('vai para configuracoes')
    ) {
      return { type: 'open_settings' };
    }
    if (
      lower.includes('salva o projeto') ||
      lower.includes('salvar o projeto') ||
      lower.includes('guarda o projeto') ||
      lower.includes('guardar o projeto') ||
      lower.includes('salva no firebase') ||
      lower.includes('salvar no firebase') ||
      lower.includes('guarda no firebase') ||
      lower.includes('guardar no firebase') ||
      lower.includes('sincroniza o firebase') ||
      lower.includes('sincroniza com o firebase') ||
      lower.includes('sincronizar firebase') ||
      lower.includes('salva isto') ||
      lower.includes('guarda isto') ||
      lower.includes('grava o projeto')
    ) {
      return { type: 'save_project' };
    }
    if (lower.includes('corrige o erro') || lower.includes('corrigir o erro') || lower.includes('corrigir erro')) {
      return { type: 'fix_error' };
    }
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
let saraModoChamada = false;
let currentUtteranceNormalized = '';
let lastSaraSpeechEndedAt = 0;
let activeRecognition: any = null;
let micShouldBeActive = false;
let resumeMicFn: (() => void) | null = null;
let pauseRecognitionForTtsFn: (() => void) | null = null;
let clearActiveVoiceBufferFn: (() => void) | null = null;
let restartAfterSpeechTimer: ReturnType<typeof setTimeout> | null = null;
let currentSpeechSeq = 0;
let bargeInEpoch = 0;
let lastBargeInAt = 0;
let bargeInAckActive = false;
let bargeInAckNormalized = '';
let stopCooldownUntil = 0;

const POST_TTS_SILENCE_COOLDOWN_MS = 800;
const STOP_COOLDOWN_LOCK_MS = 3000;
const MIN_VOICE_CONFIDENCE = 0.6;

const BARGE_IN_STOP_VARIATIONS = [
  'Ok, parei. Estou aqui.',
  'Pronto, já parei. Diz-me.',
  'Entendido, fiquei calada. O que precisas?',
  'Ok ok, parei. Fala.',
  'Feito, parei. Estou a ouvir.',
  'Certo, parei por aqui. Conta-me.',
];
let lastStopAckIndex = -1;

export function getVariedStopAckSpeech(): string {
  let idx = Math.floor(Math.random() * BARGE_IN_STOP_VARIATIONS.length);
  if (BARGE_IN_STOP_VARIATIONS.length > 1 && idx === lastStopAckIndex) {
    idx = (idx + 1 + Math.floor(Math.random() * (BARGE_IN_STOP_VARIATIONS.length - 1))) % BARGE_IN_STOP_VARIATIONS.length;
  }
  lastStopAckIndex = idx;
  return BARGE_IN_STOP_VARIATIONS[idx];
}

export function activateStopCooldown(durationMs = STOP_COOLDOWN_LOCK_MS): void {
  stopCooldownUntil = Date.now() + durationMs;
}

export function isWithinStopCooldown(): boolean {
  return Date.now() < stopCooldownUntil;
}

// Detector de Voz Humana (VAD) com Web Audio API + echoCancellation + noiseSuppression + autoGainControl: false
let persistentMicStream: MediaStream | null = null;
let persistentMicStreamPromise: Promise<MediaStream> | null = null;
let vadAudioCtx: AudioContext | null = null;
let vadStream: MediaStream | null = null;
let vadAnalyser: AnalyserNode | null = null;
let vadPollTimer: ReturnType<typeof setInterval> | null = null;
let vadActive = false;
let vadDisabledByCaptureConflict = false;
let vadNoiseFloorRms = 0.008;
let vadCurrentRms = 0;
let vadRecentPeakRms = 0;
let vadLastHumanVoiceAt = 0;

function hasLiveAudioTrack(stream: MediaStream | null): stream is MediaStream {
  if (!stream) return false;
  try {
    return stream.getAudioTracks().some((t) => t.readyState === 'live');
  } catch {
    return false;
  }
}

export async function acquireVoiceMicPermissionStream(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('Navegador sem suporte para getUserMedia.'), { name: 'NotSupportedError' });
  }
  if (hasLiveAudioTrack(persistentMicStream)) {
    return persistentMicStream;
  }
  if (persistentMicStreamPromise) {
    return persistentMicStreamPromise;
  }

  persistentMicStreamPromise = (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      persistentMicStream = stream;
      return stream;
    } catch (constraintErr: any) {
      if (constraintErr?.name === 'OverconstrainedError') {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        persistentMicStream = fallbackStream;
        return fallbackStream;
      }
      throw constraintErr;
    } finally {
      persistentMicStreamPromise = null;
    }
  })();

  return persistentMicStreamPromise;
}

export async function ensurePersistentMicStream(): Promise<MediaStream> {
  return acquireVoiceMicPermissionStream();
}

export async function startHumanVoiceVad(): Promise<boolean> {
  if (vadDisabledByCaptureConflict || vadActive) return vadActive;
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const stream = await acquireVoiceMicPermissionStream();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return false;
    }
    const ctx: AudioContext = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    // Filtro passa-banda focado na voz humana (300Hz - 3400Hz), rejeitando ruído grave e agudo
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1100;
    bandpass.Q.value = 0.7;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.35;

    source.connect(bandpass);
    bandpass.connect(analyser);

    vadStream = stream;
    vadAudioCtx = ctx;
    vadAnalyser = analyser;
    vadActive = true;
    vadNoiseFloorRms = 0.008;
    vadCurrentRms = 0;
    vadRecentPeakRms = 0;
    vadLastHumanVoiceAt = Date.now();

    const buf = new Float32Array(analyser.fftSize);
    vadPollTimer = setInterval(() => {
      if (!vadAnalyser || !vadActive) return;
      try {
        if (vadAudioCtx?.state === 'suspended') {
          void vadAudioCtx.resume().catch(() => {});
        }
        vadAnalyser.getFloatTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) {
          sumSq += buf[i] * buf[i];
        }
        const rms = Math.sqrt(sumSq / buf.length);
        vadCurrentRms = rms;

        const speechThreshold = Math.max(0.013, vadNoiseFloorRms * 2.1);
        if (rms >= speechThreshold && !isSaraActivelySpeaking()) {
          vadLastHumanVoiceAt = Date.now();
          vadRecentPeakRms = Math.max(vadRecentPeakRms * 0.85, rms);
        } else {
          vadNoiseFloorRms = vadNoiseFloorRms * 0.96 + Math.min(rms, 0.025) * 0.04;
          vadRecentPeakRms = Math.max(0, vadRecentPeakRms * 0.92);
        }
      } catch {
        // ignore sampler errors
      }
    }, 50);

    return true;
  } catch {
    return false;
  }
}

export function stopHumanVoiceVad(): void {
  vadActive = false;
  if (vadPollTimer) {
    clearInterval(vadPollTimer);
    vadPollTimer = null;
  }
  // Mantém persistentMicStream aberto para nunca fechar/repedir getUserMedia a cada frase
  vadStream = null;
  if (vadAudioCtx) {
    try {
      void vadAudioCtx.close();
    } catch {
      // ignore
    }
    vadAudioCtx = null;
  }
  vadAnalyser = null;
}

export function hasRecentHumanVoiceActivity(_windowMs = 4500): boolean {
  // Não mutar nem bloquear SpeechRecognition por causa do VAD/eco; echoCancellation e noiseSuppression tratam o áudio
  return true;
}

const recentSpokenEchoLog: Array<{ norm: string; words: string[]; ts: number }> = [];

function normalizeSpeechWords(norm: string): string[] {
  return norm
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

export function recordSpokenEcho(text: string): void {
  const norm = normalizeForRepeatCheck(text);
  if (!norm || norm.length < 3) return;
  const now = Date.now();
  recentSpokenEchoLog.push({
    norm,
    words: normalizeSpeechWords(norm),
    ts: now,
  });
  while (recentSpokenEchoLog.length > 16 || (recentSpokenEchoLog[0] && now - recentSpokenEchoLog[0].ts > 22000)) {
    recentSpokenEchoLog.shift();
  }
}

export function clearSpokenEchoLog(): void {
  recentSpokenEchoLog.length = 0;
  lastSaraSpeechEndedAt = 0;
}

export function isSaraActivelySpeaking(): boolean {
  if (saraEstaAFalar) return true;
  if (lastSaraSpeechEndedAt > 0) {
    return false;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      return Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending);
    } catch {
      return false;
    }
  }
  return false;
}

export function isProbableSaraEcho(
  transcript: string,
  contaminatedWhileSpeaking = false,
  nowMs = Date.now()
): boolean {
  const norm = normalizeForRepeatCheck(transcript);
  if (!norm) return true;

  // Durante ou logo após resposta de paragem, rejeita eco dessa frase
  if (bargeInAckActive) {
    if (
      norm === bargeInAckNormalized ||
      (norm.length >= 4 && bargeInAckNormalized.includes(norm))
    ) {
      return true;
    }
    return false;
  }

  if (isSaraActivelySpeaking()) {
    return true;
  }

  const msSinceEnded = lastSaraSpeechEndedAt > 0 ? nowMs - lastSaraSpeechEndedAt : 999999;

  // Janela de 800ms de silêncio após a Sara terminar de falar
  if (contaminatedWhileSpeaking) {
    return true;
  }
  if (lastSaraSpeechEndedAt > 0 && msSinceEnded >= 0 && msSinceEnded < POST_TTS_SILENCE_COOLDOWN_MS) {
    return true;
  }

  const tWords = normalizeSpeechWords(norm);
  const currentNorm = currentUtteranceNormalized;
  if (currentNorm && norm.length >= 6 && (currentNorm.includes(norm) || (norm.length >= 12 && norm.includes(currentNorm)))) {
    return true;
  }

  const maxAge = msSinceEnded < 1500 ? 18000 : 12000;
  for (let i = recentSpokenEchoLog.length - 1; i >= 0; i--) {
    const entry = recentSpokenEchoLog[i];
    if (nowMs - entry.ts > maxAge) continue;

    if (norm.length >= 8 && (entry.norm.includes(norm) || (entry.norm.length >= 10 && norm.includes(entry.norm)))) {
      return true;
    }

    if (tWords.length > 0 && entry.words.length > 0) {
      let overlap = 0;
      const entrySet = new Set(entry.words);
      for (const w of tWords) {
        if (entrySet.has(w)) overlap += 1;
      }
      const ratio = overlap / tWords.length;
      if (msSinceEnded < 800 && ratio >= 0.45 && overlap >= 2) {
        return true;
      }
      if (ratio >= 0.65 && overlap >= 2) {
        return true;
      }
      if (tWords.length === 1 && msSinceEnded < 800 && entrySet.has(tWords[0])) {
        return true;
      }
    }
  }

  return false;
}

function normalizeAsciiPhrase(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function parseInterruptionIntent(
  rawInput: string,
  isSpeaking = false,
  utteranceNorm = ''
): VoiceCommandAction | null {
  if (isWithinStopCooldown() || isSpeaking || isSaraActivelySpeaking()) {
    return null;
  }

  const lower = normalizeAsciiPhrase(rawInput);
  if (!lower) return null;

  if (/\bpara(?:r)?\s+(?:de\s+)?(?:rastrear|partilhar|o\s+segundo\s+plano|o\s+rastreamento|o\s+sonar|a\s+musica|o\s+video|a\s+leitura)\b/i.test(lower)) {
    return null;
  }
  if (/\b(modo\s+silencio|silencia\s+a\s+voz|nao\s+fales|fica\s+calad[ao]|fica\s+quiet[ao])\b/i.test(lower)) {
    return null;
  }

  // Comandos diretos e sinónimos flexíveis ("cala", "para lá", "chega", "podes parar", "espera aí", "calma", etc.)
  if (
    /^(?:(?:ok|oky|okay|ei|olha|epa)[,\s]+)*(?:sara[,\s]+)?(?:para(?:\s+la)?|cala(?:\s+te)?|calate|chega|calma(?:\s+ai)?|podes?\s+parar|espera(?:\s+ai)?|stop)(?:[,\s]+sara)?$/i.test(
      lower
    )
  ) {
    return { type: 'interrupt_sara', raw: rawInput };
  }

  const explicitMatch = lower.match(
    /\b(sara\s+para\s+de\s+falar|para\s+de\s+falar\s+sara|para\s+de\s+falar|parar\s+de\s+falar|deixa\s+de\s+falar|chega\s+de\s+falar|sara\s+para(?:\s+la|\s+agora|\s+ja)?|para\s+la(?:\s+sara)?|para\s+sara|sara\s+cala(?:\s+te)?|cala\s+sara|cala\s+a\s+boca|cala[-\s]?te|calate|sara\s+espera|espera\s+sara|sara\s+ouve(?:\s+me)?|ouve\s+sara|sara\s+escuta(?:\s+me)?|escuta\s+sara|podes\s+parar|pode\s+parar|para\s+agora|para\s+ja|para\s+com\s+isso|espera\s+ai|espera\s+um\s+pouco|calma\s+ai|sara\s+calma|ouve\s+me|escuta\s+me|sara\s+stop|sara\s+chega|ja\s+chega)\b/i
  );

  if (explicitMatch) {
    const matchedNorm = normalizeForRepeatCheck(explicitMatch[0]);
    if (utteranceNorm && matchedNorm && utteranceNorm.includes(matchedNorm)) {
      return null;
    }

    // Verifica se o utilizador já emendou um novo comando logo após a interrupção (ex: "SARA para, qual é o motor?")
    const idx = lower.indexOf(explicitMatch[0]);
    let trailing = '';
    if (idx >= 0) {
      const afterNorm = lower
        .slice(idx + explicitMatch[0].length)
        .replace(/^(?:sara|por\s+favor|agora|ja|ai|la|um\s+pouco|de\s+falar|com\s+isso)\b\s*/gi, '')
        .trim();
      if (afterNorm.length >= 3) {
        const rawWords = rawInput.trim().split(/\s+/);
        const afterWordsCount = afterNorm.split(/\s+/).length;
        trailing = rawWords.slice(Math.max(0, rawWords.length - afterWordsCount)).join(' ').trim();
      }
    }

    return {
      type: 'interrupt_sara',
      trailingCommand: trailing || undefined,
      raw: rawInput,
    };
  }

  return null;
}

function isSilenceCommandPhrase(
  lowerInput: string,
  isSpeaking = false,
  utteranceNorm = ''
): boolean {
  const lower = normalizeAsciiPhrase(lowerInput);
  if (!lower) return false;
  if (/\bpara(?:r)?\s+(?:de\s+)?(?:rastrear|partilhar|o\s+segundo\s+plano|o\s+rastreamento|o\s+sonar)\b/i.test(lower)) {
    return false;
  }

  // Só coloca em silêncio persistente quando o utilizador pede explicitamente para ficar calada / modo silêncio
  const persistentSilenceMatch = lower.match(
    /\b(fica\s+calad[ao]|fica\s+quiet[ao]|nao\s+fales(?:\s+mais)?|nao\s+me\s+atrapalhes|nao\s+atrapalhes?|nao\s+respondas?|nao\s+responde|modo\s+silencio|silencia\s+a\s+voz|sara\s+silencio)\b/i
  );
  if (persistentSilenceMatch) {
    const matchedNorm = normalizeForRepeatCheck(persistentSilenceMatch[0]);
    if (isSpeaking && utteranceNorm && matchedNorm && utteranceNorm.includes(matchedNorm)) {
      return false;
    }
    return true;
  }

  const strongTailMatch = lower.match(
    /(?:^|\s)(?:sara\s+)?(calada|silencio|silencia)(?:\s+(?:sara|por\s+favor|agora|ja))?$/i
  );
  if (strongTailMatch) {
    const token = normalizeForRepeatCheck(strongTailMatch[1]);
    if (isSpeaking && utteranceNorm && token && utteranceNorm.includes(token)) {
      return false;
    }
    return true;
  }

  return false;
}

const VOICE_BUS_CHANNEL = 'sara_voice_bus_v1';

export function broadcastVoiceBusEvent(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(VOICE_BUS_CHANNEL);
    ch.postMessage({ ...payload, ts: Date.now() });
    ch.close();
  } catch {
    // ignore BroadcastChannel restrictions
  }
}

export function subscribeVoiceBus(handler: (payload: any) => void): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  try {
    const ch = new BroadcastChannel(VOICE_BUS_CHANNEL);
    ch.onmessage = (evt) => handler(evt.data);
    return () => {
      try {
        ch.close();
      } catch {
        // ignore
      }
    };
  } catch {
    return () => {};
  }
}

const recentSpokenNormalized: string[] = [];

export function isSaraSilenced(): boolean {
  return saraSilenciada;
}

export function isSaraCallMode(): boolean {
  return saraModoChamada;
}

export function setSaraSilenced(silenced: boolean): void {
  saraSilenciada = silenced;
  if (silenced) {
    stopSaraSpeech();
  }
}

export function setSaraCallMode(active: boolean): void {
  saraModoChamada = active;
  if (active) {
    saraSilenciada = true;
    stopSaraSpeech();
  }
}

export function detectBargeInCommand(
  transcript: string,
  context?: VoiceParseContext
): VoiceCommandAction | null {
  const raw = String(transcript || '').trim();
  if (!raw) return null;
  const speakingNow = isSaraActivelySpeaking();

  // Nunca aceita comandos de voz vindos enquanto o TTS está ativo (microfone está surdo à própria voz)
  if (speakingNow) {
    return null;
  }

  // Verifica primeiro comandos de modo chamada, silêncio persistente ou retomada
  const cmd = parseVoiceCommand(raw, {
    ...context,
    isSilenced: saraSilenciada || context?.isSilenced,
    isCallMode: saraModoChamada || context?.isCallMode,
  });

  if (
    cmd.type === 'enter_call_mode' ||
    cmd.type === 'silence_sara' ||
    cmd.type === 'unsilence_sara' ||
    cmd.type === 'stop_listening'
  ) {
    return cmd;
  }

  // Trava de 3s após parar: ignora qualquer "para" / pause automático nessa janela
  if (isWithinStopCooldown()) {
    return null;
  }

  if (cmd.type === 'stop_all_and_pause' || cmd.type === 'pause_current_activity') {
    return cmd;
  }

  const interruptCmd = parseInterruptionIntent(raw, speakingNow, currentUtteranceNormalized);
  if (interruptCmd) {
    return interruptCmd;
  }

  return null;
}

export function interruptSaraForBargeIn(): void {
  activateStopCooldown(STOP_COOLDOWN_LOCK_MS);
  pauseRecognitionForTtsFn?.();
  // Cancela síntese de voz imediatamente (< 200ms) antes de qualquer atualização de estado
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  clearActiveVoiceBufferFn?.();
  bargeInEpoch += 1;
  lastBargeInAt = Date.now();
  currentSpeechSeq += 1;
  readingSeq += 1;
  if (readingActive) {
    readingActive = false;
    readingPaused = false;
    readingCursor = 0;
    readingChunks = [];
    readingTitle = '';
    emitReadingStatus();
  }
  queuedSpeeches.length = 0;
  lastSaraSpeechEndedAt = Date.now();
  saraEstaAFalar = false;
  bargeInAckActive = false;
  bargeInAckNormalized = '';
  currentUtteranceNormalized = '';
  speakingStateListener?.(false);
  if (restartAfterSpeechTimer) {
    clearTimeout(restartAfterSpeechTimer);
    restartAfterSpeechTimer = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    setTimeout(() => {
      try {
        if (!saraEstaAFalar) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore
      }
    }, 35);
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
        ? `${introClean}${/[.!?]$/.test(introClean) ? '' : '.'} Criei ${listLines.length} itens e deixei tudo no painel.`
        : `Criei ${listLines.length} itens e deixei tudo detalhado no painel.`;

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
    return normalizedText.slice(0, 6500);
  }

  const sentences = normalizedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  if (level === 'medium') {
    const med = sentences.slice(0, 3).join(' ').slice(0, 380);
    return sentences.length > 3
      ? `${med} Deixei o detalhe completo aqui no painel.`
      : med;
  }

  // Modo Curto (padrão): 1 a 2 frases diretas até ~155 chars
  let firstSentence = sentences[0] || normalizedText;
  if (firstSentence.length < 48 && sentences[1] && firstSentence.length + 1 + sentences[1].length <= 155) {
    firstSentence = `${firstSentence} ${sentences[1]}`;
  }
  if (firstSentence.length <= 155) {
    return firstSentence;
  }
  return firstSentence.slice(0, 148).replace(/\s+\S*$/, '') + '.';
}

export function sanitizeTextForSpeech(text: string): string {
  return resumirParaVoz(text, 'medium');
}

/**
 * Microfone contínuo resiliente em pt-PT com espera de 1.5s de silêncio para frases completas,
 * seleção inteligente entre 5 hipóteses usando o vocabulário da SARA e filtro de ruído/tosse/palavras soltas.
 */
const VOICE_SENTENCE_SILENCE_MS = 1500;

interface VoiceHypothesisCandidate {
  transcript: string;
  confidence: number;
}

const NOISE_OR_COUGH_ONLY_REGEX =
  /^(?:hm+|hum+|hmm+|uhm+|ah+|eh+|oh+|uh+|mhm+|aha+|aham+|cof+|coff+|tosse|tsk+|pss+|sh+|ei+|ai+|ui+|humhum|tipo|pois|ne|bom|entao|pronto)$/i;

const SARA_VOCAB_REGEX =
  /\b(sara|builder|construtor|assistente|jarvis|painel|menu|admin|cubo|esfera|musica|musicas|som|agenda|alarme|alarmes|lembrete|tarefa|tarefas|documento|documentos|sistema|explica|amapiano|afro|marrabenta|kizomba|inhambane|maputo|matola|luz|ventoinha|porta|tomada|calcula|ohm|volts?|amperes?|watts?|disjuntor|site|website|aplicativo|app|jogo|loja|editor|codigo|console|preview|ficheiros|arquivos|projetos?|deploy|github|firebase|zip|manual|automatico|fixe|maningue|bora|cala|para|espera|ouve|escuta|chega|voltei|chamada|pausa|continua|retoma|repete|imagem|foto|fotos|mapa|radar|rastreia|satelite|terreno|ruas|rota)\b/i;

function describeCleanHypothesis(
  cmd: VoiceCommandAction,
  cleanedText: string
): string | null {
  switch (cmd.type) {
    case 'open_editor':
    case 'open_editor_fullscreen':
      return 'abrir o editor';
    case 'show_preview':
    case 'open_preview_fullscreen':
      return 'mostrar o preview';
    case 'open_files':
      return 'abrir os ficheiros';
    case 'open_console':
      return 'abrir o console';
    case 'open_projects':
      return 'abrir os projetos';
    case 'open_settings':
      return 'abrir as configurações';
    case 'open_panel':
      return 'abrir o painel';
    case 'close_panel':
      return 'fechar o painel';
    case 'open_builder_mode':
      return 'mudar para o Estúdio SARA';
    case 'open_jarvis_mode':
      return 'mudar para o Assistente';
    case 'open_jarvis_module':
      if (cmd.moduleTab === 'musica') return 'abrir a música';
      if (cmd.moduleTab === 'agenda') return 'abrir a agenda';
      if (cmd.moduleTab === 'tarefas') return 'abrir as tarefas';
      if (cmd.moduleTab === 'documentos') return 'abrir os documentos';
      if (cmd.moduleTab === 'sistema') return 'abrir o sistema';
      return 'abrir o módulo de voz';
    case 'open_radar_map':
      return 'abrir o mapa';
    case 'save_project':
      return 'guardar o projeto';
    case 'open_deploy':
      return 'abrir o deploy';
    case 'switch_manual':
      return 'mudar para modo manual';
    case 'switch_automatic':
      return 'mudar para modo automático';
    case 'pause_music':
      return 'pausar a música';
    case 'resume_music':
      return 'continuar a música';
    case 'next_music':
      return 'passar para a próxima música';
    case 'prev_music':
      return 'voltar à música anterior';
    case 'volume_up':
      return 'aumentar o volume';
    case 'volume_down':
      return 'diminuir o volume';
    case 'stop_listening':
      return 'desligar o microfone';
    case 'smart_home_control':
      return `controlar ${cmd.device}`;
    case 'electric_calc':
      return 'fazer um cálculo elétrico';
    case 'play_local_media':
      return 'reproduzir mídia local';
    case 'open_local_document':
      return 'abrir um documento';
    case 'create_project':
      return 'criar um novo projeto';
    case 'query_status':
      return 'ver o progresso do projeto';
    case 'repeat_sara':
      return 'repetir o que disse';
    default:
      break;
  }

  if (extractImageGenRequest(cleanedText)) {
    return 'gerar uma imagem';
  }
  const imgVoice = parseImageVoiceCommand(cleanedText);
  if (imgVoice) {
    if (imgVoice.type === 'regenerate') return 'gerar outra imagem';
    if (imgVoice.type === 'download') return 'baixar a imagem';
    if (imgVoice.type === 'use_profile_photo') return 'usar como foto de perfil';
    if (imgVoice.type === 'show_last_image') return 'mostrar a imagem';
    return 'mudar o estilo da imagem';
  }

  const dom = inferDomainFromText(cleanedText);
  if (dom === 'music') return 'tocar ou controlar música';
  if (dom === 'builder') return 'trabalhar no site ou projeto';
  if (dom === 'electricity') return 'fazer um cálculo elétrico';
  if (dom === 'home') return 'controlar a casa';
  if (dom === 'study') return 'explicar ou estudar um tema';
  if (dom === 'agenda') return 'ver ou marcar na agenda';
  if (dom === 'system') return 'aceder ao sistema';
  return null;
}

function isLooseOrNoiseUtterance(
  cleanedText: string,
  cmd: VoiceCommandAction,
  confidence: number,
  domain: VoiceDomainTopic,
  context?: VoiceParseContext
): boolean {
  const norm = normalizeAsciiPhrase(cleanedText);
  if (!norm) return true;

  // Tosse / ruído / hesitação isolada
  if (NOISE_OR_COUGH_ONLY_REGEX.test(norm)) return true;

  // Confiança abaixo de 0.60 deve ser ignorada
  if (confidence > 0 && confidence < MIN_VOICE_CONFIDENCE) {
    return true;
  }

  const words = norm.split(/\s+/).filter(Boolean);
  const isImageAction = Boolean(extractImageGenRequest(cleanedText) || parseImageVoiceCommand(cleanedText));
  const isConcreteCommand = cmd.type !== 'prompt' && cmd.type !== 'unintelligible_clarify';

  // Frases naturais de 2+ palavras (sem precisar começar por "SARA") são sempre aceites
  if (words.length >= 2) {
    return false;
  }

  // Palavras curtas úteis de 1 palavra (comandos, saudações, confirmações, sinónimos de parar/repetir)
  if (context?.hasPendingConfirm && (cmd.type === 'confirm_pending' || cmd.type === 'cancel_pending')) {
    return false;
  }
  if (words[0] === 'sara' || isConcreteCommand || isImageAction || domain !== 'general') {
    return false;
  }
  if (/^(ola|oi|obrigado|obrigada|valeu|tchau|fixe|top|bora|ya|sim|nao|cala|para|chega|calma|espera|repete|continua|como|onde|quem|porque|ajuda|fome|agua)$/i.test(words[0])) {
    return false;
  }

  return true;
}

interface HypothesisSelectionOutcome {
  decision: 'execute' | 'clarify' | 'ignore';
  transcript?: string;
  clarifierSpeech?: string;
}

function selectBestVoiceHypothesis(
  candidates: VoiceHypothesisCandidate[],
  context?: VoiceParseContext
): HypothesisSelectionOutcome {
  if (!candidates.length) return { decision: 'ignore' };

  const evaluated = candidates.map((cand, rankIdx) => {
    const raw = cand.transcript.trim();
    const recon = reconstructDistortedVoiceInput(raw, context);
    const cleaned = recon.reconstructed || recon.cleaned || raw;
    const cmd = parseVoiceCommand(cleaned, context);
    const domain = inferDomainFromText(cleaned);
    const isImageCmd = Boolean(extractImageGenRequest(cleaned) || parseImageVoiceCommand(cleaned));
    const isConcreteAction = cmd.type !== 'prompt' && cmd.type !== 'unintelligible_clarify';
    const rawConf = typeof cand.confidence === 'number' && cand.confidence > 0 ? cand.confidence : 0;
    const priorConf = rawConf > 0 ? rawConf : Math.max(0.45, 0.8 - rankIdx * 0.08);
    const vocabMatches = cleaned.match(new RegExp(SARA_VOCAB_REGEX.source, 'gi'))?.length || 0;
    const normWords = normalizeAsciiPhrase(cleaned).split(/\s+/).filter(Boolean);

    let score = priorConf;
    if (isConcreteAction || isImageCmd) score += 0.48;
    if (domain !== 'general') score += 0.28;
    score += Math.min(0.32, vocabMatches * 0.14);
    if (normWords.length >= 2) score += 0.12;
    if (recon.unintelligible) score -= 0.55;
    if (isLooseOrNoiseUtterance(cleaned, cmd, rawConf, domain, context)) score -= 0.75;

    return {
      raw,
      cleaned,
      recon,
      cmd,
      domain,
      isImageCmd,
      isConcreteAction,
      rawConf,
      score,
      looseOrNoise: isLooseOrNoiseUtterance(cleaned, cmd, rawConf, domain, context),
      label: describeCleanHypothesis(cmd, cleaned),
    };
  });

  evaluated.sort((a, b) => b.score - a.score);
  const best = evaluated[0];
  if (!best) return { decision: 'ignore' };

  // Se todas as hipóteses forem ruído puro, confiança < 0.60 ou tosse, ignora em silêncio
  if (evaluated.every((e) => e.looseOrNoise || e.recon.unintelligible)) {
    const bestWords = normalizeAsciiPhrase(best.cleaned).split(/\s+/).filter(Boolean);
    if (
      bestWords.length < 2 ||
      (best.rawConf > 0 && best.rawConf < MIN_VOICE_CONFIDENCE) ||
      NOISE_OR_COUGH_ONLY_REGEX.test(normalizeAsciiPhrase(best.cleaned))
    ) {
      return { decision: 'ignore' };
    }
    const labels = Array.from(
      new Set(evaluated.map((e) => e.label).filter((lbl): lbl is string => Boolean(lbl)))
    ).slice(0, 2);
    if (labels.length >= 2) {
      return {
        decision: 'clarify',
        clarifierSpeech: `Queres dizer ${labels[0]} ou ${labels[1]}?`,
      };
    }
    return {
      decision: 'execute',
      transcript: best.cleaned,
    };
  }

  // Se houver empate próximo entre 2 comandos diferentes, pergunta naturalmente "Queres dizer X ou Y?"
  const second = evaluated[1];
  const hasCloseCommandConflict =
    Boolean(second) &&
    second.isConcreteAction &&
    best.isConcreteAction &&
    second.cmd.type !== best.cmd.type &&
    best.score - second.score < 0.1 &&
    best.rawConf > 0 &&
    best.rawConf < 0.85;

  if (hasCloseCommandConflict) {
    const labels = Array.from(
      new Set(evaluated.map((e) => e.label).filter((lbl): lbl is string => Boolean(lbl)))
    ).slice(0, 2);
    if (labels.length >= 2) {
      return {
        decision: 'clarify',
        clarifierSpeech: `Queres dizer ${labels[0]} ou ${labels[1]}?`,
      };
    }
  }

  return {
    decision: 'execute',
    transcript: best.cleaned,
  };
}

export function startContinuousVoiceRecognition(options: {
  shouldKeepListening: () => boolean;
  getParseContext?: () => VoiceParseContext;
  onResult: (transcript: string) => void;
  onBargeInStop?: (trailingCommand?: string) => void;
  onClarify?: (clarifierSpeech: string) => void;
  onError: (err: string, fatal?: boolean) => void;
  onEnd: () => void;
}): () => void {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) {
    options.onError('Erro: NotSupportedError - Reconhecimento de voz não suportado neste navegador.', true);
    options.onEnd();
    return () => {};
  }

  micShouldBeActive = true;
  void startHumanVoiceVad();
  let manuallyStopped = false;
  let isTtsRecognitionOff = isSaraActivelySpeaking();
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let silenceFlushTimer: ReturnType<typeof setTimeout> | null = null;

  let bufferedSegments: Array<VoiceHypothesisCandidate[]> = [];

  const clearSentenceBuffer = () => {
    if (silenceFlushTimer) {
      clearTimeout(silenceFlushTimer);
      silenceFlushTimer = null;
    }
    bufferedSegments = [];
  };
  clearActiveVoiceBufferFn = clearSentenceBuffer;

  const buildCombinedHypotheses = (
    segments: Array<VoiceHypothesisCandidate[]>
  ): VoiceHypothesisCandidate[] => {
    if (segments.length === 0) return [];
    if (segments.length === 1) return segments[0].slice(0, 5);

    const hypotheses: VoiceHypothesisCandidate[] = [];
    for (let altIdx = 0; altIdx < 5; altIdx++) {
      const parts: string[] = [];
      let confSum = 0;
      let confCount = 0;
      for (const seg of segments) {
        const chosen = seg[altIdx] || seg[0];
        if (chosen?.transcript) {
          parts.push(chosen.transcript.trim());
          if (chosen.confidence > 0) {
            confSum += chosen.confidence;
            confCount += 1;
          }
        }
      }
      const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (joined && !hypotheses.some((h) => h.transcript.toLowerCase() === joined.toLowerCase())) {
        hypotheses.push({
          transcript: joined,
          confidence: confCount > 0 ? confSum / confCount : 0,
        });
      }
    }
    return hypotheses.slice(0, 5);
  };

  const flushBufferedSentence = () => {
    if (silenceFlushTimer) {
      clearTimeout(silenceFlushTimer);
      silenceFlushTimer = null;
    }
    if (manuallyStopped || isTtsRecognitionOff || !options.shouldKeepListening() || isSaraActivelySpeaking()) {
      bufferedSegments = [];
      return;
    }
    if (lastSaraSpeechEndedAt > 0 && Date.now() - lastSaraSpeechEndedAt < POST_TTS_SILENCE_COOLDOWN_MS) {
      bufferedSegments = [];
      return;
    }
    const segments = bufferedSegments;
    bufferedSegments = [];
    if (segments.length === 0) return;

    const hypotheses = buildCombinedHypotheses(segments);
    const parseCtx = options.getParseContext ? options.getParseContext() : undefined;
    const outcome = selectBestVoiceHypothesis(hypotheses, parseCtx);

    if (outcome.decision === 'ignore') {
      return;
    }
    if (outcome.decision === 'clarify' && outcome.clarifierSpeech) {
      if (options.onClarify) {
        options.onClarify(outcome.clarifierSpeech);
      } else {
        options.onResult(outcome.clarifierSpeech);
      }
      return;
    }
    if (outcome.decision === 'execute' && outcome.transcript) {
      options.onResult(outcome.transcript);
    }
  };

  const scheduleRestart = (delayMs = 500) => {
    if (manuallyStopped || isTtsRecognitionOff || isSaraActivelySpeaking() || !options.shouldKeepListening()) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!manuallyStopped && !isTtsRecognitionOff && !isSaraActivelySpeaking()) {
        startSession();
      }
    }, delayMs);
  };

  const startSession = () => {
    if (manuallyStopped || !options.shouldKeepListening()) {
      micShouldBeActive = false;
      options.onEnd();
      return;
    }

    // Enquanto o TTS toca, o reconhecimento permanece 100% desligado
    if (isTtsRecognitionOff || isSaraActivelySpeaking()) {
      return;
    }

    // Evita instâncias paralelas presas na mesma sessão
    if (activeRecognition) {
      return;
    }

    const recognition = new SR();
    activeRecognition = recognition;
    recognition.lang = 'pt-PT';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    const processedFinalIndices = new Set<number>();
    let sessionBargeEpoch = bargeInEpoch;

    recognition.onstart = () => {
      if (isTtsRecognitionOff || isSaraActivelySpeaking() || activeRecognition !== recognition) {
        try {
          recognition.abort?.();
        } catch {
          // ignore
        }
        return;
      }
      broadcastVoiceBusEvent({ type: 'mic_status', listening: true });
    };

    recognition.onresult = (event: any) => {
      if (isTtsRecognitionOff || isSaraActivelySpeaking() || activeRecognition !== recognition) {
        clearSentenceBuffer();
        for (let k = 0; k < event.results.length; k++) {
          if (event.results[k]?.isFinal) processedFinalIndices.add(k);
        }
        return;
      }

      if (sessionBargeEpoch !== bargeInEpoch) {
        sessionBargeEpoch = bargeInEpoch;
        clearSentenceBuffer();
        for (let k = 0; k < event.results.length; k++) {
          if (event.results[k]?.isFinal) processedFinalIndices.add(k);
        }
        return;
      }

      const withinPostSpeechSilence =
        lastSaraSpeechEndedAt > 0 &&
        Date.now() - lastSaraSpeechEndedAt < POST_TTS_SILENCE_COOLDOWN_MS;

      if (withinPostSpeechSilence) {
        clearSentenceBuffer();
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i]?.isFinal) processedFinalIndices.add(i);
        }
        return;
      }

      let addedNewSegment = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (!res?.isFinal || processedFinalIndices.has(i)) continue;
        processedFinalIndices.add(i);

        // Extrai até 5 hipóteses com confiança mínima 0.60
        const alts: VoiceHypothesisCandidate[] = [];
        const altCount = Math.min(5, res.length || 0);
        for (let altIdx = 0; altIdx < altCount; altIdx++) {
          const cand = (res?.[altIdx]?.transcript || '').trim();
          if (!cand) continue;
          const conf = typeof res?.[altIdx]?.confidence === 'number' ? res[altIdx].confidence : 0;
          if (conf > 0 && conf < MIN_VOICE_CONFIDENCE) continue;
          alts.push({ transcript: cand, confidence: conf });
        }
        if (alts.length === 0) continue;

        if (isProbableSaraEcho(alts[0].transcript, false)) {
          continue;
        }

        bufferedSegments.push(alts);
        addedNewSegment = true;
      }

      // Aguarda 1.5 segundos de silêncio antes de processar para não cortar frases longas ao meio
      if (addedNewSegment && bufferedSegments.length > 0) {
        if (silenceFlushTimer) {
          clearTimeout(silenceFlushTimer);
        }
        silenceFlushTimer = setTimeout(() => {
          flushBufferedSentence();
        }, VOICE_SENTENCE_SILENCE_MS);
      }
    };

    recognition.onerror = (event: any) => {
      clearSentenceBuffer();
      const errCode = event?.error || '';
      if (errCode === 'audio-capture' && vadActive) {
        vadDisabledByCaptureConflict = true;
        stopHumanVoiceVad();
      }
      if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
        manuallyStopped = true;
        micShouldBeActive = false;
        stopHumanVoiceVad();
        if (activeRecognition === recognition) {
          activeRecognition = null;
        }
        broadcastVoiceBusEvent({ type: 'mic_status', listening: false });
        const detail = event?.message ? String(event.message) : 'Permissão do microfone recusada ou bloqueada.';
        options.onError(`Erro: ${errCode} - ${detail}`, true);
        options.onEnd();
        return;
      }

      if (activeRecognition === recognition) {
        activeRecognition = null;
      }
      if (!manuallyStopped && !isTtsRecognitionOff && !isSaraActivelySpeaking() && options.shouldKeepListening()) {
        scheduleRestart(500);
      }
    };

    recognition.onend = () => {
      if (
        bufferedSegments.length > 0 &&
        !manuallyStopped &&
        !isTtsRecognitionOff &&
        !isSaraActivelySpeaking() &&
        options.shouldKeepListening()
      ) {
        if (silenceFlushTimer) {
          clearTimeout(silenceFlushTimer);
        }
        silenceFlushTimer = setTimeout(() => {
          flushBufferedSentence();
        }, VOICE_SENTENCE_SILENCE_MS);
      } else if (isTtsRecognitionOff || isSaraActivelySpeaking()) {
        clearSentenceBuffer();
      }
      if (activeRecognition === recognition) {
        activeRecognition = null;
      }
      if (!manuallyStopped && options.shouldKeepListening()) {
        if (!isTtsRecognitionOff && !isSaraActivelySpeaking()) {
          scheduleRestart(500);
        }
      } else {
        clearSentenceBuffer();
        micShouldBeActive = false;
        broadcastVoiceBusEvent({ type: 'mic_status', listening: false });
        options.onEnd();
      }
    };

    try {
      recognition.start();
    } catch (err: any) {
      if (activeRecognition === recognition) {
        activeRecognition = null;
      }
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        manuallyStopped = true;
        micShouldBeActive = false;
        options.onError(`Erro: ${err?.name || 'Error'} - ${err?.message || 'Microfone não permitido'}`, true);
        options.onEnd();
        return;
      }
      if (!manuallyStopped && !isTtsRecognitionOff && !isSaraActivelySpeaking() && options.shouldKeepListening()) {
        scheduleRestart(500);
      }
    }
  };

  pauseRecognitionForTtsFn = () => {
    isTtsRecognitionOff = true;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    clearSentenceBuffer();
    const rec = activeRecognition;
    activeRecognition = null;
    if (rec) {
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort?.();
        rec.stop?.();
      } catch {
        // ignore
      }
    }
  };

  resumeMicFn = () => {
    if (manuallyStopped || !options.shouldKeepListening()) return;
    if (isSaraActivelySpeaking()) return;
    isTtsRecognitionOff = false;
    clearSentenceBuffer();
    micShouldBeActive = true;
    broadcastVoiceBusEvent({ type: 'mic_status', listening: true });
    if (!activeRecognition) {
      startSession();
    }
  };

  // Watchdog contínuo: garante que o microfone volta sempre 800ms depois da fala e nunca fica preso
  const watchdogId = setInterval(() => {
    if (manuallyStopped || !micShouldBeActive || !options.shouldKeepListening()) return;
    if (
      isTtsRecognitionOff &&
      !isSaraActivelySpeaking() &&
      !restartAfterSpeechTimer &&
      (lastSaraSpeechEndedAt === 0 || Date.now() - lastSaraSpeechEndedAt >= POST_TTS_SILENCE_COOLDOWN_MS)
    ) {
      isTtsRecognitionOff = false;
      clearSentenceBuffer();
    }
    if (!isTtsRecognitionOff && !isSaraActivelySpeaking() && !activeRecognition && !restartTimer) {
      startSession();
    }
  }, 500);

  const handleTabWake = () => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      !manuallyStopped &&
      !isTtsRecognitionOff &&
      !isSaraActivelySpeaking() &&
      micShouldBeActive &&
      options.shouldKeepListening() &&
      !activeRecognition
    ) {
      scheduleRestart(50);
    }
  };

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', handleTabWake);
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('focus', handleTabWake);
  }

  if (!isTtsRecognitionOff) {
    startSession();
  }

  return () => {
    manuallyStopped = true;
    micShouldBeActive = false;
    isTtsRecognitionOff = true;
    pauseRecognitionForTtsFn = null;
    resumeMicFn = null;
    clearActiveVoiceBufferFn = null;
    clearSentenceBuffer();
    stopHumanVoiceVad();
    clearInterval(watchdogId);
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', handleTabWake);
    }
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('focus', handleTabWake);
    }
    if (restartTimer) clearTimeout(restartTimer);
    if (restartAfterSpeechTimer) {
      clearTimeout(restartAfterSpeechTimer);
      restartAfterSpeechTimer = null;
    }
    try {
      activeRecognition?.abort?.();
      activeRecognition?.stop?.();
    } catch {
      // ignore
    }
    activeRecognition = null;
    broadcastVoiceBusEvent({ type: 'mic_status', listening: false });
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
  pickBestFemalePortugueseVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    pickBestFemalePortugueseVoice();
  };
}

let speakingStateListener: ((speaking: boolean) => void) | null = null;

export function setSpeakingStateListener(cb: ((speaking: boolean) => void) | null): void {
  speakingStateListener = cb;
}

const queuedSpeeches: Array<{ text: string; enabled: boolean; options?: SpeakOptions }> = [];

export function stopSaraSpeech(): void {
  pauseRecognitionForTtsFn?.();
  currentSpeechSeq += 1;
  queuedSpeeches.length = 0;
  clearActiveVoiceBufferFn?.();
  if (saraEstaAFalar || currentUtteranceNormalized) {
    lastSaraSpeechEndedAt = Date.now();
  }
  saraEstaAFalar = false;
  bargeInAckActive = false;
  bargeInAckNormalized = '';
  currentUtteranceNormalized = '';
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
  if (micShouldBeActive && resumeMicFn) {
    restartAfterSpeechTimer = setTimeout(() => {
      restartAfterSpeechTimer = null;
      if (micShouldBeActive && !isSaraActivelySpeaking()) {
        resumeMicFn?.();
      }
    }, POST_TTS_SILENCE_COOLDOWN_MS);
  }
}

/**
 * Interrupção imediata (Barge-In): cala a Sara no instante (< 200ms),
 * ativa a trava de 3s, limpa todo o áudio antigo e religa o microfone após 800ms.
 */
export function interruptSaraAndListen(): void {
  interruptSaraForBargeIn();
  if (micShouldBeActive && resumeMicFn) {
    restartAfterSpeechTimer = setTimeout(() => {
      restartAfterSpeechTimer = null;
      if (micShouldBeActive && !isSaraActivelySpeaking()) {
        resumeMicFn?.();
      }
    }, POST_TTS_SILENCE_COOLDOWN_MS);
  }
}

export interface SpeakOptions {
  level?: VoiceLevel;
  forceSpeak?: boolean;
  bypassSilence?: boolean;
  isQuestionReply?: boolean;
  allowInfraMention?: boolean;
  queueIfSpeaking?: boolean;
  isBargeInAck?: boolean;
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
  return 1.1;
}

let customBaseRate = typeof window !== 'undefined' ? loadSavedSpeechRate() : 1.1;

export function adjustVoiceSpeed(direction: 'faster' | 'slower' | 'normal'): number {
  if (direction === 'normal') {
    customBaseRate = 1.1;
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
 * Fala com sincronização exata de lábios via speechSynthesis.onstart / onend.
 * A boca NUNCA mexe antes do áudio realmente começar a tocar.
 */
function splitTextForFluentSpeech(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= 215) return [clean];

  const rawSentences = clean.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buffer = '';

  const flushBuf = () => {
    if (buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = '';
    }
  };

  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length > 215) {
      flushBuf();
      const parts = trimmed.split(/(?<=[,;:])\s+/);
      for (const p of parts) {
        if ((buffer + ' ' + p).trim().length > 210 && buffer) {
          flushBuf();
        }
        buffer = buffer ? `${buffer} ${p}` : p;
      }
      flushBuf();
      continue;
    }
    if ((buffer + ' ' + trimmed).trim().length > 215 && buffer) {
      flushBuf();
    }
    buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
  }
  flushBuf();
  return chunks.length > 0 ? chunks : [clean];
}

export function speakAsSara(
  text: string,
  enabled: boolean,
  onFinishedOrOptions?: (() => void) | SpeakOptions
): void {
  const opts: SpeakOptions =
    typeof onFinishedOrOptions === 'function'
      ? { onFinished: onFinishedOrOptions }
      : onFinishedOrOptions || {};

  // Regra de Ouro do Silêncio: quando silenciada ou em Modo Chamada, não emite NENHUMA fala nem som (só desbloqueia com bypassSilence explícito do utilizador)
  if (!enabled || ((saraSilenciada || saraModoChamada) && !opts.bypassSilence)) {
    opts.onFinished?.();
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts.onFinished?.();
    return;
  }

  // Se pedido queueIfSpeaking e já há fala ativa no momento, coloca em fila sem cortar o início
  if (opts.queueIfSpeaking && saraEstaAFalar) {
    queuedSpeeches.push({ text, enabled, options: { ...opts, queueIfSpeaking: false } });
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

    // Permite responder sempre naturalmente sem substituir por frases robóticas repetidas
    const normKey = normalizeForRepeatCheck(spoken);
    if (!opts.forceSpeak && !opts.isQuestionReply && normKey && recentSpokenNormalized.includes(normKey)) {
      // Ainda regista no log mas evita apenas repetir mensagens de sistema exatamente idênticas em sequência imediata
      if (recentSpokenNormalized[recentSpokenNormalized.length - 1] === normKey) {
        opts.onFinished?.();
        return;
      }
    }
    if (normKey) {
      recentSpokenNormalized.push(normKey);
      if (recentSpokenNormalized.length > 8) recentSpokenNormalized.shift();
    }

    if (restartAfterSpeechTimer) {
      clearTimeout(restartAfterSpeechTimer);
      restartAfterSpeechTimer = null;
    }

    if (!opts.queueIfSpeaking) {
      queuedSpeeches.length = 0;
    }

    const speechChunks = splitTextForFluentSpeech(spoken);
    if (speechChunks.length === 0) {
      opts.onFinished?.();
      return;
    }

    // Desliga completamente o reconhecimento de voz durante o TTS e limpa áudio antigo
    pauseRecognitionForTtsFn?.();
    clearActiveVoiceBufferFn?.();
    const mySpeechSeq = ++currentSpeechSeq;
    const isAckSpeech = Boolean(opts.isBargeInAck);
    saraEstaAFalar = true;
    bargeInAckActive = isAckSpeech;
    bargeInAckNormalized = isAckSpeech ? normalizeForRepeatCheck(spoken) : '';
    currentUtteranceNormalized = normalizeForRepeatCheck(spoken);
    recordSpokenEcho(spoken);
    speakingStateListener?.(false);

    window.speechSynthesis.cancel();

    const period = getTimePeriod();
    const voice = pickBestFemalePortugueseVoice();
    let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
    let activeChunkTimer: ReturnType<typeof setTimeout> | null = null;
    let finishedAll = false;

    const finalizeAllSpeech = () => {
      if (finishedAll) return;
      finishedAll = true;
      if (activeChunkTimer) clearTimeout(activeChunkTimer);
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      clearActiveVoiceBufferFn?.();
      opts.onFinished?.();

      if (mySpeechSeq !== currentSpeechSeq) return;

      speakingStateListener?.(false);
      bargeInAckActive = false;
      bargeInAckNormalized = '';
      lastSaraSpeechEndedAt = Date.now();

      const nextQueued = queuedSpeeches.shift();
      if (nextQueued && !saraSilenciada && !saraModoChamada) {
        saraEstaAFalar = false;
        speakAsSara(nextQueued.text, nextQueued.enabled, nextQueued.options);
        return;
      }

      saraEstaAFalar = false;
      currentUtteranceNormalized = '';
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }

      if (micShouldBeActive && resumeMicFn) {
        if (restartAfterSpeechTimer) clearTimeout(restartAfterSpeechTimer);
        restartAfterSpeechTimer = setTimeout(() => {
          restartAfterSpeechTimer = null;
          if (micShouldBeActive) {
            resumeMicFn?.();
          }
        }, POST_TTS_SILENCE_COOLDOWN_MS);
      }
    };

    keepAliveTimer = setInterval(() => {
      if (mySpeechSeq !== currentSpeechSeq || finishedAll) {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        return;
      }
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        // ignore
      }
    }, 1800);

    // Encadeia frases naturalmente sem nunca cortar explicações longas aos 16s
    const speakChunkAt = (chunkIdx: number) => {
      if (mySpeechSeq !== currentSpeechSeq || finishedAll) return;
      if (chunkIdx >= speechChunks.length) {
        finalizeAllSpeech();
        return;
      }

      const chunkText = speechChunks[chunkIdx];
      const hasExcitement = chunkText.includes('!');
      const hasQuestion = chunkText.includes('?');
      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.lang = 'pt-PT';
      utterance.rate =
        period === 'night'
          ? Math.max(0.85, customBaseRate - 0.03)
          : hasExcitement
          ? Math.min(1.38, customBaseRate + 0.03)
          : customBaseRate;
      utterance.pitch =
        (period === 'night' ? 1.0 : period === 'morning' ? 1.06 : 1.04) +
        (hasExcitement ? 0.04 : hasQuestion ? 0.03 : 0);
      utterance.volume = period === 'night' ? 0.88 : 1.0;

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      let chunkDone = false;
      const onChunkFinished = () => {
        if (chunkDone) return;
        chunkDone = true;
        if (activeChunkTimer) {
          clearTimeout(activeChunkTimer);
          activeChunkTimer = null;
        }
        if (mySpeechSeq !== currentSpeechSeq || finishedAll) {
          finalizeAllSpeech();
          return;
        }
        if (chunkIdx + 1 < speechChunks.length) {
          setTimeout(() => speakChunkAt(chunkIdx + 1), 15);
        } else {
          finalizeAllSpeech();
        }
      };

      utterance.onstart = () => {
        if (mySpeechSeq !== currentSpeechSeq || finishedAll) return;
        speakingStateListener?.(true);
      };
      utterance.onpause = () => {
        if (mySpeechSeq !== currentSpeechSeq) return;
        speakingStateListener?.(false);
      };
      utterance.onresume = () => {
        if (mySpeechSeq !== currentSpeechSeq || finishedAll) return;
        speakingStateListener?.(true);
      };
      utterance.onend = onChunkFinished;
      utterance.onerror = onChunkFinished;

      const chunkSafetyMs = Math.min(26000, Math.max(3500, chunkText.length * 105));
      activeChunkTimer = setTimeout(onChunkFinished, chunkSafetyMs);

      window.speechSynthesis.speak(utterance);
    };

    speakChunkAt(0);
  } catch {
    lastSaraSpeechEndedAt = Date.now();
    saraEstaAFalar = false;
    speakingStateListener?.(false);
    opts.onFinished?.();
    if (micShouldBeActive && resumeMicFn) {
      if (restartAfterSpeechTimer) clearTimeout(restartAfterSpeechTimer);
      restartAfterSpeechTimer = setTimeout(() => {
        restartAfterSpeechTimer = null;
        if (!saraEstaAFalar && micShouldBeActive) resumeMicFn?.();
      }, POST_TTS_SILENCE_COOLDOWN_MS);
    }
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
    ? `Construí ${filesCount} ficheiros modulares no ${projectName}.`
    : `Atualizei ${filesCount} módulos do sistema no preview.`;
  if (strategicImprovements && strategicImprovements.length >= 2) {
    return `${base} Como próximos passos sugiro ${strategicImprovements[0]} ou ${strategicImprovements[1]}.`;
  }
  if (strategicImprovements && strategicImprovements.length === 1) {
    return `${base} Próxima melhoria recomendada: ${strategicImprovements[0]}.`;
  }
  return `${base} Podes testar tudo ao vivo ou pedir o próximo ajuste por voz.`;
}

// ================================
// LEITOR CONTÍNUO DE TEXTOS/PDFs/NOTÍCIAS COM PAUSA & RETOMADA EXATA
// ================================
export interface VoiceReadingStatus {
  active: boolean;
  paused: boolean;
  title: string;
  currentIndex: number;
  totalChunks: number;
  currentSentence: string;
}

let readingChunks: string[] = [];
let readingCursor = 0;
let readingTitle = '';
let readingActive = false;
let readingPaused = false;
let readingSeq = 0;
const readingListeners = new Set<(status: VoiceReadingStatus) => void>();

export function getVoiceReadingStatus(): VoiceReadingStatus {
  return {
    active: readingActive,
    paused: readingPaused,
    title: readingTitle,
    currentIndex: readingCursor,
    totalChunks: readingChunks.length,
    currentSentence: readingChunks[readingCursor] || '',
  };
}

function emitReadingStatus(): void {
  const snap = getVoiceReadingStatus();
  readingListeners.forEach((cb) => {
    try {
      cb(snap);
    } catch {
      // ignore
    }
  });
}

export function subscribeVoiceReadingStatus(cb: (status: VoiceReadingStatus) => void): () => void {
  readingListeners.add(cb);
  cb(getVoiceReadingStatus());
  return () => {
    readingListeners.delete(cb);
  };
}

function splitTextForVoiceReading(raw: string): string[] {
  const cleaned = String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[*_`#|>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  const rawSentences = cleaned.split(/(?<=[.!?])\s+|\n+/);
  const chunks: string[] = [];
  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length <= 210) {
      chunks.push(trimmed);
    } else {
      const subParts = trimmed.split(/(?<=[,;:])\s+/);
      let buf = '';
      for (const part of subParts) {
        if ((buf + ' ' + part).trim().length > 200 && buf) {
          chunks.push(buf.trim());
          buf = part;
        } else {
          buf = (buf ? buf + ' ' : '') + part;
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
    }
  }
  return chunks;
}

function speakNextReadingChunk(mySeq: number): void {
  if (!readingActive || readingPaused || mySeq !== readingSeq || saraSilenciada || saraModoChamada) return;
  clearActiveVoiceBufferFn?.();
  if (readingCursor >= readingChunks.length) {
    readingActive = false;
    readingPaused = false;
    readingCursor = 0;
    readingChunks = [];
    lastSaraSpeechEndedAt = Date.now();
    saraEstaAFalar = false;
    currentUtteranceNormalized = '';
    speakingStateListener?.(false);
    emitReadingStatus();
    if (micShouldBeActive && resumeMicFn) {
      setTimeout(() => {
        if (micShouldBeActive) resumeMicFn?.();
      }, POST_TTS_SILENCE_COOLDOWN_MS);
    }
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const chunk = readingChunks[readingCursor];
  emitReadingStatus();

  // Desliga reconhecimento de voz e limpa buffer durante a leitura
  pauseRecognitionForTtsFn?.();
  saraEstaAFalar = true;
  currentUtteranceNormalized = normalizeForRepeatCheck(chunk);
  recordSpokenEcho(chunk);
  const utter = new SpeechSynthesisUtterance(chunk);
  utter.lang = 'pt-PT';
  utter.rate = customBaseRate;
  utter.pitch = 1.03;
  const voice = pickBestFemalePortugueseVoice();
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  }

  let settled = false;
  const finishChunk = () => {
    if (settled) return;
    settled = true;
    clearTimeout(guardTimer);
    if (mySeq !== readingSeq || !readingActive || readingPaused) return;
    readingCursor += 1;
    speakNextReadingChunk(mySeq);
  };

  utter.onstart = () => {
    if (mySeq === readingSeq && !readingPaused) speakingStateListener?.(true);
  };
  utter.onend = finishChunk;
  utter.onerror = finishChunk;

  const guardTimer = setTimeout(finishChunk, Math.min(22000, Math.max(4000, chunk.length * 105)));
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    finishChunk();
  }
}

export function startVoiceReading(title: string, text: string): boolean {
  if (saraSilenciada || saraModoChamada) return false;
  const chunks = splitTextForVoiceReading(text);
  if (chunks.length === 0) return false;
  readingSeq += 1;
  currentSpeechSeq += 1;
  queuedSpeeches.length = 0;
  readingChunks = chunks;
  readingCursor = 0;
  readingTitle = (title || 'Leitura em Voz Alta').trim();
  readingActive = true;
  readingPaused = false;
  emitReadingStatus();
  speakNextReadingChunk(readingSeq);
  return true;
}

export function pauseVoiceReading(): boolean {
  if (!readingActive || readingPaused) return false;
  readingSeq += 1;
  readingPaused = true;
  clearActiveVoiceBufferFn?.();
  lastSaraSpeechEndedAt = Date.now();
  saraEstaAFalar = false;
  currentUtteranceNormalized = '';
  speakingStateListener?.(false);
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  emitReadingStatus();
  if (micShouldBeActive && resumeMicFn) {
    setTimeout(() => {
      if (!saraEstaAFalar && micShouldBeActive) resumeMicFn?.();
    }, POST_TTS_SILENCE_COOLDOWN_MS);
  }
  return true;
}

export function resumeVoiceReading(): boolean {
  if (!readingActive || !readingPaused || readingChunks.length === 0) return false;
  readingSeq += 1;
  readingPaused = false;
  emitReadingStatus();
  speakNextReadingChunk(readingSeq);
  return true;
}

export function stopVoiceReading(): void {
  if (!readingActive && readingChunks.length === 0) return;
  readingSeq += 1;
  readingActive = false;
  readingPaused = false;
  readingCursor = 0;
  readingChunks = [];
  readingTitle = '';
  clearActiveVoiceBufferFn?.();
  lastSaraSpeechEndedAt = Date.now();
  saraEstaAFalar = false;
  currentUtteranceNormalized = '';
  speakingStateListener?.(false);
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  emitReadingStatus();
  if (micShouldBeActive && resumeMicFn) {
    setTimeout(() => {
      if (!saraEstaAFalar && micShouldBeActive) resumeMicFn?.();
    }, POST_TTS_SILENCE_COOLDOWN_MS);
  }
}

export function speakPronunciation(text: string, lang: 'pt-PT' | 'en-US' | 'fr-FR' = 'en-US'): void {
  if (saraSilenciada || saraModoChamada) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;
  try {
    pauseRecognitionForTtsFn?.();
    clearActiveVoiceBufferFn?.();
    window.speechSynthesis.cancel();
    const trimmed = text.trim();
    const mySeq = ++currentSpeechSeq;
    saraEstaAFalar = true;
    currentUtteranceNormalized = normalizeForRepeatCheck(trimmed);
    recordSpokenEcho(trimmed);
    const utter = new SpeechSynthesisUtterance(trimmed);
    utter.lang = lang;
    utter.rate = 0.94;
    const voices = window.speechSynthesis.getVoices();
    const prefix = lang.slice(0, 2).toLowerCase();
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (match) utter.voice = match;
    const done = () => {
      if (mySeq !== currentSpeechSeq) return;
      clearActiveVoiceBufferFn?.();
      lastSaraSpeechEndedAt = Date.now();
      saraEstaAFalar = false;
      currentUtteranceNormalized = '';
      speakingStateListener?.(false);
      if (micShouldBeActive && resumeMicFn) {
        if (restartAfterSpeechTimer) clearTimeout(restartAfterSpeechTimer);
        restartAfterSpeechTimer = setTimeout(() => {
          restartAfterSpeechTimer = null;
          if (!saraEstaAFalar && micShouldBeActive) resumeMicFn?.();
        }, POST_TTS_SILENCE_COOLDOWN_MS);
      }
    };
    utter.onstart = () => {
      if (mySeq === currentSpeechSeq) speakingStateListener?.(true);
    };
    utter.onend = done;
    utter.onerror = done;
    window.speechSynthesis.speak(utter);
  } catch {
    clearActiveVoiceBufferFn?.();
    lastSaraSpeechEndedAt = Date.now();
    saraEstaAFalar = false;
    if (micShouldBeActive && resumeMicFn) {
      setTimeout(() => {
        if (!saraEstaAFalar && micShouldBeActive) resumeMicFn?.();
      }, POST_TTS_SILENCE_COOLDOWN_MS);
    }
  }
}

export function playCompletionChime(): void {
  if (saraSilenciada || saraModoChamada) return;
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
