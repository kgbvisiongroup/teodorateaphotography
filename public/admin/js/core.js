// Jezgro administracije: pomoćne funkcije, API, navigacija, panel sa detaljima, dijalozi.
// Svaki ekran se registruje sa App.view(ime, {...}); novi moduli (npr. CMS) dodaju se isto.
window.App = (function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- formatiranje ----------
  const MONTHS = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
  const MONTHS_NOM = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
  const WD = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
  const WD_SHORT = ['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub'];
  const two = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toStr = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  const parse = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const today = () => toStr(new Date());
  const addDays = (s, n) => {
    const d = parse(s);
    d.setDate(d.getDate() + n);
    return toStr(d);
  };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const fmt = {
    date: (s, wd) => {
      const d = parse(s);
      return `${wd ? WD[d.getDay()] + ', ' : ''}${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
    },
    dateShort: (s) => {
      const d = parse(s);
      return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
    },
    stamp: (ts) => {
      const d = new Date(ts);
      return `${d.getDate()}. ${MONTHS[d.getMonth()]} u ${two(d.getHours())}:${two(d.getMinutes())}`;
    },
    stampLong: (ts) => {
      const d = new Date(ts);
      return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}. u ${two(d.getHours())}:${two(d.getMinutes())}`;
    },
    size(b) {
      if (!b) return '0 B';
      const u = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.min(4, Math.floor(Math.log(b) / Math.log(1024)));
      const v = b / Math.pow(1024, i);
      return (v >= 10 || !i ? Math.round(v) : v.toFixed(1)).toString().replace('.', ',') + ' ' + u[i];
    },
    money: (n) => `${Math.round(n || 0).toLocaleString('sr-RS')} ${App.meta?.currencySymbol || '€'}`,
    photos(n) {
      const m10 = n % 10, m100 = n % 100;
      return `${n} ${m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'fotografije' : 'fotografija'}`;
    },
    left(ts) {
      const h = Math.ceil((ts - Date.now()) / 3600000);
      if (h <= 0) return 'ističe';
      if (h < 24) return `još ${h} h`;
      const d = Math.floor(h / 24);
      return `još ${d} ${d === 1 ? 'dan' : 'dana'}${h % 24 ? ` i ${h % 24} h` : ''}`;
    },
    days(n) {
      const a = Math.abs(n);
      return `${a} ${a % 10 === 1 && a % 100 !== 11 ? 'dan' : 'dana'}`;
    },
    // Starost na određeni dan (isto kao na serveru)
    age(birth, at) {
      if (!birth || !at) return '';
      const days = daysBetween(birth, at);
      if (days < 0) return 'još nije rođeno';
      if (days < 31) return `${days} ${days === 1 ? 'dan' : 'dana'}`;
      if (days < 91) {
        const w = Math.floor(days / 7);
        return `${w} ${w < 5 ? 'nedelje' : 'nedelja'} (${days} dana)`;
      }
      const [y1, m1, d1] = birth.split('-').map(Number);
      const [y2, m2, d2] = at.split('-').map(Number);
      const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
      const mw = (m) => (m === 1 ? 'mesec' : m < 5 ? 'meseca' : 'meseci');
      if (months < 24) return `${months} ${mw(months)}`;
      const y = Math.floor(months / 12), r = months % 12;
      const yw = y % 10 >= 2 && y % 10 <= 4 && (y % 100 < 12 || y % 100 > 14) ? 'godine' : 'godina';
      return `${y} ${yw}${r ? ` i ${r} ${mw(r)}` : ''}`;
    },
    initials: (a, b) => ((a || '')[0] || '').toUpperCase() + ((b || '')[0] || '').toUpperCase(),
  };

  const STATUS = {
    upcoming: ['Predstoji', 'up'],
    processing: ['Čeka obradu', 'warn'],
    overdue: ['Kasni obrada', 'err'],
    edited: ['Obrađeno', 'ok'],
    sent: ['Poslato', 'ok'],
    downloaded: ['Preuzeto', 'ok'],
    cancelled: ['Otkazano', 'muted'],
  };
  const statusPill = (s) => `<span class="tag ${STATUS[s]?.[1] || ''}">${STATUS[s]?.[0] || s}</span>`;

  // ---------- poruke ----------
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 2800);
  }
  function ask(title, text, yes, danger) {
    const d = $('#confirm');
    $('#cfTitle').textContent = title;
    $('#cfText').textContent = text;
    $('#cfYes').textContent = yes;
    $('#cfYes').classList.toggle('danger', !!danger);
    return new Promise((res) => {
      d.onclose = () => res(d.returnValue === 'yes');
      d.returnValue = '';
      d.showModal();
    });
  }
  async function copy(text, msg = 'Link je kopiran') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const i = document.createElement('textarea');
      i.value = text;
      document.body.appendChild(i);
      i.select();
      document.execCommand('copy');
      i.remove();
    }
    toast(msg);
  }

  // ---------- API ----------
  async function api(method, url, body) {
    const isForm = body instanceof FormData;
    const r = await fetch(url, {
      method,
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : {},
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.endsWith('/login')) {
      showLogin();
      throw new Error('Prijavite se ponovo.');
    }
    if (!r.ok) throw new Error(data.error || 'Greška ' + r.status);
    return data;
  }

  // ---------- modal (forme za pakete, scenografije...) ----------
  const modal = {
    open(html, onSubmit) {
      const d = $('#modal');
      d.innerHTML = html;
      const f = d.querySelector('form');
      if (f && onSubmit)
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (e.submitter?.value === 'cancel') return d.close();
          const btn = f.querySelector('button.primary');
          if (btn) btn.disabled = true;
          try {
            if ((await onSubmit(f)) !== false) d.close();
          } catch (err) {
            const er = f.querySelector('.err');
            if (er) er.textContent = err.message;
            else toast(err.message);
          } finally {
            if (btn) btn.disabled = false;
          }
        });
      if (d.open) d.close();
      d.showModal();
      d.querySelector('input:not([type=hidden]),select,textarea')?.focus();
      return d;
    },
    close: () => $('#modal').close(),
  };
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' || e.target.closest('[data-close]')) $('#modal').close();
  });

  // ---------- panel sa desne strane (detalji) ----------
  let drawerBack = null;
  const drawer = {
    get el() {
      return $('#drawer');
    },
    open(html) {
      const d = $('#drawer');
      d.innerHTML = html;
      d.classList.add('on');
      d.setAttribute('aria-hidden', 'false');
      $('#drawerScrim').hidden = false;
      document.body.classList.add('noscroll');
      d.focus();
      return d;
    },
    close(fromRoute) {
      const d = $('#drawer');
      if (!d.classList.contains('on')) return;
      d.classList.remove('on');
      d.setAttribute('aria-hidden', 'true');
      $('#drawerScrim').hidden = true;
      document.body.classList.remove('noscroll');
      if (!fromRoute && location.hash.startsWith('#booking/')) history.replaceState(null, '', drawerBack || '#bookings');
    },
    isOpen: () => $('#drawer').classList.contains('on'),
  };
  $('#drawerScrim').onclick = () => drawer.close();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.isOpen() && !$('dialog[open]')) drawer.close();
  });
  $('#drawer').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) drawer.close();
  });

  // ---------- brend ----------
  let brandV = 1;
  function refreshBrand(v) {
    if (v) brandV = v;
    const q = '?v=' + brandV + '-' + Date.now();
    $$('[data-logo], #sideLogo, #logoPrev, #logoPrev2, #mpLogo, .login-logo').forEach((el) => (el.src = '/brand/logo' + q));
    const ip = $('#iconPrev');
    if (ip) ip.src = '/brand/icon' + q;
    $('#theme').href = '/brand/theme.css' + q;
    $('link[rel=icon]').href = '/brand/icon' + q;
  }

  // ---------- navigacija ----------
  const views = {};
  let current = null;
  function view(name, def) {
    views[name] = def;
  }
  function parseHash() {
    const h = location.hash.slice(1);
    const [path, q] = h.split('?');
    const [name, arg] = path.split('/');
    return { name, arg, params: new URLSearchParams(q || '') };
  }
  async function route() {
    const { name, arg, params } = parseHash();
    const def = views[name];
    // Detalji zakazivanja (#booking/ID) otvaraju se preko trenutnog ekrana
    if (def?.overlay) {
      if (!current) await show('dash', null, new URLSearchParams());
      drawerBack = '#' + current;
      return def.open(arg, params);
    }
    drawer.close(true);
    await show(def ? name : 'dash', arg, params);
  }
  async function show(name, arg, params) {
    if (views[name]?.role === 'admin' && App.me?.user?.role !== 'admin') name = 'dash';
    const def = views[name];
    current = name;
    const hash = location.hash.slice(1);
    const same = $$('.nav a').filter((a) => a.dataset.view === (def.nav || name));
    $$('.nav a').forEach((a) => {
      // kada više stavki vodi na isti ekran (skladište: Drive i disk), označava se tačno ona otvorena
      const mine = a.dataset.view === (def.nav || name);
      a.classList.toggle('on', mine && (same.length < 2 || a.getAttribute('href').slice(1) === hash));
    });
    $$('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + (def.el || name)));
    $('#pageTitle').textContent = def.title;
    $('#pageSub').textContent = def.sub || '';
    $('#pageActions').innerHTML = def.actions || '';
    $('#app').classList.remove('menu');
    document.title = def.title + ' – Administracija';
    window.scrollTo(0, 0);
    try {
      await def.load?.(params, arg);
    } catch (e) {
      toast(e.message);
    }
  }
  // Osveži podatke na ekranu koji je otvoren (npr. posle izmene u panelu sa detaljima)
  function reloadCurrent() {
    const def = views[current];
    if (!def?.load || def.noReload) return;
    const { name, params } = parseHash();
    def.load(name === current ? params : new URLSearchParams(), undefined, true);
  }
  window.addEventListener('hashchange', route);
  $('#burger').onclick = () => $('#app').classList.toggle('menu');
  $('#scrim').onclick = () => $('#app').classList.remove('menu');

  // ---------- podaci koje koristi više ekrana ----------
  const cache = {};
  async function load(kind, force) {
    if (!cache[kind] || force) cache[kind] = await api('GET', '/api/admin/' + kind);
    return cache[kind];
  }
  const cat = (key) => App.meta?.categories.find((c) => c.key === key);

  // ---------- izbor datuma (sopstveni kalendar, ponedeljak prvi, srpski nazivi) ----------
  // Polje: <div class="dp" data-name="date" data-value="2026-10-20" data-min data-max data-years="1990:2030">
  const DP_MONTHS = MONTHS_NOM;
  let dpEl = null;
  let dpTarget = null;
  let dpView = null;
  function dateField(name, value, opts = {}) {
    const y = new Date().getFullYear();
    return `<div class="dp${value ? ' has' : ''}${opts.cls ? ' ' + opts.cls : ''}" data-years="${opts.years || `${y - 10}:${y + 3}`}"${opts.min ? ` data-min="${opts.min}"` : ''}${opts.max ? ` data-max="${opts.max}"` : ''}>
<input type="hidden" name="${name}" value="${esc(value || '')}"${opts.id ? ` id="${opts.id}"` : ''}>
<button type="button" class="dp-btn" aria-haspopup="dialog"><span>${value ? esc(fmt.date(value, true)) : esc(opts.placeholder || 'Izaberite datum')}</span><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></button></div>`;
  }
  function dpSet(wrap, val) {
    const inp = wrap.querySelector('input');
    inp.value = val;
    wrap.querySelector('.dp-btn span').textContent = val ? fmt.date(val, true) : 'Izaberite datum';
    wrap.classList.toggle('has', !!val);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function dpRender() {
    const { y, m } = dpView;
    const val = dpTarget.querySelector('input').value;
    const min = dpTarget.dataset.min || '', max = dpTarget.dataset.max || '';
    const [y0, y1] = (dpTarget.dataset.years || '').split(':').map(Number);
    const first = new Date(y, m, 1);
    const off = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const td = today();
    let cells = '';
    for (let i = 0; i < off; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${two(m + 1)}-${two(d)}`;
      const dis = (min && ds < min) || (max && ds > max);
      cells += `<button type="button" data-d="${ds}" class="${ds === val ? 'sel' : ''}${ds === td ? ' td' : ''}"${dis ? ' disabled' : ''}>${d}</button>`;
    }
    const years = [];
    for (let yy = Math.min(y0 || y, y); yy <= Math.max(y1 || y, y); yy++) years.push(yy);
    dpEl.innerHTML = `<div class="dp-head"><button type="button" class="dp-nav" data-n="-1" aria-label="Prethodni mesec">‹</button>
<select class="dp-m" aria-label="Mesec">${DP_MONTHS.map((n, i) => `<option value="${i}"${i === m ? ' selected' : ''}>${n}</option>`).join('')}</select>
<select class="dp-y" aria-label="Godina">${years.map((yy) => `<option${yy === y ? ' selected' : ''}>${yy}</option>`).join('')}</select>
<button type="button" class="dp-nav" data-n="1" aria-label="Sledeći mesec">›</button></div>
<div class="dp-wd">${['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'].map((x) => `<span>${x}</span>`).join('')}</div>
<div class="dp-days">${cells}</div>
<div class="dp-foot"><button type="button" class="link small" data-today>Danas</button>${val && !dpTarget.dataset.required ? '<button type="button" class="link small" data-clear>Obriši</button>' : ''}</div>`;
  }
  function dpOpen(wrap) {
    if (!dpEl) {
      dpEl = document.createElement('div');
      dpEl.className = 'dp-pop';
      dpEl.setAttribute('role', 'dialog');
      document.body.appendChild(dpEl);
      dpEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const nav = e.target.closest('[data-n]');
        if (nav) {
          const d = new Date(dpView.y, dpView.m + Number(nav.dataset.n), 1);
          dpView = { y: d.getFullYear(), m: d.getMonth() };
          return dpRender();
        }
        const day = e.target.closest('[data-d]');
        if (day) {
          dpSet(dpTarget, day.dataset.d);
          return dpClose();
        }
        if (e.target.closest('[data-today]')) {
          dpSet(dpTarget, today());
          return dpClose();
        }
        if (e.target.closest('[data-clear]')) {
          dpSet(dpTarget, '');
          return dpClose();
        }
      });
      dpEl.addEventListener('change', (e) => {
        if (e.target.classList.contains('dp-m')) dpView.m = Number(e.target.value);
        if (e.target.classList.contains('dp-y')) dpView.y = Number(e.target.value);
        dpRender();
      });
    }
    dpTarget = wrap;
    const v = wrap.querySelector('input').value || today();
    const d = parse(v);
    dpView = { y: d.getFullYear(), m: d.getMonth() };
    dpRender();
    dpEl.hidden = false;
    const r = wrap.getBoundingClientRect();
    const w = 300;
    dpEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    const below = r.bottom + 6 + 340 < window.innerHeight;
    dpEl.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - 346)) + window.scrollY + 'px';
    dpEl.querySelector('.sel, .td, [data-d]')?.focus();
  }
  function dpClose() {
    if (dpEl) dpEl.hidden = true;
    dpTarget?.querySelector('.dp-btn')?.focus();
    dpTarget = null;
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.dp-btn');
    if (btn) {
      e.stopPropagation();
      const w = btn.closest('.dp');
      return dpTarget === w ? dpClose() : dpOpen(w);
    }
    if (dpTarget && !e.target.closest('.dp-pop')) dpClose();
  });
  window.addEventListener('resize', () => dpTarget && dpClose());

  // ---------- vreme u 24h formatu (bez AM/PM) ----------
  function timeField(name, value, opts = {}) {
    return `<div class="tp"><input type="text" name="${name}" value="${esc(value || '')}" inputmode="numeric" maxlength="5" placeholder="--:--" autocomplete="off" class="tp-in"${opts.id ? ` id="${opts.id}"` : ''}${opts.required ? ' required' : ''} aria-label="${esc(opts.label || 'Vreme')}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg><div class="tp-list" hidden></div></div>`;
  }
  const TP_SLOTS = [];
  for (let h = 7; h <= 22; h++) for (const m of ['00', '15', '30', '45']) TP_SLOTS.push(`${two(h)}:${m}`);
  function tpNormalize(v) {
    const d = v.replace(/\D/g, '').slice(0, 4);
    if (!d) return '';
    let h, m;
    if (d.length <= 2) [h, m] = [d, '00'];
    else if (d.length === 3) [h, m] = [d.slice(0, 1), d.slice(1)];
    else [h, m] = [d.slice(0, 2), d.slice(2)];
    h = Math.min(23, Number(h));
    m = Math.min(59, Number(m));
    return `${two(h)}:${two(m)}`;
  }
  document.addEventListener('focusin', (e) => {
    const inp = e.target.closest?.('.tp-in');
    if (!inp) return;
    const list = inp.parentElement.querySelector('.tp-list');
    list.innerHTML = TP_SLOTS.map((t) => `<button type="button" tabindex="-1" class="${t === inp.value ? 'sel' : ''}">${t}</button>`).join('');
    list.hidden = false;
    list.querySelector('.sel')?.scrollIntoView({ block: 'center' });
  });
  document.addEventListener('focusout', (e) => {
    const inp = e.target.closest?.('.tp-in');
    if (!inp) return;
    setTimeout(() => (inp.parentElement.querySelector('.tp-list').hidden = true), 150);
    const n = tpNormalize(inp.value);
    if (n !== inp.value) {
      inp.value = n;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  document.addEventListener('input', (e) => {
    const inp = e.target.closest?.('.tp-in');
    if (!inp || e.isTrusted === false) return;
    const d = inp.value.replace(/\D/g, '').slice(0, 4);
    inp.value = d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2) : d;
  });
  document.addEventListener('mousedown', (e) => {
    const b = e.target.closest('.tp-list button');
    if (!b) return;
    e.preventDefault();
    const inp = b.closest('.tp').querySelector('.tp-in');
    inp.value = b.textContent;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.blur();
  });

  // ---------- korisnik: slika u krugu ----------
  function avatar(u, cls = '') {
    if (!u) return '';
    const ini = (u.name || u.username || '?').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
    return u.photo ? `<span class="avatar ${cls}"><img src="${esc(u.photo)}" alt=""></span>` : `<span class="avatar ${cls}">${esc(ini)}</span>`;
  }
  function renderMe() {
    const u = App.me?.user;
    if (!u) return;
    $('#meAvatar').outerHTML = avatar(u).replace('class="avatar ', 'id="meAvatar" class="avatar ');
    $('#meAvatar2').outerHTML = avatar(u, 'big').replace('class="avatar ', 'id="meAvatar2" class="avatar ');
    $('#meName').textContent = u.name || u.username;
    $('#meName2').textContent = u.name || u.username;
    $('#meRole').textContent = (u.role === 'admin' ? 'Administrator' : 'Saradnik') + ' · ' + u.username;
    document.body.classList.toggle('role-staff', u.role !== 'admin');
  }

  // ---------- gornja traka: obaveštenja i meni korisnika ----------
  const NOTE_ICON = {
    mail: '<path d="M3.5 6.5h17v11h-17z"/><path d="m4 7 8 6 8-6"/>',
    download: '<path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19.5h14"/>',
    deadline: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    booking: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    voucher: '<rect x="3.5" y="8" width="17" height="12" rx="1.5"/><path d="M3.5 12h17M12 8v12"/>',
    error: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.5v.01"/>',
  };
  function ago(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'upravo';
    if (m < 60) return `pre ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `pre ${h} h`;
    return fmt.stamp(ts);
  }
  let notes = { items: [], unread: 0 };
  async function loadNotes() {
    if ($('#app').hidden) return;
    try {
      notes = await api('GET', '/api/admin/notifications');
    } catch {
      return;
    }
    const c = $('#bellCount');
    c.textContent = notes.unread > 99 ? '99+' : notes.unread || '';
    $('#navMail').textContent = notes.mailUnread || '';
    if (!$('#bellPop').hidden) renderNotes();
  }
  function renderNotes() {
    $('#bellList').innerHTML = notes.items.length
      ? notes.items
          .map(
            (n) => `<a class="note${n.read ? '' : ' unread'}" href="${esc(n.link || '#dash')}" data-id="${n.id}"><span class="ni ni-${n.type}"><svg viewBox="0 0 24 24">${NOTE_ICON[n.type] || NOTE_ICON.info}</svg></span>
<span class="nt"><b>${esc(n.title)}</b>${n.text ? `<small>${esc(n.text)}</small>` : ''}<em>${ago(n.at)}</em></span></a>`
          )
          .join('')
      : '<div class="empty small">Nema obaveštenja.</div>';
  }
  function closePops(except) {
    for (const [btn, pop] of [['#bellBtn', '#bellPop'], ['#userBtn', '#userPop']]) {
      if (pop === except) continue;
      $(pop).hidden = true;
      $(btn).setAttribute('aria-expanded', 'false');
    }
  }
  $('#bellBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = $('#bellPop').hidden;
    closePops('#bellPop');
    $('#bellPop').hidden = !open;
    $('#bellBtn').setAttribute('aria-expanded', String(open));
    if (open) {
      renderNotes();
      loadNotes();
    }
  });
  $('#userBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = $('#userPop').hidden;
    closePops('#userPop');
    $('#userPop').hidden = !open;
    $('#userBtn').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.pop')) closePops();
    else if (e.target.closest('.pop a')) closePops();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePops();
      if (dpTarget) dpClose();
    }
  });
  $('#bellList').addEventListener('click', (e) => {
    const a = e.target.closest('.note');
    if (a && a.classList.contains('unread')) api('POST', '/api/admin/notifications/read', { ids: [a.dataset.id] }).then(loadNotes);
  });
  $('#bellRead').addEventListener('click', async (e) => {
    e.stopPropagation();
    await api('POST', '/api/admin/notifications/read', {});
    await loadNotes();
    renderNotes();
  });
  setInterval(loadNotes, 60000);

  // ---------- prijava, zaboravljena lozinka, nova lozinka ----------
  function loginPane(which) {
    for (const id of ['loginForm', 'forgotForm', 'resetForm']) $('#' + id).hidden = id !== which;
  }
  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    loginPane('loginForm');
    drawer.close(true);
  }
  async function showApp(me) {
    $('#login').hidden = true;
    $('#app').hidden = false;
    App.me = me;
    renderMe();
    App.meta = await api('GET', '/api/admin/meta');
    applyStorageNav();
    loadNotes();
    route();
  }
  // Skladište: stavke se u meniju pojavljuju tek kada se izvor podesi
  function applyStorageNav() {
    const st = App.meta?.storage || {};
    document.body.classList.toggle('no-storage', !st.any);
    document.body.classList.toggle('no-stdisk', !st.disk);
    document.body.classList.toggle('no-stgoogle', !st.google);
    const g = $('#navStGoogle');
    const d = $('#navStDisk');
    if (g && st.googleLabel) g.lastChild.textContent = ' ' + st.googleLabel;
    if (d && st.diskLabel) d.lastChild.textContent = ' ' + st.diskLabel;
  }
  async function refreshMe() {
    App.me = await api('GET', '/api/admin/me');
    renderMe();
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    try {
      await api('POST', '/api/admin/login', { username: e.target.username.value, password: e.target.password.value, remember: !!e.target.remember?.checked });
      e.target.password.value = '';
      showApp(await api('GET', '/api/admin/me'));
    } catch (err) {
      $('#loginErr').textContent = err.message;
    }
  });
  $('#forgotLink').onclick = () => {
    loginPane('forgotForm');
    $('#forgotForm').login.value = $('#loginForm').username.value;
    $('#forgotForm').login.focus();
  };
  $$('[data-back]').forEach((b) => (b.onclick = () => loginPane('loginForm')));
  $('#forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#forgotMsg');
    try {
      const r = await api('POST', '/api/auth/forgot', { login: e.target.login.value });
      m.textContent = r.message;
    } catch (err) {
      m.textContent = err.message;
    }
  });
  let resetToken = null;
  $('#resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    $('#resetErr').textContent = '';
    if (f.password.value !== f.password2.value) return ($('#resetErr').textContent = 'Lozinke se ne poklapaju.');
    try {
      await api('POST', '/api/auth/reset', { token: resetToken, password: f.password.value });
      history.replaceState(null, '', '#dash');
      showApp(await api('GET', '/api/admin/me'));
      toast('Lozinka je postavljena');
    } catch (err) {
      $('#resetErr').textContent = err.message;
    }
  });
  $('#logout').onclick = async () => {
    await api('POST', '/api/admin/logout').catch(() => {});
    closePops();
    showLogin();
  };

  function start() {
    fetch('/api/brand')
      .then((r) => r.json())
      .then((b) => refreshBrand(b.v))
      .catch(() => {});
    // Link iz emaila za novu lozinku: #reset=TOKEN
    const m = location.hash.match(/^#reset=([\w-]+)/);
    if (m) {
      resetToken = m[1];
      $('#app').hidden = true;
      $('#login').hidden = false;
      loginPane('resetForm');
      return;
    }
    api('GET', '/api/admin/me')
      .then((me) => (me.authed ? showApp(me) : showLogin()))
      .catch(showLogin);
  }

  return {
    $, $$, esc, fmt, two, today, addDays, daysBetween, parse, toStr, MONTHS_NOM, WD_SHORT,
    api, toast, ask, copy, modal, drawer, view, route, reloadCurrent, refreshBrand, load, cache, cat, statusPill, STATUS, start,
    dateField, timeField, avatar, loadNotes, refreshMe, applyStorageNav,
    isAdmin: () => App.me?.user?.role === 'admin',
    meta: null,
    me: null,
    get current() {
      return current;
    },
  };
})();
