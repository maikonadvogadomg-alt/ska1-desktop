/* =========================================================================
   Mini SK — 90-github.js
   Repositório no GitHub, direto do navegador (sem servidor, sem Replit):
   - Cole seu token (github.com/settings/tokens — "Fine-grained", com acesso
     "Contents: Read and write" nos repositórios; para criar repositório
     novo, "Administration: Read and write").
   - Importar um repositório (seu ou público) para um projeto.
   - Enviar (commit + push) o projeto para um repositório. Só os arquivos
     que mudaram são enviados.
   - Criar repositório novo e ligar o GitHub Pages (site grátis).
   ========================================================================= */
(function (SK) {
  'use strict';
  const fs = () => SK.fs;
  const API = 'https://api.github.com';
  let box, token = SK.pref.get('ghToken', ''), me = null, repos = [];

  // ── Chamada à API ───────────────────────────────────────────────────────────
  async function gh(path, opts) {
    opts = opts || {};
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.body) headers['Content-Type'] = 'application/json';
    let r;
    try { r = await fetch(path.startsWith('http') ? path : API + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined }); }
    catch (e) { throw new Error('Sem conexão com o GitHub (' + e.message + ')'); }
    if (r.status === 204) return null;
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(explain(r.status, data, path));
      err.status = r.status; err.data = data; throw err;
    }
    return data;
  }
  function explain(status, data, path) {
    const m = (data && data.message) || '';
    if (status === 401) return 'Token inválido ou vencido. Gere outro em github.com/settings/tokens.';
    if (status === 403 && /rate limit/i.test(m)) return 'Limite de uso do GitHub atingido. Com token o limite é bem maior; sem token, espere uma hora.';
    if (status === 403) return 'O token não tem permissão para isso (' + m + '). Dê "Contents: Read and write" ao token.';
    if (status === 404) return 'Não encontrado: o repositório não existe ou o token não tem acesso a ele.';
    if (status === 409 && /empty/i.test(m)) return 'EMPTY';
    if (status === 422) return 'O GitHub recusou: ' + m + (data.errors ? ' — ' + data.errors.map((e) => e.message || e.code).join(', ') : '');
    return 'GitHub ' + status + ': ' + (m || path);
  }

  // ── Utilidades ──────────────────────────────────────────────────────────────
  async function pool(items, n, fn, onProgress) {
    let i = 0, done = 0; const out = new Array(items.length);
    const worker = async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); done++; onProgress && onProgress(done, items.length); } };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
    return out;
  }
  /** SHA-1 do jeito do git, para saber o que já está igual no GitHub. */
  async function gitSha(bytes) {
    if (!(window.crypto && crypto.subtle)) return null;
    const head = new TextEncoder().encode('blob ' + bytes.length + '\0');
    const all = new Uint8Array(head.length + bytes.length); all.set(head); all.set(bytes, head.length);
    const h = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
    return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function parseRepo(s) {
    s = String(s || '').trim().replace(/\.git$/, '');
    const m = s.match(/github\.com[/:]([^/]+)\/([^/#?]+)/) || s.match(/^([^/\s]+)\/([^/\s]+)$/);
    return m ? { owner: m[1], repo: m[2] } : null;
  }
  const linkKey = () => 'ghLink:' + (fs().project ? fs().project.name : '');
  const getLink = () => SK.pref.get(linkKey(), null);
  const setLink = (l) => SK.pref.set(linkKey(), l);
  function status(msg, kind) { const el = box && SK.$('#gh-status', box); if (el) { el.textContent = msg; el.className = 'gh-status ' + (kind || ''); } }

  // ── Importar ────────────────────────────────────────────────────────────────
  async function importRepo(owner, repo, branch, intoCurrent) {
    status('Lendo ' + owner + '/' + repo + '…');
    const info = await gh('/repos/' + owner + '/' + repo);
    branch = branch || info.default_branch;
    let tree;
    try { tree = await gh('/repos/' + owner + '/' + repo + '/git/trees/' + encodeURIComponent(branch) + '?recursive=1'); }
    catch (e) { if (e.message === 'EMPTY' || e.status === 409) throw new Error('Este repositório está vazio. Use "Enviar" para colocar o projeto nele.'); throw e; }
    const blobs = tree.tree.filter((t) => t.type === 'blob' && !/(^|\/)(node_modules|\.git)\//.test(t.path));
    if (blobs.length > 3000 && !(await SK.confirm('O repositório tem ' + blobs.length + ' arquivos. Importar mesmo assim? Pode demorar.', { okText: 'Importar' }))) return;
    if (tree.truncated) SK.toast('Repositório muito grande: o GitHub mandou só parte da lista', 'error');
    const files = {};
    await pool(blobs, 8, async (b) => {
      const d = await gh('/repos/' + owner + '/' + repo + '/git/blobs/' + b.sha);
      const bytes = fs().fromBase64((d.content || '').replace(/\n/g, ''));
      files[b.path] = fs().recordFromBytes(b.path, bytes);
    }, (n, t) => status('Baixando arquivos ' + n + '/' + t + '…'));
    if (intoCurrent && fs().project) {
      await SK.checkpoints.auto('Antes de puxar do GitHub ' + owner + '/' + repo);
      fs().restore({ files, folders: [] });
    } else {
      await fs().create(repo, files);
    }
    setLink({ owner, repo, branch });
    await fs().saveNow();
    status('✅ ' + blobs.length + ' arquivos importados de ' + owner + '/' + repo + ' (' + branch + ')', 'ok');
    renderLink();
  }

  // ── Enviar (commit + push) ──────────────────────────────────────────────────
  async function push(owner, repo, branch, message, opts) {
    opts = opts || {};
    if (!token) throw new Error('Cole o token primeiro.');
    status('Preparando envio…');
    const info = await gh('/repos/' + owner + '/' + repo);
    branch = branch || info.default_branch || 'main';
    let headSha = null, baseTree = null, remote = {};
    try {
      const ref = await gh('/repos/' + owner + '/' + repo + '/git/ref/heads/' + encodeURIComponent(branch));
      headSha = ref.object.sha;
      const commit = await gh('/repos/' + owner + '/' + repo + '/git/commits/' + headSha);
      baseTree = commit.tree.sha;
      const t = await gh('/repos/' + owner + '/' + repo + '/git/trees/' + baseTree + '?recursive=1');
      t.tree.forEach((x) => { if (x.type === 'blob') remote[x.path] = x.sha; });
    } catch (e) {
      if (e.status === 404 || e.status === 409 || e.message === 'EMPTY') {
        // Repositório vazio (ou ramo novo): o primeiro arquivo vai pela API de conteúdo.
        const isEmpty = e.message === 'EMPTY' || e.status === 409 || info.size === 0;
        if (isEmpty) {
          status('Repositório vazio: criando o primeiro commit…');
          await gh('/repos/' + owner + '/' + repo + '/contents/.gitkeep', { method: 'PUT', body: { message: 'Início', content: '', branch } });
          return push(owner, repo, branch, message, Object.assign({}, opts, { dropKeep: true }));
        }
        // ramo não existe: cria a partir do ramo principal
        const base = await gh('/repos/' + owner + '/' + repo + '/git/ref/heads/' + encodeURIComponent(info.default_branch));
        await gh('/repos/' + owner + '/' + repo + '/git/refs', { method: 'POST', body: { ref: 'refs/heads/' + branch, sha: base.object.sha } });
        return push(owner, repo, branch, message, opts);
      }
      throw e;
    }
    const paths = fs().list().filter((p) => opts.includeSk !== false || !p.startsWith('.sk/'));
    const entries = [];
    let up = 0, same = 0;
    await pool(paths, 6, async (p) => {
      const bytes = fs().bytesOf(p);
      const sha = await gitSha(bytes);
      if (sha && remote[p] === sha) { same++; entries.push({ path: p, mode: '100644', type: 'blob', sha }); return; }
      const rec = fs().get(p);
      const blob = rec.b64 != null
        ? await gh('/repos/' + owner + '/' + repo + '/git/blobs', { method: 'POST', body: { content: rec.b64, encoding: 'base64' } })
        : await gh('/repos/' + owner + '/' + repo + '/git/blobs', { method: 'POST', body: { content: rec.text, encoding: 'utf-8' } });
      up++;
      entries.push({ path: p, mode: /\.(sh|command)$/.test(p) ? '100755' : '100644', type: 'blob', sha: blob.sha });
    }, (n, t) => status('Enviando ' + n + '/' + t + '…'));
    const removed = Object.keys(remote).filter((p) => !paths.includes(p) && !(opts.dropKeep && p === '.gitkeep'));
    const keepRemote = opts.mirror === false ? removed.filter((p) => !(opts.dropKeep && p === '.gitkeep')) : [];
    keepRemote.forEach((p) => entries.push({ path: p, mode: '100644', type: 'blob', sha: remote[p] }));
    if (!up && !(opts.mirror !== false && removed.length)) { status('Nada mudou: o GitHub já está igual ao projeto.', 'ok'); return { up, same, removed: 0 }; }
    // Sem base_tree: a árvore enviada é o projeto inteiro (arquivos apagados aqui somem lá).
    const newTree = await gh('/repos/' + owner + '/' + repo + '/git/trees', { method: 'POST', body: { tree: entries } });
    const commit = await gh('/repos/' + owner + '/' + repo + '/git/commits', { method: 'POST', body: { message: message || 'Atualização pelo Mini SK', tree: newTree.sha, parents: headSha ? [headSha] : [] } });
    await gh('/repos/' + owner + '/' + repo + '/git/refs/heads/' + encodeURIComponent(branch), { method: 'PATCH', body: { sha: commit.sha, force: false } });
    setLink({ owner, repo, branch });
    const rem = opts.mirror === false ? 0 : removed.length;
    status('✅ Enviado: ' + up + ' arquivo(s) novos/alterados, ' + same + ' iguais' + (rem ? ', ' + rem + ' apagado(s) no GitHub' : '') + '.', 'ok');
    renderLink();
    return { up, same, removed: rem, commit: commit.html_url };
  }

  async function createRepo(name, priv) {
    const r = await gh('/user/repos', { method: 'POST', body: { name, private: !!priv, auto_init: false, description: 'Criado pelo Mini SK' } });
    return { owner: r.owner.login, repo: r.name, branch: r.default_branch || 'main' };
  }
  async function enablePages(owner, repo, branch) {
    try { await gh('/repos/' + owner + '/' + repo + '/pages', { method: 'POST', body: { source: { branch, path: '/' } } }); }
    catch (e) { if (!(e.status === 409 || /already/i.test(e.message))) throw e; }
    return 'https://' + owner.toLowerCase() + '.github.io/' + repo + '/';
  }

  // ── Painel ──────────────────────────────────────────────────────────────────
  function build(container) {
    box = container;
    box.innerHTML =
      '<div class="stack">' +
      '<details class="gh-tokbox"' + (token ? '' : ' open') + '><summary><b>🔑 Token do GitHub</b> <span class="muted small" id="gh-me">' + (token ? 'salvo neste aparelho' : 'não colado') + '</span></summary>' +
      '<p class="muted small">Crie em <b>github.com/settings/tokens</b> → "Fine-grained token" → escolha os repositórios → Permissões: <b>Contents: Read and write</b> (e <b>Administration</b> se quiser criar repositórios por aqui). Fica salvo só neste navegador. Para importar repositório público, nem precisa.</p>' +
      '<div class="row"><input class="inp mono grow" id="gh-token" type="password" placeholder="github_pat_… ou ghp_…" autocomplete="off" value="' + SK.esc(token) + '"><button class="btn small" id="gh-check">Verificar</button></div></details>' +
      '<div class="gh-link" id="gh-link"></div>' +
      '<div class="row"><input class="inp mono grow" id="gh-repo" list="gh-repos" placeholder="dono/repositório ou link do GitHub" autocomplete="off"><datalist id="gh-repos"></datalist><button class="btn small" id="gh-list" title="Listar meus repositórios">📋</button></div>' +
      '<div class="row"><input class="inp mono grow" id="gh-branch" placeholder="ramo (vazio = principal)" autocomplete="off"></div>' +
      '<div class="row wrap"><button class="btn primary" id="gh-import">⤓ Importar como projeto novo</button><button class="btn" id="gh-pull">⟲ Puxar para este projeto</button></div>' +
      '<hr>' +
      '<textarea class="inp" id="gh-msg" rows="2" placeholder="O que mudou? (mensagem do commit)"></textarea>' +
      '<label class="chk"><input type="checkbox" id="gh-mirror" checked> Apagar no GitHub o que foi apagado aqui</label>' +
      '<label class="chk"><input type="checkbox" id="gh-sk" checked> Enviar também a pasta .sk (memória da IA)</label>' +
      '<div class="row wrap"><button class="btn primary" id="gh-push">⤒ Enviar para o GitHub</button></div>' +
      '<hr>' +
      '<div class="row wrap"><input class="inp grow" id="gh-new" placeholder="nome-do-repositorio-novo" autocomplete="off"><label class="chk"><input type="checkbox" id="gh-priv" checked> Privado</label><button class="btn small" id="gh-create">Criar e enviar</button></div>' +
      '<div class="row wrap"><button class="btn small" id="gh-pages">🌐 Publicar site grátis (GitHub Pages)</button></div>' +
      '<div class="gh-status" id="gh-status"></div>' +
      '</div>';
    const $ = (s) => SK.$(s, box);
    $('#gh-token').addEventListener('change', (e) => { token = e.target.value.trim(); SK.pref.set('ghToken', token); me = null; $('#gh-me').textContent = token ? 'salvo neste aparelho' : 'não colado'; });
    $('#gh-check').onclick = () => run(async () => { token = $('#gh-token').value.trim(); SK.pref.set('ghToken', token); me = await gh('/user'); $('#gh-me').textContent = '✅ ' + me.login; status('Token ok: conectado como ' + me.login, 'ok'); });
    $('#gh-list').onclick = () => run(async () => {
      status('Buscando seus repositórios…');
      repos = await gh('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator');
      $('#gh-repos').innerHTML = repos.map((r) => '<option value="' + SK.esc(r.full_name) + '">' + (r.private ? '🔒 ' : '') + SK.esc(r.description || '') + '</option>').join('');
      status(repos.length + ' repositórios. Toque no campo para escolher.', 'ok');
      $('#gh-repo').focus();
    });
    const target = () => { const r = parseRepo($('#gh-repo').value); if (!r) throw new Error('Escreva o repositório assim: dono/nome (ou cole o link).'); return r; };
    $('#gh-import').onclick = () => run(async () => { const r = target(); await importRepo(r.owner, r.repo, $('#gh-branch').value.trim(), false); });
    $('#gh-pull').onclick = () => run(async () => {
      const r = target();
      if (!(await SK.confirm('Substituir os arquivos deste projeto pelos de ' + r.owner + '/' + r.repo + '? Um checkpoint é criado antes.', { okText: 'Puxar' }))) return;
      await importRepo(r.owner, r.repo, $('#gh-branch').value.trim(), true);
    });
    $('#gh-push').onclick = () => run(async () => {
      const r = target();
      const res = await push(r.owner, r.repo, $('#gh-branch').value.trim(), $('#gh-msg').value.trim(), { mirror: $('#gh-mirror').checked, includeSk: $('#gh-sk').checked });
      if (res && res.up) $('#gh-msg').value = '';
    });
    $('#gh-create').onclick = () => run(async () => {
      const name = $('#gh-new').value.trim().replace(/\s+/g, '-');
      if (!name) throw new Error('Escreva o nome do repositório novo.');
      status('Criando repositório…');
      const r = await createRepo(name, $('#gh-priv').checked);
      $('#gh-repo').value = r.owner + '/' + r.repo; $('#gh-branch').value = '';
      await push(r.owner, r.repo, r.branch, $('#gh-msg').value.trim() || 'Primeiro envio pelo Mini SK', { mirror: true, includeSk: $('#gh-sk').checked });
    });
    $('#gh-pages').onclick = () => run(async () => {
      const r = target();
      const info = await gh('/repos/' + r.owner + '/' + r.repo);
      if (info.private) SK.toast('Atenção: no plano grátis, o Pages só funciona em repositório público', 'error');
      const url = await enablePages(r.owner, r.repo, $('#gh-branch').value.trim() || info.default_branch);
      status('🌐 Site pedido. Em 1–2 minutos estará em: ' + url, 'ok');
    });
    renderLink();
  }
  async function run(fn) {
    const btns = SK.$$('button', box); btns.forEach((b) => (b.disabled = true));
    try { await fn(); } catch (e) { status('⚠ ' + (e.message === 'EMPTY' ? 'Repositório vazio.' : e.message), 'error'); }
    finally { btns.forEach((b) => (b.disabled = false)); }
  }
  function renderLink() {
    if (!box) return;
    const l = getLink(); const el = SK.$('#gh-link', box);
    if (l) {
      el.innerHTML = '<span class="muted small">Este projeto está ligado a</span> <b>' + SK.esc(l.owner + '/' + l.repo) + '</b> <span class="muted small">(' + SK.esc(l.branch || '') + ')</span>';
      SK.$('#gh-repo', box).value = l.owner + '/' + l.repo; SK.$('#gh-branch', box).value = l.branch || '';
    } else el.innerHTML = '<span class="muted small">Este projeto ainda não está ligado a um repositório.</span>';
  }
  SK.on('project-open', () => { if (box) { SK.$('#gh-repo', box).value = ''; SK.$('#gh-branch', box).value = ''; renderLink(); } });

  SK.github = { build, gh, importRepo, push, createRepo, enablePages, parseRepo };
})(window.SK);
