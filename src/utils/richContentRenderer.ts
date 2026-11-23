import DOMPurify from 'dompurify';
import katex from 'katex';
import { marked } from 'marked';
import type { JarvisMathStep } from '../types/jarvis';

function safeSanitize(html: string): string {
  if (typeof window !== 'undefined' && typeof DOMPurify?.sanitize === 'function') {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mstyle', 'annotation'],
      ADD_ATTR: ['class', 'style', 'aria-hidden', 'encoding', 'xmlns'],
    });
  }
  return html;
}

export function normalizeMathExpression(raw: string): string {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/lim_\{([^}]+)->([^}]+)\}/g, '\\lim_{$1 \\to $2}')
    .replace(/\\lim_\{([^}]+)->([^}]+)\}/g, '\\lim_{$1 \\to $2}')
    .replace(/->/g, '\\to ')
    .replace(/<=/g, '\\le ')
    .replace(/>=/g, '\\ge ')
    .replace(/!=/g, '\\neq ')
    .replace(/∞/g, '\\infty ')
    .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/√([0-9A-Za-z]+)/g, '\\sqrt{$1}')
    .trim();
}

export function renderMathLatexToHtml(latex: string, displayMode = false): string {
  const normalized = normalizeMathExpression(latex);
  if (!normalized) return '';
  try {
    const rendered = katex.renderToString(normalized, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      output: 'htmlAndMathml',
    });
    return safeSanitize(rendered);
  } catch {
    return `<code>${safeSanitize(normalized)}</code>`;
  }
}

function autoDetectBareMath(text: string, stash: (latex: string, displayMode: boolean) => string): string {
  // Detect bare math expressions like lim_{x->0} ..., \frac{a}{b}, \sqrt{x}, etc. outside HTML tags
  return text
    .replace(/\\lim_\{[^}]+\}\s*[^\n,;]+/g, (m) => stash(m, false))
    .replace(/\blim_\{[^}]+\}\s*[^\n,;]+/g, (m) => stash(m, false))
    .replace(/\\(?:frac|dfrac|sqrt|int|sum|prod)\{[^}]+\}(?:\{[^}]+\})?/g, (m) => stash(m, false))
    .replace(/\b([A-Za-z]+)\^\{([^}]+)\}/g, (m) => stash(m, false));
}

export function renderRichMarkdownHtml(rawText: string): string {
  const input = String(rawText || '').trim();
  if (!input) return '';

  const mathTokens: Array<{ placeholder: string; html: string }> = [];
  const stashMath = (latex: string, displayMode: boolean) => {
    const idx = mathTokens.length;
    const placeholder = `@@SARAMATH${idx}@@`;
    mathTokens.push({
      placeholder,
      html: renderMathLatexToHtml(latex, displayMode),
    });
    return placeholder;
  };

  let working = input
    // Block math: $$...$$ and \[...\]
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => stashMath(expr, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => stashMath(expr, true))
    // Inline math: $...$ and \(...\)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => stashMath(expr, false))
    .replace(/(^|[^\\])\$([^\n$]+?)\$/g, (_, prefix, expr) => `${prefix}${stashMath(expr, false)}`);

  working = autoDetectBareMath(working, stashMath);

  // If unbalanced stray ** or # remain after partial streaming, clean gracefully before marked
  const rawHtml = String(
    marked.parse(working, {
      breaks: true,
      gfm: true,
    })
  );

  let restored = rawHtml;
  for (const item of mathTokens) {
    restored = restored.split(item.placeholder).join(item.html);
  }

  return safeSanitize(restored);
}

export function stripRawMarkdownArtifacts(text: string): string {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\$\$?([^$]+)\$\$?/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface NormalizedMathStep {
  step: string;
  explanation: string;
  expression: string;
  partialResult: string;
}

export function ensureRichMathSteps(params: {
  title?: string;
  problem?: string;
  formulas?: string[];
  steps?: JarvisMathStep[];
  finalAnswer?: string;
}): NormalizedMathStep[] {
  const { title = '', problem = '', formulas = [], steps = [], finalAnswer = '' } = params;
  const cleanFormulas = formulas.map((f) => String(f || '').trim()).filter(Boolean);

  if (Array.isArray(steps) && steps.length > 0) {
    return steps.map((s, idx) => {
      const stepLabel = String(s?.step || '').trim() || `Passo ${idx + 1}`;
      const explanation =
        String(s?.explanation || '').trim() ||
        (idx === 0
          ? 'Identificamos os dados conhecidos e a relação matemática principal.'
          : 'Desenvolvemos a simplificação passo a passo mantendo o rigor algébrico.');
      const expression =
        String(s?.expression || '').trim() ||
        cleanFormulas[idx] ||
        cleanFormulas[0] ||
        problem ||
        finalAnswer ||
        'Aplicação direta da fórmula';
      const partialResult =
        String(s?.partialResult || '').trim() ||
        (idx === steps.length - 1 && finalAnswer ? finalAnswer : expression);
      return {
        step: stepLabel,
        explanation,
        expression,
        partialResult,
      };
    });
  }

  const mainFormula = cleanFormulas[0] || problem || title || 'f(x)';
  const solved = String(finalAnswer || '').trim() || mainFormula;
  return [
    {
      step: 'Passo 1 — Identificação da Expressão',
      explanation: `Analisamos o enunciado (${problem || title || 'expressão dada'}) e isolamos as variáveis principais.`,
      expression: problem || mainFormula,
      partialResult: mainFormula,
    },
    {
      step: 'Passo 2 — Desenvolvimento e Aplicação',
      explanation: 'Aplicamos a propriedade ou fórmula correspondente sobre os termos conhecidos.',
      expression: mainFormula,
      partialResult: cleanFormulas[1] || solved,
    },
    {
      step: 'Passo 3 — Simplificação Final',
      explanation: 'Concluímos a operação apresentando o valor exato simplificado.',
      expression: solved,
      partialResult: solved,
    },
  ];
}
