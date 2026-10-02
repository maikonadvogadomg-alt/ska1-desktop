/* =========================================================================
   Mini SK — 60-preview.js
   Preview ao vivo, sempre na parte de baixo (pode aumentar, diminuir ou
   esconder arrastando a barrinha). Monta a página com TODOS os arquivos do
   projeto: CSS, JS, imagens, módulos (import/export) e até fetch('dados.json').
   Mostra o console (erros e console.log) logo abaixo.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  let panel, frame, consoleEl, sel, autoBtn;
  let urls = [];
  let pinned = '';            // arquivo HTML fixado pelo usuário (vazio = automático)
  let auto = SK.pref.get('pvAuto', true);
  let size = SK.pref.get('pvSize', 'normal'); // min | normal | max
  let errors = 0;

  function build() {
    panel = SK.$('#preview-panel');
    panel.innerHTML =
      '<div class="pv-grip" title="Arraste para aumentar ou diminuir" aria-label="Redimensionar preview" role="separator"></div>' +
      '<div class="pv-head">' +
      '  <b class="pv-title">Preview</b>' +
      '  <select class="pv-sel" aria-label="Qual página mostrar"></select>' +
      '  <span class="pv-err" hidden></span>' +
      '  <div class="row tight pv-tools">' +
      '    <button class="icon-btn" data-p="auto" title="Atualizar sozinho enquanto digita">⚡</button>' +
      '    <button class="icon-btn" data-p="reload" title="Atualizar agora">⟳</button>' +
      '    <button class="icon-btn" data-p="console" title="Console (erros e logs)">▤</button>' +
      '    <button class="icon-btn" data-p="tab" title="Abrir em nova aba">↗</button>' +
      '    <button class="icon-btn" data-p="min" title="Diminuir">▁</button>' +
      '    <button class="icon-btn" data-p="max" title="Aumentar">▔</button>' +
      '  </div>' +
      '</div>' +
      '<div class="pv-body">' +
      '  <iframe class="pv-frame" title="Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>' +
      '  <div class="pv-console" hidden><div class="pv-console-head"><b>Console</b><button class="btn tiny" data-p="clear">Limpar</button></div><div class="pv-log"></div></div>' +
      '</div>';
    frame = SK.$('.pv-frame', panel); consoleEl = SK.$('.pv-console', panel); sel = SK.$('.pv-sel', panel); autoBtn = SK.$('[data-p="auto"]', panel);
    panel.addEventListener('click', onClick);
    sel.addEventListener('change', () => { pinned = sel.value; refresh(); });
    window.addEventListener('message', onMessage);
    setupGrip();
    applySize();
    autoBtn.classList.toggle('on', auto);
  }

  function onClick(e) {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const p = b.dataset.p;
    if (p === 'reload') refresh();
    if (p === 'auto') { auto = !auto; SK.pref.set('pvAuto', auto); autoBtn.classList.toggle('on', auto); SK.toast(auto ? 'Preview ao vivo ligado' : 'Preview ao vivo desligado (use ⟳)'); if (auto) refresh(); }
    if (p === 'console') consoleEl.hidden = !consoleEl.hidden;
    if (p === 'clear') { SK.$('.pv-log', panel).innerHTML = ''; errors = 0; showErr(); }
    if (p === 'tab') openTab();
    if (p === 'min') { size = size === 'min' ? 'normal' : 'min'; applySize(); }
    if (p === 'max') { size = size === 'max' ? 'normal' : 'max'; applySize(); }
  }

  function applySize() {
    SK.pref.set('pvSize', size);
    document.body.dataset.pv = size;
    const h = SK.pref.get('pvHeight', 0);
    if (h && size === 'normal') document.documentElement.style.setProperty('--pv-h', h + 'px');
    else document.documentElement.style.removeProperty('--pv-h');
    if (size !== 'min') refresh();
  }

  function setupGrip() {
    const grip = SK.$('.pv-grip', panel);
    let startY = 0, startH = 0, dragging = false;
    grip.addEventListener('pointerdown', (e) => {
      dragging = true; startY = e.clientY; startH = panel.getBoundingClientRect().height;
      grip.setPointerCapture(e.pointerId); document.body.classList.add('dragging');
      if (size !== 'normal') { size = 'normal'; document.body.dataset.pv = 'normal'; }
    });
    grip.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const main = SK.$('#main').getBoundingClientRect().height;
      const h = Math.max(36, Math.min(main - 60, startH + (startY - e.clientY)));
      document.documentElement.style.setProperty('--pv-h', h + 'px');
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; document.body.classList.remove('dragging');
      const h = panel.getBoundingClientRect().height;
      if (h < 60) { size = 'min'; SK.pref.set('pvHeight', 0); } else SK.pref.set('pvHeight', Math.round(h));
      applySize();
    };
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => { size = size === 'max' ? 'normal' : 'max'; applySize(); });
  }

  // ── Qual página mostrar ─────────────────────────────────────────────────────
  function htmlFiles() { return fs().list().filter((f) => /\.html?$/i.test(f)); }
  function pickTarget() {
    if (pinned && fs().exists(pinned)) return pinned;
    const cur = SK.editor.current;
    const htmls = htmlFiles();
    if (cur && /\.(html?|md|markdown|svg)$/i.test(cur)) return cur;
    if (cur) { // procura um index.html na pasta do arquivo aberto, subindo
      let d = fs().dirName(cur);
      for (;;) { const c = (d ? d + '/' : '') + 'index.html'; if (fs().exists(c)) return c; if (!d) break; d = fs().dirName(d); }
      if (/\.(m?js|jsx?)$/i.test(cur) && !htmls.length) return cur;
    }
    return htmls.find((f) => /(^|\/)index\.html?$/i.test(f)) || htmls[0] || cur || '';
  }
  function fillSelect(target) {
    const htmls = htmlFiles();
    sel.innerHTML = '<option value="">Automático' + (target ? ' (' + SK.esc(target) + ')' : '') + '</option>' + htmls.map((h) => '<option value="' + SK.esc(h) + '"' + (h === pinned ? ' selected' : '') + '>' + SK.esc(h) + '</option>').join('');
  }

  // ── Montar a página ─────────────────────────────────────────────────────────
  const isExternal = (u) => !u || /^(?:[a-z][\w+.-]*:|\/\/|#|data:|blob:|mailto:|tel:|javascript:)/i.test(u);
  function resolve(fromDir, ref) {
    const clean = ref.split('#')[0].split('?')[0];
    const p = clean.startsWith('/') ? fs().norm(clean) : fs().norm((fromDir ? fromDir + '/' : '') + clean);
    return p;
  }
  function revokeAll() { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; }
  // Aberto direto do arquivo (file://), o navegador não deixa a página do preview
  // carregar endereços blob:. Nesse caso cada arquivo vira um endereço data:.
  const DATA_MODE = location.protocol === 'file:';
  function mk(content, mime) {
    if (DATA_MODE) {
      const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
      return 'data:' + mime + (typeof content === 'string' ? ';charset=utf-8' : '') + ';base64,' + fs().toBase64(bytes);
    }
    const u = URL.createObjectURL(new Blob([content], { type: mime })); urls.push(u); return u;
  }
  function mkPage(html) { const u = URL.createObjectURL(new Blob([html], { type: 'text/html' })); urls.push(u); return u; }

  let cache;
  function fileURL(path, asModule) {
    const key = path + (asModule ? '#m' : '');
    if (cache.has(key)) return cache.get(key);
    const rec = fs().get(path); if (!rec) return null;
    const t = fs().typeOf(path);
    let url;
    cache.set(key, 'about:blank'); // evita laço infinito em import circular
    if (rec.b64 != null) url = mk(fs().bytesOf(path), t.mime);
    else if (t.ext === 'css') url = mk(rewriteCss(rec.text, fs().dirName(path)), 'text/css');
    else if (asModule || /\.(mjs)$/i.test(path)) url = mk(rewriteModule(rec.text, fs().dirName(path)), 'text/javascript');
    else if (t.lang === 'js') url = mk(rec.text, 'text/javascript');
    else url = mk(rec.text, t.mime === 'application/octet-stream' ? 'text/plain' : t.mime);
    cache.set(key, url);
    return url;
  }
  function rewriteCss(css, dir) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => {
      if (isExternal(u)) return m;
      const p = resolve(dir, u); const url = fs().exists(p) ? fileURL(p) : null;
      return url ? 'url("' + url + '")' : m;
    }).replace(/@import\s+(['"])([^'"]+)\1/g, (m, q, u) => {
      if (isExternal(u)) return m;
      const p = resolve(dir, u); const url = fs().exists(p) ? fileURL(p) : null;
      return url ? '@import "' + url + '"' : m;
    });
  }
  function rewriteModule(js, dir) {
    const fix = (spec) => {
      if (!/^\.{0,2}\//.test(spec)) return null;
      let p = resolve(dir, spec);
      if (!fs().exists(p)) { for (const e of ['.js', '.mjs', '/index.js']) if (fs().exists(p + e)) { p = p + e; break; } }
      return fs().exists(p) ? fileURL(p, /\.(m?js|jsx?|ts)$/i.test(p)) : null;
    };
    return js
      .replace(/(\bimport\s+(?:[\w*{}\s,$]+\s+from\s+)?|\bexport\s+[\w*{}\s,$]+\s+from\s+)(['"])([^'"\n]+)\2/g, (m, a, q, spec) => { const u = fix(spec); return u ? a + q + u + q : m; })
      .replace(/\bimport\(\s*(['"])([^'"\n]+)\1\s*\)/g, (m, q, spec) => { const u = fix(spec); return u ? 'import(' + q + u + q + ')' : m; });
  }

  function consoleShim(map, baseDir) {
    return '<script>(function(){var P=parent,M=' + JSON.stringify(map) + ',B=' + JSON.stringify(baseDir) + ';' +
      'function S(v){try{if(v instanceof Error)return v.stack||String(v);if(typeof v==="object")return JSON.stringify(v,null,1).slice(0,2000);return String(v)}catch(e){return String(v)}}' +
      '["log","info","warn","error","debug"].forEach(function(l){var o=console[l];console[l]=function(){try{P.postMessage({sk:"console",level:l,text:[].map.call(arguments,S).join(" ")},"*")}catch(e){}o&&o.apply(console,arguments)}});' +
      'addEventListener("error",function(e){P.postMessage({sk:"console",level:"error",text:(e.message||"Erro")+(e.lineno?" (linha "+e.lineno+")":"")},"*")});' +
      'addEventListener("unhandledrejection",function(e){P.postMessage({sk:"console",level:"error",text:"Promise rejeitada: "+S(e.reason)},"*")});' +
      'function R(u){if(typeof u!=="string"||/^(?:[a-z][\\w+.-]*:|\\/\\/)/i.test(u))return u;var p=(u.charAt(0)==="/"?u:(B?B+"/":"")+u).split("?")[0].split("#")[0].split("/"),o=[];p.forEach(function(s){if(!s||s===".")return;if(s==="..")o.pop();else o.push(s)});var k=o.join("/");return M[k]||u}' +
      'var F=window.fetch;window.fetch=function(u,i){return F.call(this,typeof u==="string"?R(u):u,i)};' +
      'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a||e.defaultPrevented||a.target==="_blank")return;var h=a.getAttribute("href");if(!h||h.charAt(0)==="#"||/^(?:[a-z][\\w+.-]*:|\\/\\/)/i.test(h))return;e.preventDefault();var p=(h.charAt(0)==="/"?h:(B?B+"/":"")+h).split("?")[0].split("#")[0].split("/"),o=[];p.forEach(function(s){if(!s||s===".")return;if(s==="..")o.pop();else o.push(s)});P.postMessage({sk:"nav",path:o.join("/")},"*")});' +
      'var X=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=R(u);return X.apply(this,arguments)};' +
      '})();<\/script>';
  }

  function buildHtml(path) {
    const src = fs().read(path) || '';
    const dir = fs().dirName(path);
    const doc = new DOMParser().parseFromString(src, 'text/html');
    const attrFix = (el, attr, asModule) => {
      const v = el.getAttribute(attr); if (isExternal(v)) return;
      const p = resolve(dir, v); if (!fs().exists(p)) return;
      el.setAttribute(attr, fileURL(p, asModule));
    };
    doc.querySelectorAll('script[src]').forEach((s) => attrFix(s, 'src', s.type === 'module'));
    doc.querySelectorAll('script[type="module"]:not([src])').forEach((s) => { s.textContent = rewriteModule(s.textContent, dir); });
    doc.querySelectorAll('link[href]').forEach((l) => attrFix(l, 'href'));
    doc.querySelectorAll('img[src],source[src],video[src],audio[src],iframe[src],embed[src],track[src],input[src]').forEach((e) => attrFix(e, 'src'));
    doc.querySelectorAll('[poster]').forEach((e) => attrFix(e, 'poster'));
    doc.querySelectorAll('img[srcset],source[srcset]').forEach((e) => {
      e.setAttribute('srcset', e.getAttribute('srcset').split(',').map((part) => { const [u, d] = part.trim().split(/\s+/); if (isExternal(u)) return part; const p = resolve(dir, u); return fs().exists(p) ? fileURL(p) + (d ? ' ' + d : '') : part; }).join(', '));
    });
    doc.querySelectorAll('style').forEach((s) => { s.textContent = rewriteCss(s.textContent, dir); });
    doc.querySelectorAll('[style]').forEach((e) => e.setAttribute('style', rewriteCss(e.getAttribute('style'), dir)));
    // mapa para fetch('dados.json') funcionar
    const map = {};
    const all = fs().list();
    all.forEach((f) => {
      const dataLike = /\.(json|txt|csv|md|xml|svg|png|jpe?g|gif|webp|html?|wasm)$/i.test(f);
      if ((all.length > 400 || DATA_MODE) && !dataLike) return;
      const r = fs().get(f); if (r && (r.size || 0) < (DATA_MODE ? 6e5 : 3e6)) { try { map[f] = fileURL(f); } catch {} }
    });
    const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    return html.replace(/<head([^>]*)>/i, (m) => m + consoleShim(map, dir));
  }

  function markdown(md) {
    const esc = SK.esc;
    let h = esc(md)
      .replace(/^```(\w*)\n([\s\S]*?)^```/gm, (m, l, c) => '<pre><code>' + c + '</code></pre>')
      .replace(/^###### (.*)$/gm, '<h6>$1</h6>').replace(/^##### (.*)$/gm, '<h5>$1</h5>').replace(/^#### (.*)$/gm, '<h4>$1</h4>')
      .replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n{2,}/g, '<p></p>');
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:20px auto;padding:0 16px;color:#222}pre{background:#f4f4f4;padding:10px;overflow:auto}code{background:#f4f4f4;padding:1px 4px}</style></head><body>' + h + '</body></html>';
  }

  let lastUrl = '';
  function refresh() {
    if (!panel || !fs().project || size === 'min') return;
    const target = pickTarget();
    fillSelect(target);
    revokeAll(); cache = new Map();
    let html;
    if (!target) html = '<!DOCTYPE html><html><body style="font:14px system-ui;color:#777;padding:16px">Crie ou abra um arquivo .html para ver o preview aqui.</body></html>';
    else if (/\.(md|markdown)$/i.test(target)) html = markdown(fs().read(target) || '');
    else if (/\.svg$/i.test(target)) html = '<!DOCTYPE html><html><body style="margin:0;display:grid;place-items:center;min-height:100vh">' + (fs().read(target) || '') + '</body></html>';
    else if (/\.(m?js|jsx?)$/i.test(target)) html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font:14px system-ui;padding:12px"><p style="color:#777">Rodando ' + SK.esc(target) + ' — veja o console ▤</p><script src="' + SK.esc(target) + '"><\/script></body></html>';
    else html = null;
    try {
      if (html && /\.(m?js|jsx?)$/i.test(target)) { const tmpDir = fs().dirName(target); html = html.replace('src="' + SK.esc(target) + '"', 'src="' + fileURL(target) + '"'); html = html.replace('<head>', '<head>' + consoleShim({}, tmpDir)); }
      if (!html) html = buildHtml(target);
    } catch (e) { html = '<pre style="color:#c00;padding:12px">Erro ao montar o preview: ' + SK.esc(e.message) + '</pre>'; }
    errors = 0; showErr();
    lastUrl = mkPage(html);
    frame.src = lastUrl;
    SK.$('.pv-title', panel).textContent = target ? 'Preview' : 'Preview';
  }
  const refreshSoon = SK.debounce(() => { if (auto) refresh(); }, 650);

  function openTab() {
    if (!lastUrl) refresh();
    const w = window.open(lastUrl, '_blank');
    if (!w) SK.toast('O navegador bloqueou a nova aba', 'error');
  }

  function onMessage(e) {
    const d = e.data;
    if (!d || e.source !== frame.contentWindow) return;
    if (d.sk === 'nav') {
      // link para outra página do projeto: o preview vai para ela
      let p = String(d.path || '').replace(/\/$/, '');
      if (!fs().exists(p) && fs().exists((p ? p + '/' : '') + 'index.html')) p = (p ? p + '/' : '') + 'index.html';
      if (fs().exists(p)) { pinned = p; refresh(); SK.toast('Preview: ' + p); }
      else SK.toast('Página não existe no projeto: ' + d.path, 'error');
      return;
    }
    if (d.sk !== 'console') return;
    const log = SK.$('.pv-log', panel);
    const line = document.createElement('div');
    line.className = 'log-' + d.level;
    line.textContent = d.text;
    log.appendChild(line);
    while (log.childElementCount > 400) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    if (d.level === 'error') { errors++; showErr(); }
  }
  function showErr() {
    const el = SK.$('.pv-err', panel);
    el.hidden = !errors;
    el.textContent = errors + ' erro' + (errors > 1 ? 's' : '');
    el.onclick = () => { consoleEl.hidden = false; };
  }

  SK.on('edit', refreshSoon);
  SK.on('fs-change', (c) => { if (!c.silent) refreshSoon(); });
  SK.on('file-open', (p) => { if (!pinned && auto) refreshSoon(); });
  SK.on('project-open', () => { pinned = ''; setTimeout(refresh, 50); });

  SK.preview = {
    build, refresh,
    show(path) { if (/\.html?$/i.test(path)) pinned = path; if (size === 'min') { size = 'normal'; applySize(); } refresh(); },
    get logText() { return SK.$$('.pv-log div', panel).map((d) => d.textContent).join('\n'); },
  };
})(window.SK);
