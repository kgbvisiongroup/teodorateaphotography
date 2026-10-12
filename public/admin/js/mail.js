// Pošta: sanduče sinhronizovano sa mail serverom (IMAP). Folderi, čitanje, odgovor, prosleđivanje,
// premeštanje, spam, brisanje, prilozi i sopstveni folderi.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, modal } = App;

  const ICON = {
    '\\Inbox': '<path d="M3.5 12.5 6 5.5h12l2.5 7v6h-17z"/><path d="M3.5 12.5H8l1.5 2.5h5l1.5-2.5h4.5"/>',
    '\\Sent': '<path d="m4 12 16-7.5L13.5 20 11 13z"/><path d="m11 13 9-8.5"/>',
    '\\Drafts': '<path d="M5 19h4L19.5 8.5l-4-4L5 15z"/>',
    '\\Junk': '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
    '\\Trash': '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
    '\\Archive': '<path d="M4 5h16v4H4zM5.5 9v10h13V9M10 13h4"/>',
    '\\Flagged': '<path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z"/>',
    '\\All': '<path d="M4 6h16M4 12h16M4 18h16"/>',
    folder: '<path d="M3.5 7.5v11h17V9.5h-9l-2-2z"/>',
  };
  const ic = (k) => `<svg viewBox="0 0 24 24">${ICON[k] || ICON.folder}</svg>`;

  const st = { folders: [], folder: 'INBOX', page: 1, q: '', list: null, sel: new Set(), open: null, msg: null, contacts: null, showImages: false };

  async function load(params) {
    const box = $('#mailbox');
    const status = await api('GET', '/api/admin/mail/status');
    if (!status.configured || !status.ok) {
      box.innerHTML = `<div class="panel empty mb-setup">${ic('\\Inbox')}<h2>${status.configured ? 'Veza sa mail serverom ne radi' : 'Pošta još nije povezana'}</h2>
<p>${status.configured ? esc(status.error) : 'Unesite podatke mail naloga (IMAP), pa će se ovde pojaviti sve poruke i folderi sa servera.'}</p>
${App.isAdmin() ? '<a class="btn primary" href="#email">Podesi poštu</a>' : '<p class="small">Zamolite administratora da podesi poštu.</p>'}</div>`;
      return;
    }
    if (!box.querySelector('.mbox')) {
      box.innerHTML = `<div class="mbox" id="mbox">
<aside class="mb-folders"><button class="btn primary block" id="mbCompose">Nova poruka</button><nav id="mbFolders"></nav><button class="link small" id="mbNewFolder">Novi folder</button></aside>
<section class="mb-list"><div class="mb-tools" id="mbTools"></div><div id="mbRows"></div><div class="mb-pager" id="mbPager"></div></section>
<section class="mb-read" id="mbRead"></section></div>`;
      bind();
    }
    if (params?.get('compose')) compose({ to: params.get('compose') });
    await Promise.all([loadFolders(), loadList()]);
    if (!st.open) renderRead();
  }

  // ---------- folderi ----------
  async function loadFolders() {
    st.folders = await api('GET', '/api/admin/mail/folders');
    if (!st.folders.find((f) => f.path === st.folder)) st.folder = st.folders[0]?.path || 'INBOX';
    const inbox = st.folders.find((f) => f.special === '\\Inbox');
    $('#navMail').textContent = inbox?.unseen || '';
    $('#mbFolders').innerHTML =
      `<select class="mb-fsel" id="mbFsel" aria-label="Folder">${st.folders.map((f) => `<option value="${esc(f.path)}"${f.path === st.folder ? ' selected' : ''}>${esc(f.name)}${f.unseen ? ` (${f.unseen})` : ''}</option>`).join('')}</select>` +
      st.folders
        .map(
          (f) => `<a href="#" class="mb-f${f.path === st.folder ? ' on' : ''}" data-path="${esc(f.path)}" style="--d:${f.depth}">${ic(f.special || 'folder')}<span>${esc(f.name)}</span>${f.unseen ? `<b>${f.unseen}</b>` : ''}${
            f.special ? '' : `<button class="mb-fmore" data-fmenu="${esc(f.path)}" aria-label="Opcije foldera ${esc(f.name)}">⋯</button>`
          }</a>`
        )
        .join('');
  }
  const folderName = (p) => st.folders.find((f) => f.path === p)?.name || p;
  const specialPath = (sp) => st.folders.find((f) => f.special === sp)?.path;

  // ---------- lista poruka ----------
  async function loadList(keepSel) {
    if (!keepSel) st.sel.clear();
    $('#mbRows').innerHTML = '<div class="mb-loading">Učitavam poruke…</div>';
    try {
      st.list = await api('GET', `/api/admin/mail/messages?folder=${encodeURIComponent(st.folder)}&page=${st.page}&q=${encodeURIComponent(st.q)}`);
    } catch (e) {
      $('#mbRows').innerHTML = `<div class="empty small">${esc(e.message)}</div>`;
      return;
    }
    renderList();
  }
  function shortDate(ts) {
    const d = new Date(ts);
    const t = new Date();
    if (d.toDateString() === t.toDateString()) return `${App.two(d.getHours())}:${App.two(d.getMinutes())}`;
    if (d.getFullYear() === t.getFullYear()) return `${d.getDate()}. ${App.MONTHS_NOM[d.getMonth()].slice(0, 3).toLowerCase()}`;
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
  }
  function renderTools() {
    const n = st.sel.size;
    const isJunk = st.folder === specialPath('\\Junk');
    const others = st.folders.filter((f) => f.path !== st.folder);
    $('#mbTools').innerHTML = n
      ? `<label class="mb-chk"><input type="checkbox" id="mbAll" checked aria-label="Poništi izbor"></label><span class="small">${n} izabrano</span>
<button class="btn sm" data-bulk="read">Pročitano</button><button class="btn sm" data-bulk="unread">Nepročitano</button>
<select class="sm-select" id="mbMove" aria-label="Premesti u folder"><option value="">Premesti u…</option>${others.map((f) => `<option value="${esc(f.path)}">${esc(f.name)}</option>`).join('')}</select>
<button class="btn sm" data-bulk="${isJunk ? 'notspam' : 'spam'}">${isJunk ? 'Nije spam' : 'Spam'}</button><button class="btn sm danger" data-bulk="delete">Obriši</button>`
      : `<label class="mb-chk"><input type="checkbox" id="mbAll" aria-label="Izaberi sve"></label>
<form id="mbSearch" class="mb-search"><input type="search" name="q" value="${esc(st.q)}" placeholder="Pretraga u folderu ${esc(folderName(st.folder))}" aria-label="Pretraga"></form>
<button class="btn sm icon" id="mbRefresh" title="Osveži" aria-label="Osveži"><svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.1-5M19 4.5V9h-4.5"/></svg></button>`;
  }
  function renderList() {
    renderTools();
    const L = st.list;
    $('#mbRows').innerHTML = L.items.length
      ? L.items
          .map(
            (m) => `<div class="mrow${m.seen ? '' : ' unread'}${st.open?.uid === m.uid ? ' on' : ''}" data-uid="${m.uid}" tabindex="0" role="button">
<label class="mb-chk" onclick="event.stopPropagation()"><input type="checkbox" data-sel="${m.uid}" ${st.sel.has(m.uid) ? 'checked' : ''} aria-label="Izaberi"></label>
<button class="star${m.flagged ? ' on' : ''}" data-star="${m.uid}" aria-label="Zvezdica">${ic('\\Flagged')}</button>
<div class="m-main"><b>${esc(st.folder === specialPath('\\Sent') ? 'Za: ' + (m.to[0]?.name || m.to[0]?.address || '') : m.from.name || m.from.address)}</b><span>${m.answered ? '<i class="ans" title="Odgovoreno">↩</i> ' : ''}${esc(m.subject)}</span></div>
<div class="m-side">${m.attachment ? '<svg class="clip" viewBox="0 0 24 24" aria-label="Prilog"><path d="m19 11-7.5 7.5a4.5 4.5 0 0 1-6.4-6.4l8-8a3 3 0 0 1 4.2 4.2l-8 8a1.5 1.5 0 0 1-2.1-2.1L14.5 7"/></svg>' : ''}<small>${shortDate(m.date)}</small></div></div>`
          )
          .join('')
      : `<div class="empty small">${st.q ? 'Nema poruka za tu pretragu.' : 'Ovaj folder je prazan.'}</div>`;
    const from = (st.page - 1) * 40 + 1;
    $('#mbPager').innerHTML = L.total
      ? `<span class="small sub">${from}–${Math.min(L.total, from + L.items.length - 1)} od ${L.total}</span><button class="btn sm icon" data-pg="-1" ${st.page <= 1 ? 'disabled' : ''} aria-label="Novije">‹</button><button class="btn sm icon" data-pg="1" ${st.page >= L.pages ? 'disabled' : ''} aria-label="Starije">›</button>`
      : '';
  }

  // ---------- čitanje ----------
  function renderRead() {
    const r = $('#mbRead');
    const m = st.msg;
    $('#mbox').classList.toggle('reading', !!m);
    if (!m) {
      r.innerHTML = `<div class="mb-empty">${ic('\\Inbox')}<p>Izaberite poruku sa liste.</p></div>`;
      return;
    }
    const isJunk = st.folder === specialPath('\\Junk');
    const who = (list) => list.map((a) => (a.name ? `${esc(a.name)} <span class="sub">&lt;${esc(a.address)}&gt;</span>` : esc(a.address))).join(', ');
    const f = m.from[0] || { name: '', address: '' };
    r.innerHTML = `<div class="mr-bar">
<button class="btn sm mr-back" data-act="back">‹ Nazad</button>
<button class="btn sm" data-act="reply">Odgovori</button>${m.to.length + m.cc.length > 1 ? '<button class="btn sm" data-act="replyAll">Odgovori svima</button>' : ''}<button class="btn sm" data-act="forward">Prosledi</button>
<select class="sm-select" data-act-move aria-label="Premesti u folder"><option value="">Premesti u…</option>${st.folders.filter((x) => x.path !== st.folder).map((x) => `<option value="${esc(x.path)}">${esc(x.name)}</option>`).join('')}</select>
<button class="btn sm" data-act="${isJunk ? 'notspam' : 'spam'}">${isJunk ? 'Nije spam' : 'Spam'}</button>
<button class="btn sm" data-act="unread">Nepročitano</button>
<button class="btn sm danger" data-act="delete">Obriši</button></div>
<div class="mr-head"><h2>${esc(m.subject)}</h2>
<div class="mr-from">${App.avatar({ name: f.name || f.address })}<div><b>${esc(f.name || f.address)}</b> ${f.name ? `<span class="sub small">&lt;${esc(f.address)}&gt;</span>` : ''}<small>Za: ${who(m.to)}${m.cc.length ? ` · Cc: ${who(m.cc)}` : ''}</small></div><small class="mr-date">${fmt.stampLong(m.date)}</small></div></div>
${m.remote && !st.showImages ? '<div class="mr-imgs">Slike sa interneta su sakrivene radi privatnosti. <button class="link small" data-act="images">Prikaži slike</button></div>' : ''}
<iframe class="mr-body" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" title="Sadržaj poruke"></iframe>
${m.attachments.length ? `<div class="mr-att">${m.attachments
      .map((a) => `<a class="att" href="/api/admin/mail/attachment?folder=${encodeURIComponent(st.folder)}&uid=${m.uid}&idx=${a.idx}" download>${ic('\\Archive')}<span><b>${esc(a.filename)}</b><small>${fmt.size(a.size)}</small></span></a>`)
      .join('')}</div>` : ''}`;
    const fr = r.querySelector('iframe');
    const csp = `default-src 'none'; img-src data: ${st.showImages ? 'https: http:' : ''}; style-src 'unsafe-inline'; font-src data:`;
    fr.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#3b2c2e;margin:0;padding:4px 2px 20px;word-wrap:break-word}img{max-width:100%;height:auto}pre{white-space:pre-wrap;font-family:inherit}blockquote{margin:0 0 0 6px;padding-left:12px;border-left:2px solid #e5cfd1;color:#7d6a6c}a{color:#b5525c}</style></head><body>${m.html || m.textHtml || `<pre>${esc(m.text)}</pre>`}</body></html>`;
    fr.onload = () => {
      try {
        fr.style.height = Math.max(160, fr.contentDocument.documentElement.scrollHeight + 8) + 'px';
      } catch {}
    };
  }
  async function openMsg(uid) {
    st.showImages = false;
    $('#mbRead').innerHTML = '<div class="mb-loading">Učitavam poruku…</div>';
    $('#mbox').classList.add('reading');
    try {
      st.msg = await api('GET', `/api/admin/mail/message?folder=${encodeURIComponent(st.folder)}&uid=${uid}`);
      st.open = { uid };
    } catch (e) {
      st.msg = null;
      toast(e.message);
    }
    renderRead();
    const row = $(`.mrow[data-uid="${uid}"]`);
    if (row) {
      $$('.mrow.on').forEach((x) => x.classList.remove('on'));
      row.classList.add('on');
      if (row.classList.contains('unread')) {
        row.classList.remove('unread');
        loadFolders();
      }
    }
  }

  // ---------- radnje ----------
  async function act(action, uids, target) {
    await api('POST', '/api/admin/mail/action', { folder: st.folder, uids, action, target });
    const msg = { read: 'Označeno kao pročitano', unread: 'Označeno kao nepročitano', spam: 'Premešteno u Spam', notspam: 'Vraćeno u Primljeno', delete: st.folder === specialPath('\\Trash') ? 'Trajno obrisano' : 'Premešteno u Kantu', move: 'Premešteno u ' + folderName(target) }[action];
    if (msg) toast(msg);
    if (['spam', 'notspam', 'delete', 'move'].includes(action) && st.open && uids.includes(st.open.uid)) {
      st.open = null;
      st.msg = null;
      renderRead();
    }
    await Promise.all([loadFolders(), loadList()]);
  }

  function bind() {
    const box = $('#mbox');
    box.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.closest('#mbCompose')) return compose({});
      if (t.closest('#mbNewFolder')) return newFolder();
      const fm = t.closest('[data-fmenu]');
      if (fm) {
        e.preventDefault();
        e.stopPropagation();
        return folderMenu(fm.dataset.fmenu);
      }
      const fl = t.closest('.mb-f');
      if (fl) {
        e.preventDefault();
        return switchFolder(fl.dataset.path);
      }
      if (t.closest('#mbRefresh')) return Promise.all([loadFolders(), loadList()]).then(() => toast('Osveženo'));
      const star = t.closest('[data-star]');
      if (star) {
        e.stopPropagation();
        const on = star.classList.toggle('on');
        return api('POST', '/api/admin/mail/action', { folder: st.folder, uids: [Number(star.dataset.star)], action: on ? 'flag' : 'unflag' });
      }
      const bulk = t.closest('[data-bulk]');
      if (bulk) {
        const uids = [...st.sel];
        if (bulk.dataset.bulk === 'delete' && st.folder === specialPath('\\Trash') && !(await ask('Trajno obrisati poruke?', 'Poruke se brišu sa servera i ne mogu da se vrate.', 'Obriši', true))) return;
        return act(bulk.dataset.bulk, uids);
      }
      const pg = t.closest('[data-pg]');
      if (pg) {
        st.page += Number(pg.dataset.pg);
        return loadList();
      }
      const row = t.closest('.mrow');
      if (row && !t.closest('.mb-chk')) return openMsg(Number(row.dataset.uid));
      const a = t.closest('[data-act]');
      if (a && st.msg) {
        const k = a.dataset.act;
        if (k === 'back') {
          st.open = null;
          st.msg = null;
          return renderRead();
        }
        if (k === 'images') {
          st.showImages = true;
          return renderRead();
        }
        if (k === 'reply' || k === 'replyAll' || k === 'forward') return compose({ mode: k, msg: st.msg });
        if (k === 'delete' && st.folder === specialPath('\\Trash') && !(await ask('Trajno obrisati poruku?', 'Poruka se briše sa servera i ne može da se vrati.', 'Obriši', true))) return;
        if (k === 'unread') {
          await act('unread', [st.msg.uid]);
          st.open = null;
          st.msg = null;
          return renderRead();
        }
        return act(k, [st.msg.uid]);
      }
    });
    box.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'mbAll') {
        if (t.checked) st.list.items.forEach((m) => st.sel.add(m.uid));
        else st.sel.clear();
        return renderList();
      }
      if (t.dataset.sel) {
        const u = Number(t.dataset.sel);
        t.checked ? st.sel.add(u) : st.sel.delete(u);
        return renderTools();
      }
      if (t.id === 'mbMove' && t.value) return act('move', [...st.sel], t.value);
      if (t.hasAttribute('data-act-move') && t.value) return act('move', [st.msg.uid], t.value);
      if (t.id === 'mbFsel') return switchFolder(t.value);
    });
    box.addEventListener('submit', (e) => {
      if (e.target.id !== 'mbSearch') return;
      e.preventDefault();
      st.q = e.target.q.value.trim();
      st.page = 1;
      loadList();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('mrow')) openMsg(Number(e.target.dataset.uid));
    });
  }

  function switchFolder(path) {
    st.folder = path;
    st.page = 1;
    st.q = '';
    st.open = null;
    st.msg = null;
    renderRead();
    $$('.mb-f').forEach((x) => x.classList.toggle('on', x.dataset.path === path));
    loadList();
  }

  function newFolder() {
    modal.open(
      `<form class="mform"><h3>Novi folder</h3><label class="f">Naziv<input name="name" required placeholder="npr. Ugovori"></label><p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Napravi</button></div></form>`,
      async (f) => {
        st.folders = await api('POST', '/api/admin/mail/folders', { name: f.name.value });
        toast('Folder je napravljen');
        loadFolders();
      }
    );
  }
  function folderMenu(path) {
    const f = st.folders.find((x) => x.path === path);
    modal.open(
      `<form class="mform"><h3>Folder: ${esc(f.name)}</h3><label class="f">Novi naziv<input name="name" value="${esc(f.name)}" required></label><p class="err"></p>
<div class="btn-row"><button type="button" class="btn danger" id="fDel">Obriši folder</button><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Preimenuj</button></div></form>`,
      async (fm) => {
        await api('PUT', '/api/admin/mail/folders', { path, name: fm.name.value });
        if (st.folder === path) st.folder = 'INBOX';
        toast('Folder je preimenovan');
        loadFolders();
        loadList();
      }
    );
    $('#fDel').onclick = async () => {
      modal.close();
      if (!(await ask(`Obrisati folder „${f.name}“?`, `Briše se sa servera zajedno sa ${f.total} ${f.total === 1 ? 'porukom' : 'poruka'} u njemu.`, 'Obriši', true))) return;
      try {
        await api('DELETE', '/api/admin/mail/folders?path=' + encodeURIComponent(path));
        if (st.folder === path) switchFolder('INBOX');
        toast('Folder je obrisan');
        loadFolders();
      } catch (e) {
        toast(e.message);
      }
    };
  }

  // ---------- nova poruka / odgovor / prosleđivanje ----------
  async function compose({ mode, msg, to }) {
    if (!st.contacts) st.contacts = await api('GET', '/api/admin/mail/contacts').catch(() => []);
    const fmtAddr = (a) => (a.name ? `${a.name} <${a.address}>` : a.address);
    let toV = to || '', ccV = '', subject = '', body = '';
    if (msg) {
      const from = msg.replyTo.length ? msg.replyTo : msg.from;
      const quote = `\n\n\nDana ${fmt.stampLong(msg.date)}, ${msg.from[0]?.name || msg.from[0]?.address} je napisao/la:\n` + (msg.text || '').split('\n').map((l) => '> ' + l).join('\n');
      if (mode === 'forward') {
        subject = /^fwd?:/i.test(msg.subject) ? msg.subject : 'Fwd: ' + msg.subject;
        body = `\n\n\n---------- Prosleđena poruka ----------\nOd: ${msg.from.map(fmtAddr).join(', ')}\nDatum: ${fmt.stampLong(msg.date)}\nNaslov: ${msg.subject}\nZa: ${msg.to.map(fmtAddr).join(', ')}\n\n${msg.text || ''}`;
      } else {
        subject = /^re:/i.test(msg.subject) ? msg.subject : 'Re: ' + msg.subject;
        toV = from.map(fmtAddr).join(', ');
        if (mode === 'replyAll') {
          const me = (App.meta?.mailUser || '').toLowerCase();
          ccV = [...msg.to, ...msg.cc].filter((a) => a.address.toLowerCase() !== me && !from.some((f) => f.address === a.address)).map(fmtAddr).join(', ');
        }
        body = quote;
      }
    }
    const d = modal.open(
      `<form class="mform compose"><h3>${mode === 'forward' ? 'Prosledi poruku' : mode ? 'Odgovor' : 'Nova poruka'}</h3>
<datalist id="mailContacts">${(st.contacts || []).map((c) => `<option value="${esc(c.name ? `${c.name} <${c.email}>` : c.email)}">`).join('')}</datalist>
<label class="f">Za<input name="to" value="${esc(toV)}" list="mailContacts" required autocomplete="off" placeholder="ime@primer.rs (više adresa odvojite zarezom)"></label>
<div class="cc-row" ${ccV ? '' : 'hidden'}><label class="f">Cc<input name="cc" value="${esc(ccV)}" list="mailContacts" autocomplete="off"></label><label class="f">Bcc<input name="bcc" list="mailContacts" autocomplete="off"></label></div>
${ccV ? '' : '<button type="button" class="link small" id="ccShow">Dodaj Cc / Bcc</button>'}
<label class="f">Naslov<input name="subject" value="${esc(subject)}"></label>
<label class="f">Poruka<textarea name="body" rows="12">${esc(body)}</textarea></label>
<div class="att-pick"><input type="file" name="files" multiple id="cFiles" hidden><button type="button" class="btn sm" id="cAttach">Dodaj prilog</button><span class="small sub" id="cFileList"></span>
${mode === 'forward' && msg.attachments.length ? `<label class="check inline"><input type="checkbox" name="fwdAtt" checked><span>Prosledi i priloge (${msg.attachments.length})</span></label>` : ''}</div>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Pošalji</button></div></form>`,
      async (f) => {
        const fd = new FormData();
        for (const k of ['to', 'cc', 'bcc', 'subject', 'body']) fd.append(k, f.elements[k].value);
        for (const file of f.files.files) fd.append('files', file, file.name);
        if (msg && mode !== 'forward') {
          fd.append('inReplyTo', msg.messageId);
          fd.append('references', [...msg.references, msg.messageId].filter(Boolean).join(' '));
          fd.append('replyFolder', st.folder);
          fd.append('replyUid', msg.uid);
        }
        if (mode === 'forward' && f.fwdAtt?.checked) {
          fd.append('fwdFolder', st.folder);
          fd.append('fwdUid', msg.uid);
          fd.append('fwdAttachments', '1');
        }
        await api('POST', '/api/admin/mail/send', fd);
        toast('Poruka je poslata');
        if (App.current === 'mail') {
          loadFolders();
          if (st.folder === specialPath('\\Sent')) loadList();
        }
      }
    );
    d.classList.add('xwide');
    d.addEventListener('close', () => d.classList.remove('xwide'), { once: true });
    $('#ccShow', d)?.addEventListener('click', (e) => {
      $('.cc-row', d).hidden = false;
      e.target.remove();
    });
    $('#cAttach', d).onclick = () => $('#cFiles', d).click();
    $('#cFiles', d).onchange = (e) => ($('#cFileList', d).textContent = [...e.target.files].map((x) => `${x.name} (${fmt.size(x.size)})`).join(', '));
    const ta = d.querySelector('textarea');
    if (mode) {
      ta.focus();
      ta.setSelectionRange(0, 0);
      ta.scrollTop = 0;
    } else if (to) d.querySelector('[name=subject]').focus();
  }
  App.composeMail = compose;

  App.view('mail', { title: 'Pošta', sub: 'Sinhronizovano sa mail serverom – sve izmene se vide i na telefonu i u drugim programima.', load, noReload: false });
})();
