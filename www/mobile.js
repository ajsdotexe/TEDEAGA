/* Camada Android do TEDEAGA (Capacitor).
   Oferece ao app o mesmo "window.desktop" da versão Windows, mais: alarmes nativos
   (notificações agendadas), widgets da tela inicial, botão voltar, arrastar o mascote e sacudir o celular. */
(function () {
  const Cap = window.Capacitor;
  const pl = n => { try { return Cap.Plugins[n] || Cap.registerPlugin(n); } catch (e) { return null; } };
  const Pref = pl('Preferences'), Br = pl('Browser'), AppP = pl('App'), LN = pl('LocalNotifications'),
    Share = pl('Share'), FS = pl('Filesystem'), SB = pl('StatusBar'), WB = pl('WidgetBridge');
  const pget = async k => { try { return (await Pref.get({ key: k })).value; } catch (e) { return null; } };
  const pset = (k, v) => Pref.set({ key: k, value: String(v) });
  const prm = k => Pref.remove({ key: k });
  const pj = async (k, d) => { try { const v = await pget(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const wrap = fn => async (...a) => { try { return await fn(...a); } catch (e) { return { error: String((e && e.message) || e) }; } };

  /* ---------- IA (chave da Anthropic) ---------- */
  const D = {
    userName: async () => '',
    getLogin: async () => false, setLogin: async () => false,
    wState: async () => ({ open: [], top: {} }), wOpen: async () => true, wClose: async () => true, wPin: async () => true,
    hasKey: async () => !!(await pget('ai-key')),
    setKey: async k => { k = String(k || '').trim(); if (k) await pset('ai-key', k); else await prm('ai-key'); return !!k; },
    getModel: async () => (await pget('ai-model')) || '',
    setModel: async m => { await pset('ai-model', String(m || '').trim()); return true; },
    ai: async body => {
      const key = await pget('ai-key'); if (!key) return { error: 'nokey' };
      const model = (await pget('ai-model')) || 'claude-sonnet-5-5';
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ ...body, model })
        });
        const j = await r.json();
        if (!r.ok) return { error: r.status === 401 ? 'badkey' : r.status === 429 ? 'rate' : 'http', message: j && j.error && j.error.message };
        return { data: j };
      } catch (e) { return { error: 'network' }; }
    }
  };

  /* ---------- Conta Google (OAuth com PKCE + Drive appDataFolder) ---------- */
  const GREDIR = 'app.tedeaga.mobile:/oauth2redirect';
  const GSCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rnd = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
  let loginWait = null;
  if (AppP) AppP.addListener('appUrlOpen', ev => {
    if (loginWait && ev.url && ev.url.startsWith('app.tedeaga.mobile:')) { const w = loginWait; loginWait = null; try { Br.close(); } catch (e) {} w.res(ev.url); }
  });
  if (Br) Br.addListener('browserFinished', () => setTimeout(() => { if (loginWait) { const w = loginWait; loginWait = null; w.rej(new Error('Login cancelado')); } }, 1500));
  async function gForm(url, params) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
    const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || ('http ' + r.status)); return j;
  }
  async function gAccess() {
    const t = await pj('g-token', null), c = await pj('g-config', {});
    if (!t || !t.refresh_token) throw new Error('Entre com o Google primeiro');
    if (t.access_token && t.exp > Date.now() + 60000) return t.access_token;
    const j = await gForm('https://oauth2.googleapis.com/token', { client_id: c.id, refresh_token: t.refresh_token, grant_type: 'refresh_token' });
    await pset('g-token', JSON.stringify({ ...t, access_token: j.access_token, exp: Date.now() + j.expires_in * 1000 }));
    return j.access_token;
  }
  async function gApi(url, opt = {}) {
    const tk = await gAccess();
    const r = await fetch(url, { ...opt, headers: { authorization: 'Bearer ' + tk, ...(opt.headers || {}) } });
    if (!r.ok) throw new Error('Google ' + r.status + ': ' + (await r.text()).slice(0, 160));
    return r;
  }
  async function gLogin() {
    const c = await pj('g-config', {});
    if (!c.id) throw new Error('Salve o Client ID primeiro');
    const verifier = rnd(32), challenge = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))), state = rnd(12);
    const q = new URLSearchParams({ client_id: c.id, redirect_uri: GREDIR, response_type: 'code', scope: GSCOPE, code_challenge: challenge, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent' });
    const back = await new Promise((res, rej) => {
      loginWait = { res, rej };
      setTimeout(() => { if (loginWait && loginWait.res === res) { loginWait = null; rej(new Error('Tempo esgotado. Tente de novo.')); } }, 180000);
      Br.open({ url: 'https://accounts.google.com/o/oauth2/v2/auth?' + q });
    });
    const u = new URL(back), code = u.searchParams.get('code');
    if (!code || u.searchParams.get('state') !== state) throw new Error(u.searchParams.get('error') || 'Login cancelado');
    const j = await gForm('https://oauth2.googleapis.com/token', { code, client_id: c.id, redirect_uri: GREDIR, grant_type: 'authorization_code', code_verifier: verifier });
    if (!j.refresh_token) throw new Error('O Google não devolveu permissão offline. Remova o acesso em myaccount.google.com/permissions e tente de novo.');
    const info = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { authorization: 'Bearer ' + j.access_token } })).json();
    await pset('g-token', JSON.stringify({ access_token: j.access_token, refresh_token: j.refresh_token, exp: Date.now() + j.expires_in * 1000, email: info.email, name: info.name, picture: info.picture }));
    return true;
  }
  const DRV = 'https://www.googleapis.com/drive/v3/files', UP = 'https://www.googleapis.com/upload/drive/v3/files';
  async function dList(q) {
    const r = await gApi(`${DRV}?spaces=appDataFolder&q=${encodeURIComponent(q + " and 'appDataFolder' in parents and trashed=false")}&fields=files(id,name,modifiedTime)&pageSize=100`);
    return (await r.json()).files || [];
  }
  async function dPut(name, text) {
    const f = (await dList(`name='${name}'`))[0];
    if (f) { await gApi(`${UP}/${f.id}?uploadType=media`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: text }); return f.id; }
    const b = 'tdg' + Date.now();
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: ['appDataFolder'] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`;
    const r = await gApi(`${UP}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'content-type': 'multipart/related; boundary=' + b }, body });
    return (await r.json()).id;
  }
  const dGet = async id => (await gApi(`${DRV}/${id}?alt=media`)).text();
  Object.assign(D, {
    gStatus: wrap(async () => { const c = await pj('g-config', {}), t = await pj('g-token', null); return { configured: !!c.id, signed: !!(t && t.refresh_token), email: t && t.email, name: t && t.name, picture: t && t.picture }; }),
    gSetConfig: wrap(async id => { await pset('g-config', JSON.stringify({ id: String(id || '').trim() })); return true; }),
    gClearConfig: wrap(async () => { await prm('g-config'); return true; }),
    gLogin: wrap(async () => { await gLogin(); return true; }),
    gLogout: wrap(async () => {
      const t = await pj('g-token', null); await prm('g-token');
      if (t && t.refresh_token) { try { await fetch('https://oauth2.googleapis.com/revoke?token=' + t.refresh_token, { method: 'POST' }); } catch (e) {} }
      return true;
    }),
    gPush: wrap(async text => { await dPut('tedeaga-sync.json', text); return { ok: true }; }),
    gPull: wrap(async () => { const f = (await dList("name='tedeaga-sync.json'"))[0]; if (!f) return { data: null }; return { data: await dGet(f.id), modified: f.modifiedTime }; }),
    gBackup: wrap(async (text, day) => {
      await dPut(`tedeaga-backup-${day}.json`, text);
      const L = (await dList("name contains 'tedeaga-backup-'")).sort((a, b) => b.name.localeCompare(a.name));
      for (const f of L.slice(7)) { try { await gApi(`${DRV}/${f.id}`, { method: 'DELETE' }); } catch (e) {} }
      return { ok: true };
    }),
    gList: wrap(async () => (await dList("name contains 'tedeaga-backup-'")).sort((a, b) => b.name.localeCompare(a.name))),
    gGet: wrap(async id => ({ data: await dGet(id) }))
  });
  window.desktop = D;
  window.__mobile = true;

  /* ---------- salvar/compartilhar backup ---------- */
  window.mobileSave = async (filename, data) => {
    await FS.writeFile({ path: filename, data, directory: 'CACHE', encoding: 'utf8' });
    const u = await FS.getUri({ path: filename, directory: 'CACHE' });
    await Share.share({ title: filename, files: [u.uri], dialogTitle: 'Salvar backup' });
  };

  /* ---------- alarmes nativos (notificações agendadas) ---------- */
  const PRESETS = { bip: 'Bipe', sino: 'Sino', harpa: 'Harpa', digital: 'Digital', suave: 'Suave', sirene: 'Sirene' };
  const dstr = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const soundKey = a => { const id = a.snd || (S.prefs && S.prefs.snd) || 'bip'; return PRESETS[id] ? id : 'bip'; };
  const dueOn = (a, d) => { const f = a.freq || 'daily', w = d.getDay(); return f === 'daily' || (f === 'weekdays' && w > 0 && w < 6) || (f === 'weekends' && (w === 0 || w === 6)) || (f === 'custom' && (a.days || []).includes(w)) || (f === 'once' && (a.date ? a.date === dstr(d) : true)); };
  async function alInit() {
    if (!LN) return;
    try {
      const pr = await LN.checkPermissions(); if (pr.display !== 'granted') await LN.requestPermissions();
      for (const [k, n] of Object.entries(PRESETS)) await LN.createChannel({ id: 'al_' + k, name: 'Alarme · ' + n, description: 'Alarmes do TEDEAGA', importance: 5, visibility: 1, vibration: true, sound: 'snd_' + k + '.wav' });
      await LN.registerActionTypes({ types: [{ id: 'ALARM', actions: [{ id: 'snooze', title: '+5 min', foreground: true }, { id: 'off', title: 'Desativar', foreground: true }] }] });
      try { const ex = await LN.checkExactNotificationSetting(); if (ex.exact_alarm !== 'granted') await LN.changeExactNotificationSetting(); } catch (e) {}
    } catch (e) {}
  }
  let alSig = '';
  async function alSchedule(force) {
    if (!LN || typeof S === 'undefined') return;
    const now = Date.now(), mute = (S.prefs && S.prefs.muteUntil) || 0, list = S.alarms.filter(a => a.on);
    const sig = JSON.stringify([list.map(a => [a.id, a.time, a.freq, a.days, a.date, a.snd, a.label]), mute, today()]);
    if (!force && sig === alSig) return; alSig = sig;
    try { const p = await LN.getPending(); if (p.notifications.length) await LN.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) }); } catch (e) {}
    const out = [];
    list.forEach(a => {
      const [hh, mm] = String(a.time).split(':').map(Number); let onceDone = false;
      for (let d = 0; d < 14 && out.length < 180; d++) {
        const day = new Date(); day.setDate(day.getDate() + d); day.setHours(hh, mm, 0, 0);
        if (day.getTime() <= now + 2000 || day.getTime() < mute || !dueOn(a, day)) continue;
        if (a.freq === 'once' && !a.date) { if (onceDone) break; onceDone = true; }
        out.push({ id: (hash(a.id) % 20000) * 100 + d, title: '⏰ ' + a.label, body: a.time + ' · ' + freqTxt(a), schedule: { at: new Date(day), allowWhileIdle: true }, channelId: 'al_' + soundKey(a), actionTypeId: 'ALARM', smallIcon: 'ic_stat_icon', extra: { aid: a.id } });
      }
    });
    if (out.length) { try { await LN.schedule({ notifications: out }); } catch (e) {} }
  }
  function ringNow(a) {
    lastRing = today() + a.time;
    if (a.freq === 'once') a.on = false;
    S.alarms = S.alarms.filter(x => !(x.tmp && x.id === a.id));
    ringAlarm(a); save();
  }
  if (LN) {
    LN.addListener('localNotificationReceived', n => {
      const a = S.alarms.find(x => x.id === (n.extra || {}).aid);
      if (!a || document.visibilityState !== 'visible') return;
      try { LN.removeDeliveredNotifications({ notifications: [{ id: n.id }] }); } catch (e) {}
      ringNow(a);
    });
    LN.addListener('localNotificationActionPerformed', ev => {
      const a = S.alarms.find(x => x.id === ((ev.notification && ev.notification.extra) || {}).aid); if (!a) return;
      if (ev.actionId === 'snooze') { const d = new Date(Date.now() + 3e5); S.alarms.push({ id: uid(), time: pad2(d.getHours()) + ':' + pad2(d.getMinutes()), label: a.label, on: true, snd: a.snd, freq: 'once', date: dstr(d), tmp: true }); save(); }
      else if (ev.actionId === 'off') { a.on = false; save(); }
      else if (document.visibilityState === 'visible') ringAlarm(a);
    });
  }

  /* ---------- widgets da tela inicial ---------- */
  async function widgetPush() {
    if (!Pref || typeof S === 'undefined') return;
    try {
      const t = today(), ev = S.events.filter(e => e.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6)
        .map(e => (e.date === t ? 'hoje' : e.date.slice(8) + '/' + e.date.slice(5, 7)) + ' ' + (e.time || '') + ' ' + e.title);
      const rt = (S.routine || []).filter(i => rtSched(i, t)).sort((a, b) => (a.time || '99').localeCompare(b.time || '99')), done = rt.filter(i => (i.log || {})[t]).length;
      const rl = rt.filter(i => !(i.log || {})[t]).slice(0, 6).map(i => '○ ' + (i.time ? i.time + ' ' : '') + i.title);
      const dl = fxDue().filter(f => !f.paid && f.diff <= 14).slice(0, 6).map(f => 'dia ' + f.day + ' · ' + f.name + ' · ' + brl(f.val) + (f.diff < 0 ? ' (atrasada)' : f.diff === 0 ? ' (hoje)' : ' (em ' + f.diff + ' d)'));
      await pset('w_agenda', ev.join('\n') || 'Sem eventos.');
      await pset('w_rotina', (rt.length ? '✓ ' + done + '/' + rt.length + ' concluídos\n' : '') + (rl.join('\n') || (rt.length ? 'Tudo feito! 🎉' : 'Nada agendado hoje.')));
      await pset('w_contas', dl.join('\n') || 'Nenhuma conta nos próximos 14 dias.');
      const g = nu().goals, nt = nday(t), nm = (S.meals || []).filter(x => x.date === t).slice(-3).map(x => '• ' + x.name + ' · ' + r0(x.kcal) + ' kcal');
      await pset('w_nutri', r0(nt.kcal) + ' / ' + g.kcal + ' kcal\nP ' + r0(nt.p) + ' · C ' + r0(nt.c) + ' · G ' + r0(nt.f) + ' g\n💧 ' + nwater(t) + ' / ' + g.water + ' ml' + (nm.length ? '\n' + nm.join('\n') : ''));
      if (WB) await WB.refresh();
    } catch (e) {}
  }
  let tw;
  const schedAll = () => { clearTimeout(tw); tw = setTimeout(() => { alSchedule(false); widgetPush(); }, 1500); };

  window.deskCard = () => `<div class="glass card"><h2>📱 Widgets e alarmes no Android</h2>
    <div class="mu" style="margin-bottom:8px">Widgets: segure em um espaço vazio da tela inicial > Widgets > TEDEAGA e escolha Agenda, Rotina ou Contas. Eles mostram os dados do app e abrem o TEDEAGA ao tocar.</div>
    <div class="mu" style="margin-bottom:8px">Alarmes tocam com o app fechado como notificações (som do alarme escolhido, desde que seja um dos sons prontos). Permita as notificações e tire o TEDEAGA da economia de bateria para não perder nenhum.</div>
    <div class="seg"><button class="pri" data-a="wpush">🔄 Atualizar widgets</button><button data-a="ntest">🔔 Testar alarme (5 s)</button></div></div>`;
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'wpush') { await widgetPush(); toast('Widgets atualizados'); }
    else if (b.dataset.a === 'ntest' && LN) {
      await alInit();
      try { await LN.schedule({ notifications: [{ id: 999999991, title: '⏰ Teste TEDEAGA', body: 'Se você viu isto, os alarmes funcionam.', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, channelId: 'al_bip', smallIcon: 'ic_stat_icon' }] }); toast('Teste agendado: feche o app e aguarde 5 s'); }
      catch (err) { toast('Não consegui agendar: ' + err.message); }
    }
  });

  /* ---------- mascote no toque: arrastar e sacudir ---------- */
  const mas = document.getElementById('mas');
  if (mas) {
    let drag = null, moved = false;
    mas.style.touchAction = 'none';
    mas.addEventListener('pointerdown', e => { drag = { sx: e.clientX, sy: e.clientY, x0: mp.x, y0: mp.y }; moved = false; try { mas.setPointerCapture(e.pointerId); } catch (x) {} });
    mas.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!moved && Math.hypot(dx, dy) < 10) return;
      moved = true; mp = { x: drag.x0 + dx, y: drag.y0 + dy }; setPos(mp.x, mp.y, 0); masHold = Date.now() + 6000; gcool = Date.now() + 800;
    });
    mas.addEventListener('pointerup', () => { drag = null; });
    mas.addEventListener('pointercancel', () => { drag = null; });
    mas.addEventListener('click', e => { if (moved) { e.stopImmediatePropagation(); moved = false; } }, true);
  }
  let lastShake = 0, shakes = 0;
  addEventListener('devicemotion', e => {
    const a = e.accelerationIncludingGravity; if (!a || typeof S === 'undefined') return;
    const m = (S.prefs && S.prefs.mas) || {}; if (m.on === false || m.gs === false) return;
    if (Math.abs(Math.hypot(a.x || 0, a.y || 0, a.z || 0) - 9.8) > 14) {
      const now = Date.now(); shakes = now - lastShake < 900 ? shakes + 1 : 1; lastShake = now;
      if (shakes >= 3 && now > gcool) { shakes = 0; gcool = now + 2500; const sz = m.sz || 80; masGoto(8 + Math.random() * (innerWidth - sz - 16), 70 + Math.random() * Math.max(10, innerHeight - sz - 190), .9, 'wow'); }
    }
  });

  /* ---------- sincronização por Wi-Fi com o PC ---------- */
  const LK = 'tedeaga-lan';
  const lcfg = () => { try { return JSON.parse(localStorage.getItem(LK) || '{}'); } catch (e) { return {}; } };
  const lset = o => { try { localStorage.setItem(LK, JSON.stringify({ ...lcfg(), ...o })); } catch (e) {} };
  const LS = { busy: '', msg: '' };
  const lanBase = h => { h = String(h || '').trim().replace(/\/+$/, ''); if (!/^https?:\/\//i.test(h)) h = 'http://' + h; if (!/:\d+$/.test(h.replace(/^https?:\/\//i, ''))) h += ':47821'; return h; };
  async function lanReq(method, body) {
    const m = lcfg(); if (!m.host || !m.pin) throw new Error('Informe o endereço e o PIN do PC');
    const call = fetch(lanBase(m.host) + '/sync', { method, headers: { 'x-pin': String(m.pin).trim(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const r = await Promise.race([call.catch(() => { throw new Error('Não consegui falar com o PC. Confira se o TEDEAGA está aberto nele, se o Wi-Fi é o mesmo e se o endereço está certo.'); }), new Promise((_, rej) => setTimeout(() => rej(new Error('O PC não respondeu. Confira se o TEDEAGA está aberto no PC, o Wi-Fi e o endereço.')), 10000))]);
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (r.status === 401) throw new Error('PIN incorreto');
    if (r.status === 429) throw new Error(j.error || 'Aguarde 1 minuto');
    if (!r.ok) throw new Error(j.error || ('O PC respondeu ' + r.status));
    return j;
  }
  async function lanSync(mode) {
    const sy = window.__sync, m = lcfg(); if (!sy || LS.busy || !m.host || !m.pin) return;
    try {
      LS.busy = 'Sincronizando…'; render();
      const r = await lanReq('GET'), remote = r.snapshot ? JSON.parse(r.snapshot) : null, dirty = (sy.gm().at || 0) > (m.last || 0);
      let applied = false;
      if (mode === 'pull') {
        if (!remote) throw new Error('O PC ainda não tem dados para enviar');
        if (!confirm('Substituir os dados deste celular pelos do PC?')) throw new Error('Cancelado');
        sy.applyRemote(remote.data); lset({ last: remote._at }); sy.gms({ at: remote._at }); applied = true;
      } else if (mode !== 'push' && remote && remote._at > (m.last || 0)) {
        if (!dirty || confirm('Há alterações neste celular e também no PC.\n\nOK = usar a versão do PC (descarta o que mudou aqui)\nCancelar = manter este celular e enviar para o PC')) {
          sy.applyRemote(remote.data); lset({ last: remote._at }); sy.gms({ at: remote._at }); applied = true;
        }
      }
      if (!applied && (mode === 'push' || mode === 'manual' || dirty || !remote)) {
        const at = Date.now(); await lanReq('POST', { snapshot: JSON.stringify({ _at: at, data: sy.slim() }) }); lset({ last: at });
      }
      lset({ when: Date.now() });
      LS.msg = (applied ? 'Atualizado com o PC' : 'Enviado ao PC') + ' às ' + hmNow();
    } catch (e) { LS.msg = e.message === 'Cancelado' ? '' : 'Erro: ' + e.message; }
    LS.busy = ''; render();
  }
  let tl;
  const lanSchedule = () => { const m = lcfg(); if (!m.host || !m.pin || m.auto === false) return; clearTimeout(tl); tl = setTimeout(() => lanSync('auto'), 25000); };
  window.lanCard = () => {
    const m = lcfg();
    return `<div class="glass card"><h2>📶 Sincronizar com o PC (Wi-Fi)</h2>
    <div class="mu" style="margin-bottom:8px">No PC: abra o TEDEAGA > Ajustes > "Sincronizar com o celular" > Ativar. Digite aqui o endereço e o PIN que aparecem lá. PC e celular precisam estar no mesmo Wi-Fi.</div>
    <div style="display:flex;flex-direction:column;gap:10px"><label class="fld"><span>Endereço do PC (ex.: 192.168.0.12)</span><input id="lanhost" value="${esc(m.host || '')}" autocomplete="off" inputmode="decimal"></label><label class="fld"><span>PIN (6 números)</span><input id="lanpin" value="${esc(m.pin || '')}" autocomplete="off" inputmode="numeric" maxlength="6"></label><button class="pri" data-a="lansave" style="align-self:flex-start">Salvar</button></div>
    <div class="seg" style="margin-top:10px"><button class="pri" data-a="lansync">🔄 Sincronizar agora</button><button data-a="lanpush">⬆️ Enviar ao PC</button><button data-a="lanpull">⬇️ Buscar do PC</button></div>
    <div class="row"><div class="g t">Sincronizar automaticamente</div><input type="checkbox" data-lanauto ${m.auto !== false ? 'checked' : ''} style="flex:none"></div>
    <div class="mu">${esc(LS.busy || LS.msg || '')}${m.when ? ' · última troca: ' + new Date(m.when).toLocaleString('pt-BR') : ''}</div></div>`;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'lansave') { lset({ host: $('#lanhost').value.trim(), pin: $('#lanpin').value.trim() }); toast('Salvo'); lanSync('manual'); }
    else if (a === 'lansync') lanSync('manual');
    else if (a === 'lanpush') lanSync('push');
    else if (a === 'lanpull') lanSync('pull');
  });
  document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.lanauto !== undefined) lset({ auto: e.target.checked }); });

  /* ---------- botão voltar, barra de status e início ---------- */
  if (AppP) AppP.addListener('backButton', () => {
    const chat = document.getElementById('chat'), idl = document.getElementById('idlg');
    if (chat && !chat.hidden) { chat.hidden = true; return; }
    if (idl && !idl.hidden) { idl.hidden = true; return; }
    if (typeof view !== 'undefined' && view !== 'home') { view = 'home'; render(); return; }
    AppP.minimizeApp();
  });
  if (AppP) AppP.addListener('appStateChange', s => { if (s.isActive) { schedAll(); setTimeout(() => lanSync('auto'), 1500); } });
  addEventListener('load', async () => {
    try { if (SB) { await SB.setBackgroundColor({ color: '#0d0914' }); await SB.setStyle({ style: 'DARK' }); } } catch (e) {}
    const orig = window.save;
    window.save = function () { orig.apply(this, arguments); schedAll(); lanSchedule(); };
    await alInit(); alSchedule(true); widgetPush();
    setTimeout(() => lanSync('auto'), 2000);
  });
})();
