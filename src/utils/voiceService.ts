import type { ProjectType } from '../types/builder';

export type VoiceLevel = 'short' | 'medium' | 'full';

export type VoiceCommandAction =
  | { type: 'background_smalltalk'; reply: string; raw: string }
  | { type: 'silence_sara'; raw: string }
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
  | { type: 'prompt'; text: string };

export interface VoiceParseContext {
  activeTab?: 'files' | 'editor' | 'console';
  previewDevice?: 'desktop' | 'tablet' | 'mobile';
  isEditorFullscreen?: boolean;
  isPreviewFullscreen?: boolean;
  hasOpenOverlay?: boolean;
  hasPendingConfirm?: boolean;
  projectFiles?: string[];
  availableProjects?: string[];
  isMissionActive?: boolean;
  isMissionPaused?: boolean;
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

  let coreIdea = 'uma arquitetura modular organizada por pastas';
  let suggestion = 'posso incluir um layout responsivo mobile-first e animações suaves para dar fluidez';

  if (/(loja|e-?commerce|mercado|venda|produtos|roupa|padaria|restaurante)/i.test(lower)) {
    coreIdea = 'uma loja completa separada em catálogo, carrinho, checkout e serviços';
    suggestion = 'sugiro adicionarmos filtros rápidos por categoria, carrinho persistente e resumo de encomenda por WhatsApp';
  } else if (/(escola|aluno|turma|professor|nota|academi)/i.test(lower)) {
    coreIdea = 'um sistema escolar estruturado por alunos, notas, presenças e relatórios';
    suggestion = 'vale muito a pena colocar gráficos de desempenho com ApexCharts e fichas pesquisáveis em tempo real';
  } else if (/(jogo|game|arcade|corrida|tiro|puzzle|carro|nave)/i.test(lower)) {
    coreIdea = 'um jogo modular com engine de física, áudio Web Audio, cenas e sistema de recordes';
    suggestion = 'posso colocar efeitos sonoros sintetizados, partículas no impacto e ranking local de pontuação máxima';
  } else if (/(dashboard|painel|financeir|analytics|grafico|kpi|relatorio)/i.test(lower)) {
    coreIdea = 'um painel analítico profissional com módulos de dados, KPIs e gráficos interativos';
    suggestion = 'recomendo gráficos interativos em ApexCharts ou ECharts com alternância de tema e exportação rápida';
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
    return pickNonRepeating([
      `Aceitei o desafio, Eletro-Jr! Vou montar ${coreIdea}, e ${suggestion}. Assumo tudo sozinha agora e testo no preview.`,
      `Excelente ideia, Eletro-Jr! Estou a estruturar ${coreIdea}, onde ${suggestion}. Fica tranquilo que construo e valido tudo etapa por etapa.`,
      `Com certeza, Eletro-Jr! Para esse projeto vamos usar ${coreIdea}, e ${suggestion}. Já entro em ação no modo automático.`,
    ]);
  }

  return pickNonRepeating([
    `Curti muito essa proposta, Eletro-Jr! Pensei em ${coreIdea}, e ${suggestion}. Concordas em avançarmos com a primeira etapa ou queres ajustar algo antes?`,
    `Excelente pedido, Eletro-Jr! A minha sugestão é estruturar ${coreIdea}, além disso ${suggestion}. Posso começar pela Etapa 1 ou preferes mudar algum detalhe?`,
    `Vamos construir isto juntos, Eletro-Jr! Proponho ${coreIdea}, e ${suggestion}. Aprovas o plano para eu codar a primeira parte?`,
  ]);
}

export function getContinuationSpeech(
  projectName: string,
  agentMode: 'manual' | 'automatic' = 'automatic'
): string {
  if (agentMode === 'manual') {
    return pickNonRepeating([
      `Já analisei os ficheiros atuais de ${projectName}, Eletro-Jr, mantendo tudo o que já funciona. Posso aplicar esta evolução por etapas contigo agora ou queres ajustar algum ponto primeiro?`,
      `Estou por dentro da estrutura de ${projectName}, Eletro-Jr! Vou integrar esta melhoria sem estragar o código existente. Aprovas avançar já com a alteração?`,
    ]);
  }
  return pickNonRepeating([
    `Já li os ficheiros atuais de ${projectName}, Eletro-Jr, e vou integrar isto mantendo toda a base intacta e responsiva. Começo já a atualizar e testar no preview!`,
    `Entendido, Eletro-Jr! Analisei a estrutura de ${projectName} para encaixar esta novidade de forma limpa. Vou aplicar as mudanças e validar tudo agora.`,
    `Mãos à obra em ${projectName}, Eletro-Jr! Vou preservar o que já está bom, reforçar a experiência visual e testar o resultado no console.`,
  ]);
}

export function getManualStepApprovalSpeech(stepTitle: string): string {
  return pickNonRepeating([
    `Combinado, Eletro-Jr! A construir agora a etapa ${stepTitle} no editor e preview.`,
    `Excelente, vamos a isso! Estou a implementar ${stepTitle} passo a passo.`,
    `Aprovado, Eletro-Jr! Já estou a gerar o código completo de ${stepTitle}.`,
  ]);
}

export function getPlatformCommandSpeech(action: string, detail?: string): string {
  switch (action) {
    case 'open_editor':
      return pickNonRepeating(['A abrir o editor de código, Eletro-Jr.', 'Editor aberto para ti, Eletro-Jr.']);
    case 'open_editor_fullscreen':
      return pickNonRepeating(['A expandir o editor em tela cheia, Eletro-Jr.', 'Editor em ecrã inteiro ativo.']);
    case 'open_files':
      return pickNonRepeating(['A mostrar a árvore de ficheiros do projeto.', 'Pasta de ficheiros aberta, Eletro-Jr.']);
    case 'open_console':
      return pickNonRepeating(['A abrir o console de execução agora.', 'Console aberto, Eletro-Jr.']);
    case 'show_preview':
      return pickNonRepeating(['A focar o preview ao vivo, Eletro-Jr.', 'Aqui está o preview atualizado.']);
    case 'open_preview_fullscreen':
      return pickNonRepeating(['Preview em tela cheia ativo, Eletro-Jr.', 'A expandir o preview para ecrã inteiro.']);
    case 'close_editor_or_back':
      return pickNonRepeating(['De volta ao painel principal, Eletro-Jr.', 'Fechei e voltei para a vista principal.']);
    case 'preview_mobile':
      return pickNonRepeating(['A mudar o preview para telemóvel, Eletro-Jr.', 'Modo telemóvel ativo no preview.']);
    case 'preview_tablet':
      return pickNonRepeating(['A alternar para a vista de tablet.', 'Preview em tablet ativo, Eletro-Jr.']);
    case 'preview_desktop':
      return pickNonRepeating(['A voltar para a vista de computador.', 'Preview em computador ativo, Eletro-Jr.']);
    case 'save_project':
      return pickNonRepeating(['A guardar o projeto no Firebase, Eletro-Jr.', 'Projeto guardado com segurança.']);
    case 'open_projects':
      return pickNonRepeating(['A abrir a tua lista de projetos, Eletro-Jr.', 'Aqui estão os teus projetos.']);
    case 'open_settings':
      return pickNonRepeating(['A abrir as definições da plataforma.', 'Configurações abertas, Eletro-Jr.']);
    case 'open_deploy':
      return pickNonRepeating(['A abrir o painel de publicação e deploy.', 'Painel de deploy pronto, Eletro-Jr.']);
    case 'refresh_preview':
      return pickNonRepeating(['A recarregar o preview agora, Eletro-Jr.', 'Preview atualizado.']);
    default:
      return detail || 'Feito, Eletro-Jr.';
  }
}

export function getModeSwitchSpeech(mode: 'manual' | 'automatic'): string {
  if (mode === 'manual') {
    return pickNonRepeating([
      'Modo manual ligado, Eletro-Jr! Vamos decidir juntos e aprovo contigo antes de construir cada etapa.',
      'Combinado, passei para o modo manual. Eu sugiro a arquitetura, pergunto-te primeiro e avançamos passo a passo.',
      'Modo colaborativo ativo, Eletro-Jr! Diz-me o que queres construir que eu planeio e confirmo contigo.',
    ]);
  }
  return pickNonRepeating([
    'Modo automático ligado, Eletro-Jr! Falo contigo logo no início com sugestões, depois construo, testo e corrijo tudo sozinha.',
    'Ativei o modo automático! Podes mandar o objetivo que eu alinho as ideias contigo e executo tudo de ponta a ponta.',
    'Modo autónomo pronto, Eletro-Jr. Manda a missão que eu assumo daqui até ao teste final.',
  ]);
}

/**
 * Corrige erros fonéticos frequentes do reconhecimento de voz pt-PT dentro do contexto técnico da plataforma.
 */
export function normalizePhoneticVoiceTranscript(transcript: string): string {
  let out = transcript.trim();
  if (!out) return out;

  // Confusão comum do nome "Sara" no início da frase (ex: "sala abre o editor", "zara modo manual")
  out = out.replace(
    /^(sala|saia|cara|zara|lara)(?=[\s,]+(abre|abrir|fecha|fechar|apaga|apagar|elimina|remove|cria|criar|faz|fazer|modo|desfaz|mostra|vai|para|continua|limpa|baixa|salva|guarda|atualiza|recarrega|cala|pausa|retoma|tudo|esta|oi|ola|duplica|renomeia|quero|podes|pode|muda|poe))/i,
    'Sara'
  );

  // Confusões técnicas recorrentes em STT português
  const replacements: Array<[RegExp, string]> = [
    [/\b(priviu|perviu|pr[eé]vio|pre viu)\b/gi, 'preview'],
    [/\b(consola|consolo|conselho)\b/gi, 'console'],
    [/\b(heitor|aditor|edito|edictor)\b/gi, 'editor'],
    [/\b(feicheiros|fixeiros)\b/gi, 'ficheiros'],
    [/\b(proj[eé]to|progeto)\b/gi, 'projeto'],
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
  ];

  for (const [pattern, target] of replacements) {
    out = out.replace(pattern, target);
  }

  return out.replace(/\s+/g, ' ').trim();
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

  // Já contém autorização explícita na mesma frase
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

export function parseVoiceCommand(
  transcript: string,
  context?: VoiceParseContext
): VoiceCommandAction {
  const repaired = normalizePhoneticVoiceTranscript(transcript);
  const clean = repaired.trim();
  const lower = clean
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();

  // Confirmação / cancelamento imediato quando há uma pergunta de segurança pendente
  if (context?.hasPendingConfirm) {
    const cleanWords = lower.replace(/[,.;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (
      /^(sara\s+)?(sim|confirmo|confirmar|autorizo|ok|claro|avanca|manda\s+ver|executa|faz\s+isso|pode\s+(fazer|ir|enviar|apagar|limpar))(\s+(sim|confirmo|autorizo|pode\s+(fazer|ir|enviar|apagar|limpar)|sara))*$/i.test(
        cleanWords
      )
    ) {
      return { type: 'confirm_pending', raw: clean };
    }
    if (
      /^(sara\s+)?(nao|cancela|cancelar|aborta|abortar|esquece|para|deixa\s+estar)(\s+(nao|cancela|cancelar|esquece|sara))*$/i.test(
        cleanWords
      )
    ) {
      return { type: 'cancel_pending', raw: clean };
    }
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

  // Microfone desligar / ligar
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
let activeRecognition: any = null;
let micShouldBeActive = false;
let resumeMicFn: (() => void) | null = null;
let restartAfterSpeechTimer: ReturnType<typeof setTimeout> | null = null;
let currentSpeechSeq = 0;

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
    const med = sentences.slice(0, 3).join(' ').slice(0, 360);
    return sentences.length > 3
      ? `${med} Deixei o detalhe completo no chat, Eletro-Júnior.`
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
 * Microfone contínuo resiliente com autorestart, proteção anti-eco durante fala da Sara e recuperação automática ao trocar de aba/ecrã.
 */
let audioConstraintsPrimed = false;

async function primeHardwareAudioConstraints(): Promise<void> {
  if (audioConstraintsPrimed) return;
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  audioConstraintsPrimed = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // Fallback silencioso: SpeechRecognition continua normalmente sem bloquear
  }
}

export function startContinuousVoiceRecognition(options: {
  shouldKeepListening: () => boolean;
  onResult: (transcript: string) => void;
  onError: (err: string, fatal?: boolean) => void;
  onEnd: () => void;
}): () => void {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) {
    options.onError('Reconhecimento de voz não suportado neste navegador.', true);
    options.onEnd();
    return () => {};
  }

  void primeHardwareAudioConstraints();
  micShouldBeActive = true;
  let manuallyStopped = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveErrors = 0;

  const scheduleRestart = (delayMs = 110) => {
    if (manuallyStopped || !options.shouldKeepListening() || saraEstaAFalar) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      startSession();
    }, delayMs);
  };

  const startSession = () => {
    if (manuallyStopped || !options.shouldKeepListening()) {
      micShouldBeActive = false;
      options.onEnd();
      return;
    }

    // Trava: se a Sara ainda está a falar, aguarda fim da fala + 400ms
    if (saraEstaAFalar) {
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
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      consecutiveErrors = 0;
      broadcastVoiceBusEvent({ type: 'mic_status', listening: true });
    };

    recognition.onresult = (event: any) => {
      // TRAVA ABSOLUTA: ignora qualquer captura enquanto a Sara estiver a falar
      if (saraEstaAFalar) return;

      consecutiveErrors = 0;
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
        if (activeRecognition === recognition) {
          activeRecognition = null;
        }
        broadcastVoiceBusEvent({ type: 'mic_status', listening: false });
        options.onError('Permissão de microfone recusada no navegador.', true);
        options.onEnd();
        return;
      }

      // Erros transitórios (audio-capture, network, no-speech, aborted) NUNCA desligam a escuta contínua!
      if (errCode !== 'no-speech' && errCode !== 'aborted') {
        consecutiveErrors += 1;
        options.onError(`Microfone: ${errCode} (a recuperar em 2.º plano)`, false);
      }
      if (activeRecognition === recognition) {
        activeRecognition = null;
      }
      if (!saraEstaAFalar && !manuallyStopped && options.shouldKeepListening()) {
        const backoff = Math.min(1400, 180 + consecutiveErrors * 180);
        scheduleRestart(backoff);
      }
    };

    recognition.onend = () => {
      if (activeRecognition === recognition) {
        activeRecognition = null;
      }
      if (saraEstaAFalar) {
        return;
      }
      if (!manuallyStopped && options.shouldKeepListening()) {
        const delay = consecutiveErrors > 0 ? Math.min(1200, 200 + consecutiveErrors * 180) : 100;
        scheduleRestart(delay);
      } else {
        micShouldBeActive = false;
        broadcastVoiceBusEvent({ type: 'mic_status', listening: false });
        options.onEnd();
      }
    };

    try {
      recognition.start();
    } catch {
      if (activeRecognition === recognition) {
        activeRecognition = null;
      }
      if (!manuallyStopped && options.shouldKeepListening() && !saraEstaAFalar) {
        scheduleRestart(500);
      }
    }
  };

  resumeMicFn = () => {
    if (!activeRecognition && !saraEstaAFalar && !manuallyStopped && options.shouldKeepListening()) {
      startSession();
    }
  };

  // Watchdog contínuo: garante que o microfone nunca morre após trocar de aba/ecrã ou falha silenciosa do browser
  const watchdogId = setInterval(() => {
    if (
      !manuallyStopped &&
      micShouldBeActive &&
      options.shouldKeepListening() &&
      !saraEstaAFalar &&
      !activeRecognition &&
      !restartTimer
    ) {
      startSession();
    }
  }, 1500);

  const handleTabWake = () => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      !manuallyStopped &&
      micShouldBeActive &&
      options.shouldKeepListening() &&
      !saraEstaAFalar &&
      !activeRecognition
    ) {
      scheduleRestart(80);
    }
  };

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', handleTabWake);
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('focus', handleTabWake);
  }

  startSession();

  return () => {
    manuallyStopped = true;
    micShouldBeActive = false;
    resumeMicFn = null;
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

export function stopSaraSpeech(): void {
  currentSpeechSeq += 1;
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
  if (micShouldBeActive && resumeMicFn) {
    restartAfterSpeechTimer = setTimeout(() => {
      restartAfterSpeechTimer = null;
      if (!saraEstaAFalar && micShouldBeActive) {
        resumeMicFn?.();
      }
    }, 350);
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

    // 1. Ativa trava ANTES de falar, incrementa sequência e pausa o microfone imediatamente
    const mySpeechSeq = ++currentSpeechSeq;
    saraEstaAFalar = true;
    speakingStateListener?.(true);
    if (activeRecognition) {
      const prevRec = activeRecognition;
      activeRecognition = null;
      try {
        prevRec.stop?.();
      } catch {
        // ignore
      }
    }

    window.speechSynthesis.cancel();

    const period = getTimePeriod();
    const hasExcitement = spoken.includes('!');
    const hasQuestion = spoken.includes('?');
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = 'pt-PT';
    // Voz feminina natural com entoação emocional viva conforme o contexto da frase e período
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

    const voice = pickBestFemalePortugueseVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    let finished = false;
    let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
    const finishSpeech = () => {
      if (finished) return;
      finished = true;
      clearTimeout(safetyTimer);
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      opts.onFinished?.();

      // Ignora reset se uma fala mais recente já assumiu o controlo
      if (mySpeechSeq !== currentSpeechSeq) return;

      saraEstaAFalar = false;
      speakingStateListener?.(false);

      // Espera 400ms após terminar de falar e volta a ligar o microfone se estiver ativo
      if (micShouldBeActive && resumeMicFn) {
        if (restartAfterSpeechTimer) clearTimeout(restartAfterSpeechTimer);
        restartAfterSpeechTimer = setTimeout(() => {
          restartAfterSpeechTimer = null;
          if (!saraEstaAFalar && micShouldBeActive) {
            resumeMicFn?.();
          }
        }, 400);
      }
    };

    // Contorna bug do Chromium onde speechSynthesis pausa silenciosamente
    keepAliveTimer = setInterval(() => {
      if (mySpeechSeq !== currentSpeechSeq || finished) {
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
    }, 2200);

    // Garantia de segurança caso o navegador bloqueie eventos onend de TTS
    const safetyMs = Math.min(16000, Math.max(2200, spoken.length * 80));
    const safetyTimer = setTimeout(finishSpeech, safetyMs);

    utterance.onend = finishSpeech;
    utterance.onerror = finishSpeech;

    window.speechSynthesis.speak(utterance);
  } catch {
    saraEstaAFalar = false;
    speakingStateListener?.(false);
    opts.onFinished?.();
    if (micShouldBeActive && resumeMicFn) {
      setTimeout(() => {
        if (!saraEstaAFalar && micShouldBeActive) resumeMicFn?.();
      }, 400);
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
