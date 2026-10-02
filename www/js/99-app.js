/* =========================================================================
   Mini SK — 99-app.js
   Junta tudo: barra de cima, gavetas (Arquivos à esquerda; IA, Busca,
   Checkpoints, GitHub e Projetos à direita), atalhos de teclado,
   celular x computador e o primeiro projeto de exemplo.
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const SIDES = {
    ai: { title: '🤖 IA', build: (el) => SK.ai.build(el) },
    search: { title: '🔍 Buscar', build: (el) => SK.search.build(el) },
    cp: { title: '📸 Checkpoints', build: (el) => SK.checkpoints.build(el) },
    gh: { title: '🐙 GitHub', build: (el) => SK.github.build(el) },
    pwa: { title: '📱 PWA — ícones, instalar, Hub', build: (el) => SK.pwa.build(el) },
    proj: { title: '🗂 Projetos', build: (el) => buildProjects(el) },
  };
  let side = null;
  const mobile = () => window.matchMedia('(max-width: 820px)').matches;

  // ── Gavetas ─────────────────────────────────────────────────────────────────
  function setTree(open) {
    document.body.classList.toggle('tree-open', open);
    if (!mobile()) SK.pref.set('treeOpen', open);
    if (open && mobile()) closeSide();
    SK.$('#btn-tree').classList.toggle('on', open);
  }
  function openSide(name) {
    if (!SIDES[name]) return;
    side = name;
    document.body.classList.add('side-open');
    SK.$$('#side .side-pane').forEach((p) => (p.hidden = p.dataset.side !== name));
    SK.$('#side-title').textContent = SIDES[name].title;
    SK.$$('[data-open]').forEach((b) => b.classList.toggle('on', b.dataset.open === name));
    if (mobile()) setTree(false);
    SK.pref.set('side', name);
    if (name === 'proj') renderProjects();
    if (name === 'cp') SK.checkpoints.render();
    if (name === 'pwa') SK.$('#side [data-side="pwa"] .seg-b.on')?.click();
  }
  function closeSide() {
    side = null;
    document.body.classList.remove('side-open');
    SK.$$('[data-open]').forEach((b) => b.classList.remove('on'));
    SK.pref.set('side', null);
  }
  function toggleSide(name) { side === name && document.body.classList.contains('side-open') ? closeSide() : openSide(name); }

  // ── Projetos ────────────────────────────────────────────────────────────────
  const STARTER = {
    'index.html': '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Meu projeto</title>\n  <link rel="stylesheet" href="css/estilo.css">\n</head>\n<body>\n  <main>\n    <h1>Olá! 👋</h1>\n    <p>Edite os arquivos na árvore e veja o resultado aqui embaixo, ao vivo.</p>\n    <button id="btn">Clique aqui</button>\n    <p id="saida"></p>\n  </main>\n  <script src="js/app.js"></script>\n</body>\n</html>\n',
    'css/estilo.css': 'body {\n  font-family: system-ui, sans-serif;\n  background: #f6f7fb;\n  color: #1d2433;\n  margin: 0;\n}\nmain {\n  max-width: 640px;\n  margin: 40px auto;\n  padding: 0 16px;\n}\nbutton {\n  padding: 10px 16px;\n  border: 0;\n  border-radius: 8px;\n  background: #3b6cf6;\n  color: #fff;\n  font-size: 16px;\n}\n',
    'js/app.js': "// Cada módulo cuida de uma coisa só.\nconst btn = document.getElementById('btn');\nconst saida = document.getElementById('saida');\nlet cliques = 0;\n\nbtn.addEventListener('click', () => {\n  cliques++;\n  saida.textContent = 'Você clicou ' + cliques + ' vez(es).';\n  console.log('clique', cliques);\n});\n",
    '.sk/diario.md': '# Diário do projeto\n\nO que é este projeto, o que já funciona e o que falta. A IA lê e atualiza este arquivo para não se perder.\n\n## Objetivo\n- \n\n## Já funciona\n- \n\n## Falta fazer\n- \n',
  };
  function starterFiles() {
    const files = {};
    for (const p in STARTER) files[p] = { text: STARTER[p], enc: 'UTF-8', size: new TextEncoder().encode(STARTER[p]).length };
    return files;
  }

  let projBox;
  function buildProjects(el) {
    projBox = el;
    el.innerHTML =
      '<div class="stack">' +
      '<div class="row wrap"><button class="btn primary" id="pj-new">＋ Projeto novo</button><button class="btn" id="pj-blank">＋ Vazio</button><button class="btn" id="pj-zip">🗜 Abrir .zip como projeto</button></div>' +
      '<input type="file" id="pj-zip-in" accept=".zip,application/zip" hidden>' +
      '<div id="pj-list" class="pj-list"></div>' +
      '<hr><h4>Editor</h4>' +
      '<div class="row wrap"><button class="btn small" id="pj-zoom-out">A−</button><button class="btn small" id="pj-zoom-in">A+</button><button class="btn small" id="pj-wrap">↩ Quebra de linha</button><button class="btn small" id="pj-goto">Ir para linha</button></div>' +
      '<hr><h4>Espaço</h4><p class="muted small" id="pj-space">…</p>' +
      '<p class="muted small">Tudo fica guardado <b>neste navegador</b>, neste aparelho. Para levar para outro lugar: baixe o .zip (⤓ na árvore) ou envie ao GitHub. Limpar os dados do navegador apaga os projetos.</p>' +
      '<hr><h4>Atalhos</h4><p class="muted small">Ctrl+S salvar · Ctrl+B arquivos · Ctrl+Shift+F buscar · Ctrl+J IA · Ctrl+G ir para linha · Ctrl+Enter (na IA) enviar · Alt+P preview maior/menor</p>' +
      '</div>';
    const $ = (s) => SK.$(s, el);
    $('#pj-new').onclick = async () => { const n = await SK.prompt('Nome do projeto novo:', 'Projeto ' + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-'), { okText: 'Criar' }); if (n) { await fs().create(n, starterFiles()); SK.editor.open('index.html'); renderProjects(); } };
    $('#pj-blank').onclick = async () => { const n = await SK.prompt('Nome do projeto vazio:', 'Projeto vazio', { okText: 'Criar' }); if (n) { await fs().create(n, {}); renderProjects(); setTree(true); } };
    $('#pj-zip').onclick = () => $('#pj-zip-in').click();
    $('#pj-zip-in').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      await fs().create(f.name.replace(/\.zip$/i, ''), {});
      const r = await fs().importFiles([f], '');
      await fs().saveNow();
      SK.toast(r.count + ' arquivos importados · ' + Object.entries(r.encs).map(([k, v]) => k + ': ' + v).join(', '));
      e.target.value = ''; renderProjects(); setTree(true);
    };
    $('#pj-list').onclick = async (e) => {
      const b = e.target.closest('[data-pj]'); if (!b) return;
      const name = b.closest('[data-name]').dataset.name;
      const act = b.dataset.pj;
      if (act === 'open') { await fs().open(name); renderProjects(); if (mobile()) closeSide(); }
      if (act === 'rename') { if (name !== fs().project.name) await fs().open(name); const n = await SK.prompt('Novo nome do projeto:', name, { okText: 'Renomear' }); if (n) await fs().renameProject(n); renderProjects(); }
      if (act === 'del') {
        if (!(await SK.confirm('Apagar o projeto "' + name + '" e todos os checkpoints dele? Isso não tem volta. (Baixe o .zip antes se tiver dúvida.)', { danger: true, okText: 'Apagar para sempre' }))) return;
        const wasOpen = fs().project && fs().project.name === name;
        await fs().deleteProject(name);
        if (wasOpen) { const rest = await fs().listProjects(); rest.length ? await fs().open(rest[0].name) : await fs().create('Meu projeto', starterFiles()); }
        renderProjects();
      }
    };
    $('#pj-zoom-out').onclick = () => SK.editor.zoom(-1);
    $('#pj-zoom-in').onclick = () => SK.editor.zoom(1);
    $('#pj-wrap').onclick = () => SK.editor.toggleWrap();
    $('#pj-goto').onclick = () => SK.editor.goToLine();
    renderProjects();
  }
  async function renderProjects() {
    if (!projBox) return;
    const all = await fs().listProjects();
    const cur = fs().project && fs().project.name;
    SK.$('#pj-list', projBox).innerHTML = all.map((p) =>
      '<div class="pj' + (p.name === cur ? ' on' : '') + '" data-name="' + SK.esc(p.name) + '">' +
      '<div><b>' + SK.esc(p.name) + '</b>' + (p.name === cur ? ' <span class="pill">aberto</span>' : '') + '<div class="muted small">' + p.files + ' arquivos · ' + (p.updated ? new Date(p.updated).toLocaleString('pt-BR') : '') + '</div></div>' +
      '<div class="row tight">' + (p.name === cur ? '' : '<button class="btn tiny primary" data-pj="open">Abrir</button>') +
      '<button class="btn tiny" data-pj="rename">Renomear</button><button class="btn tiny danger" data-pj="del">Apagar</button></div></div>').join('') || '<p class="muted">Nenhum projeto.</p>';
    const est = await SK.storageInfo();
    if (est && est.quota) SK.$('#pj-space', projBox).textContent = 'Usando ' + SK.bytes(est.usage || 0) + ' de ' + SK.bytes(est.quota) + ' disponíveis neste navegador.';
  }

  // ── Indicador de salvo ──────────────────────────────────────────────────────
  let saveState;
  function setSave(state) {
    const el = SK.$('#save-ind'); if (!el) return;
    saveState = state;
    el.textContent = state === 'dirty' ? '● salvando' : '✓ salvo';
    el.classList.toggle('dirty', state === 'dirty');
  }

  // ── Atalhos ─────────────────────────────────────────────────────────────────
  function keys(e) {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); fs().saveNow().then(() => SK.toast('✓ Salvo neste navegador')); return; }
    if (mod && k === 'b') { e.preventDefault(); setTree(!document.body.classList.contains('tree-open')); return; }
    if (mod && e.shiftKey && k === 'f') { e.preventDefault(); openSide('search'); SK.search.focus(SK.editor.selection()); return; }
    if (mod && k === 'j') { e.preventDefault(); toggleSide('ai'); return; }
    if (e.altKey && k === 'p') { e.preventDefault(); SK.$('[data-p="max"]').click(); return; }
    if (k === 'escape' && !SK.$('.modal-wrap') && !SK.$('.popup')) { if (mobile() && document.body.classList.contains('side-open')) closeSide(); else if (mobile() && document.body.classList.contains('tree-open')) setTree(false); }
  }

  // ── Início ──────────────────────────────────────────────────────────────────
  async function init() {
    // Monta os painéis da direita
    const sideBody = SK.$('#side-body');
    for (const name in SIDES) {
      const pane = document.createElement('div');
      pane.className = 'side-pane'; pane.dataset.side = name; pane.hidden = true;
      sideBody.appendChild(pane);
      try { SIDES[name].build(pane); } catch (e) { pane.innerHTML = '<p class="msg error">Erro ao montar este painel: ' + SK.esc(e.message) + '</p>'; console.error(e); }
    }
    SK.editor.build(); SK.tree.build(); SK.preview.build();

    SK.$('#btn-tree').onclick = () => setTree(!document.body.classList.contains('tree-open'));
    SK.$('#side-close').onclick = closeSide;
    SK.$('#backdrop').onclick = () => { closeSide(); setTree(false); };
    SK.$$('[data-open]').forEach((b) => (b.onclick = () => toggleSide(b.dataset.open)));
    SK.$('#proj-name').onclick = () => openSide('proj');
    document.addEventListener('keydown', keys);

    SK.on('project-open', (P) => { SK.$('#proj-name').textContent = P.name; document.title = P.name + ' · Mini SK'; renderProjects(); });
    SK.on('fs-change', () => setSave('dirty'));
    SK.on('saved', () => setSave('ok'));
    SK.on('tree-picked', () => { if (mobile()) setTree(false); });
    SK.on('picked-result', () => { if (mobile()) closeSide(); });
    window.addEventListener('beforeunload', () => { fs().saveNow(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') fs().saveNow(); });

    // Abre o último projeto (ou cria o de exemplo)
    SK.persistStorage();
    let list = [];
    try { list = await fs().listProjects(); } catch (e) { SK.toast('O navegador bloqueou o armazenamento (modo anônimo?). Os projetos não serão guardados.', 'error'); }
    const last = SK.pref.get('lastProject', null);
    if (last && list.some((p) => p.name === last)) await fs().open(last);
    else if (list.length) await fs().open(list[0].name);
    else { await fs().create('Meu primeiro projeto', starterFiles()); SK.editor.open('index.html', { noFocus: true }); }

    setTree(mobile() ? false : SK.pref.get('treeOpen', true));
    const s = SK.pref.get('side', null);
    if (s && !mobile()) openSide(s);
    setSave('ok');
    document.body.classList.add('ready');
  }

  SK.app = { openSide, closeSide, toggleSide, setTree, starterFiles };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.SK);
