// Construye LADELOS Control de Vitrina.
//  dist/ladelos-control-vitrina.html  Fase 1 (datos en el equipo) para publicar como página.
//  dist/standalone.html               Fase 1 como documento completo.
//  dist/vitrina.html                  Fase 2 conectada a Supabase (va en ladelos-app/public/).
//  dist/edge/vitrina.ts               Edge Function de Supabase en un solo archivo.
//  dist/edge/clover-webhook.ts        Edge Function que recibe las órdenes de Clover.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SB_URL = 'https://pnxkfhhdadymkbfbjgki.supabase.co';
// Llave pública (anon). Es la misma que ladelos-app ya publica; la seguridad la dan RLS y la Edge Function.
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBueGtmaGhkYWR5bWtiZmJqZ2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NTcwNTIsImV4cCI6MjA5OTEzMzA1Mn0.U1kM4guRWaadeyFCr-Tc7HU3yBC42K8P1uXsYy0vxUo';

const remotePlugin = {
  name: 'remote-store',
  setup(b) {
    b.onResolve({ filter: /^\.\/store$/ }, (args) => ({ path: path.join(args.resolveDir, 'remote.ts') }));
  },
};

async function bundleApp(remote) {
  const r = await build({
    entryPoints: ['src/main.tsx'],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    target: ['es2020', 'safari15'],
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    legalComments: 'none',
    plugins: remote ? [remotePlugin] : [],
    define: remote ? { __SB_URL__: JSON.stringify(SB_URL), __SB_ANON__: JSON.stringify(SB_ANON) } : {},
  });
  return r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

const css = readFileSync('src/ui/styles.css', 'utf8');
const REACT = 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js';
const REACT_DOM = 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js';
const SUPABASE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&display=swap';

const head = (extra = '') => `<title>LADELOS Control de Vitrina</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#163e8e">
${extra}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${css}</style>`;
const body = (js, libs) => `<div id="root"></div>
${libs.map((l) => `<script src="${l}"></script>`).join('\n')}
<script>${js}</script>`;
const doc = (h, b) => `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${h}\n</head>\n<body>\n${b}\n</body>\n</html>\n`;

mkdirSync('dist/edge', { recursive: true });
const local = await bundleApp(false);
writeFileSync('dist/ladelos-control-vitrina.html', `${head()}\n${body(local, [REACT, REACT_DOM])}\n`);
writeFileSync('dist/standalone.html', doc(head(), body(local, [REACT, REACT_DOM])));
const remote = await bundleApp(true);
const pwa = '<link rel="manifest" href="/vitrina.webmanifest">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Vitrina">\n<link rel="apple-touch-icon" href="/logo.png">\n';
writeFileSync('dist/vitrina.html', doc(head(pwa), body(remote, [REACT, REACT_DOM, SUPABASE])));
writeFileSync(
  'dist/vitrina.webmanifest',
  JSON.stringify({ name: 'LADELOS Control de Vitrina', short_name: 'Vitrina', start_url: '/vitrina.html', display: 'standalone', orientation: 'any', background_color: '#f6f0e2', theme_color: '#163e8e', icons: [{ src: '/logo.png', sizes: '512x512', type: 'image/png' }] }, null, 2),
);

const edge = await build({
  entryPoints: ['supabase/functions/vitrina/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  write: false,
  external: ['npm:*'],
  legalComments: 'none',
});
writeFileSync('dist/edge/vitrina.ts', `// LADELOS Control de Vitrina — Edge Function "vitrina" (generada por build.mjs; no editar a mano)\n${edge.outputFiles[0].text}`);
const hook = await build({
  entryPoints: ['supabase/functions/clover-webhook/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  write: false,
  external: ['npm:*'],
  legalComments: 'none',
});
writeFileSync('dist/edge/clover-webhook.ts', `// LADELOS Control de Vitrina — Edge Function "clover-webhook" (generada por build.mjs; no editar a mano)\n${hook.outputFiles[0].text}`);
console.log(`OK · local ${(local.length / 1024).toFixed(0)} KB · conectada ${(remote.length / 1024).toFixed(0)} KB · edge ${(edge.outputFiles[0].text.length / 1024).toFixed(0)} KB`);
