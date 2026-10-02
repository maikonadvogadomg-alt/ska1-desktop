/* =========================================================================
   Mini SK — 95-pwa.js
   Painel 📱 PWA, em três partes:
   1) 🎨 Ícone  — o Gerador de Ícones PRO (texto ou imagem, gradiente, forma,
      borda, sombra) + o que faltava: versão MASKABLE (com margem de
      segurança), SVG, favicon.ico e apple-touch-icon. Grava em icons/ ou
      baixa em .zip (PNG, JPG ou WEBP).
   2) 📲 Instalável — transforma qualquer página em app instalável: cria
      manifest.json, service-worker.js (SEM lista manual: ele mesmo lista
      todos os arquivos) e arruma o <head> do index sem duplicar nada.
   3) 🧭 Hub — o seu "index de códigos": acha todas as páginas .html do
      projeto (100 de uma vez, sem digitar endereço), e GERA O INDEX DO HUB
      já montado, com a lista gravada dentro. Instala como app e funciona
      em qualquer celular, sem montar de novo.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const DEF = {
    texto: 'M', fonte: 'Georgia', tamFonte: 300, forma: 'arredondado', fundo: 'gradiente',
    cor: '#a3a082', g1: '#667eea', g2: '#764ba2', ang: 135, corTexto: '#ffffff',
    corBorda: '#ffffff', borda: 0, sombra: 0, corSombra: '#000000', opSombra: 50, imgEscala: 80,
  };
  let cfg = Object.assign({}, DEF, SK.pref.get('iconCfg', {}));
  let imgEl = null;                // imagem própria (opcional)
  let box, canvas, tab = SK.pref.get('pwaTab', 'icone');
  const SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512];
  const FONTES = ['Georgia', 'Arial', 'Verdana', 'Trebuchet MS', 'Courier New', 'Impact', 'Times New Roman', 'Comic Sans MS', 'system-ui'];
  const GRADS = [['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#30cfd0', '#330867'], ['#ff9a56', '#ff6a88'], ['#1e3799', '#0c2461'], ['#0f2027', '#2c5364'], ['#b8860b', '#5c3d00'], ['#232526', '#414345'], ['#89f7fe', '#66a6ff']];

  // ── Desenho ─────────────────────────────────────────────────────────────────
  function gradFill(c, x, y, w) {
    if (cfg.fundo === 'solido') return cfg.cor;
    const a = cfg.ang * Math.PI / 180, dx = Math.sin(a) * w / 2, dy = -Math.cos(a) * w / 2, cx = x + w / 2, cy = y + w / 2;
    const g = c.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, cfg.g1); g.addColorStop(1, cfg.g2);
    return g;
  }
  function shapePath(c, x, y, w, forma) {
    c.beginPath();
    if (forma === 'circulo') { c.arc(x + w / 2, y + w / 2, w / 2, 0, Math.PI * 2); return; }
    if (forma === 'arredondado') {
      const r = w * 0.22;
      c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + w, r); c.arcTo(x + w, y + w, x, y + w, r);
      c.arcTo(x, y + w, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); return;
    }
    c.rect(x, y, w, w);
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function content(c, S, area) {
    const cx = S / 2, cy = S / 2;
    if (imgEl) {
      const max = area * cfg.imgEscala / 100;
      const r = Math.min(max / imgEl.naturalWidth, max / imgEl.naturalHeight);
      const w = imgEl.naturalWidth * r, h = imgEl.naturalHeight * r;
      c.drawImage(imgEl, cx - w / 2, cy - h / 2, w, h);
      return;
    }
    const t = cfg.texto || 'M';
    let fs_ = cfg.tamFonte * area / 512;
    c.font = 'bold ' + fs_ + 'px "' + cfg.fonte + '"';
    const wMax = area * 0.86, m = c.measureText(t).width;
    if (m > wMax) { fs_ *= wMax / m; c.font = 'bold ' + fs_ + 'px "' + cfg.fonte + '"'; }
    c.fillStyle = cfg.corTexto; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(t, cx, cy + fs_ * 0.04);
  }
  /** maskable = fundo ocupa tudo e o desenho fica dentro da área segura (80%). */
  function draw(c, S, maskable) {
    const k = S / 512;
    c.clearRect(0, 0, S, S);
    if (maskable) {
      c.fillStyle = gradFill(c, 0, 0, S); c.fillRect(0, 0, S, S);
      content(c, S, S * 0.8 * 0.92);
      return;
    }
    const m = cfg.sombra > 0 ? Math.min(cfg.sombra * 0.9, 40) * k : 0;
    const x = m * 0.6, w = S - m * 1.6;
    if (cfg.sombra > 0) { c.shadowColor = hexA(cfg.corSombra, cfg.opSombra / 100); c.shadowBlur = cfg.sombra * k; c.shadowOffsetX = c.shadowOffsetY = cfg.sombra / 4 * k; }
    c.fillStyle = gradFill(c, x, x, w); shapePath(c, x, x, w, cfg.forma); c.fill();
    c.shadowColor = 'transparent'; c.shadowBlur = c.shadowOffsetX = c.shadowOffsetY = 0;
    const b = cfg.borda * k;
    if (b > 0) { c.strokeStyle = cfg.corBorda; c.lineWidth = b; shapePath(c, x + b / 2, x + b / 2, w - b, cfg.forma); c.stroke(); }
    content(c, S, w);
  }
  function render(S, maskable, mime) {
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    if (mime === 'image/jpeg') { c.fillStyle = '#ffffff'; c.fillRect(0, 0, S, S); }
    c.save(); draw(c, S, maskable); c.restore();
    if (mime === 'image/jpeg') { const c2 = document.createElement('canvas'); c2.width = c2.height = S; const x = c2.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); x.drawImage(cv, 0, 0); return c2; }
    return cv;
  }
  const toBytes = (cv, mime, q) => new Promise((res) => cv.toBlob(async (b) => res(new Uint8Array(await b.arrayBuffer())), mime || 'image/png', q || 0.92));

  function svg(maskable) {
    const S = 512, esc = SK.esc;
    const a = cfg.ang * Math.PI / 180;
    const x1 = 50 - Math.sin(a) * 50, y1 = 50 + Math.cos(a) * 50, x2 = 50 + Math.sin(a) * 50, y2 = 50 - Math.cos(a) * 50;
    const fill = cfg.fundo === 'solido' ? cfg.cor : 'url(#g)';
    const defs = cfg.fundo === 'solido' ? '' : '<defs><linearGradient id="g" x1="' + x1.toFixed(1) + '%" y1="' + y1.toFixed(1) + '%" x2="' + x2.toFixed(1) + '%" y2="' + y2.toFixed(1) + '%"><stop offset="0" stop-color="' + cfg.g1 + '"/><stop offset="1" stop-color="' + cfg.g2 + '"/></linearGradient></defs>';
    let shape;
    if (maskable || cfg.forma === 'quadrado') shape = '<rect width="512" height="512" fill="' + fill + '"/>';
    else if (cfg.forma === 'circulo') shape = '<circle cx="256" cy="256" r="256" fill="' + fill + '"/>';
    else shape = '<rect width="512" height="512" rx="112" fill="' + fill + '"/>';
    const b = !maskable && cfg.borda > 0 ? (cfg.forma === 'circulo' ? '<circle cx="256" cy="256" r="' + (256 - cfg.borda / 2) + '" fill="none" stroke="' + cfg.corBorda + '" stroke-width="' + cfg.borda + '"/>' : '<rect x="' + cfg.borda / 2 + '" y="' + cfg.borda / 2 + '" width="' + (512 - cfg.borda) + '" height="' + (512 - cfg.borda) + '" rx="' + (cfg.forma === 'arredondado' ? 112 - cfg.borda / 2 : 0) + '" fill="none" stroke="' + cfg.corBorda + '" stroke-width="' + cfg.borda + '"/>') : '';
    const area = maskable ? S * 0.8 * 0.92 : S;
    let inner;
    if (imgEl) {
      const cv = document.createElement('canvas'); const max = 512; const r = Math.min(1, max / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
      cv.width = Math.round(imgEl.naturalWidth * r); cv.height = Math.round(imgEl.naturalHeight * r); cv.getContext('2d').drawImage(imgEl, 0, 0, cv.width, cv.height);
      const box_ = area * cfg.imgEscala / 100, sc = Math.min(box_ / cv.width, box_ / cv.height), w = cv.width * sc, h = cv.height * sc;
      inner = '<image href="' + cv.toDataURL('image/png') + '" x="' + (256 - w / 2).toFixed(1) + '" y="' + (256 - h / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"/>';
    } else {
      const size = Math.min(cfg.tamFonte * area / 512, area * 0.86 / Math.max(1, (cfg.texto || 'M').length * 0.62));
      inner = '<text x="256" y="256" text-anchor="middle" dominant-baseline="central" font-family="' + esc(cfg.fonte) + ', sans-serif" font-weight="bold" font-size="' + size.toFixed(0) + '" fill="' + cfg.corTexto + '">' + esc(cfg.texto || 'M') + '</text>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">' + defs + shape + b + inner + '</svg>\n';
  }
  /** favicon.ico com PNGs de 16, 32 e 48 dentro. */
  function ico(pngs) {
    const head = 6 + 16 * pngs.length;
    const total = head + pngs.reduce((s, p) => s + p.bytes.length, 0);
    const out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint16(2, 1, true); dv.setUint16(4, pngs.length, true);
    let off = head;
    pngs.forEach((p, i) => {
      const e = 6 + i * 16;
      out[e] = p.size >= 256 ? 0 : p.size; out[e + 1] = p.size >= 256 ? 0 : p.size;
      dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true);
      dv.setUint32(e + 8, p.bytes.length, true); dv.setUint32(e + 12, off, true);
      out.set(p.bytes, off); off += p.bytes.length;
    });
    return out;
  }

  /** Gera todos os arquivos de ícone. Retorna [{path, bytes|text}] relativos a `dir`. */
  async function iconFiles(dir, sizes, fmt) {
    const mime = fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
    const ext = fmt || 'png';
    const pre = (dir ? dir + '/' : '');
    const out = [];
    for (const s of sizes) out.push({ path: pre + 'icons/icon-' + s + '.' + ext, bytes: await toBytes(render(s, false, mime), mime) });
    for (const s of [192, 512]) out.push({ path: pre + 'icons/maskable-' + s + '.png', bytes: await toBytes(render(s, true), 'image/png') });
    out.push({ path: pre + 'icons/apple-touch-icon.png', bytes: await toBytes(render(180, true), 'image/png') });
    out.push({ path: pre + 'icons/icon.svg', text: svg(false) });
    out.push({ path: pre + 'icons/maskable.svg', text: svg(true) });
    const small = [];
    for (const s of [16, 32, 48]) small.push({ size: s, bytes: await toBytes(render(s, false), 'image/png') });
    out.push({ path: pre + 'favicon.ico', bytes: ico(small) });
    return out;
  }
  function saveFiles(files) {
    for (const f of files) {
      if (f.text != null) fs().write(f.path, f.text, { silent: true });
      else fs().writeRecord(f.path, { b64: fs().toBase64(f.bytes), enc: 'binário', size: f.bytes.length });
    }
  }

  // ── Caminhos ────────────────────────────────────────────────────────────────
  function rel(fromDir, path) {
    const a = fromDir ? fromDir.split('/') : [], b = path.split('/');
    let i = 0; while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
    return '../'.repeat(a.length - i) + b.slice(i).join('/');
  }
  function resolveFrom(dir, ref) { return /^(?:[a-z]+:|\/\/|data:)/i.test(ref) ? null : fs().norm((ref.startsWith('/') ? '' : (dir ? dir + '/' : '')) + ref.split(/[?#]/)[0]); }
  const titleOf = (html) => { const m = /<title[^>]*>([^<]*)<\/title>/i.exec(html || ''); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
  const slug = (s) => (s || 'app').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'app';
  const initials = (s) => { const all = String(s || '?').replace(/\.[a-z0-9]+$/i, '').split(/[\s_\-.]+/).filter(Boolean); const w = all.filter((x) => !/^(de|da|do|das|dos|e|a|o|the|of)$/i.test(x)).length ? all.filter((x) => !/^(de|da|do|das|dos|e|a|o|the|of)$/i.test(x)) : all; return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '').slice(1, 2))).toUpperCase(); };
  function colorOf(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 'hsl(' + (h % 360) + ' 62% 48%)'; }

  // ── Tornar instalável ───────────────────────────────────────────────────────
  /** index.html usa manifest.json; outra página da mesma pasta ganha o próprio (ex.: hub.webmanifest). */
  const manifestOf = (page) => /^index\.html?$/i.test(fs().baseName(page)) ? 'manifest.json' : fs().baseName(page).replace(/\.html?$/i, '') + '.webmanifest';
  function swText(name, files) {
    return '// service-worker.js — gerado pelo Mini SK em ' + new Date().toLocaleString('pt-BR') + '\n' +
      '// Não precisa mexer: ele guarda sozinho o que o app usa.\n' +
      "const PREFIXO = 'sk-" + slug(name) + "-';\n" +
      "const CACHE = PREFIXO + '" + Date.now().toString(36) + "';\n" +
      '// Lista feita automaticamente (para funcionar sem internet logo após instalar)\n' +
      'const GUARDAR = ' + JSON.stringify(files, null, 0).replace(/","/g, '",\n  "').replace(/^\[/, '[\n  ').replace(/\]$/, '\n]') + ';\n\n' +
      "self.addEventListener('install', (e) => {\n  self.skipWaiting();\n  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(GUARDAR.map((u) => c.add(u).catch(() => null)))));\n});\n\n" +
      "self.addEventListener('activate', (e) => {\n  e.waitUntil(caches.keys()\n    .then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIXO) && k !== CACHE).map((k) => caches.delete(k))))\n    .then(() => self.clients.claim()));\n});\n\n" +
      '// Primeiro a internet (sempre a versão nova); sem internet, a cópia guardada.\n' +
      "self.addEventListener('fetch', (e) => {\n  const req = e.request;\n  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;\n  e.respondWith(\n    fetch(req).then((res) => {\n      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }\n      return res;\n    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./') : undefined)))\n  );\n});\n";
  }
  function patchHead(html, block) {
    html = html.replace(/[ \t]*<!-- PWA:inicio[\s\S]*?<!-- PWA:fim -->\s*/g, '');
    html = html.replace(/[ \t]*<!--\s*PWA:[^>]*-->\s*\n?/gi, '');
    html = html.replace(/[ \t]*<link\b[^>]*\brel=["']?(?:manifest|apple-touch-icon|icon|shortcut icon|mask-icon)["']?[^>]*>\s*\n?/gi, '');
    html = html.replace(/[ \t]*<meta\b[^>]*\bname=["']?(?:theme-color|mobile-web-app-capable|apple-mobile-web-app-[\w-]+)["']?[^>]*>\s*\n?/gi, '');
    html = html.replace(/[ \t]*<script\b[^>]*>([\s\S]*?)<\/script>\s*\n?/gi, (m, body) => (/serviceWorker/.test(body) && /register/.test(body) && body.length < 2500 ? '' : m));
    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, block + '</head>');
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + '\n' + block);
    return block + html;
  }
  async function makeInstallable(page, o) {
    const report = [];
    const dir = fs().dirName(page);
    const pre = dir ? dir + '/' : '';
    let html = fs().read(page) || '';
    // 1. ícones
    const hasIcons = fs().exists(pre + 'icons/icon-192.png') && fs().exists(pre + 'icons/icon-512.png') && fs().exists(pre + 'icons/maskable-512.png');
    if (!hasIcons || o.newIcons) {
      if (!imgEl && cfg.texto === DEF.texto) cfg.texto = initials(o.name);
      saveFiles(await iconFiles(dir, SIZES, 'png'));
      report.push((hasIcons ? '♻️ Ícones refeitos' : '✅ Criei os ícones') + ' (' + SIZES.length + ' tamanhos + maskable + SVG + favicon) em ' + (pre || '') + 'icons/');
    } else report.push('👍 Ícones já existiam — mantive');
    // 2. manifest
    const icons = SIZES.filter((s) => s >= 48 && fs().exists(pre + 'icons/icon-' + s + '.png')).map((s) => ({ src: 'icons/icon-' + s + '.png', sizes: s + 'x' + s, type: 'image/png', purpose: 'any' }));
    icons.push({ src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' }, { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }, { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' });
    let old = {};
    const manName = manifestOf(page);
    try { old = JSON.parse(fs().read(pre + manName) || '{}'); } catch {}
    const start = fs().baseName(page).toLowerCase() === 'index.html' ? './' : './' + fs().baseName(page);
    const man = Object.assign({}, old, {
      name: o.name, short_name: o.short || o.name.slice(0, 12), description: o.desc || old.description || o.name,
      id: start, start_url: start, scope: './', display: o.display, orientation: o.orientation,
      background_color: o.bg, theme_color: o.theme, lang: 'pt-BR', dir: 'ltr', icons,
    });
    if (o.shortcuts && o.shortcuts.length) man.shortcuts = o.shortcuts;
    fs().write(pre + manName, JSON.stringify(man, null, 2) + '\n', { silent: true });
    report.push((old.name ? '♻️ Atualizei' : '✅ Criei') + ' o ' + pre + manName + ' (' + icons.length + ' ícones, ' + o.display + ', ' + o.orientation + ')');
    // 3. service worker com lista automática
    const list = ['./'].concat(fs().list().filter((f) => (!dir || f.startsWith(pre)) && !/^\.sk\/|(^|\/)\.git|\.(zip|apk|aab|exe|map)$/i.test(f.slice(pre.length)) && (fs().get(f).size || 0) < 5e6 && f !== pre + 'service-worker.js').map((f) => './' + f.slice(pre.length)));
    const files = o.offline ? list.slice(0, 3000) : ['./', './' + fs().baseName(page), './' + manName];
    fs().write(pre + 'service-worker.js', swText(o.name, files), { silent: true });
    report.push('✅ Service worker ' + (o.offline ? 'com ' + files.length + ' arquivos listados SOZINHO (funciona sem internet)' : 'leve (guarda o que for usado)'));
    // 4. <head>
    const viewport = /<meta[^>]+name=["']?viewport/i.test(html) ? '' : '  <meta name="viewport" content="width=device-width, initial-scale=1">\n';
    const charset = /<meta[^>]+charset/i.test(html) ? '' : '  <meta charset="utf-8">\n';
    const title = titleOf(html) ? '' : '  <title>' + SK.esc(o.name) + '</title>\n';
    const block = '  <!-- PWA:inicio (gerado pelo Mini SK — pode refazer no painel 📱 PWA) -->\n' + charset + viewport + title +
      '  <link rel="manifest" href="' + manName + '">\n' +
      '  <meta name="theme-color" content="' + o.theme + '">\n' +
      '  <meta name="mobile-web-app-capable" content="yes">\n' +
      '  <meta name="apple-mobile-web-app-capable" content="yes">\n' +
      '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n' +
      '  <meta name="apple-mobile-web-app-title" content="' + SK.esc(o.short || o.name) + '">\n' +
      '  <link rel="icon" href="favicon.ico" sizes="any">\n' +
      '  <link rel="icon" href="icons/icon.svg" type="image/svg+xml">\n' +
      '  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n' +
      "  <script>\n    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {\n      addEventListener('load', function () { navigator.serviceWorker.register('service-worker.js').catch(function (e) { console.warn('Service worker:', e); }); });\n    }\n  </script>\n" +
      '  <!-- PWA:fim -->\n';
    if (!/<html/i.test(html)) html = '<!doctype html>\n<html lang="pt-BR">\n<head>\n</head>\n<body>\n' + html + '\n</body>\n</html>\n';
    fs().write(page, patchHead(html, block));
    report.push('✅ Arrumei o <head> de ' + page + ' (tirei duplicados e coloquei tudo certo)');
    return report;
  }

  // ── Hub ─────────────────────────────────────────────────────────────────────
  const HUB_MARK = '<!-- SK-HUB -->';
  let hub = null;
  function loadHub() {
    try { hub = JSON.parse(fs().read('.sk/hub.json') || 'null'); } catch { hub = null; }
    if (!hub) hub = { titulo: (fs().project && fs().project.name) || 'Meus apps', arquivo: '', itens: [] };
    return hub;
  }
  function saveHub() { fs().write('.sk/hub.json', JSON.stringify(hub, null, 2), { silent: true }); }
  function hubFile() {
    if (hub.arquivo) return hub.arquivo;
    const idx = fs().read('index.html');
    return idx == null || idx.includes(HUB_MARK) ? 'index.html' : 'hub.html';
  }
  function iconFor(page) {
    const html = fs().read(page) || '', dir = fs().dirName(page), pre = dir ? dir + '/' : '';
    const re = /<link\b[^>]*\brel=["']?(?:apple-touch-icon|icon)["']?[^>]*>/gi; let m;
    const cands = [];
    while ((m = re.exec(html))) { const h = /href=["']?([^"'\s>]+)/i.exec(m[0]); if (h) cands.push(resolveFrom(dir, h[1])); }
    cands.push(pre + 'icons/icon-192.png', pre + 'icons/apple-touch-icon.png', pre + 'icon-192.png');
    return cands.find((c) => c && fs().exists(c) && !/\.ico$/i.test(c)) || '';
  }
  function scanHub() {
    const file = hubFile();
    const pages = fs().list().filter((f) => /\.html?$/i.test(f) && f !== file && !/^\.sk\//.test(f) && !/(^|\/)(node_modules|dist\/assets)\//.test(f) && !(fs().read(f) || '').includes(HUB_MARK));
    const old = new Map(hub.itens.map((i) => [i.path, i]));
    let novos = 0;
    hub.itens = pages.map((p) => {
      if (old.has(p)) return Object.assign(old.get(p), { icone: iconFor(p) });
      novos++;
      const t = titleOf(fs().read(p));
      const base = fs().baseName(p).replace(/\.html?$/i, '');
      const nome = t || (/^index$/i.test(base) && fs().dirName(p) ? fs().baseName(fs().dirName(p)) : base);
      return { path: p, nome, desc: '', on: true, icone: iconFor(p) };
    });
    saveHub();
    return { total: pages.length, novos };
  }
  function hubHtml(file) {
    const dir = fs().dirName(file);
    const items = hub.itens.filter((i) => i.on && fs().exists(i.path)).map((i) => ({ n: i.nome, d: i.desc || '', u: rel(dir, i.path), i: i.icone ? rel(dir, i.icone) : '', c: colorOf(i.nome), l: initials(i.nome) }));
    const t = SK.esc(hub.titulo || 'Meus apps');
    return '<!doctype html>\n' + HUB_MARK + '\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n  <title>' + t + '</title>\n' +
      '  <style>\n    :root{--bg:#0f1420;--card:#171e30;--line:#263048;--tx:#e6ebf5;--mut:#8a96b0;color-scheme:dark}\n    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:env(safe-area-inset-top) 0 24px}\n    header{position:sticky;top:0;background:rgba(15,20,32,.92);backdrop-filter:blur(8px);padding:14px 16px 10px;z-index:2;border-bottom:1px solid var(--line)}\n    h1{margin:0 0 10px;font-size:20px}\n    input{width:100%;padding:11px 14px;border-radius:12px;border:1px solid var(--line);background:#0b0f18;color:var(--tx);font:inherit}\n    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:14px;padding:16px}\n    a.app{display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;color:var(--tx);padding:12px 6px;border-radius:14px}\n    a.app:hover,a.app:focus{background:var(--card);outline:none}\n    .ic{width:64px;height:64px;border-radius:16px;display:grid;place-items:center;font-weight:800;font-size:24px;color:#fff;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.35)}\n    .ic img{width:100%;height:100%;object-fit:cover}\n    .nm{font-size:13px;text-align:center;line-height:1.25;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n    .ds{font-size:11px;color:var(--mut);text-align:center}\n    .vazio{color:var(--mut);padding:30px 16px;text-align:center}\n    .rec{padding:0 16px;color:var(--mut);font-size:12px;margin-top:10px}\n  </style>\n</head>\n<body>\n' +
      '  <header><h1>' + t + '</h1><input id="q" type="search" placeholder="Procurar entre ' + items.length + ' apps…" autocomplete="off"></header>\n  <div class="rec" id="rec"></div>\n  <main class="grid" id="g"></main>\n' +
      '  <script>\n    // Lista gravada pelo Mini SK — não depende do navegador, funciona em qualquer celular.\n    var APPS = ' + JSON.stringify(items, null, 1) + ';\n' +
      "    var g = document.getElementById('g'), q = document.getElementById('q');\n" +
      "    function rec(){ try { return JSON.parse(localStorage.getItem('hub-recentes') || '[]'); } catch (e) { return []; } }\n" +
      "    function esc(s){ return String(s).replace(/[&<>\"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]; }); }\n" +
      "    function card(a){ return '<a class=\"app\" href=\"' + esc(a.u) + '\" data-u=\"' + esc(a.u) + '\"><span class=\"ic\" style=\"background:' + a.c + '\">' + (a.i ? '<img src=\"' + esc(a.i) + '\" alt=\"\" loading=\"lazy\" onerror=\"this.remove()\">' : '') + (a.i ? '' : esc(a.l)) + '</span><span class=\"nm\">' + esc(a.n) + '</span>' + (a.d ? '<span class=\"ds\">' + esc(a.d) + '</span>' : '') + '</a>'; }\n" +
      "    function show(){ var t = q.value.trim().toLowerCase(); var r = rec(); var list = APPS.filter(function(a){ return !t || (a.n + ' ' + a.d + ' ' + a.u).toLowerCase().indexOf(t) >= 0; });\n" +
      "      if (!t) list.sort(function(a,b){ var x = r.indexOf(a.u), y = r.indexOf(b.u); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); });\n" +
      "      g.innerHTML = list.map(card).join('') || '<p class=\"vazio\">Nada encontrado.</p>'; document.getElementById('rec').textContent = !t && r.length ? 'Os usados por último aparecem primeiro.' : ''; }\n" +
      "    g.addEventListener('click', function(e){ var a = e.target.closest('a.app'); if (!a) return; var r = rec().filter(function(u){ return u !== a.dataset.u; }); r.unshift(a.dataset.u); try { localStorage.setItem('hub-recentes', JSON.stringify(r.slice(0, 30))); } catch (e) {} });\n" +
      "    q.addEventListener('input', show); show();\n  </script>\n</body>\n</html>\n";
  }
  async function buildHub(o) {
    const file = hubFile();
    hub.arquivo = file; saveHub();
    const n = hub.itens.filter((i) => i.on).length;
    if (!n) throw new Error('Nenhuma página marcada. Toque em "Procurar páginas" primeiro.');
    await SK.checkpoints.auto('Antes de montar o Hub');
    fs().write(file, hubHtml(file));
    const dir = fs().dirName(file);
    const shortcuts = hub.itens.filter((i) => i.on).slice(0, 4).map((i) => ({ name: i.nome, url: rel(dir, i.path) }));
    const rep = await makeInstallable(file, Object.assign({}, o, { name: hub.titulo, shortcuts, offline: true }));
    rep.unshift('✅ Montei o ' + file + ' com ' + n + ' apps já gravados dentro (não precisa cadastrar de novo em outro celular)');
    return rep;
  }

  // ── Interface ───────────────────────────────────────────────────────────────
  function build(container) {
    box = container;
    box.innerHTML =
      '<div class="seg" role="tablist">' +
      '<button class="seg-b" data-tab="icone">🎨 Ícone</button><button class="seg-b" data-tab="inst">📲 Instalável</button><button class="seg-b" data-tab="hub">🧭 Hub</button></div>' +
      '<div data-pane="icone" class="stack">' +
      '  <div class="ic-prev"><canvas id="pw-cv" width="256" height="256"></canvas><canvas id="pw-cvm" width="128" height="128" title="Maskable (como o Android corta)"></canvas></div>' +
      '  <p class="muted small center">À esquerda o ícone; à direita a versão <b>maskable</b> já recortada em círculo, como o Android mostra.</p>' +
      '  <div class="row"><input class="inp grow" id="pw-txt" maxlength="4" placeholder="Letra(s)"><button class="btn small" id="pw-img">🖼 Usar imagem</button><button class="btn small" id="pw-noimg" hidden>✕ Imagem</button></div>' +
      '  <input type="file" id="pw-img-in" accept="image/*" hidden>' +
      '  <div class="row wrap"><select class="inp" id="pw-font">' + FONTES.map((f) => '<option>' + f + '</option>').join('') + '</select>' +
      '  <label class="chk">Tamanho <input type="range" id="pw-tf" min="80" max="460"></label></div>' +
      '  <div class="row wrap" id="pw-forma"><button class="btn small" data-forma="quadrado">⬜ Quadrado</button><button class="btn small" data-forma="arredondado">▢ Arredondado</button><button class="btn small" data-forma="circulo">⚫ Círculo</button></div>' +
      '  <div class="row wrap"><label class="chk"><input type="radio" name="pw-fundo" value="solido"> Cor sólida</label><label class="chk"><input type="radio" name="pw-fundo" value="gradiente"> Gradiente</label></div>' +
      '  <div class="row wrap"><label class="chk">Fundo <input type="color" id="pw-cor"></label><label class="chk">De <input type="color" id="pw-g1"></label><label class="chk">Até <input type="color" id="pw-g2"></label><label class="chk">Texto <input type="color" id="pw-ct"></label></div>' +
      '  <label class="chk">Ângulo <input type="range" id="pw-ang" min="0" max="360"></label>' +
      '  <div class="swatches" id="pw-grads">' + GRADS.map((g, i) => '<button data-g="' + i + '" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')" aria-label="Gradiente ' + (i + 1) + '"></button>').join('') + '</div>' +
      '  <details><summary>✨ Borda e sombra</summary><div class="stack" style="margin-top:6px">' +
      '    <div class="row wrap"><label class="chk">Borda <input type="range" id="pw-bd" min="0" max="40"></label><input type="color" id="pw-cb"></div>' +
      '    <div class="row wrap"><label class="chk">Sombra <input type="range" id="pw-sb" min="0" max="50"></label><input type="color" id="pw-cs"><label class="chk">Força <input type="range" id="pw-os" min="0" max="100"></label></div>' +
      '    <label class="chk">Tamanho da imagem <input type="range" id="pw-ie" min="30" max="100"></label>' +
      '  </div></details>' +
      '  <div class="row wrap"><select class="inp" id="pw-fmt"><option value="png">PNG</option><option value="webp">WEBP</option><option value="jpg">JPG</option></select>' +
      '  <button class="btn primary" id="pw-save">💾 Gravar no projeto (icons/)</button><button class="btn" id="pw-zip">⤓ Baixar .zip</button></div>' +
      '  <p class="muted small">Gera ' + SIZES.join(', ') + ' + maskable 192/512 + apple-touch-icon + icon.svg + maskable.svg + favicon.ico.</p>' +
      '</div>' +
      '<div data-pane="inst" class="stack">' +
      '  <p class="muted small">Escolha a página. O Mini SK cria o que faltar (ícones, manifest, service worker) e arruma o &lt;head&gt; dela — sem duplicar nada. Se rodar de novo, ele só atualiza.</p>' +
      '  <select class="inp" id="pw-page"></select>' +
      '  <div id="pw-check" class="pw-check"></div>' +
      '  <input class="inp" id="pw-name" placeholder="Nome do app (ex.: SK Jurídico)">' +
      '  <input class="inp" id="pw-short" placeholder="Nome curto, aparece embaixo do ícone (até 12 letras)" maxlength="20">' +
      '  <div class="row wrap"><label class="chk">Cor da barra <input type="color" id="pw-theme"></label><label class="chk">Fundo ao abrir <input type="color" id="pw-bg"></label></div>' +
      '  <div class="row wrap"><select class="inp" id="pw-disp"><option value="standalone">Como app (sem barra do navegador)</option><option value="fullscreen">Tela cheia</option><option value="minimal-ui">Com botões mínimos</option></select>' +
      '  <select class="inp" id="pw-ori"><option value="any">Retrato e paisagem</option><option value="portrait">Só retrato (em pé)</option><option value="landscape">Só paisagem (deitado)</option></select></div>' +
      '  <label class="chk"><input type="checkbox" id="pw-off" checked> Funcionar sem internet (lista todos os arquivos sozinho)</label>' +
      '  <label class="chk"><input type="checkbox" id="pw-newic"> Refazer os ícones com o desenho da aba 🎨</label>' +
      '  <button class="btn primary" id="pw-go">📲 Tornar instalável</button>' +
      '  <div id="pw-rep" class="pw-rep"></div>' +
      '</div>' +
      '<div data-pane="hub" class="stack">' +
      '  <p class="muted small">O Hub é uma página com o ícone de cada código do projeto. Ele acha <b>todas</b> as páginas .html sozinho e grava a lista <b>dentro</b> do index do Hub. Instalou uma vez, está tudo lá — em qualquer celular.</p>' +
      '  <input class="inp" id="hub-title" placeholder="Título do Hub (ex.: Meus códigos)">' +
      '  <div class="row wrap"><button class="btn" id="hub-scan">🔎 Procurar páginas</button><button class="btn small" id="hub-all">Marcar todas</button><button class="btn small" id="hub-none">Desmarcar</button></div>' +
      '  <div id="hub-list" class="hub-list"></div>' +
      '  <button class="btn primary" id="hub-go">🧭 Montar Hub instalável</button>' +
      '  <div id="hub-rep" class="pw-rep"></div>' +
      '  <p class="muted small">Depois: 🐙 GitHub → Enviar → "Publicar site grátis". Abra o link no celular e toque em "Instalar app" / "Adicionar à tela inicial".</p>' +
      '</div>';
    canvas = SK.$('#pw-cv', box);
    bindIcon(); bindInst(); bindHub();
    showTab(tab);
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  }
  function showTab(t) {
    tab = t; SK.pref.set('pwaTab', t);
    SK.$$('[data-pane]', box).forEach((p) => (p.hidden = p.dataset.pane !== t));
    SK.$$('[data-tab]', box).forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    if (t === 'inst') fillInst();
    if (t === 'hub') renderHub();
  }
  function paintPreview() {
    if (!canvas) return;
    const c = canvas.getContext('2d'); c.save(); draw(c, 256, false); c.restore();
    const cm = SK.$('#pw-cvm', box).getContext('2d'); cm.save(); cm.clearRect(0, 0, 128, 128);
    cm.beginPath(); cm.arc(64, 64, 64, 0, Math.PI * 2); cm.clip(); draw(cm, 128, true); cm.restore();
    SK.pref.set('iconCfg', cfg);
  }
  function bindIcon() {
    const $ = (s) => SK.$(s, box);
    const map = { '#pw-txt': 'texto', '#pw-font': 'fonte', '#pw-tf': 'tamFonte', '#pw-cor': 'cor', '#pw-g1': 'g1', '#pw-g2': 'g2', '#pw-ct': 'corTexto', '#pw-ang': 'ang', '#pw-bd': 'borda', '#pw-cb': 'corBorda', '#pw-sb': 'sombra', '#pw-cs': 'corSombra', '#pw-os': 'opSombra', '#pw-ie': 'imgEscala' };
    const sync = () => {
      for (const s in map) $(s).value = cfg[map[s]];
      SK.$$('[name="pw-fundo"]', box).forEach((r) => (r.checked = r.value === cfg.fundo));
      SK.$$('[data-forma]', box).forEach((b) => b.classList.toggle('primary', b.dataset.forma === cfg.forma));
      $('#pw-noimg').hidden = !imgEl;
    };
    for (const s in map) $(s).addEventListener('input', (e) => { const v = e.target.value; cfg[map[s]] = e.target.type === 'range' ? +v : v; paintPreview(); });
    SK.$$('[name="pw-fundo"]', box).forEach((r) => r.addEventListener('change', () => { cfg.fundo = r.value; paintPreview(); }));
    $('#pw-forma').onclick = (e) => { const b = e.target.closest('[data-forma]'); if (!b) return; cfg.forma = b.dataset.forma; sync(); paintPreview(); };
    $('#pw-grads').onclick = (e) => { const b = e.target.closest('[data-g]'); if (!b) return; const g = GRADS[+b.dataset.g]; cfg.g1 = g[0]; cfg.g2 = g[1]; cfg.fundo = 'gradiente'; sync(); paintPreview(); };
    $('#pw-img').onclick = () => $('#pw-img-in').click();
    $('#pw-img-in').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { const im = new Image(); im.onload = () => { imgEl = im; sync(); paintPreview(); }; im.src = r.result; };
      r.readAsDataURL(f); e.target.value = '';
    };
    $('#pw-noimg').onclick = () => { imgEl = null; sync(); paintPreview(); };
    $('#pw-save').onclick = async () => {
      if (!fs().project) return;
      const page = SK.editor.current && /\.html?$/i.test(SK.editor.current) ? SK.editor.current : (fs().exists('index.html') ? 'index.html' : '');
      const dir = page ? fs().dirName(page) : '';
      await SK.checkpoints.auto('Antes de gravar ícones');
      const files = await iconFiles(dir, SIZES, $('#pw-fmt').value);
      saveFiles(files);
      SK.toast('✅ ' + files.length + ' arquivos de ícone gravados em ' + (dir ? dir + '/' : '') + 'icons/');
    };
    $('#pw-zip').onclick = async () => {
      const files = await iconFiles('', SIZES, $('#pw-fmt').value);
      const zip = await SK.zip.write(files.map((f) => ({ name: f.path, data: f.text != null ? new TextEncoder().encode(f.text) : f.bytes })));
      SK.download('icones-' + slug(cfg.texto) + '.zip', zip);
    };
    sync(); paintPreview();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintPreview);
  }

  function checkPage(page) {
    const dir = fs().dirName(page), pre = dir ? dir + '/' : '';
    const html = fs().read(page) || '';
    const has = (re) => re.test(html);
    const rows = [
      ['Manifest', has(/rel=["']?manifest/i) && fs().exists(pre + manifestOf(page))],
      ['Service worker', fs().exists(pre + 'service-worker.js') || fs().exists(pre + 'sw.js')],
      ['Ícones 192 e 512', fs().exists(pre + 'icons/icon-192.png') && fs().exists(pre + 'icons/icon-512.png')],
      ['Ícone maskable', fs().exists(pre + 'icons/maskable-512.png')],
      ['Ícone SVG', fs().exists(pre + 'icons/icon.svg')],
      ['Viewport (celular)', has(/name=["']?viewport/i)],
      ['theme-color duplicado', (html.match(/name=["']?theme-color/gi) || []).length > 1, true],
    ];
    return rows.map(([n, ok, bad]) => '<div>' + (bad ? (ok ? '⚠️ ' + n + ' (vou arrumar)' : '✅ Sem duplicados') : (ok ? '✅ ' : '➕ ') + n + (ok ? '' : ' — vou criar')) + '</div>').join('');
  }
  function fillInst() {
    const $ = (s) => SK.$(s, box);
    const pages = fs().list().filter((f) => /\.html?$/i.test(f));
    const cur = $('#pw-page').value;
    const def = cur && pages.includes(cur) ? cur : (SK.editor.current && /\.html?$/i.test(SK.editor.current) ? SK.editor.current : (pages.find((p) => /^index\.html?$/i.test(p)) || pages[0] || ''));
    $('#pw-page').innerHTML = pages.length ? pages.map((p) => '<option' + (p === def ? ' selected' : '') + '>' + SK.esc(p) + '</option>').join('') : '<option value="">(nenhuma página .html no projeto)</option>';
    loadInstFields(def);
  }
  function loadInstFields(page) {
    const $ = (s) => SK.$(s, box);
    if (!page) { $('#pw-check').innerHTML = ''; return; }
    const pre = fs().dirName(page) ? fs().dirName(page) + '/' : '';
    let man = {}; try { man = JSON.parse(fs().read(pre + manifestOf(page)) || '{}'); } catch {}
    const html = fs().read(page) || '';
    const themeM = /<meta[^>]+name=["']?theme-color["']?[^>]*content=["']?([^"'\s>]+)/i.exec(html);
    $('#pw-name').value = man.name || titleOf(html) || (fs().project ? fs().project.name : 'Meu app');
    $('#pw-short').value = man.short_name || '';
    $('#pw-theme').value = /^#[0-9a-f]{6}$/i.test(man.theme_color || '') ? man.theme_color : (themeM && /^#[0-9a-f]{6}$/i.test(themeM[1]) ? themeM[1] : '#0f1420');
    $('#pw-bg').value = /^#[0-9a-f]{6}$/i.test(man.background_color || '') ? man.background_color : $('#pw-theme').value;
    $('#pw-disp').value = man.display || 'standalone';
    $('#pw-ori').value = man.orientation || 'any';
    $('#pw-check').innerHTML = checkPage(page);
  }
  function instOpts() {
    const $ = (s) => SK.$(s, box);
    return { name: $('#pw-name').value.trim() || 'Meu app', short: $('#pw-short').value.trim(), theme: $('#pw-theme').value, bg: $('#pw-bg').value, display: $('#pw-disp').value, orientation: $('#pw-ori').value, offline: $('#pw-off').checked, newIcons: $('#pw-newic').checked };
  }
  function bindInst() {
    const $ = (s) => SK.$(s, box);
    $('#pw-page').onchange = (e) => loadInstFields(e.target.value);
    $('#pw-go').onclick = async () => {
      const page = $('#pw-page').value; if (!page) return SK.toast('Não há página .html no projeto', 'error');
      $('#pw-go').disabled = true;
      try {
        await SK.checkpoints.auto('Antes de tornar instalável: ' + page);
        const rep = await makeInstallable(page, instOpts());
        $('#pw-rep').innerHTML = rep.map((r) => '<div>' + SK.esc(r) + '</div>').join('') + '<div class="muted small">Para instalar: publique (🐙 GitHub → Pages) e abra o link no celular. Aberto direto do arquivo, o navegador não deixa instalar.</div>';
        loadInstFields(page);
      } catch (e) { $('#pw-rep').innerHTML = '<div class="msg error">⚠ ' + SK.esc(e.message) + '</div>'; }
      $('#pw-go').disabled = false;
    };
  }

  function renderHub() {
    loadHub();
    const $ = (s) => SK.$(s, box);
    $('#hub-title').value = hub.titulo;
    const el = $('#hub-list');
    if (!hub.itens.length) { el.innerHTML = '<p class="muted small">Toque em "Procurar páginas".</p>'; return; }
    el.innerHTML = '<div class="muted small">' + hub.itens.filter((i) => i.on).length + ' de ' + hub.itens.length + ' marcadas · arquivo do Hub: <b>' + SK.esc(hubFile()) + '</b></div>' +
      hub.itens.map((it, k) => '<div class="hub-it" data-k="' + k + '"><input type="checkbox" data-f="on"' + (it.on ? ' checked' : '') + ' aria-label="Incluir">' +
        '<span class="hub-ic" style="background:' + colorOf(it.nome) + '">' + SK.esc(initials(it.nome)) + '</span>' +
        '<div class="grow"><input class="inp" data-f="nome" value="' + SK.esc(it.nome) + '"><div class="muted small hub-p">' + SK.esc(it.path) + (it.icone ? ' · 🖼 tem ícone' : '') + '</div></div></div>').join('');
  }
  function bindHub() {
    const $ = (s) => SK.$(s, box);
    $('#hub-title').addEventListener('change', (e) => { loadHub(); hub.titulo = e.target.value.trim() || 'Meus apps'; saveHub(); });
    $('#hub-scan').onclick = () => { loadHub(); const r = scanHub(); SK.toast(r.total + ' páginas encontradas' + (r.novos ? ' (' + r.novos + ' novas)' : '')); renderHub(); };
    $('#hub-all').onclick = () => { loadHub(); hub.itens.forEach((i) => (i.on = true)); saveHub(); renderHub(); };
    $('#hub-none').onclick = () => { loadHub(); hub.itens.forEach((i) => (i.on = false)); saveHub(); renderHub(); };
    $('#hub-list').addEventListener('change', (e) => {
      const row = e.target.closest('[data-k]'); if (!row) return; loadHub();
      const it = hub.itens[+row.dataset.k]; if (!it) return;
      if (e.target.dataset.f === 'on') it.on = e.target.checked;
      if (e.target.dataset.f === 'nome') it.nome = e.target.value.trim() || it.nome;
      saveHub(); if (e.target.dataset.f === 'on') renderHub();
    });
    $('#hub-go').onclick = async () => {
      $('#hub-go').disabled = true;
      try {
        loadHub(); hub.titulo = $('#hub-title').value.trim() || hub.titulo; saveHub();
        if (!hub.itens.length) scanHub();
        const theme = '#0f1420';
        const rep = await buildHub({ short: hub.titulo.slice(0, 12), theme, bg: theme, display: 'standalone', orientation: 'any', newIcons: false });
        $('#hub-rep').innerHTML = rep.map((r) => '<div>' + SK.esc(r) + '</div>').join('');
        SK.editor.open(hub.arquivo, { noFocus: true });
        renderHub();
      } catch (e) { $('#hub-rep').innerHTML = '<div class="msg error">⚠ ' + SK.esc(e.message) + '</div>'; }
      $('#hub-go').disabled = false;
    };
  }
  SK.on('project-open', () => { hub = null; if (box && !box.hidden) showTab(tab); });

  SK.pwa = { build, makeInstallable, buildHub, scanHub, iconFiles, svg, draw, get cfg() { return cfg; } };
})(window.SK);
