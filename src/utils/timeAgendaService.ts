import type { JarvisAgendaItem } from '../types/jarvis';

export const MAPUTO_TIMEZONE = 'Africa/Maputo';

const PT_WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PT_WEEKDAYS_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
const PT_MONTHS_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];
const PT_MONTHS_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export interface MaputoClockParts {
  isoDate: string;
  timeHHmm: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekdayIndex: number;
  weekdayShort: string;
  weekdayFull: string;
  monthShort: string;
  monthFull: string;
  shortHeaderText: string;
  humanDate: string;
}

export function getMaputoNowParts(date: Date = new Date()): MaputoClockParts {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MAPUTO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const partsMap: Record<string, string> = {};
  for (const part of formatter.formatToParts(safeDate)) {
    if (part.type !== 'literal') {
      partsMap[part.type] = part.value;
    }
  }

  const year = Number(partsMap.year || 2026);
  const month = Number(partsMap.month || 1);
  const day = Number(partsMap.day || 1);
  const rawHour = Number(partsMap.hour || 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(partsMap.minute || 0);
  const second = Number(partsMap.second || 0);

  const isoDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeHHmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  const weekdayShort = PT_WEEKDAYS_SHORT[weekdayIndex] || 'Seg';
  const weekdayFull = PT_WEEKDAYS_FULL[weekdayIndex] || 'Segunda-feira';
  const monthShort = PT_MONTHS_SHORT[month - 1] || 'Jan';
  const monthFull = PT_MONTHS_FULL[month - 1] || 'Janeiro';

  const shortHeaderText = `Hoje: ${weekdayShort}, ${day} ${monthShort} ${year} - ${timeHHmm}`;
  const humanDate = `${weekdayFull}, ${day} de ${monthFull}`;

  return {
    isoDate,
    timeHHmm,
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekdayIndex,
    weekdayShort,
    weekdayFull,
    monthShort,
    monthFull,
    shortHeaderText,
    humanDate,
  };
}

export function getMaputoDayOffsetIso(offsetDays: number, now: Date = new Date()): string {
  const parts = getMaputoNowParts(now);
  const target = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offsetDays, 12, 0, 0));
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDateTuple(isoDate: string): { year: number; month: number; day: number } | null {
  const match = String(isoDate || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toMaputoDaySerial(isoDate: string): number | null {
  const t = parseIsoDateTuple(isoDate);
  if (!t) return null;
  return Math.floor(Date.UTC(t.year, t.month - 1, t.day, 12, 0, 0) / 86400000);
}

export function formatIsoDateToPtHuman(isoDate: string, now: Date = new Date()): string {
  const tuple = parseIsoDateTuple(isoDate);
  if (!tuple) return isoDate;
  const nowParts = getMaputoNowParts(now);
  const targetSerial = toMaputoDaySerial(isoDate);
  const todaySerial = toMaputoDaySerial(nowParts.isoDate);
  const weekdayIdx = new Date(Date.UTC(tuple.year, tuple.month - 1, tuple.day, 12, 0, 0)).getUTCDay();
  const weekday = PT_WEEKDAYS_FULL[weekdayIdx] || '';
  const month = PT_MONTHS_FULL[tuple.month - 1] || '';

  if (targetSerial !== null && todaySerial !== null) {
    const diffDays = targetSerial - todaySerial;
    if (diffDays === 0) return `Hoje, ${weekday}, ${tuple.day} de ${month}`;
    if (diffDays === 1) return `Amanhã, ${weekday}, ${tuple.day} de ${month}`;
    if (diffDays === -1) return `Ontem, ${weekday}, ${tuple.day} de ${month}`;
    if (diffDays === 2) return `Depois de amanhã, ${weekday}, ${tuple.day} de ${month}`;
  }
  return `${weekday}, ${tuple.day} de ${month} de ${tuple.year}`;
}

export function normalizeTextForSchedule(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function resolvePortugueseDate(
  input: string,
  now: Date = new Date()
): { dateIso: string; explicitDateFound: boolean } {
  const norm = normalizeTextForSchedule(input);
  const nowParts = getMaputoNowParts(now);

  // Explicit ISO date
  const isoMatch = norm.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Math.min(12, Math.max(1, Number(isoMatch[2])));
    const d = Math.min(31, Math.max(1, Number(isoMatch[3])));
    return {
      dateIso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      explicitDateFound: true,
    };
  }

  // DD/MM/YYYY or DD/MM or DD-MM
  const slashMatch = norm.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}|\d{2}))?\b/);
  if (slashMatch) {
    const d = Math.min(31, Math.max(1, Number(slashMatch[1])));
    const m = Math.min(12, Math.max(1, Number(slashMatch[2])));
    let y = nowParts.year;
    if (slashMatch[3]) {
      y = slashMatch[3].length === 2 ? 2000 + Number(slashMatch[3]) : Number(slashMatch[3]);
    }
    return {
      dateIso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      explicitDateFound: true,
    };
  }

  // "dia 25 de novembro" or "dia 25"
  const monthNamesMap: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };
  const namedMonthMatch = norm.match(
    /\b(?:dia\s+)?(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(20\d{2}))?\b/
  );
  if (namedMonthMatch) {
    const d = Math.min(31, Math.max(1, Number(namedMonthMatch[1])));
    const m = monthNamesMap[namedMonthMatch[2]] || nowParts.month;
    const y = namedMonthMatch[3] ? Number(namedMonthMatch[3]) : nowParts.year;
    return {
      dateIso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      explicitDateFound: true,
    };
  }

  if (/\bdepois\s+de\s+amanha\b/.test(norm)) {
    return { dateIso: getMaputoDayOffsetIso(2, now), explicitDateFound: true };
  }
  if (/\bamanha\b/.test(norm)) {
    return { dateIso: getMaputoDayOffsetIso(1, now), explicitDateFound: true };
  }
  if (/\bontem\b/.test(norm)) {
    return { dateIso: getMaputoDayOffsetIso(-1, now), explicitDateFound: true };
  }
  if (/\bhoje\b|\besta noite\b|\bagora\b/.test(norm)) {
    return { dateIso: nowParts.isoDate, explicitDateFound: true };
  }

  const weekdayTokens: Array<{ pattern: RegExp; day: number }> = [
    { pattern: /\bdomingo\b/, day: 0 },
    { pattern: /\bsegunda(?:-feira)?\b/, day: 1 },
    { pattern: /\bterca(?:-feira)?\b/, day: 2 },
    { pattern: /\bquarta(?:-feira)?\b/, day: 3 },
    { pattern: /\bquinta(?:-feira)?\b/, day: 4 },
    { pattern: /\bsexta(?:-feira)?\b/, day: 5 },
    { pattern: /\bsabado\b/, day: 6 },
  ];

  for (const w of weekdayTokens) {
    if (w.pattern.test(norm)) {
      let delta = (w.day - nowParts.weekdayIndex + 7) % 7;
      if (delta === 0) delta = 7;
      if (/\bproxima\s+semana\b|\bsemana\s+que\s+vem\b/.test(norm) && delta < 7) {
        delta += 7;
      }
      return { dateIso: getMaputoDayOffsetIso(delta, now), explicitDateFound: true };
    }
  }

  if (/\bproxima\s+semana\b|\bsemana\s+que\s+vem\b/.test(norm)) {
    return { dateIso: getMaputoDayOffsetIso(7, now), explicitDateFound: true };
  }

  const dayOnlyMatch = norm.match(/\bdia\s+(\d{1,2})\b/);
  if (dayOnlyMatch) {
    const targetDay = Math.min(31, Math.max(1, Number(dayOnlyMatch[1])));
    let y = nowParts.year;
    let m = nowParts.month;
    if (targetDay < nowParts.day) {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return {
      dateIso: `${y}-${String(m).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`,
      explicitDateFound: true,
    };
  }

  return { dateIso: nowParts.isoDate, explicitDateFound: false };
}

export function extractTimeHHmm(input: string): { timeHHmm: string; explicitTimeFound: boolean } {
  const norm = normalizeTextForSchedule(input);

  if (/\bmeio[- ]?dia\b/.test(norm)) {
    return { timeHHmm: '12:00', explicitTimeFound: true };
  }
  if (/\bmeia[- ]?noite\b/.test(norm)) {
    return { timeHHmm: '00:00', explicitTimeFound: true };
  }

  // "14h30", "14h", "às 14:30", "14 horas e 15"
  const hhmmMatch =
    norm.match(/\b(\d{1,2})\s*(?::|h|horas?\s*(?:e\s*)?)\s*(\d{2})?\b/) ||
    norm.match(/\b(?:as|para\s+as|para\s+o|pelas)\s+(\d{1,2})(?::(\d{2}))?\b/);

  if (hhmmMatch) {
    const rawH = Number(hhmmMatch[1]);
    const rawM = Number(hhmmMatch[2] || 0);
    if (rawH >= 0 && rawH <= 23 && rawM >= 0 && rawM <= 59) {
      let h = rawH;
      if (/\bda\s+tarde\b|\bda\s+noite\b/.test(norm) && h > 0 && h < 12) {
        h += 12;
      }
      return {
        timeHHmm: `${String(h).padStart(2, '0')}:${String(rawM).padStart(2, '0')}`,
        explicitTimeFound: true,
      };
    }
  }

  return { timeHHmm: '09:00', explicitTimeFound: false };
}

export function isQueryAgendaCommand(prompt: string): boolean {
  const norm = normalizeTextForSchedule(prompt);
  return (
    /(o\s+que\s+tenho\s+na\s+agenda|quais\s+(?:os\s+|sao\s+os\s+)?compromissos|mostra\s+(?:a\s+)?agenda|ver\s+(?:a\s+)?agenda|lista\s+(?:a\s+)?agenda|tenho\s+algo\s+marcado|agenda\s+de\s+(?:hoje|amanha))/.test(
      norm
    ) && !/\b(?:marca|marcar|adiciona|adicionar|coloca|colocar|poe|por|agendar|anota)\b/.test(norm)
  );
}

export interface ParsedAgendaCommand {
  title: string;
  dateIso: string;
  timeHHmm: string;
  notes: string;
  confirmationText: string;
}

export function parseAgendaCommand(prompt: string, now: Date = new Date()): ParsedAgendaCommand | null {
  const raw = String(prompt || '').trim();
  if (!raw || isQueryAgendaCommand(raw)) return null;

  const norm = normalizeTextForSchedule(raw);
  // Skip pure alarm commands unless agenda/event is mentioned
  if (/\b(?:despertador|alarme)\b/.test(norm) && !/\b(?:agenda|reuniao|compromisso|evento|marca)\b/.test(norm)) {
    return null;
  }

  const hasVerb =
    /\b(?:marca|marcar|agenda|agendar|agende|coloca|colocar|poe|põe|adiciona|adicionar|anota|anotar|regista|registar|lembra-me|lembrete)\b/.test(
      norm
    );
  const { dateIso, explicitDateFound } = resolvePortugueseDate(raw, now);
  const { timeHHmm, explicitTimeFound } = extractTimeHHmm(raw);

  const hasScheduleCue =
    hasVerb ||
    (/\b(?:tenho|compromisso|reuniao|consulta|prova|exame|entrega|aula)\b/.test(norm) &&
      (explicitDateFound || explicitTimeFound));

  if (!hasScheduleCue) return null;

  const B_START = '(?<![A-Za-zÀ-ÿ0-9_])';
  const B_END = '(?![A-Za-zÀ-ÿ0-9_])';
  let cleanedTitle = raw
    .replace(/^(?:ei|ol[aá]|sara|por favor|pfv)[,\s]+/gi, '')
    .replace(
      new RegExp(
        `${B_START}(?:sara|marca(?:-me)?|marcar|agenda(?:-me)?|agendar|agende|coloca(?:-me)?|colocar|p[oõ]e|adiciona(?:-me)?|adicionar|anota(?:-me)?|anotar|regista(?:-me)?|registar|lembra-me\\s+de|lembra-me|cria\\s+um\\s+lembrete(?:\\s+de|\\s+para)?|na\\s+agenda|na\\s+minha\\s+agenda|a\\s+agenda|um\\s+compromisso|uma\\s+reuni[aã]o\\s+para)${B_END}`,
        'gi'
      ),
      ' '
    )
    .replace(
      new RegExp(
        `${B_START}(?:depois\\s+de\\s+amanh[aã]|amanh[aã]|hoje|ontem|pr[oó]xima\\s+semana|semana\\s+que\\s+vem)${B_END}`,
        'gi'
      ),
      ' '
    )
    .replace(
      new RegExp(
        `${B_START}(?:no\\s+domingo|na\\s+segunda(?:-feira)?|na\\s+ter[cç]a(?:-feira)?|na\\s+quarta(?:-feira)?|na\\s+quinta(?:-feira)?|na\\s+sexta(?:-feira)?|no\\s+s[aá]bado|domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado)${B_END}`,
        'gi'
      ),
      ' '
    )
    .replace(
      new RegExp(
        `${B_START}(?:para\\s+o\\s+dia|para\\s+dia|no\\s+dia|dia)\\s+\\d{1,2}(?:\\s+de\\s+[a-zçãõáéíóú]+)?(?:\\s+de\\s+20\\d{2})?${B_END}`,
        'gi'
      ),
      ' '
    )
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')
    .replace(
      new RegExp(
        `${B_START}(?:[aà]s|pelas|para\\s+[aà]s|para)\\s+\\d{1,2}(?::\\d{2}|h\\d{0,2}|\\s*horas?(?:\\s+e\\s+\\d{1,2})?)?${B_END}`,
        'gi'
      ),
      ' '
    )
    .replace(/\b\d{1,2}\s*(?::|h|horas?)\s*\d{0,2}\b/gi, ' ')
    .replace(
      new RegExp(
        `${B_START}(?:da\\s+manh[aã]|da\\s+tarde|da\\s+noite|meio-dia|meia-noite|[aà]s|pelas)${B_END}`,
        'gi'
      ),
      ' '
    )
    .replace(/^[,\s\-.:;]+|[,\s\-.:;]+$/g, '')
    .replace(new RegExp(`${B_START}(?:para|uma|um|o|a|de|no|na|[aà]s)\\s*$`, 'i'), '')
    .replace(/^(?:para|um|uma|de)\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleanedTitle && /\breuni[aã]o\b/i.test(normalizeTextForSchedule(raw))) {
    cleanedTitle = 'Reunião';
  }
  if (!cleanedTitle) {
    cleanedTitle = 'Compromisso';
  } else {
    cleanedTitle = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);
  }

  const humanDate = formatIsoDateToPtHuman(dateIso, now);
  const confirmationText = `Marcado: ${cleanedTitle}, ${humanDate}, ${timeHHmm}`;

  return {
    title: cleanedTitle,
    dateIso,
    timeHHmm,
    notes: '',
    confirmationText,
  };
}

export function sortAgendaItems(items: JarvisAgendaItem[]): JarvisAgendaItem[] {
  return [...items].sort((a, b) => {
    const keyA = `${a.date || '9999-99-99'} ${a.time || '23:59'}`;
    const keyB = `${b.date || '9999-99-99'} ${b.time || '23:59'}`;
    return keyA.localeCompare(keyB);
  });
}

function getEventDiffMinutesMaputo(item: JarvisAgendaItem, nowParts: MaputoClockParts): number | null {
  const tuple = parseIsoDateTuple(item.date);
  if (!tuple) return null;
  const timeMatch = String(item.time || '09:00').match(/^(\d{1,2}):(\d{2})$/);
  const evH = timeMatch ? Number(timeMatch[1]) : 9;
  const evM = timeMatch ? Number(timeMatch[2]) : 0;

  const eventUtcMin = Math.floor(
    Date.UTC(tuple.year, tuple.month - 1, tuple.day, evH, evM, 0) / 60000
  );
  const nowUtcMin = Math.floor(
    Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, nowParts.hour, nowParts.minute, 0) / 60000
  );
  return eventUtcMin - nowUtcMin;
}

export function formatMinutesCountdown(diffMinutes: number): string {
  if (diffMinutes <= 0) return 'agora';
  const days = Math.floor(diffMinutes / 1440);
  const hours = Math.floor((diffMinutes % 1440) / 60);
  const mins = diffMinutes % 60;
  if (days > 0) return `em ${days}d ${hours}h`;
  if (hours > 0 && mins > 0) return `em ${hours}h ${mins}m`;
  if (hours > 0) return `em ${hours}h`;
  return `em ${mins} min`;
}

export interface UpcomingAgendaInfo {
  item: JarvisAgendaItem;
  diffMinutes: number;
  badgeText: string;
}

export function getUpcomingAgendaCountdown(
  agenda: JarvisAgendaItem[],
  now: Date = new Date()
): UpcomingAgendaInfo | null {
  const nowParts = getMaputoNowParts(now);
  const sorted = sortAgendaItems(agenda.filter((a) => !a.completed));
  for (const item of sorted) {
    const diffMinutes = getEventDiffMinutesMaputo(item, nowParts);
    if (diffMinutes === null || diffMinutes < -2) continue;
    const badgeText =
      diffMinutes <= 0
        ? `Agora: ${item.title}`
        : `Próximo: ${item.title} ${formatMinutesCountdown(diffMinutes)}`;
    return { item, diffMinutes, badgeText };
  }
  return null;
}

export interface TriggeredAgendaAlert {
  key: string;
  kind: 'pre15' | 'due';
  item: JarvisAgendaItem;
  minutesLeft: number;
  headline: string;
  speakText: string;
}

export function evaluateAgendaAlerts(
  agenda: JarvisAgendaItem[],
  notifiedKeys: Set<string>,
  now: Date = new Date()
): TriggeredAgendaAlert[] {
  const nowParts = getMaputoNowParts(now);
  const alerts: TriggeredAgendaAlert[] = [];

  for (const item of agenda) {
    if (item.completed) continue;
    const diffMinutes = getEventDiffMinutesMaputo(item, nowParts);
    if (diffMinutes === null) continue;

    if (diffMinutes <= 0 && diffMinutes >= -2) {
      const key = `${item.id}_${item.date}_${item.time}_due`;
      if (!notifiedKeys.has(key)) {
        alerts.push({
          key,
          kind: 'due',
          item,
          minutesLeft: 0,
          headline: `Compromisso agora (${item.time}): ${item.title}`,
          speakText: `Atenção: Está na hora de ${item.title}.`,
        });
      }
    } else if (diffMinutes > 0 && diffMinutes <= 15) {
      const key = `${item.id}_${item.date}_${item.time}_pre15`;
      if (!notifiedKeys.has(key)) {
        alerts.push({
          key,
          kind: 'pre15',
          item,
          minutesLeft: diffMinutes,
          headline: `Em ${diffMinutes} min (${item.time}): ${item.title}`,
          speakText: `Lembrete: Tens ${item.title} em ${diffMinutes} minutos.`,
        });
      }
    }
  }

  return alerts;
}

export function sanitizeInfraText(text: string): string {
  return String(text || '')
    .replace(/sara[\s_-]*biulder/gi, 'Estúdio SARA')
    .replace(/firebase\s+auth|firestore|firebase/gi, 'Núcleo SARA')
    .replace(/google\s+ai\s+studio|google\s+studio|google\s+cloud/gi, 'Núcleo SARA')
    .replace(/github\s+personal\s+access\s+token|github\s+token/gi, 'Chave do Cofre')
    .replace(/\bgithub\b/gi, 'Cofre de Projetos')
    .replace(/gemini[\s_-]*api[\s_-]*key|api[\s_-]*key/gi, 'Chave do Núcleo')
    .replace(/\bgemini(?:[-\s]*[\w.]*)?/gi, 'Motor Inteligente')
    .replace(/\blocalstorage\b/gi, 'Memória da SARA')
    .replace(/\bbuilder\b/gi, 'Estúdio SARA')
    .replace(/\btoken\b/gi, 'chave');
}

export function toSafeCoreOfflineMessage(rawError?: string): string {
  const txt = String(rawError || '').trim();
  if (!txt) return 'Núcleo offline. A tentar reconectar...';
  if (
    /(firebase|firestore|api|key|gemini|network|offline|fetch|timeout|401|403|500|502|503|504|unauthenticated|quota|server|cloud)/i.test(
      txt
    )
  ) {
    return 'Núcleo offline. A tentar reconectar...';
  }
  return sanitizeInfraText(txt);
}
