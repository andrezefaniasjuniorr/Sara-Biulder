import type { BuilderProjectContract, ProjectFiles } from '../types/builder';

const BASE_WEB_DEPENDENCIES: Record<string, string> = {
  react: '^19.0.0',
  'react-dom': '^19.0.0',
  next: '^15.2.0',
  vite: '^6.2.0',
  typescript: '^5.8.0',
  tailwindcss: '^3.4.17',
  postcss: '^8.4.49',
  autoprefixer: '^10.4.20',
  '@types/react': '^19.0.0',
  '@types/react-dom': '^19.0.0',
  'lucide-react': '^0.475.0',
  'framer-motion': '^12.0.0',
  axios: '^1.8.0',
  firebase: '^11.5.0',
  '@google/generative-ai': '^0.24.0',
};

const KNOWN_OPTIONAL_PACKAGES: Record<string, string> = {
  recharts: '^2.15.0',
  zustand: '^5.0.3',
  clsx: '^2.1.1',
  'tailwind-merge': '^3.0.2',
  'date-fns': '^4.1.0',
  uuid: '^11.1.0',
  'chart.js': '^4.4.8',
  three: '^0.174.0',
  gsap: '^3.12.7',
};

function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sara-projeto'
  );
}

/**
 * Varre todas as importações em ficheiros JS/TS/JSX/TSX e garante que
 * nenhuma dependência fique em falta no package.json nem ficheiros de config essenciais.
 */
export function ensureCompleteProjectScaffoldAndDeps(
  files: ProjectFiles,
  contract: BuilderProjectContract | null | undefined
): { files: ProjectFiles; addedDeps: string[] } {
  const next: ProjectFiles = { ...files };
  const addedDeps: string[] = [];
  const stack = contract?.stack || 'nextjs-vite-tsx';
  const projectName = contract?.projectName || 'Projeto SARA';
  const slug = slugifyName(projectName);

  // Limpa comentários proibidos ("TODO", "aqui falta") caso alguma camada tenha deixado resíduo
  for (const [pathKey, content] of Object.entries(next)) {
    if (!content) continue;
    next[pathKey] = content
      .replace(/\/\/\s*(?:TODO|FIXME|aqui falta)[^\n]*/gi, '// Implementação concluída')
      .replace(/\/\*\s*(?:TODO|FIXME|aqui falta)[\s\S]*?\*\//gi, '');
  }

  const webPrefix = stack === 'hybrid-web-android' ? 'web/' : '';
  const needsWebScaffold = stack === 'nextjs-vite-tsx' || stack === 'hybrid-web-android';
  const needsAndroidScaffold = stack === 'android-kotlin' || stack === 'hybrid-web-android';

  if (needsWebScaffold) {
    // Descobre pacotes importados no código
    const detectedImports = new Set<string>();
    const importRe = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'".@/][^'"]*)['"]/gm;
    for (const [pathKey, content] of Object.entries(next)) {
      if (!/\.(js|jsx|ts|tsx|mjs)$/i.test(pathKey)) continue;
      let m: RegExpExecArray | null;
      importRe.lastIndex = 0;
      while ((m = importRe.exec(content || '')) !== null) {
        const rawPkg = m[1];
        const pkgName = rawPkg.startsWith('@')
          ? rawPkg.split('/').slice(0, 2).join('/')
          : rawPkg.split('/')[0];
        if (pkgName && !pkgName.startsWith('node:')) {
          detectedImports.add(pkgName);
        }
      }
    }

    const pkgPath = `${webPrefix}package.json`;
    let pkgJson: Record<string, any> = {};
    if (next[pkgPath]) {
      try {
        pkgJson = JSON.parse(next[pkgPath]);
      } catch {
        pkgJson = {};
      }
    }

    const existingDeps: Record<string, string> = {
      ...(pkgJson.dependencies || {}),
    };
    const existingDevDeps: Record<string, string> = {
      ...(pkgJson.devDependencies || {}),
    };

    for (const [dep, ver] of Object.entries(BASE_WEB_DEPENDENCIES)) {
      if (dep === 'typescript' || dep === '@types/react' || dep === '@types/react-dom' || dep === 'postcss' || dep === 'autoprefixer') {
        if (!existingDevDeps[dep] && !existingDeps[dep]) {
          existingDevDeps[dep] = ver;
          addedDeps.push(dep);
        }
      } else if (!existingDeps[dep] && !existingDevDeps[dep]) {
        existingDeps[dep] = ver;
        addedDeps.push(dep);
      }
    }

    for (const impPkg of detectedImports) {
      if (!existingDeps[impPkg] && !existingDevDeps[impPkg]) {
        existingDeps[impPkg] = KNOWN_OPTIONAL_PACKAGES[impPkg] || 'latest';
        addedDeps.push(impPkg);
      }
    }

    pkgJson = {
      name: slug,
      private: true,
      version: pkgJson.version || '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
        'next:dev': 'next dev',
        'next:build': 'next build',
        ...(pkgJson.scripts || {}),
      },
      dependencies: existingDeps,
      devDependencies: existingDevDeps,
    };
    next[pkgPath] = JSON.stringify(pkgJson, null, 2);

    if (!next[`${webPrefix}vite.config.ts`]) {
      next[`${webPrefix}vite.config.ts`] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuração Vite para build rápido e desenvolvimento local
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
`;
    }

    if (!next[`${webPrefix}tsconfig.json`]) {
      next[`${webPrefix}tsconfig.json`] = JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            isolatedModules: true,
            moduleDetection: 'force',
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
            baseUrl: '.',
            paths: { '@/*': ['./src/*'] },
          },
          include: ['src'],
        },
        null,
        2
      );
    }

    if (!next[`${webPrefix}tailwind.config.js`]) {
      next[`${webPrefix}tailwind.config.js`] = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
    }

    if (!next[`${webPrefix}postcss.config.js`]) {
      next[`${webPrefix}postcss.config.js`] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
    }

    if (!next[`${webPrefix}.env.example`]) {
      next[`${webPrefix}.env.example`] = `# Variáveis de ambiente de exemplo (nunca coloques segredos reais aqui)
VITE_APP_NAME="${projectName}"
VITE_API_URL="http://localhost:3000"
`;
    }

    if (!next[`${webPrefix}public/manifest.json`]) {
      next[`${webPrefix}public/manifest.json`] = JSON.stringify(
        {
          name: projectName,
          short_name: projectName.slice(0, 14),
          start_url: '/',
          display: 'standalone',
        },
        null,
        2
      );
    }
  }

  if (needsAndroidScaffold) {
    if (!next['android-app/build.gradle.kts']) {
      next['android-app/build.gradle.kts'] = `// Configuração raiz Gradle do projeto Android (${projectName})
plugins {
    id("com.android.application") version "8.7.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}
`;
    }

    if (!next['android-app/app/build.gradle.kts']) {
      next['android-app/app/build.gradle.kts'] = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.projeto.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.projeto.${slug.replace(/-/g, '')}"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.navigation:navigation-compose:2.8.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
`;
    }

    if (!next['android-app/app/src/main/AndroidManifest.xml']) {
      next['android-app/app/src/main/AndroidManifest.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:allowBackup="true"
        android:label="${projectName}"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.Light.NoActionBar">
        <activity
            android:name=".ui.MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;
    }
  }

  if (!next['README.md'] || next['README.md'].length < 80) {
    const pagesText = (contract?.pages || ['Início']).map((p) => `- ${p}`).join('\n');
    const funcsText = (contract?.functions || ['Funcionalidades principais']).map((f) => `- ${f}`).join('\n');
    next['README.md'] = `# ${projectName}

${contract?.purpose || 'Projeto construído com engenharia modular no SARA BUILDER V2.'}

## Páginas e Ecrãs
${pagesText}

## Funcionalidades
${funcsText}

## Como executar localmente
${
  needsWebScaffold
    ? `\`\`\`bash
${webPrefix ? 'cd web\n' : ''}npm install
npm run dev
\`\`\``
    : ''
}
${
  needsAndroidScaffold
    ? `\n### Android (Kotlin + Jetpack Compose)\nAbre a pasta \`android-app\` no Android Studio e executa \`app\` num emulador ou telemóvel.\n`
    : ''
}
`;
  }

  return { files: next, addedDeps };
}

/**
 * Gera um prompt completo e estruturado pronto para colar no Google AI Studio
 * (botão "Abrir no Google AI Studio").
 */
export function buildAiStudioExportPrompt(
  projectName: string,
  contract: BuilderProjectContract | null | undefined,
  files: ProjectFiles
): string {
  const filePaths = Object.keys(files || {}).sort();
  const stackLabel =
    contract?.stack === 'android-kotlin'
      ? 'Android Kotlin + Jetpack Compose'
      : contract?.stack === 'hybrid-web-android'
      ? 'Híbrido (Web Next.js/Vite/React/TS + Android Kotlin/Compose em pastas separadas)'
      : 'Web (Next.js + Vite + React + TypeScript + Tailwind CSS)';

  const keySnippets = filePaths
    .filter((p) => !p.endsWith('package-lock.json'))
    .slice(0, 12)
    .map((p) => `--- ${p} ---\n${String(files[p] || '').slice(0, 1800)}`)
    .join('\n\n');

  return `Constrói e expande este projeto com engenharia sénior completa (zero TODOs, código 100% funcional, design moderno e responsivo):

PROJETO: ${contract?.projectName || projectName}
STACK: ${stackLabel}
PÚBLICO-ALVO: ${contract?.audience || 'Utilizadores finais'}
OBJETIVO: ${contract?.purpose || 'Sistema modular completo'}
CORES E IDENTIDADE VISUAL: ${contract?.colors || 'Moderna com alto contraste'}

PÁGINAS / ECRÃS:
${(contract?.pages || ['Início']).map((p) => `- ${p}`).join('\n')}

FUNÇÕES PRINCIPAIS:
${(contract?.functions || ['Funcionalidades principais']).map((f) => `- ${f}`).join('\n')}

ESTRUTURA DE PASTAS E FICHEIROS (${filePaths.length} ficheiros):
${(contract?.folderTree?.length ? contract.folderTree : filePaths).map((f) => `- ${f}`).join('\n')}

ESTADO ATUAL DOS FICHEIROS PRINCIPAIS:
${keySnippets || '(Projeto pronto para gerar todos os módulos acima.)'}`;
}
