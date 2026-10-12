// IN album – uređivač u kome klijent sam slaže svoj album.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const api = async (method, url, body) => {
    const opts = { method, headers: {} };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) {
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(url, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Greška');
    return j;
  };
  const money = (v, cur) => `${Math.round(v * 100) / 100} ${({ EUR: '€', RSD: 'RSD', USD: '$', CHF: 'CHF' })[cur] || cur || '€'}`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------- izbor formata ----------
  async function showPicker() {
    const { formats, currency } = await api('GET', '/api/album/formats');
    $('#pick').hidden = false;
    $('#formats').innerHTML = formats
      .map((f) => {
        const long = 150;
        const w = f.w >= f.h ? long : Math.round((f.w / f.h) * long);
        const h = f.h > f.w ? long : Math.round((f.h / f.w) * long);
        return `<div class="fmt">
<div class="shape" style="width:${w}px;height:${h}px">${esc(f.name.toUpperCase())}</div>
<span class="size">${esc(f.size)}</span>
<h3>${esc(f.name)}</h3>
<p class="meta">${f.spreads * 2}+ strana<br>${esc(f.cover || '')} već od</p>
<div class="price">${money(f.price, currency)}</div>
<button class="btn" data-f="${f.id}">Napravi svoj ${esc(f.name)}</button>
</div>`;
      })
      .join('');
    $$('#formats [data-f]').forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try {
        const { token } = await api('POST', '/api/album/new', { formatId: b.dataset.f });
        location.href = '/album/' + token;
      } catch (e) {
        b.disabled = false;
        toast(e.message);
      }
    }));
  }

  // ---------- uređivač ----------
  const BG = [
    { id: '', name: 'Bela', css: '#fff' },
    { id: 'cream', name: 'Krem', css: '#fbf5ef' },
    { id: 'blush', name: 'Puder', css: '#fbeced' },
    { id: 'sand', name: 'Pesak', css: '#f2e9df' },
    { id: 'sage', name: 'Žalfija', css: '#e8efe6' },
    { id: 'sky', name: 'Nebo', css: '#e7eef5' },
    { id: 'grad1', name: 'Nežni prelaz', css: 'linear-gradient(135deg,#fde8e6,#fff)' },
    { id: 'grad2', name: 'Topli prelaz', css: 'linear-gradient(135deg,#f7e7d3,#fffdfb)' },
    { id: 'dots', name: 'Tačkice', css: 'radial-gradient(#f3dcd9 1.5px,transparent 1.6px) 0 0/14px 14px,#fff' },
    { id: 'lines', name: 'Linije', css: 'repeating-linear-gradient(45deg,#fbeced 0 6px,#fff 6px 12px)' },
    { id: 'hearts', name: 'Srca', css: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M14 20s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8z' fill='%23f6dcdc'/%3E%3C/svg%3E\") 0 0/28px 28px,#fff" },
    { id: 'stars', name: 'Zvezdice', css: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Cpath d='M15 8l1.6 4.4L21 14l-4.4 1.6L15 20l-1.6-4.4L9 14l4.4-1.6z' fill='%23f2e3d6'/%3E%3C/svg%3E\") 0 0/30px 30px,#fff" },
  ];
  const STICKERS = ['♥', '★', '✿', '❀', '☁', '✈', '🎂', '🎈', '👶', '🍼', '🧸', '🌿', '🌸', '✨', '🎄', '🥚'];
  const FRAMES = [
    { id: '', name: 'Bez okvira' },
    { id: 'thin', name: 'Tanka linija' },
    { id: 'thick', name: 'Deblja linija' },
    { id: 'round', name: 'Zaobljeno' },
    { id: 'circle', name: 'Krug' },
    { id: 'polaroid', name: 'Polaroid' },
  ];
  const LAYOUTS = [
    { id: 'full', name: 'Preko cele strane', items: [[2, 2, 96, 96]] },
    { id: 'two', name: 'Dve slike', items: [[2, 2, 47, 96], [51, 2, 47, 96]] },
    { id: 'half', name: 'Po strani', items: [[4, 6, 44, 88], [52, 6, 44, 88]] },
    { id: 'three', name: 'Tri slike', items: [[2, 2, 31, 96], [35, 2, 31, 96], [68, 2, 30, 96]] },
    { id: 'four', name: 'Četiri slike', items: [[2, 2, 47, 47], [51, 2, 47, 47], [2, 51, 47, 47], [51, 51, 47, 47]] },
    { id: 'big2', name: 'Velika + dve', items: [[2, 2, 62, 96], [66, 2, 32, 47], [66, 51, 32, 47]] },
    { id: 'six', name: 'Šest slika', items: [[2, 2, 31, 47], [35, 2, 31, 47], [68, 2, 30, 47], [2, 51, 31, 47], [35, 51, 31, 47], [68, 51, 30, 47]] },
    { id: 'center', name: 'Jedna u sredini', items: [[18, 10, 64, 80]] },
    { id: 'clean', name: 'Prazna strana', items: [] },
  ];

  let P = null; // projekat
  let page = 0; // trenutna strana
  let sel = null; // izabrani element
  let sideTab = 'layouts';
  let undoStack = [];
  let redoStack = [];
  let saveT = null;
  let dirty = false;

  const curPage = () => P.pages[page];
  const isCover = () => page === 0;

  function snapshot() {
    undoStack.push(JSON.stringify(P.pages));
    if (undoStack.length > 40) undoStack.shift();
    redoStack = [];
    updUndo();
  }
  function updUndo() {
    $('#undo').disabled = !undoStack.length;
    $('#redo').disabled = !redoStack.length;
  }
  function applyPages(json) {
    P.pages = JSON.parse(json);
    P.spreads = Math.max(1, P.pages.length - 1);
    page = clamp(page, 0, P.pages.length - 1);
    sel = null;
    drawAll();
    save();
    updUndo();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(P.pages));
    applyPages(undoStack.pop());
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(P.pages));
    applyPages(redoStack.pop());
  }

  function save() {
    dirty = true;
    $('#saved').textContent = 'Čuvam…';
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      try {
        const r = await api('PUT', '/api/album/' + P.token, { pages: P.pages, spreads: P.spreads });
        P.price = r.price;
        $('#priceTop').textContent = money(P.price, P.currency);
        $('#saved').textContent = 'Sačuvano';
        dirty = false;
      } catch (e) {
        $('#saved').textContent = 'Nije sačuvano: ' + e.message;
      }
    }, 900);
  }

  // ---------- crtanje ----------
  function sheetSize() {
    const f = P.format;
    const wrap = $('#sheetWrap');
    const availW = wrap.clientWidth - 44;
    const availH = wrap.clientHeight - 44;
    const ratio = (f.w * 2) / f.h; // dupla strana
    let w = Math.min(availW, 1100);
    let h = w / ratio;
    if (h > availH) {
      h = availH;
      w = h * ratio;
    }
    return { w: Math.max(260, w), h: Math.max(140, h) };
  }

  function bgCss(bg) {
    const b = BG.find((x) => x.id === (bg || ''));
    return b ? b.css : '#fff';
  }

  function itemHtml(it) {
    const style = `left:${it.x}%;top:${it.y}%;width:${it.w}%;height:${it.h}%;z-index:${it.z || 1};${it.rot ? `transform:rotate(${it.rot}deg);` : ''}`;
    const frame = it.frame ? ` fr-${it.frame}` : '';
    if (it.type === 'text') {
      return `<div class="el txt${frame}" data-id="${it.id}" style="${style}">
<div class="t" style="font-size:${it.size || 18}px;color:${it.color || '#4a3236'};text-align:${it.align || 'center'};font-family:${it.font === 'serif' ? "'Italiana',Georgia,serif" : "'Jost',sans-serif"}">${esc(it.text || 'Vaš tekst')}</div>
<i class="h tl"></i><i class="h tr"></i><i class="h bl"></i><i class="h br"></i></div>`;
    }
    if (it.type === 'sticker') {
      return `<div class="el stk${frame}" data-id="${it.id}" style="${style}">
<div class="box">${esc(it.ch || '♥')}</div>
<i class="h tl"></i><i class="h tr"></i><i class="h bl"></i><i class="h br"></i></div>`;
    }
    const photo = it.photoId && P.photos.find((p) => p.id === it.photoId);
    const t = it.fit || { zoom: 1, ox: 0, oy: 0 };
    const inner = photo
      ? `<img src="${photo.thumb}" data-full="${photo.url}" alt="" style="transform:scale(${t.zoom}) translate(${t.ox}%,${t.oy}%)${it.flip ? ' scaleX(-1)' : ''}">`
      : '<span class="drop">Prevucite fotografiju ovde</span>';
    return `<div class="el${photo ? ' has-photo' : ''}${frame}" data-id="${it.id}" style="${style}">
<div class="box">${inner}</div>
<div class="zoom"><button data-z="-1" title="Umanji">−</button><button data-z="1" title="Uvećaj">+</button><button data-z="0" title="Uklopi">↺</button></div>
<i class="h tl"></i><i class="h tr"></i><i class="h bl"></i><i class="h br"></i></div>`;
  }

  function fitSheet() {
    const { w, h } = sheetSize();
    const s = $('#sheet');
    s.style.width = w + 'px';
    s.style.height = h + 'px';
  }

  function drawSheet() {
    if (!P.pages.length) P.pages = [{ kind: 'cover', items: [], bg: null }];
    page = clamp(page, 0, P.pages.length - 1);
    const s = $('#sheet');
    const pg = curPage();
    fitSheet();
    s.style.background = bgCss(pg.bg);
    s.className = 'sheet' + (isCover() ? ' cover' : '');
    s.innerHTML =
      (isCover() ? '<span class="edge l">Zadnja korica</span><span class="edge r">Prednja korica</span>' : '') +
      (pg.items || []).map(itemHtml).join('');
    if (sel) {
      const el = s.querySelector(`[data-id="${sel}"]`);
      if (el) {
        el.classList.add('sel');
        el.style.zIndex = 99;
      } else sel = null;
    }
    $('#pageLabel').textContent = isCover() ? 'Korice' : `Strane ${page * 2} – ${page * 2 + 1}`;
    $('#prevPage').disabled = page === 0;
    $('#nextPage').disabled = page >= P.pages.length - 1;
    updateTools();
  }

  function drawStrip() {
    const strip = $('#strip');
    strip.innerHTML =
      P.pages
        .map((pg, i) => {
          const mini = (pg.items || [])
            .slice(0, 8)
            .map((it) => `<i style="left:${it.x}%;top:${it.y}%;width:${it.w}%;height:${it.h}%"></i>`)
            .join('');
          return `<div class="pg${i === page ? ' on' : ''}" data-p="${i}"><div class="mini" style="background:${bgCss(pg.bg)}">${mini}</div><small>${i === 0 ? 'Korice' : `${i * 2} – ${i * 2 + 1}`}</small></div>`;
        })
        .join('') + `<button class="add" id="addSpread">+ dodaj<br>dupli list</button>`;
    $$('#strip .pg').forEach((el) => (el.onclick = () => {
      page = Number(el.dataset.p);
      sel = null;
      drawAll();
    }));
    $('#addSpread').onclick = () => {
      snapshot();
      P.pages.push({ kind: 'spread', items: [], bg: null });
      P.spreads = P.pages.length - 1;
      page = P.pages.length - 1;
      drawAll();
      save();
      toast('Dodat je dupli list – cena je uvećana');
    };
  }

  function drawGallery() {
    const used = new Set();
    P.pages.forEach((pg) => (pg.items || []).forEach((it) => it.photoId && used.add(it.photoId)));
    $('#galList').innerHTML = P.photos
      .map((p) => `<div class="ph${used.has(p.id) ? ' used' : ''}" draggable="true" data-ph="${p.id}"><img src="${p.thumb}" alt=""><button class="x" title="Ukloni">×</button></div>`)
      .join('');
    $('#galHint').textContent = P.photos.length ? 'Prevucite sliku na stranu albuma' : 'Prevucite slike koje ćete koristiti u albumu';
    $$('#galList .ph').forEach((el) => {
      el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', el.dataset.ph));
      el.querySelector('.x').onclick = async (e) => {
        e.stopPropagation();
        if (!confirm('Ukloniti ovu fotografiju iz galerije i sa strana?')) return;
        await api('DELETE', `/api/album/${P.token}/photos/${el.dataset.ph}`);
        P.photos = P.photos.filter((p) => p.id !== el.dataset.ph);
        P.pages.forEach((pg) => (pg.items = (pg.items || []).filter((it) => it.photoId !== el.dataset.ph)));
        drawAll();
      };
      el.addEventListener('click', () => {
        // klik ubacuje sliku u izabrani okvir
        if (!sel) return;
        const it = curPage().items.find((x) => x.id === sel);
        if (!it || it.type !== 'photo') return;
        snapshot();
        it.photoId = el.dataset.ph;
        it.fit = { zoom: 1, ox: 0, oy: 0 };
        drawAll();
        save();
      });
    });
  }

  function drawSide() {
    const body = $('#sideBody');
    const it = sel && curPage().items.find((x) => x.id === sel);
    if (sideTab === 'layouts') {
      body.innerHTML = `<h4>Raspored na strani</h4><p class="hint">Klik postavlja okvire za slike na trenutnu stranu. Postojeće fotografije ostaju u njima.</p>
<div class="lay-grid">${LAYOUTS.map(
        (l) => `<button class="lay" data-l="${l.id}" title="${esc(l.name)}">${l.items.map((b) => `<i style="position:absolute;left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%"></i>`).join('')}</button>`
      ).join('')}</div>`;
      $$('#sideBody .lay').forEach((b) => (b.onclick = () => applyLayout(b.dataset.l)));
      return;
    }
    if (sideTab === 'bg') {
      body.innerHTML = `<h4>Pozadina strane</h4><p class="hint">Važi za stranu koju trenutno uređujete.</p>
<div class="bgs">${BG.map((b) => `<button data-bg="${b.id}" class="${(curPage().bg || '') === b.id ? 'on' : ''}" style="background:${b.css}" title="${esc(b.name)}"></button>`).join('')}</div>`;
      $$('#sideBody [data-bg]').forEach((b) => (b.onclick = () => {
        snapshot();
        curPage().bg = b.dataset.bg || null;
        drawAll();
        save();
      }));
      return;
    }
    if (sideTab === 'stickers') {
      body.innerHTML = `<h4>Stikeri</h4><p class="hint">Klik dodaje stiker na sredinu strane; posle ga pomerate i uvećavate.</p>
<div class="stk">${STICKERS.map((c) => `<button data-stk="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
      $$('#sideBody [data-stk]').forEach((b) => (b.onclick = () => addItem({ type: 'sticker', ch: b.dataset.stk, x: 44, y: 38, w: 12, h: 24 })));
      return;
    }
    if (sideTab === 'frames') {
      body.innerHTML = `<h4>Okvir izabrane slike</h4><p class="hint">${it ? 'Izaberite izgled okvira.' : 'Prvo kliknite na sliku na strani.'}</p>
<div class="frm">${FRAMES.map((f) => `<button data-fr="${f.id}" class="${it && (it.frame || '') === f.id ? 'on' : ''}" ${it ? '' : 'disabled'}>${esc(f.name)}</button>`).join('')}</div>
${it && it.type === 'text' ? textOptions(it) : ''}`;
      $$('#sideBody [data-fr]').forEach((b) => (b.onclick = () => {
        if (!it) return;
        snapshot();
        it.frame = b.dataset.fr || null;
        drawAll();
        save();
      }));
      bindTextOptions(it);
    }
  }

  function textOptions(it) {
    const colors = ['#4a3236', '#9c8486', '#ffffff', '#c86b74', '#8fb8cf', '#c9a66b'];
    return `<div class="txt-opts"><h4 style="margin-top:18px">Tekst</h4>
<label>Veličina</label><input type="range" id="txtSize" min="10" max="60" value="${it.size || 18}">
<label>Poravnanje</label><div class="colors"><button data-al="left">⟸</button><button data-al="center">≡</button><button data-al="right">⟹</button></div>
<label>Font</label><div class="colors"><button data-fo="sans">Jost</button><button data-fo="serif">Italiana</button></div>
<label>Boja</label><div class="colors">${colors.map((c) => `<button data-col="${c}" style="background:${c}"></button>`).join('')}</div></div>`;
  }
  function bindTextOptions(it) {
    if (!it || it.type !== 'text') return;
    const up = (fn) => {
      snapshot();
      fn();
      drawAll();
      save();
    };
    $('#txtSize')?.addEventListener('change', (e) => up(() => (it.size = Number(e.target.value))));
    $$('#sideBody [data-al]').forEach((b) => (b.onclick = () => up(() => (it.align = b.dataset.al))));
    $$('#sideBody [data-fo]').forEach((b) => (b.onclick = () => up(() => (it.font = b.dataset.fo))));
    $$('#sideBody [data-col]').forEach((b) => (b.onclick = () => up(() => (it.color = b.dataset.col))));
  }

  function drawAll() {
    drawSheet();
    drawStrip();
    drawGallery();
    drawSide();
    $('#priceTop').textContent = money(P.price, P.currency);
  }

  // ---------- elementi ----------
  function addItem(partial) {
    snapshot();
    const items = curPage().items || (curPage().items = []);
    const it = { id: uid(), type: 'photo', x: 10, y: 10, w: 36, h: 60, z: items.length + 1, fit: { zoom: 1, ox: 0, oy: 0 }, ...partial };
    items.push(it);
    sel = it.id;
    drawAll();
    save();
    return it;
  }

  function applyLayout(id) {
    const l = LAYOUTS.find((x) => x.id === id);
    if (!l) return;
    snapshot();
    const pg = curPage();
    const old = (pg.items || []).filter((i) => i.type === 'photo' && i.photoId);
    const keep = (pg.items || []).filter((i) => i.type !== 'photo');
    pg.items = l.items.map((b, i) => ({
      id: uid(),
      type: 'photo',
      x: b[0],
      y: b[1],
      w: b[2],
      h: b[3],
      z: i + 1,
      photoId: old[i] ? old[i].photoId : null,
      fit: { zoom: 1, ox: 0, oy: 0 },
      frame: old[i] ? old[i].frame : null,
    }));
    keep.forEach((k) => pg.items.push(k));
    sel = null;
    drawAll();
    save();
  }

  function updateTools() {
    const it = sel && curPage().items.find((x) => x.id === sel);
    $$('.tools button').forEach((b) => {
      const t = b.dataset.tool;
      b.disabled = ['up', 'down', 'del', 'flip', 'fit'].includes(t) && !it;
    });
  }

  function toolAction(tool) {
    const items = curPage().items || [];
    const it = sel && items.find((x) => x.id === sel);
    if (tool === 'photo') return addItem({ x: 20, y: 18, w: 30, h: 50 });
    if (tool === 'text') return addItem({ type: 'text', text: 'Vaš tekst', x: 28, y: 42, w: 44, h: 14, size: 22, align: 'center', color: '#4a3236' });
    if (!it) return;
    snapshot();
    if (tool === 'del') {
      curPage().items = items.filter((x) => x.id !== it.id);
      sel = null;
    }
    if (tool === 'up') it.z = Math.max(...items.map((x) => x.z || 1)) + 1;
    if (tool === 'down') it.z = Math.min(...items.map((x) => x.z || 1)) - 1;
    if (tool === 'flip') it.flip = !it.flip;
    if (tool === 'fit') it.fit = { zoom: 1, ox: 0, oy: 0 };
    drawAll();
    save();
  }

  // ---------- miš: pomeranje, veličina, slika u okviru ----------
  function bindSheet() {
    const sheet = $('#sheet');
    let drag = null;

    sheet.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.el');
      const handle = e.target.closest('.h');
      const zoomBtn = e.target.closest('.zoom button');
      if (zoomBtn || e.target.isContentEditable) return;
      if (!el) {
        sel = null;
        drawSheet();
        drawSide();
        return;
      }
      const it = curPage().items.find((x) => x.id === el.dataset.id);
      if (!it) return;
      sel = it.id;
      $$('.el', sheet).forEach((x) => x.classList.toggle('sel', x === el));
      drawSide();
      updateTools();
      const r = sheet.getBoundingClientRect();
      drag = {
        it,
        el,
        mode: handle ? 'size' : e.shiftKey && it.photoId ? 'pan' : 'move',
        corner: handle ? [...handle.classList].find((c) => ['tl', 'tr', 'bl', 'br'].includes(c)) : null,
        sx: e.clientX,
        sy: e.clientY,
        ox: it.x,
        oy: it.y,
        ow: it.w,
        oh: it.h,
        fit: { ...(it.fit || { zoom: 1, ox: 0, oy: 0 }) },
        rw: r.width,
        rh: r.height,
        moved: false,
      };
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    sheet.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = ((e.clientX - drag.sx) / drag.rw) * 100;
      const dy = ((e.clientY - drag.sy) / drag.rh) * 100;
      if (Math.abs(dx) + Math.abs(dy) > 0.3) drag.moved = true;
      const it = drag.it;
      if (drag.mode === 'move') {
        it.x = clamp(drag.ox + dx, -10, 100 - 5);
        it.y = clamp(drag.oy + dy, -10, 100 - 5);
      } else if (drag.mode === 'size') {
        const c = drag.corner;
        if (c === 'br') {
          it.w = clamp(drag.ow + dx, 5, 110);
          it.h = clamp(drag.oh + dy, 5, 110);
        } else if (c === 'tr') {
          it.w = clamp(drag.ow + dx, 5, 110);
          it.h = clamp(drag.oh - dy, 5, 110);
          it.y = drag.oy + dy;
        } else if (c === 'bl') {
          it.w = clamp(drag.ow - dx, 5, 110);
          it.x = drag.ox + dx;
          it.h = clamp(drag.oh + dy, 5, 110);
        } else {
          it.w = clamp(drag.ow - dx, 5, 110);
          it.h = clamp(drag.oh - dy, 5, 110);
          it.x = drag.ox + dx;
          it.y = drag.oy + dy;
        }
      } else if (drag.mode === 'pan') {
        it.fit = { zoom: drag.fit.zoom, ox: clamp(drag.fit.ox + dx * 1.6, -60, 60), oy: clamp(drag.fit.oy + dy * 1.6, -60, 60) };
      }
      const el = drag.el;
      el.style.left = it.x + '%';
      el.style.top = it.y + '%';
      el.style.width = it.w + '%';
      el.style.height = it.h + '%';
      const img = el.querySelector('img');
      if (img && drag.mode === 'pan') img.style.transform = `scale(${it.fit.zoom}) translate(${it.fit.ox}%,${it.fit.oy}%)${it.flip ? ' scaleX(-1)' : ''}`;
    });

    const end = () => {
      if (!drag) return;
      if (drag.moved) {
        snapshot();
        save();
        drawStrip();
      }
      drag = null;
    };
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);

    // zumiranje slike u okviru
    sheet.addEventListener('click', (e) => {
      const z = e.target.closest('.zoom button');
      if (!z) return;
      const el = z.closest('.el');
      const it = curPage().items.find((x) => x.id === el.dataset.id);
      if (!it) return;
      snapshot();
      const f = it.fit || (it.fit = { zoom: 1, ox: 0, oy: 0 });
      const k = Number(z.dataset.z);
      if (k === 0) it.fit = { zoom: 1, ox: 0, oy: 0 };
      else f.zoom = clamp(f.zoom + k * 0.15, 1, 3);
      drawSheet();
      save();
    });

    // dupli klik na tekst = izmena
    sheet.addEventListener('dblclick', (e) => {
      const el = e.target.closest('.el.txt');
      if (!el) return;
      const it = curPage().items.find((x) => x.id === el.dataset.id);
      const t = el.querySelector('.t');
      t.contentEditable = 'true';
      t.focus();
      const r = document.createRange();
      r.selectNodeContents(t);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(r);
      let touched = false;
      t.oninput = () => {
        it.text = t.textContent.replace(/\s+$/, '') || 'Vaš tekst';
        if (!touched) {
          touched = true;
          snapshot();
        }
        save();
        drawStrip();
      };
      t.onblur = () => {
        t.contentEditable = 'false';
        it.text = t.textContent.trim() || 'Vaš tekst';
        drawSheet();
        save();
      };
    });

    // prevlačenje iz galerije
    sheet.addEventListener('dragover', (e) => {
      e.preventDefault();
      const el = e.target.closest('.el');
      $$('.el', sheet).forEach((x) => x.classList.toggle('over', x === el));
    });
    sheet.addEventListener('dragleave', () => $$('.el', sheet).forEach((x) => x.classList.remove('over')));
    sheet.addEventListener('drop', (e) => {
      e.preventDefault();
      const photoId = e.dataTransfer.getData('text/plain');
      if (!photoId) return;
      $$('.el', sheet).forEach((x) => x.classList.remove('over'));
      const el = e.target.closest('.el');
      snapshot();
      if (el) {
        const it = curPage().items.find((x) => x.id === el.dataset.id);
        if (it && it.type === 'photo') {
          it.photoId = photoId;
          it.fit = { zoom: 1, ox: 0, oy: 0 };
        }
      } else {
        const r = sheet.getBoundingClientRect();
        const x = clamp(((e.clientX - r.left) / r.width) * 100 - 14, 0, 72);
        const y = clamp(((e.clientY - r.top) / r.height) * 100 - 22, 0, 56);
        const items = curPage().items || (curPage().items = []);
        items.push({ id: uid(), type: 'photo', x, y, w: 28, h: 44, z: items.length + 1, photoId, fit: { zoom: 1, ox: 0, oy: 0 } });
      }
      drawAll();
      save();
    });
  }

  // ---------- pregled i porudžbina ----------
  function dialog(html) {
    const d = $('#dlg');
    d.innerHTML = `<div class="dlg-card${html.wide ? ' wide' : ''}">${html.body}</div>`;
    d.hidden = false;
    d.onclick = (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.hidden = true;
    };
    return d;
  }

  function preview() {
    const f = P.format;
    const w = 760;
    const h = Math.round((w * f.h) / (f.w * 2));
    const pages = P.pages
      .map((pg, i) => {
        const items = (pg.items || [])
          .map((it) => {
            if (it.type === 'text')
              return `<div style="position:absolute;left:${it.x}%;top:${it.y}%;width:${it.w}%;height:${it.h}%;display:grid;align-items:center;font-size:${(it.size || 18) * (w / 1000)}px;color:${it.color || '#4a3236'};text-align:${it.align || 'center'};font-family:${it.font === 'serif' ? "'Italiana',serif" : "'Jost',sans-serif"}">${esc(it.text || '')}</div>`;
            if (it.type === 'sticker')
              return `<div style="position:absolute;left:${it.x}%;top:${it.y}%;width:${it.w}%;height:${it.h}%;display:grid;place-items:center;font-size:${Math.min(it.w * w, (it.h * w) / ((P.format.w * 2) / P.format.h)) / 100 * 0.88}px;line-height:1">${esc(it.ch || '♥')}</div>`;
            const ph = it.photoId && P.photos.find((p) => p.id === it.photoId);
            return `<div style="position:absolute;left:${it.x}%;top:${it.y}%;width:${it.w}%;height:${it.h}%;overflow:hidden;background:#f6f1f0">${ph ? `<img src="${ph.thumb}" style="width:100%;height:100%;object-fit:cover;transform:scale(${(it.fit || {}).zoom || 1}) translate(${(it.fit || {}).ox || 0}%,${(it.fit || {}).oy || 0}%)${it.flip ? ' scaleX(-1)' : ''}">` : ''}</div>`;
          })
          .join('');
        return `<div><small style="color:var(--muted);font-size:12px">${i === 0 ? 'Korice' : `Strane ${i * 2} – ${i * 2 + 1}`}</small>
<div class="p" style="width:${w}px;height:${h}px;background:${bgCss(pg.bg)}">${items}</div></div>`;
      })
      .join('');
    dialog({
      wide: true,
      body: `<h2>Pregled albuma</h2><p class="sub">${esc(P.format.name)} · ${esc(P.format.size)} · ${P.pages.length - 1} duplih listova</p>
<div class="prev-pages">${pages}</div>
<div class="dlg-row"><button class="btn ghost" data-close>Zatvori</button><button class="btn" id="orderFromPrev">Poruči ${money(P.price, P.currency)}</button></div>`,
    });
    $('#orderFromPrev').onclick = () => {
      $('#dlg').hidden = true;
      orderDialog();
    };
  }

  function orderDialog() {
    const used = P.pages.reduce((n, pg) => n + (pg.items || []).filter((i) => i.photoId).length, 0);
    const d = dialog({
      body: `<h2>Poručite svoj album</h2><p class="sub">${esc(P.format.name)} · ${esc(P.format.size)} · ${P.pages.length - 1} duplih listova · ${used} fotografija u albumu</p>
<form id="orderForm">
<label>Ime i prezime</label><input name="name" required>
<label>Email</label><input name="email" type="email" required>
<label>Telefon</label><input name="phone" required>
<label>Poruka (nije obavezno)</label><textarea name="note" placeholder="Posebne želje, rok, način preuzimanja…"></textarea>
<p class="dlg-err" id="orderErr"></p>
<div class="dlg-row"><button type="button" class="btn ghost" data-close>Nazad</button><button class="btn">Pošalji porudžbinu · ${money(P.price, P.currency)}</button></div>
</form>`,
    });
    $('#orderForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const btn = f.querySelector('button.btn:not(.ghost)');
      btn.disabled = true;
      try {
        clearTimeout(saveT);
        await api('PUT', '/api/album/' + P.token, { pages: P.pages, spreads: P.spreads });
        await api('POST', `/api/album/${P.token}/order`, { name: f.name.value, email: f.email.value, phone: f.phone.value, note: f.note.value });
        d.innerHTML = `<div class="dlg-card"><div class="done-box"><h2>Album je poručen!</h2>
<p class="sub">Hvala vam. Javljamo se u najkraćem roku oko izrade i preuzimanja, a potvrdu smo poslali i na vaš email.</p>
<a class="btn" href="/">Nazad na sajt</a></div></div>`;
      } catch (err) {
        $('#orderErr').textContent = err.message;
        btn.disabled = false;
      }
    };
  }

  // ---------- pokretanje ----------
  async function startEditor(token) {
    P = await api('GET', '/api/album/' + token);
    if (P.status === 'ordered' || P.status === 'done') {
      document.body.innerHTML = `<div class="sheet-dialog"><div class="dlg-card"><div class="done-box"><h2>Album je poručen</h2><p class="sub">Ovaj album je već poslat studiju, pa se više ne menja. Ako nešto treba da promenite, javite nam se.</p><a class="btn" href="/">Nazad na sajt</a></div></div></div>`;
      return;
    }
    $('#editor').hidden = false;
    $('#fmtName').textContent = P.format.name;
    $('#fmtSize').textContent = P.format.size;
    drawAll();
    bindSheet();

    $('#addPhotos').onclick = () => $('#photoFile').click();
    $('#photoFile').onchange = async (e) => {
      const files = [...e.target.files];
      if (!files.length) return;
      $('#saved').textContent = `Šaljem ${files.length} ${files.length === 1 ? 'fotografiju' : 'fotografija'}…`;
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      try {
        const r = await api('POST', `/api/album/${P.token}/photos`, fd);
        P.photos.push(...r.added);
        drawGallery();
        $('#saved').textContent = 'Fotografije su dodate';
      } catch (err) {
        toast(err.message);
        $('#saved').textContent = '';
      }
      e.target.value = '';
    };
    $$('.tools button').forEach((b) => (b.onclick = () => toolAction(b.dataset.tool)));
    $$('#sideTabs button').forEach((b) => (b.onclick = () => {
      sideTab = b.dataset.t;
      $$('#sideTabs button').forEach((x) => x.classList.toggle('on', x === b));
      drawSide();
    }));
    $('#prevPage').onclick = () => {
      if (page > 0) {
        page--;
        sel = null;
        drawAll();
      }
    };
    $('#nextPage').onclick = () => {
      if (page < P.pages.length - 1) {
        page++;
        sel = null;
        drawAll();
      }
    };
    $('#undo').onclick = undo;
    $('#redo').onclick = redo;
    $('#preview').onclick = preview;
    $('#order').onclick = orderDialog;
    updUndo();

    addEventListener('resize', fitSheet);
    if (window.ResizeObserver) new ResizeObserver(fitSheet).observe($('#sheetWrap'));
    addEventListener('keydown', (e) => {
      if (e.target.isContentEditable || /input|textarea/i.test(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') return e.shiftKey ? redo() : undo();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') return redo();
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        toolAction('del');
      }
    });
    addEventListener('beforeunload', (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  const token = document.body.dataset.token;
  (token ? startEditor(token) : showPicker()).catch((e) => {
    document.body.innerHTML = `<div class="sheet-dialog"><div class="dlg-card"><h2>Greška</h2><p class="sub">${esc(e.message)}</p><a class="btn" href="/">Nazad na sajt</a></div></div>`;
  });
})();
