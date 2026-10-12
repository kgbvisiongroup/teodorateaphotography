// Zakazivanja: lista, čarobnjak za novo zakazivanje i panel sa detaljima.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, drawer } = App;

  const ICONS = {
    newborn: '<path d="M12 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"/><path d="M5.5 20c.8-4 3.3-6 6.5-6s5.7 2 6.5 6"/><path d="M10.5 8h.01M13.5 8h.01"/>',
    novogodisnje: '<path d="M12 3 7 10h3l-4 6h4l-3 4h10l-3-4h4l-4-6h3z"/><path d="M12 20v1.5"/>',
    rodjendan: '<ellipse cx="12" cy="9" rx="5" ry="6"/><path d="M12 15c0 2-1.5 2.5-1.5 4s1.5 2 1.5 2"/>',
    krstenje: '<path d="M12 3v18M7 8h10"/><path d="M5 21h14"/>',
    trudnicko: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    cakesmash: '<path d="M4 20h16M5 20v-6h14v6M5 14c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0"/><path d="M12 14v-4M12 7.5v.01"/>',
  };
  App.catIcon = (key) => `<svg viewBox="0 0 24 24">${ICONS[key] || ''}</svg>`;

  const COLORS = [
    ['bela', '#ffffff'], ['krem', '#f4ead9'], ['bež', '#dcc7a8'], ['puder roze', '#efc6c9'], ['roze', '#e79aa2'],
    ['lila', '#c9b3d6'], ['plava', '#a9c4dc'], ['zelena', '#a8c3a5'], ['siva', '#c5c2c0'], ['zlatna', '#d4b36a'], ['crvena', '#c8494b'], ['braon', '#9a7358'],
  ];

  // ---------- red u listi (koristi se i na kontrolnoj tabli i kod klijenata) ----------
  App.bookingRow = function (b, opts = {}) {
    const d = App.parse(b.date);
    let extra = '';
    if (b.status === 'processing' || b.status === 'overdue') {
      extra = b.daysLeft < 0 ? `rok je bio ${fmt.dateShort(b.deadlineDate)}` : b.daysLeft === 0 ? 'rok je danas' : `rok ${fmt.dateShort(b.deadlineDate)} · još ${fmt.days(b.daysLeft)}`;
    }
    const sub = [b.catName, b.age, b.location].filter(Boolean).map(esc).join(' · ');
    return `<div class="bk${b.cancelled ? ' cancelled' : ''}" data-id="${b.id}" style="--c:${b.color}" tabindex="0" role="button" aria-label="${esc(b.firstName)} ${esc(b.lastName)}, ${esc(b.catName)}">
<div class="bk-date"><b>${d.getDate()}</b><span>${App.MONTHS_NOM[d.getMonth()].slice(0, 3).toLowerCase()}</span><small>${App.WD_SHORT[d.getDay()]} ${esc(b.time)}</small></div>
<div class="bk-main"><b>${esc(b.firstName)} ${esc(b.lastName)}</b><span>${sub}</span></div>
${opts.compact ? '' : `<div class="bk-mid"><span>${esc(b.packageName || '–')}</span><small>${fmt.money(b.total)}</small></div>`}
<div class="bk-status">${App.statusPill(b.status)}${extra ? `<small>${extra}</small>` : ''}</div>
${(b.status === 'processing' || b.status === 'overdue') && !opts.noAction ? `<button class="btn sm" data-done title="Označi da su fotografije obrađene">Obrađeno</button>` : ''}
</div>`;
  };

  // klik na red otvara detalje; dugme „Obrađeno“ menja status na licu mesta
  App.bindBookingRows = function (container, after) {
    container.addEventListener('click', async (e) => {
      const row = e.target.closest('.bk');
      if (!row) return;
      if (e.target.closest('[data-done]')) {
        e.stopPropagation();
        await api('POST', `/api/admin/bookings/${row.dataset.id}/state`, { edited: true });
        toast('Označeno kao obrađeno');
        after ? after() : App.reloadCurrent();
        return;
      }
      location.hash = '#booking/' + row.dataset.id;
    });
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('bk')) e.target.click();
    });
  };

  // ---------- lista ----------
  let all = [];
  let filter = 'upcoming';
  async function loadList(params) {
    if (params?.get('f')) filter = params.get('f');
    $$('#bkFilter button').forEach((b) => b.classList.toggle('on', b.dataset.f === filter));
    const sel = $('#bkCat');
    if (sel.options.length === 1) App.meta.categories.forEach((c) => sel.add(new Option(c.name, c.key)));
    all = await api('GET', '/api/admin/bookings');
    $('#navEdit').textContent = all.filter((b) => b.status === 'processing' || b.status === 'overdue').length || '';
    renderList();
    const open = params?.get('open');
    if (open) location.hash = '#booking/' + open;
  }
  function renderList() {
    const q = $('#bkSearch').value.trim().toLowerCase();
    const c = $('#bkCat').value;
    let list = all.filter((b) => (!c || b.category === c) && (!q || `${b.firstName} ${b.lastName} ${b.parentName || ''} ${b.email} ${b.phone}`.toLowerCase().includes(q)));
    if (filter === 'upcoming') list = list.filter((b) => b.status === 'upcoming');
    else if (filter === 'edit') list = list.filter((b) => b.status === 'processing' || b.status === 'overdue').sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));
    else if (filter === 'done') list = list.filter((b) => ['edited', 'sent', 'downloaded'].includes(b.status)).reverse();
    else list = [...list].reverse();
    const empty = {
      upcoming: 'Nema zakazanih fotografisanja.<br><a class="btn primary" href="#book">Zakaži fotografisanje</a>',
      edit: 'Sve fotografije su obrađene.',
      done: 'Još nema završenih fotografisanja.',
      all: 'Još nema zakazivanja.<br><a class="btn primary" href="#book">Zakaži fotografisanje</a>',
    };
    $('#bkList').innerHTML = list.length ? list.map((b) => App.bookingRow(b)).join('') : `<div class="empty">${q || c ? 'Nema rezultata.' : empty[filter]}</div>`;
  }
  $$('#bkFilter button').forEach((b) => (b.onclick = () => {
    filter = b.dataset.f;
    $$('#bkFilter button').forEach((x) => x.classList.toggle('on', x === b));
    renderList();
  }));
  $('#bkSearch').addEventListener('input', renderList);
  $('#bkCat').addEventListener('change', renderList);
  App.bindBookingRows($('#bkList'), () => loadList());

  App.view('bookings', {
    title: 'Zakazivanja',
    sub: 'Sva fotografisanja, status obrade i slanja.',
    actions: '<a class="btn primary" href="#book">Novo zakazivanje</a>',
    load: loadList,
  });

  // ---------- čarobnjak ----------
  let W = null;

  async function loadWizard(params) {
    const editId = params.get('edit');
    W = { step: 1, cat: null, values: {}, editId: null, client: null, discountTouched: false, sendConfirmation: true };
    await Promise.all([App.load('packages', true), App.load('scenes', true), App.load('products', true)]);
    if (editId) {
      const b = await api('GET', '/api/admin/bookings/' + editId);
      W.editId = editId;
      W.cat = b.category;
      W.values = { ...b, discountPct: b.discountPct };
      W.discountTouched = true;
      W.step = 2;
      $('#pageTitle').textContent = 'Izmena zakazivanja';
    } else {
      for (const k of ['email', 'phone', 'date', 'time', 'location', 'packageId', 'note', 'firstName', 'lastName', 'parentName', 'deposit']) {
        if (params.get(k)) W.values[k] = params.get(k);
      }
      if (params.get('cat') && App.cat(params.get('cat'))) {
        W.cat = params.get('cat');
        W.step = 2;
      }
    }
    render();
  }

  function stepper() {
    const steps = ['Vrsta fotografisanja', 'Podaci', 'Pregled i potvrda'];
    return `<ol class="stepper">${steps.map((s, i) => `<li class="${W.step === i + 1 ? 'st-on' : W.step > i + 1 ? 'st-done' : ''}"><span>${i + 1}</span>${s}</li>`).join('')}</ol>`;
  }

  function render() {
    const host = $('#wizard');
    if (W.step === 1) {
      host.innerHTML = stepper() + `<div class="cats">${App.meta.categories
        .map((c) => `<button type="button" class="catcard" data-cat="${c.key}" style="--c:${c.color}">${App.catIcon(c.key)}<b>${esc(c.name)}</b><span>${esc(c.blurb)}</span></button>`)
        .join('')}</div>`;
      $$('.catcard', host).forEach((b) => (b.onclick = () => {
        W.cat = b.dataset.cat;
        W.step = 2;
        render();
      }));
      return;
    }
    const c = App.cat(W.cat);
    if (W.step === 2) {
      host.innerHTML =
        stepper() +
        `<form id="bkForm" class="wiz-grid" novalidate>
<div class="panel">
  <div class="wiz-cat" style="--c:${c.color}">${App.catIcon(c.key)}<b>${esc(c.name)}</b>${W.editId ? '' : '<button type="button" class="link" id="chgCat">Promeni vrstu</button>'}</div>
  <div class="fgrid2">${c.fields.map(field).join('')}</div>
  ${extrasBlock()}
  <p class="err" id="bkErr" role="alert"></p>
</div>
<aside class="panel wiz-sum" id="wizSum"></aside>
</form>
<div class="wiz-nav">${W.editId ? '<a class="btn" href="#bookings">Odustani</a>' : '<button type="button" class="btn" id="back">Nazad</button>'}<button type="button" class="btn primary" id="next">Dalje: pregled</button></div>`;
      bindForm();
      summary();
      return;
    }
    // korak 3: pregled
    host.innerHTML =
      stepper() +
      `<div class="wiz-grid">
<div class="panel"><div class="wiz-cat" style="--c:${c.color}">${App.catIcon(c.key)}<b>${esc(c.name)}</b></div>${review(c)}</div>
<aside class="panel wiz-sum" id="wizSum"></aside>
</div>
<div class="wiz-nav"><button type="button" class="btn" id="back">Nazad na podatke</button>
<label class="check inline"><input type="checkbox" id="sendConf" ${W.sendConfirmation ? 'checked' : ''} ${W.values.email ? '' : 'disabled'}><span>${W.editId ? 'Pošalji klijentu izmenjenu potvrdu' : 'Pošalji klijentu potvrdu emailom'}</span></label>
<button type="button" class="btn primary" id="save">${W.editId ? 'Sačuvaj izmene' : 'Zakaži'}</button></div>
<p class="err" id="bkErr" role="alert"></p>`;
    summary();
    $('#back').onclick = () => {
      W.step = 2;
      render();
    };
    if (W.editId) $('#sendConf').checked = W.sendConfirmation = false;
    $('#sendConf').onchange = (e) => (W.sendConfirmation = e.target.checked);
    $('#save').onclick = save;
  }

  function field(f) {
    const v = W.values[f.k];
    const id = 'bf_' + f.k;
    const req = f.req ? ' required' : '';
    const hint = f.hint ? ` <small>${esc(f.hint)}</small>` : '';
    const wide = f.half ? '' : ' wide';
    const list = f.list ? ` list="dl_${f.list}"` : '';
    const dl = f.list ? `<datalist id="dl_${f.list}">${(App.meta.suggestions[f.list] || []).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : '';
    switch (f.type) {
      case 'textarea':
        return `<label class="f wide" for="${id}">${esc(f.label)}${hint}<textarea id="${id}" name="${f.k}" rows="3">${esc(v || '')}</textarea></label>`;
      case 'checkbox': {
        const on = v === undefined ? !!f.def : !!v;
        return `<label class="switch${wide}"><input type="checkbox" name="${f.k}" ${on ? 'checked' : ''}><span class="sw"></span><span>${esc(f.label)}${hint}</span></label>`;
      }
      case 'package': {
        const pk = (App.cache.packages || []).filter((p) => p.category === W.cat && (p.active || p.id === v));
        if (!pk.length)
          return `<div class="f wide"><span class="lbl">${esc(f.label)}</span><div class="empty small">Za ovu kategoriju još nema paketa. <a class="link" href="#catalog?cat=${W.cat}">Dodaj pakete</a></div></div>`;
        return `<fieldset class="f wide"><legend>${esc(f.label)}</legend><div class="pks">${pk
          .map(
            (p) => `<label class="pk"><input type="radio" name="packageId" value="${p.id}" ${p.id === v || (pk.length === 1 && !v) ? 'checked' : ''}${req}>
<span><b>${esc(p.name)}</b><em>${fmt.money(p.price)}</em>${p.extraHourPrice ? `<small>dodatni sat ${fmt.money(p.extraHourPrice)}</small>` : ''}${p.description ? `<small>${esc(p.description)}</small>` : ''}</span></label>`
          )
          .join('')}</div></fieldset>`;
      }
      case 'scene': {
        const sc = (App.cache.scenes || []).filter((s) => s.active !== false || s.id === v);
        if (!sc.length)
          return `<div class="f wide"><span class="lbl">${esc(f.label)}</span><div class="empty small">Još nema scenografija. <a class="link" href="#catalog?cat=scenes">Dodaj scenografije</a></div></div>`;
        return `<fieldset class="f wide"><legend>${esc(f.label)}</legend><div class="scs">${sc
          .map(
            (s) => `<label class="sc"><input type="radio" name="sceneId" value="${s.id}" ${s.id === v ? 'checked' : ''}${req}>
<span class="sc-img">${s.image ? `<img src="/media/scene/${s.id}?v=${esc(s.image)}" alt="" loading="lazy">` : App.catIcon('novogodisnje')}</span><b>${esc(s.name)}</b>${s.description ? `<small>${esc(s.description)}</small>` : ''}</label>`
          )
          .join('')}</div></fieldset>`;
      }
      case 'colors': {
        const chosen = String(v || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
        return `<div class="f wide"><label for="${id}">${esc(f.label)}${hint}</label><input id="${id}" name="${f.k}" value="${esc(v || '')}" placeholder="npr. bela, bež, puder roze">
<div class="swatch-row">${COLORS.map(([n, hex]) => `<button type="button" class="cs${chosen.includes(n) ? ' on' : ''}" data-color="${n}" style="--s:${hex}" title="${n}"><i></i>${n}</button>`).join('')}</div></div>`;
      }
      case 'hours':
        return `<label class="f${wide}" for="${id}">${esc(f.label)}${hint}<input id="${id}" name="${f.k}" type="number" min="0" max="24" step="0.5" inputmode="decimal" value="${v ?? ''}"></label>`;
      case 'number':
        return `<label class="f${wide}" for="${id}">${esc(f.label)}${hint}<input id="${id}" name="${f.k}" type="number" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} inputmode="numeric" value="${v ?? ''}"${req}></label>`;
      case 'date': {
        const y = new Date().getFullYear();
        const opts = f.age ? { years: `${y - 18}:${y}`, max: App.today(), placeholder: 'Izaberite datum rođenja' } : { years: `${y - 1}:${y + 3}` };
        return `<div class="f${wide}"><span class="lbl">${esc(f.label)}${hint}</span>${App.dateField(f.k, v, opts)}${f.age ? '<span class="age" id="ageOut"></span>' : ''}</div>`;
      }
      case 'time':
        return `<div class="f${wide}"><span class="lbl">${esc(f.label)}${hint}</span>${App.timeField(f.k, v, { label: f.label })}</div>`;
      case 'location': {
        const locs = App.meta.locations || [];
        const other = v && !locs.includes(v);
        return `<div class="f${wide}"><span class="lbl">${esc(f.label)}${hint}</span><div class="locs">${locs
          .map((l) => `<label class="loc"><input type="radio" name="locSel" value="${esc(l)}" ${v === l ? 'checked' : ''}><span>${esc(l)}</span></label>`)
          .join('')}<label class="loc"><input type="radio" name="locSel" value="__other" ${other ? 'checked' : ''}><span>Druga lokacija</span></label></div>
<input name="location" id="${id}" value="${esc(other ? v : '')}" placeholder="npr. Crkva Svetog Marka, Beograd" ${other ? '' : 'hidden'} autocomplete="off"></div>`;
      }
      default: {
        const type = { email: 'email', tel: 'tel', time: 'time' }[f.type] || 'text';
        return `<label class="f${wide}" for="${id}">${esc(f.label)}${hint}<input id="${id}" name="${f.k}" type="${type}" value="${esc(v || '')}"${req}${list}${type === 'tel' ? ' inputmode="tel"' : ''}${type === 'email' ? ' autocomplete="off"' : ''}></label>${dl}`;
      }
    }
  }

  // Izrada (album, book, kutija) i kapara
  function extrasBlock() {
    const prods = (App.cache.products || []).filter((p) => p.active !== false);
    const items = W.values.items || [];
    const qtyOf = (id) => (items.find((x) => x.productId === id) || {}).qty || 0;
    const chips = prods.length
      ? `<div class="items">${prods
          .map(
            (p) => `<div class="item${qtyOf(p.id) ? ' on' : ''}" data-prod="${p.id}">
<div class="i-main"><b>${esc(p.name)}</b><small>${p.price ? fmt.money(p.price) + ' · ' : ''}na stanju: ${p.stock}${p.low ? ' ⚠︎' : ''}</small></div>
<div class="qty"><button type="button" data-step="-1" aria-label="Manje">−</button><span>${qtyOf(p.id)}</span><button type="button" data-step="1" aria-label="Više">+</button></div></div>`
          )
          .join('')}</div>`
      : '<div class="empty small">Nema artikala u magacinu. <a class="link" href="#stock">Dodaj artikle</a></div>';
    return `<div class="extras">
<h3>Izrada i naplata</h3>
<p class="sub small">Izaberite da li klijent želi album, book ili kutiju – kada označite da je fotografisanje obrađeno, artikli se skidaju sa stanja.</p>
${chips}
<label class="f dep">Kapara (${esc(App.meta.currencySymbol)}) <small>uplaćeno unapred, oduzima se od ukupnog</small><input name="deposit" inputmode="numeric" value="${W.values.deposit || ''}" placeholder="npr. 50"></label>
</div>`;
  }

  function bindExtras() {
    const box = $('#bkForm .extras');
    if (!box) return;
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      const id = btn.closest('.item').dataset.prod;
      const items = (W.values.items = W.values.items || []);
      const cur = items.find((x) => x.productId === id);
      const next = Math.max(0, (cur ? cur.qty : 0) + Number(btn.dataset.step));
      if (!next) W.values.items = items.filter((x) => x.productId !== id);
      else if (cur) cur.qty = next;
      else items.push({ productId: id, qty: next });
      const row = btn.closest('.item');
      row.querySelector('.qty span').textContent = next;
      row.classList.toggle('on', !!next);
      summary();
    });
  }

  function readForm() {
    const f = $('#bkForm');
    if (!f) return;
    const c = App.cat(W.cat);
    for (const fd of c.fields) {
      if (fd.type === 'checkbox') W.values[fd.k] = !!f.elements[fd.k]?.checked;
      else if (fd.type === 'package' || fd.type === 'scene') W.values[fd.k] = f.querySelector(`[name="${fd.k}"]:checked`)?.value || '';
      else if (fd.type === 'location') {
        const sel = f.querySelector('[name="locSel"]:checked')?.value || '';
        const other = f.elements.location;
        other.hidden = sel !== '__other';
        W.values.location = sel === '__other' ? other.value.trim() : sel;
      } else if (f.elements[fd.k]) W.values[fd.k] = f.elements[fd.k].value.trim();
    }
    if (f.elements.deposit) W.values.deposit = f.elements.deposit.value.trim();
  }

  let lookupT;
  function bindForm() {
    bindExtras();
    const f = $('#bkForm');
    f.addEventListener('input', (e) => {
      readForm();
      if (e.target.name === 'email' || e.target.name === 'phone') {
        clearTimeout(lookupT);
        lookupT = setTimeout(lookup, 450);
      }
      summary();
    });
    f.addEventListener('change', () => {
      readForm();
      summary();
    });
    f.addEventListener('click', (e) => {
      const cs = e.target.closest('.cs');
      if (!cs) return;
      const inp = f.elements.colors;
      const list = inp.value.split(',').map((x) => x.trim()).filter(Boolean);
      const name = cs.dataset.color;
      const i = list.findIndex((x) => x.toLowerCase() === name);
      if (i >= 0) list.splice(i, 1);
      else list.push(name);
      inp.value = list.join(', ');
      cs.classList.toggle('on', i < 0);
      readForm();
    });
    $('#back')?.addEventListener('click', () => {
      readForm();
      W.step = 1;
      render();
    });
    $('#chgCat')?.addEventListener('click', () => {
      readForm();
      W.step = 1;
      render();
    });
    $('#next').onclick = () => {
      readForm();
      const err = validate();
      $('#bkErr').textContent = err || '';
      if (err) return;
      W.step = 3;
      render();
      window.scrollTo(0, 0);
    };
    if (W.values.email || W.values.phone) lookup();
  }

  function validate() {
    const c = App.cat(W.cat);
    for (const f of c.fields) {
      const v = W.values[f.k];
      if (f.req && f.type !== 'checkbox' && (v === '' || v == null)) {
        const el = $(`[name="${f.k}"]`);
        el?.focus();
        return `Polje „${f.label}“ je obavezno.`;
      }
    }
    if (W.values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(W.values.email)) return 'Proverite email adresu.';
    if (W.values.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(W.values.time)) return 'Vreme upišite kao sati:minuti, npr. 11:30.';
    if (W.values.birthDate && W.values.date && W.values.birthDate > W.values.date) return 'Datum rođenja je posle datuma fotografisanja.';
    return '';
  }

  async function lookup() {
    const { email, phone } = W.values;
    if (!email && !phone) return;
    try {
      const c = await api('GET', `/api/admin/clients/lookup?email=${encodeURIComponent(email || '')}&phone=${encodeURIComponent(phone || '')}`);
      W.client = c && c.key ? c : null;
      if (W.client && !W.discountTouched) W.values.discountPct = W.client.discount || 0;
      summary();
    } catch {}
  }

  function price() {
    const p = (App.cache.packages || []).find((x) => x.id === W.values.packageId);
    const base = p ? p.price : W.values.packagePrice || 0;
    const hp = p ? p.extraHourPrice || 0 : W.values.extraHourPrice || 0;
    const hours = Number(String(W.values.extraHours || 0).replace(',', '.')) || 0;
    const extra = hours * hp;
    const disc = Math.min(100, Math.max(0, Number(W.values.discountPct) || 0));
    const prods = App.cache.products || [];
    const items = (W.values.items || [])
      .map((it) => {
        const p2 = prods.find((x) => x.id === it.productId);
        return p2 ? { name: p2.name, qty: it.qty, price: p2.price || 0, stock: p2.stock } : null;
      })
      .filter(Boolean);
    const itemsTotal = items.reduce((sum, x) => sum + x.price * x.qty, 0);
    const total = Math.round((base + extra) * (1 - disc / 100) + itemsTotal);
    const deposit = Math.max(0, Math.round(Number(String(W.values.deposit || 0).replace(',', '.')) || 0));
    return { p, base, hp, hours, extra, disc, items, itemsTotal, deposit, total, remaining: Math.max(0, total - deposit) };
  }

  function summary() {
    const s = $('#wizSum');
    if (!s) return;
    const v = W.values;
    const c = App.cat(W.cat);
    const pr = price();
    const age = v.birthDate && v.date ? fmt.age(v.birthDate, v.date) : '';
    const ageOut = $('#ageOut');
    if (ageOut) ageOut.textContent = age ? `Na dan fotografisanja: ${age}` : '';
    const who = [v.firstName, v.lastName].filter(Boolean).join(' ');
    s.innerHTML = `<h2>Ukratko</h2>
<div class="sum-who" style="--c:${c.color}"><b>${esc(who || 'Ime i prezime')}</b><span>${esc(c.name)}${age ? ' · ' + esc(age) : ''}</span></div>
<dl class="sum">
  <dt>Termin</dt><dd>${v.date ? esc(fmt.date(v.date, true)) : '–'}${v.time ? ` u ${esc(v.time)}` : ''}</dd>
  ${v.location ? `<dt>Lokacija</dt><dd>${esc(v.location)}</dd>` : ''}
  <dt>Paket</dt><dd>${pr.p ? `${esc(pr.p.name)} · ${fmt.money(pr.base)}` : '–'}</dd>
  ${pr.hours ? `<dt>Dodatna satnica</dt><dd>${String(pr.hours).replace('.', ',')} h × ${fmt.money(pr.hp)} = ${fmt.money(pr.extra)}</dd>` : ''}
  ${pr.items.length ? `<dt>Izrada</dt><dd>${pr.items.map((i) => `${esc(i.name)}${i.qty > 1 ? ` × ${i.qty}` : ''}${i.price ? ` · ${fmt.money(i.price * i.qty)}` : ''}${i.stock - i.qty < 0 ? ' <span class="t-err">(nema na stanju)</span>' : ''}`).join('<br>')}</dd>` : ''}
</dl>
${W.client ? `<div class="loyal"><b>${esc(W.client.name)}</b> je postojeći klijent · ${W.client.sessions} ${W.client.sessions === 1 ? 'fotografisanje' : 'fotografisanja'}${W.client.cardNo ? `<br>Loyalty kartica ${esc(W.client.cardNo)} · ${W.client.discount}% popusta` : ''}</div>` : ''}
<label class="f disc">Popust (%)<input type="number" id="discIn" min="0" max="100" value="${pr.disc || ''}" placeholder="0"></label>
<div class="total"><span>Ukupno</span><b>${fmt.money(pr.total)}</b></div>
${pr.deposit ? `<div class="total sub-total"><span>Kapara</span><b>− ${fmt.money(pr.deposit)}</b></div><div class="total rest"><span>Ostatak za uplatu</span><b>${fmt.money(pr.remaining)}</b></div>` : ''}`;
    $('#discIn').addEventListener('input', (e) => {
      W.values.discountPct = e.target.value;
      W.discountTouched = true;
      const pr2 = price();
      $('.total b', s).textContent = fmt.money(pr2.total);
      const rest = s.querySelector('.total.rest b');
      if (rest) rest.textContent = fmt.money(pr2.remaining);
    });
  }

  function review(c) {
    const v = W.values;
    const rows = c.fields
      .map((f) => {
        let val = v[f.k];
        if (f.type === 'package') val = (App.cache.packages || []).find((p) => p.id === val)?.name || '';
        else if (f.type === 'scene') val = (App.cache.scenes || []).find((s) => s.id === val)?.name || '';
        else if (f.type === 'checkbox') val = val ? 'Da' : 'Ne';
        else if (f.type === 'date' && val) val = fmt.date(val, f.k === 'date') + (f.age && v.date ? ` (${fmt.age(val, v.date)})` : '');
        else if (f.type === 'hours' && val) val = `${String(val).replace('.', ',')} h`;
        if (val === '' || val == null) return '';
        return `<dt>${esc(f.label)}</dt><dd>${esc(val)}</dd>`;
      })
      .join('');
    return `<dl class="review">${rows}</dl>`;
  }

  async function save() {
    const btn = $('#save');
    btn.disabled = true;
    $('#bkErr').textContent = '';
    const body = { ...W.values, category: W.cat, sendConfirmation: W.sendConfirmation };
    try {
      const b = W.editId ? await api('PUT', '/api/admin/bookings/' + W.editId, body) : await api('POST', '/api/admin/bookings', body);
      if (W.editId && W.sendConfirmation) await api('POST', `/api/admin/bookings/${b.id}/confirm`).catch((e) => toast(e.message));
      if (b.mail && b.mail !== 'sent') toast('Zakazano, ali potvrda nije poslata: ' + b.mail);
      else toast(W.editId ? 'Izmene su sačuvane' : b.mail === 'sent' ? 'Zakazano i potvrda je poslata' : 'Zakazano');
      App.meta = await api('GET', '/api/admin/meta'); // nove lokacije za predloge
      location.hash = '#bookings?f=all&open=' + b.id;
    } catch (e) {
      $('#bkErr').textContent = e.message;
      btn.disabled = false;
    }
  }

  App.view('book', {
    title: 'Novo zakazivanje',
    sub: 'Izaberite vrstu fotografisanja i popunite podatke.',
    nav: 'bookings',
    noReload: true,
    load: loadWizard,
  });

  // ---------- detalji zakazivanja ----------
  async function openBooking(id) {
    drawer.open('<div class="dr-load">Učitavam…</div>');
    let b;
    try {
      b = await api('GET', '/api/admin/bookings/' + id);
    } catch (e) {
      drawer.open(`<div class="dr-head"><h2>Nije pronađeno</h2><button class="x" data-close aria-label="Zatvori">×</button></div><p class="sub">${esc(e.message)}</p>`);
      return;
    }
    renderDrawer(b);
  }

  function renderDrawer(b) {
    const c = App.cat(b.category);
    const skip = new Set(['firstName', 'lastName', 'email', 'phone', 'date', 'time', 'location', 'packageId', 'parentName', 'birthDate', 'notes']);
    const details = c.fields
      .filter((f) => !skip.has(f.k))
      .map((f) => {
        let val = b[f.k];
        if (f.type === 'scene') val = b.sceneName;
        else if (f.type === 'checkbox') val = val ? 'Da' : 'Ne';
        else if (f.type === 'hours') val = val ? `${String(val).replace('.', ',')} h` : '';
        else if (f.type === 'number' && f.k === 'pregnancyWeek' && val) val = `${val}. nedelja`;
        return val === '' || val == null ? '' : `<dt>${esc(f.label)}</dt><dd>${esc(val)}</dd>`;
      })
      .join('');
    const editDone = !!b.editedAt;
    let deadline = '';
    if (!b.cancelled && b.status !== 'upcoming') {
      deadline = editDone
        ? `Označeno kao obrađeno ${fmt.stamp(b.editedAt)}.`
        : b.daysLeft < 0
        ? `<b class="t-err">Rok je istekao ${fmt.date(b.deadlineDate)}</b>`
        : `Rok za obradu: <b>${fmt.date(b.deadlineDate, true)}</b> (${b.daysLeft === 0 ? 'danas' : 'još ' + fmt.days(b.daysLeft)}).`;
    } else if (!b.cancelled) deadline = `Rok za obradu biće ${fmt.date(b.deadlineDate)}`;
    const mails = [
      ['confirm', 'Potvrda termina'],
      ['reminder', 'Podsetnik dan pre'],
      ['edit3', 'Podsetnik za obradu (3 dana)'],
      ['edit1', 'Podsetnik za obradu (1 dan)'],
    ]
      .map(([k, l]) => {
        const m = b.emails?.[k];
        if (!m) return '';
        return `<li>${l}: ${m.at ? 'poslat ' + fmt.stamp(m.at) : `<span class="t-err">nije poslat (${esc(m.err)})</span>`}</li>`;
      })
      .join('');
    const del = (b.deliveries || [])
      .map((d) => {
        const log = (d.downloadLog || []).slice(0, 8).map((x) => `<li>${fmt.stamp(x.at)} · ${x.kind === 'all' ? 'sve fotografije' : esc(x.file || 'fajl')}</li>`).join('');
        return `<div class="dlv">
<div class="dlv-h"><b>${fmt.photos(d.imageCount || 0)}${d.fileCount > (d.imageCount || 0) ? ` + ${d.fileCount - d.imageCount} ZIP` : ''}, ${fmt.size(d.totalSize)}</b><span>poslato ${fmt.stamp(d.createdAt)}</span></div>
<p>${d.downloads ? `Preuzeto ${d.downloads}× · prvi put ${fmt.stamp(d.firstDownloadAt)}` : '<span class="t-warn">Još nije preuzeto</span>'} · ${d.active ? `link ističe ${fmt.stamp(d.expiresAt)}` : 'link je istekao'}</p>
${log ? `<details><summary>Istorija preuzimanja</summary><ul class="log">${log}</ul></details>` : ''}
${d.active && d.link ? `<div class="btn-row left"><button class="btn sm" data-copy="${esc(d.link)}">Kopiraj link</button><a class="btn sm" href="${esc(d.link)}" target="_blank" rel="noopener">Otvori</a></div>` : ''}
</div>`;
      })
      .join('');

    const html = `<div class="dr-head" style="--c:${b.color}">
  <div class="dr-ico">${App.catIcon(b.category)}</div>
  <div><h2>${esc(b.firstName)} ${esc(b.lastName)}</h2><p>${esc(b.catName)}${b.age ? ' · ' + esc(b.age) : ''}</p></div>
  <button class="x" data-close aria-label="Zatvori">×</button>
</div>
<div class="dr-status">${App.statusPill(b.status)}${b.cardNo ? `<span class="tag">Kartica ${esc(b.cardNo)}</span>` : ''}</div>
<section class="dr-sec"><h3>Termin</h3><dl class="kv">
  <dt>Datum</dt><dd>${esc(fmt.date(b.date, true))} u ${esc(b.time)}</dd>
  <dt>Lokacija</dt><dd>${esc(b.location)}</dd>
</dl></section>
<section class="dr-sec"><h3>Klijent</h3><dl class="kv">
  ${b.parentName ? `<dt>Roditelj</dt><dd>${esc(b.parentName)}</dd>` : ''}
  ${b.birthDate ? `<dt>Datum rođenja</dt><dd>${esc(fmt.date(b.birthDate))}</dd>` : ''}
  <dt>Email</dt><dd><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></dd>
  <dt>Telefon</dt><dd><a href="tel:${esc(String(b.phone).replace(/[^\d+]/g, ''))}">${esc(b.phone)}</a></dd>
</dl>${b.clientKey ? `<a class="link small" href="#clients?open=${encodeURIComponent(b.clientKey)}">Profil klijenta i loyalty</a>` : ''}</section>
${details ? `<section class="dr-sec"><h3>Detalji</h3><dl class="kv">${details}</dl></section>` : ''}
<section class="dr-sec"><h3>Paket i cena</h3><dl class="kv">
  <dt>Paket</dt><dd>${esc(b.packageName || '–')} · ${fmt.money(b.packagePrice)}</dd>
  ${b.extraHours ? `<dt>Dodatna satnica</dt><dd>${String(b.extraHours).replace('.', ',')} h · ${fmt.money(b.extraHours * b.extraHourPrice)}</dd>` : ''}
  ${b.discountPct ? `<dt>Popust</dt><dd>${b.discountPct}%</dd>` : ''}
  ${(b.itemsList || []).length ? `<dt>Izrada</dt><dd>${b.itemsList.map((i) => `${esc(i.name)}${i.qty > 1 ? ` × ${i.qty}` : ''}${i.price ? ` · ${fmt.money(i.price * i.qty)}` : ''}`).join('<br>')}${b.stockTaken ? '<br><small class="sub">skinuto sa stanja</small>' : ''}</dd>` : ''}
  <dt>Ukupno</dt><dd><b>${fmt.money(b.total)}</b></dd>
  ${b.deposit ? `<dt>Kapara</dt><dd>− ${fmt.money(b.deposit)}</dd><dt>Ostatak</dt><dd><b>${fmt.money(b.remaining)}</b></dd>` : ''}
</dl></section>
${b.notes ? `<section class="dr-sec"><h3>Napomena</h3><p class="note-txt">${esc(b.notes)}</p></section>` : ''}
${b.cancelled ? '' : `<section class="dr-sec"><h3>Obrada fotografija</h3>
  <p class="small">${deadline}</p>
  ${b.status === 'upcoming' ? '' : `<label class="switch big"><input type="checkbox" id="edToggle" ${editDone ? 'checked' : ''}><span class="sw"></span><span>Fotografije su obrađene</span></label>`}
</section>
<section class="dr-sec"><h3>Fotografije klijentu</h3>
  ${del || '<p class="small sub">Još nisu poslate.</p>'}
  <a class="btn primary" href="#new?booking=${b.id}">Pošalji fotografije</a>
</section>`}
${mails ? `<section class="dr-sec"><h3>Poslate poruke</h3><ul class="mails">${mails}</ul></section>` : ''}
<div class="dr-actions">
  <a class="btn" href="#book?edit=${b.id}">Izmeni</a>
  ${b.cancelled ? '' : '<button class="btn" id="dConfirm">Pošalji potvrdu</button>'}
  <button class="btn" id="dCancel">${b.cancelled ? 'Vrati termin' : 'Otkaži termin'}</button>
  <button class="btn danger" id="dDelete">Obriši</button>
</div>`;
    const d = drawer.open(html);
    const refresh = async () => {
      renderDrawer(await api('GET', '/api/admin/bookings/' + b.id));
      App.reloadCurrent();
    };
    $('#edToggle', d)?.addEventListener('change', async (e) => {
      await api('POST', `/api/admin/bookings/${b.id}/state`, { edited: e.target.checked });
      toast(e.target.checked ? 'Označeno kao obrađeno' : 'Vraćeno na „čeka obradu“');
      refresh();
    });
    $$('[data-copy]', d).forEach((x) => (x.onclick = () => App.copy(x.dataset.copy)));
    $('#dConfirm', d)?.addEventListener('click', async () => {
      if (!(await ask('Poslati potvrdu termina?', `${b.clientName} dobija email na ${b.email}.`, 'Pošalji'))) return;
      try {
        await api('POST', `/api/admin/bookings/${b.id}/confirm`);
        toast('Potvrda je poslata');
        refresh();
      } catch (e) {
        toast(e.message);
      }
    });
    $('#dCancel', d).onclick = async () => {
      if (!b.cancelled && !(await ask('Otkazati termin?', 'Termin ostaje u evidenciji kao otkazan i ne šalju se podsetnici.', 'Otkaži termin', true))) return;
      await api('POST', `/api/admin/bookings/${b.id}/state`, { cancelled: !b.cancelled });
      toast(b.cancelled ? 'Termin je vraćen' : 'Termin je otkazan');
      refresh();
    };
    $('#dDelete', d).onclick = async () => {
      if (!(await ask('Obrisati zakazivanje?', 'Brisanje se ne može poništiti. Ako je termin samo otkazan, bolje je izabrati „Otkaži termin“.', 'Obriši', true))) return;
      await api('DELETE', '/api/admin/bookings/' + b.id);
      toast('Obrisano');
      drawer.close();
      App.reloadCurrent();
    };
  }

  App.view('booking', { overlay: true, open: openBooking });
})();
