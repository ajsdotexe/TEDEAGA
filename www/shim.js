/* Camada do desktop: IA do mascote (API da Anthropic), download de backup,
   conta Google (login, sincronização e backup no Drive) e widgets da área de trabalho. */
(function () {
  const D = window.desktop;

  /* ---------- IA ---------- */
  async function sample(prompt, o = {}) {
    const defs = o.tools || [];
    const tools = defs.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: 'object', properties: {} } }));
    const msgs = [{ role: 'user', content: prompt }];
    let text = '';
    for (let i = 0; i < 6; i++) {
      const r = await D.ai({ max_tokens: 4096, messages: msgs, ...(tools.length ? { tools } : {}) });
      if (r.error) throw { code: r.error === 'rate' ? 'rate_limited' : r.error, message: r.message };
      const c = r.data.content || [];
      const t = c.filter(b => b.type === 'text').map(b => b.text).join('');
      if (t) { text = t; o.onText && o.onText({ text }); }
      if (r.data.stop_reason !== 'tool_use') break;
      msgs.push({ role: 'assistant', content: c });
      const res = [];
      for (const b of c.filter(b => b.type === 'tool_use')) {
        const tl = defs.find(x => x.name === b.name);
        let out;
        try { out = tl ? await tl.execute(b.input) : 'Ferramenta desconhecida'; } catch (e) { out = 'Erro: ' + e.message; }
        res.push({ type: 'tool_result', tool_use_id: b.id, content: String(out) });
      }
      msgs.push({ role: 'user', content: res });
    }
    return { text };
  }
  window.claude = {
    use: async name => {
      if (name === 'downloads') return { save: async ({ filename, data }) => window.mobileSave(filename, data) };
      if (name === 'user') return { me: async () => ({ name: await D.userName(), email: '' }) };
      if (name === 'sample') return sample;
      return null; // 'db' (colaboração em tempo real) existe só na versão web
    }
  };
  window.keyCard = () => `<div class="glass card"><h2>🔑 Chave da IA (mascote)</h2>
    <div class="mu" style="margin-bottom:8px">O mascote usa a API da Anthropic. Cole sua chave (console.anthropic.com); ela fica criptografada neste aparelho. ${window.__hasKey ? '✅ Chave configurada.' : 'Nenhuma chave configurada.'}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="apikey" type="password" placeholder="sk-ant-…" autocomplete="off"><button class="pri" data-a="savekey">Salvar</button></div>
    <div style="display:flex;gap:8px;margin-top:8px"><input id="aimodel" placeholder="Modelo (padrão: claude-sonnet-5-5)" value="${esc(window.__model || '')}"><button class="pri" data-a="savemodel">OK</button></div></div>`;

  /* ---------- Conta Google ---------- */
  const GM = 'tedeaga-g';
  const gm = () => { try { return JSON.parse(localStorage.getItem(GM) || '{}'); } catch (e) { return {}; } };
  const gms = o => { try { localStorage.setItem(GM, JSON.stringify({ ...gm(), ...o })); } catch (e) {} };
  const G = { st: { configured: false, signed: false }, busy: '', msg: '', backups: [] };
  const slim = () => { const s = JSON.parse(JSON.stringify(S)); const p = s.prefs || {}; delete p.wall; delete p.lib; delete p.sndFile; return s; };
  async function gStatus() {
    const s = await D.gStatus(); G.st = s && !s.error ? s : G.st;
    if (G.st.signed && G.st.name) { me.name = G.st.name; me.email = G.st.email || ''; }
  }
  function applyRemote(d) {
    const loc = S.prefs || {}, keep = { wall: loc.wall, lib: loc.lib, sndFile: loc.sndFile, sndName: loc.sndName };
    const n = Object.assign(structuredClone(DEF), d);
    n.prefs = Object.assign({}, d.prefs, keep);
    Object.keys(keep).forEach(k => { if (keep[k] === undefined) delete n.prefs[k]; });
    S = n;
    try { localStorage.setItem('tempo-v1', JSON.stringify(S)); } catch (e) {}
    applyTheme(); render();
  }
  async function pushRaw() {
    const at = Date.now();
    const r = await D.gPush(JSON.stringify({ _at: at, data: slim() }));
    if (r && r.error) throw new Error(r.error);
    gms({ lastSync: at });
  }
  async function gSync(manual) {
    if (!G.st.signed || G.busy) return;
    try {
      G.busy = 'Sincronizando…'; render();
      const r = await D.gPull(); if (r.error) throw new Error(r.error);
      let applied = false; const m = gm(), dirty = (m.at || 0) > (m.lastSync || 0);
      if (r.data) {
        const o = JSON.parse(r.data), rnew = o._at > (m.lastSync || 0);
        if (rnew && (!dirty || confirm('Há alterações neste aparelho e também na nuvem.\n\nOK = usar a versão da nuvem (descarta o que mudou aqui)\nCancelar = manter este computador e enviar para a nuvem'))) {
          applyRemote(o.data); gms({ lastSync: o._at, at: o._at }); applied = true;
        }
      }
      if (!applied && (dirty || !r.data || manual)) await pushRaw();
      G.msg = (applied ? 'Atualizado com a nuvem' : 'Enviado para a nuvem') + ' às ' + hmNow();
    } catch (e) { G.msg = 'Erro: ' + e.message; }
    G.busy = ''; render();
  }
  async function gBackupNow(silent) {
    if (!G.st.signed) return;
    try {
      if (!silent) { G.busy = 'Fazendo backup…'; render(); }
      const r = await D.gBackup(JSON.stringify({ _at: Date.now(), data: S }), today());
      if (r && r.error) throw new Error(r.error);
      gms({ lastBackup: today() }); G.msg = 'Backup salvo às ' + hmNow();
    } catch (e) { G.msg = 'Erro no backup: ' + e.message; }
    G.busy = ''; render();
  }
  async function gLoadList() {
    const r = await D.gList(); if (r.error) { G.msg = 'Erro: ' + r.error; } else { G.backups = r; G.msg = r.length ? '' : 'Nenhum backup ainda'; }
    render();
  }
  let tmr;
  function schedule() { if (!G.st.signed || gm().auto === false) return; clearTimeout(tmr); tmr = setTimeout(() => gSync(false), 25000); }
  window.googleCard = () => {
    const s = G.st, m = gm(), top = '<div class="glass card"><h2>🔐 Conta Google</h2>';
    if (!s.configured) return top + `<div class="mu" style="margin-bottom:8px">Para entrar com o Google, crie uma credencial gratuita do tipo Android (passo a passo no arquivo GOOGLE-ANDROID.md) e cole o Client ID abaixo. Isso é feito uma única vez.</div><div style="display:flex;flex-direction:column;gap:8px"><input id="gcid" placeholder="Client ID do tipo Android (…apps.googleusercontent.com)" autocomplete="off"><button class="pri" data-a="gsave">Salvar credenciais</button></div></div>`;
    if (!s.signed) return top + `<div class="mu" style="margin-bottom:8px">Entre com sua conta Google (se ainda não tiver uma, crie em accounts.google.com) para sincronizar e guardar backups automáticos.</div><div class="seg"><button class="pri" data-a="glogin">${esc(G.busy || 'Entrar com o Google')}</button><button data-a="gcfgx">Trocar credenciais</button></div>${G.msg ? `<div class="mu">${esc(G.msg)}</div>` : ''}</div>`;
    return top + `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">${s.picture ? `<img src="${esc(s.picture)}" referrerpolicy="no-referrer" style="width:40px;height:40px;border-radius:50%">` : ''}<div class="g"><div class="t">${esc(s.name || '')}</div><div class="mu">${esc(s.email || '')}</div></div></div>
     <div class="seg"><button class="pri" data-a="gsync">🔄 Sincronizar agora</button><button data-a="gbk">☁️ Backup agora</button><button data-a="glogout">Sair</button></div>
     <div class="row"><div class="g t">Sincronização automática</div><input type="checkbox" data-g="auto" ${m.auto !== false ? 'checked' : ''} style="flex:none"></div>
     <div class="row"><div class="g t">Backup diário automático (guarda os últimos 7)</div><input type="checkbox" data-g="daily" ${m.daily !== false ? 'checked' : ''} style="flex:none"></div>
     <div class="row"><div class="g t">Restaurar backup</div><select id="gbsel"><option value="">${G.backups.length ? 'Escolha…' : 'Toque em ⟳'}</option>${G.backups.map(b => `<option value="${b.id}">${esc(b.name.replace('tedeaga-backup-', '').replace('.json', ''))}</option>`).join('')}</select><button class="x" data-a="gbl" title="Carregar lista">⟳</button><button class="pri" data-a="gbr">Restaurar</button></div>
     <div class="mu">${esc(G.busy || G.msg || '')}${m.lastSync ? ' · última sincronização: ' + new Date(m.lastSync).toLocaleString('pt-BR') : ''}${m.lastBackup ? ' · último backup: ' + m.lastBackup : ''}</div>
     <div class="mu">Papel de parede e áudios próprios não entram na sincronização (só no backup) para ela ser rápida.</div></div>`;
  };

  /* ---------- eventos ---------- */
  window.__sync = { applyRemote, slim, gms, gm, G };
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'savekey') { window.__hasKey = await D.setKey($('#apikey').value); toast(window.__hasKey ? 'Chave salva' : 'Chave removida'); render(); }
    else if (a === 'savemodel') { await D.setModel($('#aimodel').value); window.__model = $('#aimodel').value.trim(); toast('Modelo salvo'); }
    else if (a === 'gsave') { const id = $('#gcid').value.trim(); if (!id) { toast('Preencha o Client ID'); return; } await D.gSetConfig(id, ''); await gStatus(); render(); }
    else if (a === 'gcfgx') { await D.gClearConfig(); await gStatus(); render(); }
    else if (a === 'glogin') { G.busy = 'Abrindo o navegador…'; render(); const r = await D.gLogin(); G.busy = ''; if (r && r.error) G.msg = 'Erro: ' + r.error; else { G.msg = ''; await gStatus(); await gSync(true); await gBackupNow(true); } render(); }
    else if (a === 'glogout') { if (confirm('Sair da conta Google? Os dados continuam neste aparelho e na nuvem.')) { await D.gLogout(); G.backups = []; await gStatus(); render(); } }
    else if (a === 'gsync') gSync(true);
    else if (a === 'gbk') gBackupNow(false);
    else if (a === 'gbl') gLoadList();
    else if (a === 'gbr') {
      const id = $('#gbsel').value; if (!id) { toast('Escolha um backup'); return; }
      if (!confirm('Restaurar este backup? Os dados atuais serão substituídos.')) return;
      const r = await D.gGet(id); if (r.error) { toast('Erro: ' + r.error); return; }
      try { const o = JSON.parse(r.data); S = Object.assign(structuredClone(DEF), o.data || o); save(); toast('Backup restaurado'); } catch (err) { toast('Arquivo de backup inválido'); }
    }
  });
  document.addEventListener('change', async e => {
    const t = e.target; if (!t.dataset || !t.dataset.g) return;
    gms({ [t.dataset.g]: t.checked }); if (t.dataset.g === 'auto' && t.checked) schedule();
  });
  // widgets da área de trabalho alteram os mesmos dados: recarrega quando mudarem
  addEventListener('storage', e => {
    if (e.key === 'tempo-v1' && e.newValue) { try { S = Object.assign(structuredClone(DEF), JSON.parse(e.newValue)); applyTheme(); render(); } catch (err) {} }
  });

  /* ---------- inicialização (depois que o app carregou) ---------- */
  addEventListener('load', async () => {
    window.__hasKey = await D.hasKey(); window.__model = await D.getModel();
    const orig = window.save;
    window.save = function () { orig.apply(this, arguments); gms({ at: Date.now() }); schedule(); };
    await gStatus(); render();
    if (G.st.signed) {
      if (gm().auto !== false) gSync(false);
      if (gm().daily !== false && gm().lastBackup !== today()) gBackupNow(true);
      setInterval(() => { if (G.st.signed && gm().daily !== false && gm().lastBackup !== today()) gBackupNow(true); }, 3 * 3600 * 1000);
    }
  });
})();
