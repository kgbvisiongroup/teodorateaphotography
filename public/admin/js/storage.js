// Skladište fotografija: pregled vašeg diska, pretraga, otpremanje prevlačenjem
// i slanje klijentu vezano za zakazani termin.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, modal } = App;

  let D = { path: '/', items: [], label: 'Skladište', parent: null };
  let sel = new Set();
  let search = '';
  let busy = false;

  const isImg = (it) => it.image;
  const thumb = (it) => `/api/admin/storage/thumb?p=${encodeURIComponent(it.path)}`;
  const fileUrl = (it, dl) => `/api/admin/storage/file?p=${encodeURIComponent(it.path)}${dl ? '&dl=1' : ''}`;

  // ---------- podešavanje (u Podešavanjima) ----------
  async function setup() {
    const box = $('#storageSetup');
    if (!box) return;
    let c;
    try {
      c = (await api('GET', '/api/admin/storage/config')).disk;
    } catch {
      return;
    }
    const space = c.total ? `${fmt.size(c.total - c.free)} od ${fmt.size(c.total)} zauzeto · ${fmt.size(c.free)} slobodno` : '';
    box.innerHTML = `<h2>Skladište fotografija</h2>
<p class="sub small">Vaš disk ili Samba (mrežni) folder montiran na server. Kada je uključeno, u meniju se pojavljuje <b>Skladište fotografija</b> sa pregledom, pretragom i slanjem klijentu.</p>
<form class="sform" id="stForm">
<div class="row2">
  <label class="f">Naziv skladišta<input name="label" value="${esc(c.label || '')}" placeholder="npr. Naš disk"></label>
  <label class="f">Putanja na serveru <small>npr. /mnt/foto</small><input name="path" value="${esc(c.path || '')}" placeholder="/mnt/foto"></label>
</div>
<label class="switch"><input type="checkbox" name="enabled" ${c.enabled ? 'checked' : ''}><span class="sw"></span><span>Uključi skladište <small class="sub">(stavka se pojavljuje u meniju)</small></span></label>
<p class="st-state ${c.ok ? 'ok' : c.path ? 'bad' : ''}">${
      c.path
        ? c.ok
          ? `Fascikla je dostupna${c.writable ? '' : ' (samo za čitanje – otpremanje neće raditi)'}${space ? ' · ' + space : ''}`
          : esc(c.error || 'Fascikla nije dostupna.')
        : 'Putanja još nije upisana.'
    }</p>
<div class="btn-row left"><button class="btn primary">Sačuvaj</button></div>
</form>
<details class="st-help"><summary>Kako da povežem Samba disk (jednom, na serveru)</summary>
<p class="sub small">Prijavite se na server i pokrenite, uz svoje podatke:</p>
<pre class="st-pre">sudo apt install -y cifs-utils
sudo mkdir -p /mnt/foto
sudo nano /etc/samba-foto.cred     # upišite dva reda: username=KORISNIK i password=LOZINKA
sudo chmod 600 /etc/samba-foto.cred
sudo mount -t cifs //IP-DISKA/ime-deljenja /mnt/foto -o credentials=/etc/samba-foto.cred,uid=$(id -u),gid=$(id -g),iocharset=utf8</pre>
<p class="sub small">Da bi ostalo i posle restarta servera, dodajte isti red u <code>/etc/fstab</code>. Zatim ovde upišite <code>/mnt/foto</code> i uključite skladište.</p>
</details>`;
    $('#stForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api('PUT', '/api/admin/storage/config', { label: f.label.value, path: f.path.value, enabled: f.enabled.checked });
        toast('Skladište je sačuvano');
        App.meta = await api('GET', '/api/admin/meta');
        document.body.classList.toggle('no-storage', !App.meta.storage);
        setup();
      } catch (err) {
        toast(err.message);
        setup();
      }
    };
  }
  App.storageSetup = setup;
  addEventListener('hashchange', () => {
    if (location.hash.replace('#', '').split('?')[0] === 'settings') setup();
  });

  // ---------- pregled ----------
  async function load(params) {
    const p = params?.get('p');
    if (p) D.path = p;
    await refresh();
  }

  async function refresh() {
    try {
      D = await api('GET', `/api/admin/storage/list?p=${encodeURIComponent(D.path)}${search ? '&q=' + encodeURIComponent(search) : ''}`);
      sel.clear();
      render();
    } catch (e) {
      $('#storageBox').innerHTML = `<div class="panel"><div class="empty">${esc(e.message)}<br><a class="link" href="#settings">Otvori podešavanja skladišta</a></div></div>`;
    }
  }

  function crumbs() {
    const parts = D.path.split('/').filter(Boolean);
    let acc = '';
    const links = parts.map((p) => {
      acc += '/' + p;
      return `<button class="crumb" data-go="${esc(acc)}">${esc(p)}</button>`;
    });
    return `<nav class="st-crumbs"><button class="crumb" data-go="/">${esc(D.label || 'Skladište')}</button>${links.map((l) => '<span>›</span>' + l).join('')}</nav>`;
  }

  function render() {
    const folders = D.items.filter((i) => i.type === 'folder');
    const files = D.items.filter((i) => i.type === 'file');
    $('#storageBox').innerHTML = `<div class="panel st-panel" id="stDrop">
<div class="toolbar st-bar">
  ${crumbs()}
  <input type="search" id="stSearch" placeholder="Pretraga po imenu" aria-label="Pretraga" value="${esc(search)}">
  <button class="btn sm" id="stNew">Nova fascikla</button>
  <button class="btn sm primary" id="stUp">Otpremi fotografije</button>
  <input type="file" id="stFile" multiple hidden>
</div>
${search ? `<p class="sub small">Rezultati pretrage za „${esc(search)}"${D.truncated ? ' (prikazano prvih 400)' : ''} · <button class="link" id="stClear">poništi</button></p>` : ''}
${
  D.items.length
    ? `<div class="st-grid">${D.items.map(tile).join('')}</div>`
    : `<div class="empty">${search ? 'Nema rezultata.' : 'Fascikla je prazna. Prevucite fotografije ovde da ih otpremite.'}</div>`
}
<p class="sub small st-count">${folders.length} ${folders.length === 1 ? 'fascikla' : 'fascikli'} · ${files.length} ${files.length === 1 ? 'fajl' : 'fajlova'}</p>
</div>
<div class="st-actions" id="stActions" hidden>
  <span id="stSelCount"></span>
  <span class="grow"></span>
  <button class="btn sm primary" id="actSend">Pošalji klijentu</button>
  <button class="btn sm" id="actDl">Preuzmi</button>
  <button class="btn sm danger" id="actDel">Obriši</button>
  <button class="btn sm" id="actNone">Poništi izbor</button>
</div>`;
    bind();
  }

  function tile(it) {
    const on = sel.has(it.path) ? ' on' : '';
    const inner =
      it.type === 'folder'
        ? `<div class="st-ico"><svg viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v10H3z"/></svg></div>`
        : isImg(it)
          ? `<img loading="lazy" src="${thumb(it)}" alt="">`
          : `<div class="st-ico file"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg></div>`;
    return `<div class="st-tile${on}" data-path="${esc(it.path)}" data-type="${it.type}">
<div class="st-thumb">${inner}<button class="st-pick" title="Izaberi"></button></div>
<div class="st-name" title="${esc(it.name)}">${esc(it.name)}</div>
<small>${it.type === 'folder' ? 'fascikla' : fmt.size(it.size)}</small>
</div>`;
  }

  function bind() {
    $$('#storageBox [data-go]').forEach((b) => (b.onclick = () => {
      D.path = b.dataset.go;
      search = '';
      refresh();
    }));
    $('#stClear')?.addEventListener('click', () => {
      search = '';
      refresh();
    });
    const s = $('#stSearch');
    if (s) {
      let t;
      s.oninput = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          search = s.value.trim();
          refresh();
        }, 350);
      };
    }
    $('#stNew').onclick = newFolder;
    $('#stUp').onclick = () => $('#stFile').click();
    $('#stFile').onchange = (e) => upload([...e.target.files]);

    $$('.st-tile').forEach((el) => {
      const p = el.dataset.path;
      el.querySelector('.st-pick').onclick = (e) => {
        e.stopPropagation();
        sel.has(p) ? sel.delete(p) : sel.add(p);
        el.classList.toggle('on', sel.has(p));
        actions();
      };
      el.onclick = () => {
        if (el.dataset.type === 'folder') {
          D.path = p;
          search = '';
          refresh();
        } else {
          const it = D.items.find((x) => x.path === p);
          isImg(it) ? preview(it) : window.open(fileUrl(it, true), '_blank');
        }
      };
    });

    $('#actNone').onclick = () => {
      sel.clear();
      $$('.st-tile').forEach((e) => e.classList.remove('on'));
      actions();
    };
    $('#actDl').onclick = () => [...sel].forEach((p) => window.open(`/api/admin/storage/file?p=${encodeURIComponent(p)}&dl=1`, '_blank'));
    $('#actDel').onclick = remove;
    $('#actSend').onclick = sendDialog;

    // prevlačenje fajlova u fasciklu
    const drop = $('#stDrop');
    ['dragenter', 'dragover'].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add('over');
      })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        if (ev === 'dragleave' && drop.contains(e.relatedTarget)) return;
        drop.classList.remove('over');
      })
    );
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) upload(files);
    });
    actions();
  }

  function actions() {
    const box = $('#stActions');
    box.hidden = sel.size === 0;
    if (sel.size) $('#stSelCount').textContent = `${sel.size} ${sel.size === 1 ? 'izabrano' : 'izabranih'}`;
  }

  // ---------- radnje ----------
  async function upload(files) {
    if (!files.length || busy) return;
    busy = true;
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    toast(`Otpremam ${files.length} ${files.length === 1 ? 'fajl' : 'fajlova'}…`);
    try {
      const r = await api('POST', `/api/admin/storage/upload?p=${encodeURIComponent(D.path)}`, fd);
      toast(`Otpremljeno: ${r.added.length}`);
      await refresh();
    } catch (e) {
      toast(e.message);
    }
    busy = false;
  }

  function newFolder() {
    modal.open(
      `<form class="mform"><h3>Nova fascikla</h3>
<label class="f">Naziv<input name="name" required placeholder="npr. Milica – newborn"></label>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Napravi</button></div></form>`,
      async (f) => {
        await api('POST', '/api/admin/storage/folder', { p: D.path, name: f.name.value });
        await refresh();
      }
    );
  }

  async function remove() {
    const n = sel.size;
    if (!(await ask(`Obrisati ${n} ${n === 1 ? 'stavku' : 'stavki'}?`, 'Premešta se u fasciklu _kanta u skladištu, odakle je možete vratiti ili trajno obrisati.', 'Obriši', true))) return;
    try {
      await api('POST', '/api/admin/storage/delete', { items: [...sel] });
      toast('Premešteno u _kanta');
      await refresh();
    } catch (e) {
      toast(e.message);
    }
  }

  function preview(it) {
    const imgs = D.items.filter(isImg);
    let i = imgs.findIndex((x) => x.path === it.path);
    const d = modal.open(`<div class="st-prev"><img id="stPrevImg" src="${thumb(imgs[i])}&s=l" alt=""><div class="st-prev-bar">
<button class="btn sm" id="pPrev">‹</button><span id="pName"></span><button class="btn sm" id="pNext">›</button>
<span class="grow"></span><a class="btn sm" id="pDl" href="${fileUrl(imgs[i], true)}">Preuzmi</a>
<button type="button" class="btn sm" data-close>Zatvori</button></div></div>`);
    const show = () => {
      $('#stPrevImg').src = thumb(imgs[i]) + '&s=l';
      $('#pName').textContent = imgs[i].name;
      $('#pDl').href = fileUrl(imgs[i], true);
    };
    $('#pPrev').onclick = () => {
      i = (i - 1 + imgs.length) % imgs.length;
      show();
    };
    $('#pNext').onclick = () => {
      i = (i + 1) % imgs.length;
      show();
    };
    show();
    return d;
  }

  // ---------- slanje klijentu, vezano za termin ----------
  async function sendDialog() {
    const bookings = (await App.load('bookings', true)) || [];
    const today = App.today();
    const list = bookings
      .filter((b) => !b.cancelled)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 80);
    const opts = list
      .map((b) => `<option value="${b.id}" data-first="${esc(b.firstName || '')}" data-last="${esc(b.lastName || '')}" data-email="${esc(b.email || '')}" data-name="${esc(b.clientName || '')}">${esc(b.clientName || '—')} · ${esc(b.catName || '')} · ${fmt.date(b.date)}${b.date <= today && b.status !== 'done' ? ' (čeka obradu)' : ''}</option>`)
      .join('');

    modal.open(
      `<form class="mform"><h3>Slanje fotografija klijentu</h3>
<p class="sub small">${sel.size} ${sel.size === 1 ? 'izabrana stavka' : 'izabranih stavki'} iz skladišta. Fotografije se kopiraju u pošiljku — originali ostaju netaknuti.</p>
<label class="f">Zakazivanje <small>povezivanjem se termin odmah vodi kao obrađen</small>
<select name="bookingId" id="sendBk"><option value="">Bez zakazivanja (upisujem ručno)</option>${opts}</select></label>
<div class="row3">
  <label class="f">Oslovljavanje<input name="salutation" placeholder="npr. Draga"></label>
  <label class="f">Ime<input name="firstName" required></label>
  <label class="f">Prezime<input name="lastName" required></label>
</div>
<label class="f">Email<input name="email" type="email" required></label>
<label class="f">Poruka uz link <small>nije obavezno</small><textarea name="message" rows="3"></textarea></label>
<label class="check"><input type="checkbox" name="sendEmail" checked><span>Pošalji email sa linkom odmah</span></label>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Pošalji</button></div></form>`,
      async (f) => {
        const r = await api('POST', '/api/admin/storage/send', {
          items: [...sel],
          bookingId: f.bookingId.value,
          salutation: f.salutation.value,
          firstName: f.firstName.value,
          lastName: f.lastName.value,
          email: f.email.value,
          message: f.message.value,
          sendEmail: f.sendEmail.checked,
        });
        toast(`Poslato ${r.fileCount} ${r.fileCount === 1 ? 'fotografija' : 'fotografija'} · link važi do ${fmt.date(new Date(r.expiresAt).toISOString().slice(0, 10))}`);
        sel.clear();
        await refresh();
      }
    );

    // izbor zakazivanja popunjava podatke klijenta
    const bk = $('#sendBk');
    bk.onchange = () => {
      const o = bk.selectedOptions[0];
      const f = bk.form;
      if (!o || !o.value) return;
      // clientName je roditelj kad se fotografiše beba, inače sama osoba
      const name = (o.dataset.name || '').trim().split(/\s+/).filter(Boolean);
      f.firstName.value = name[0] || o.dataset.first || '';
      f.lastName.value = name.slice(1).join(' ') || o.dataset.last || '';
      f.email.value = o.dataset.email || '';
    };
  }

  App.view('storage', {
    title: 'Skladište fotografija',
    sub: 'Vaše fotografije na disku: pregled, pretraga, otpremanje i slanje klijentu.',
    load,
  });
})();
