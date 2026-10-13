// Skladište fotografija: vaš disk i Google Drive na jednom mestu – pregled, pretraga,
// otpremanje prevlačenjem i slanje klijentu vezano za zakazani termin.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, modal } = App;

  let prov = localStorage.getItem('stProv') || 'disk';
  let D = { path: '/', items: [], crumbs: [], providers: [], label: 'Skladište' };
  let sel = new Set();
  let search = '';
  let busy = false;

  const q = (o) =>
    Object.entries(o)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  const thumb = (it) => `/api/admin/storage/thumb?${q({ provider: prov, p: it.path })}`;
  const fileUrl = (it, dl) => `/api/admin/storage/file?${q({ provider: prov, p: it.path })}${dl ? '&dl=1' : ''}`;

  // ================= podešavanje (u Podešavanjima) =================
  async function setup() {
    const box = $('#storageSetup');
    if (!box) return;
    let c;
    try {
      c = await api('GET', '/api/admin/storage/config');
    } catch {
      return;
    }
    const d = c.disk;
    const g = c.google;
    const space = d.total ? `${fmt.size(d.total - d.free)} od ${fmt.size(d.total)} zauzeto · ${fmt.size(d.free)} slobodno` : '';

    box.innerHTML = `<h2>Skladište fotografija</h2>
<p class="sub small">Mesto gde čuvate sve fotografije. Možete koristiti Google Drive, svoj disk, ili oboje – stavka <b>Skladište fotografija</b> pojavljuje se u meniju čim uključite bar jedno.</p>

<div class="st-src">
  <h3>Google Drive</h3>
  ${
    g.connected
      ? `<p class="st-state ok">Povezano${g.email ? ' · ' + esc(g.email) : ''} · fascikla „${esc(g.rootName)}"${g.error ? ' · ' + esc(g.error) : ''}</p>
<form class="sform" id="gForm">
  <div class="row2">
    <label class="f">Naziv u panelu<input name="label" value="${esc(g.label)}"></label>
    <label class="f">Fascikla u Drive-u<input name="rootName" value="${esc(g.rootName)}"></label>
  </div>
  <label class="switch"><input type="checkbox" name="enabled" ${g.enabled ? 'checked' : ''}><span class="sw"></span><span>Uključi Google Drive u skladištu</span></label>
  <div class="btn-row left"><button class="btn primary">Sačuvaj</button><button type="button" class="btn danger" id="gOff">Prekini vezu</button></div>
</form>`
      : `<p class="sub small">Panel u vašem Drive-u pravi fasciklu „${esc(g.rootName)}" i radi samo sa njom – ostatak Drive-a ne vidi. Povezivanje ide kodom, bez domena i sertifikata.</p>
<form class="sform" id="gStart">
  <div class="row2">
    <label class="f">Client ID<input name="clientId" placeholder="${g.hasApp ? 'već upisan – ostavite prazno' : '…apps.googleusercontent.com'}"></label>
    <label class="f">Client secret<input name="clientSecret" placeholder="${g.hasApp ? 'već upisan – ostavite prazno' : 'GOCSPX-…'}"></label>
  </div>
  <div class="btn-row left"><button class="btn primary">Poveži Google Drive</button></div>
</form>
<details class="st-help"><summary>Gde se dobijaju Client ID i secret (jednom, 5 minuta)</summary>
<ol class="st-steps">
  <li>Otvorite <b>console.cloud.google.com</b> i napravite projekat (npr. „Teodora Studio").</li>
  <li><i>APIs &amp; Services → Library</i> → uključite <b>Google Drive API</b>.</li>
  <li><i>APIs &amp; Services → OAuth consent screen</i> → tip <b>External</b>, upišite naziv i svoj email, pa kliknite <b>Publish app</b> (da veza ne ističe na 7 dana).</li>
  <li><i>Credentials → Create credentials → OAuth client ID</i> → tip <b>TVs and Limited Input devices</b>.</li>
  <li>Prekopirajte <b>Client ID</b> i <b>Client secret</b> ovde.</li>
</ol></details>`
  }
</div>

<div class="st-src">
  <h3>Naš disk (lokalni ili Samba)</h3>
  <form class="sform" id="stForm">
    <div class="row2">
      <label class="f">Naziv u panelu<input name="label" value="${esc(d.label || '')}" placeholder="npr. Naš disk"></label>
      <label class="f">Putanja na serveru <small>npr. /mnt/foto</small><input name="path" value="${esc(d.path || '')}" placeholder="/mnt/foto"></label>
    </div>
    <label class="switch"><input type="checkbox" name="enabled" ${d.enabled ? 'checked' : ''}><span class="sw"></span><span>Uključi disk u skladištu</span></label>
    <p class="st-state ${d.ok ? 'ok' : d.path ? 'bad' : ''}">${
      d.path
        ? d.ok
          ? `Fascikla je dostupna${d.writable ? '' : ' (samo za čitanje – otpremanje neće raditi)'}${space ? ' · ' + space : ''}`
          : esc(d.error || 'Fascikla nije dostupna.')
        : 'Putanja još nije upisana.'
    }</p>
    <div class="btn-row left"><button class="btn primary">Sačuvaj</button></div>
  </form>
  <details class="st-help"><summary>Kako da povežem Samba disk (jednom, na serveru)</summary>
<pre class="st-pre">sudo apt install -y cifs-utils
sudo mkdir -p /mnt/foto
sudo nano /etc/samba-foto.cred     # dva reda: username=KORISNIK i password=LOZINKA
sudo chmod 600 /etc/samba-foto.cred
sudo mount -t cifs //IP-DISKA/ime-deljenja /mnt/foto -o credentials=/etc/samba-foto.cred,uid=$(id -u),gid=$(id -g),iocharset=utf8</pre>
<p class="sub small">Da ostane posle restarta servera, isti red dodajte u <code>/etc/fstab</code>.</p>
</details>
</div>`;

    const save = async (body) => {
      try {
        await api('PUT', '/api/admin/storage/config', body);
        toast('Sačuvano');
      } catch (e) {
        toast(e.message);
      }
      App.meta = await api('GET', '/api/admin/meta');
      document.body.classList.toggle('no-storage', !App.meta.storage);
      setup();
    };

    $('#stForm').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      save({ disk: { label: f.label.value, path: f.path.value, enabled: f.enabled.checked } });
    };
    $('#gForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      save({ google: { label: f.label.value, rootName: f.rootName.value, enabled: f.enabled.checked } });
    });
    $('#gOff')?.addEventListener('click', async () => {
      if (!(await ask('Prekinuti vezu sa Google Drive-om?', 'Fotografije ostaju u vašem Drive-u, panel ih više neće prikazivati.', 'Prekini', true))) return;
      await api('POST', '/api/admin/storage/google/disconnect');
      save({});
    });
    $('#gStart')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      connectGoogle(f.clientId.value.trim(), f.clientSecret.value.trim());
    });
  }
  App.storageSetup = setup;
  addEventListener('hashchange', () => {
    if (location.hash.replace('#', '').split('?')[0] === 'settings') setup();
  });

  // Povezivanje kodom: panel pokaže kod, vi ga upišete na google.com/device
  async function connectGoogle(clientId, clientSecret) {
    let start;
    try {
      start = await api('POST', '/api/admin/storage/google/start', { clientId, clientSecret });
    } catch (e) {
      return toast(e.message);
    }
    const d = modal.open(`<div class="g-connect">
<h3>Povežite Google Drive</h3>
<p class="sub">Na telefonu ili računaru otvorite <b>${esc(String(start.url).replace(/^https?:\/\//, ''))}</b> i upišite kod:</p>
<div class="g-code">${esc(start.code)}</div>
<p class="sub small">Prijavite se svojim Google nalogom i potvrdite pristup. Prozor se sam zatvara kada se poveže.</p>
<p class="g-wait" id="gWait">Čekam potvrdu…</p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button></div>
</div>`);
    const timer = setInterval(async () => {
      if (!d.open) return clearInterval(timer);
      try {
        const r = await api('POST', '/api/admin/storage/google/poll');
        if (r.waiting) return;
        clearInterval(timer);
        d.close();
        toast('Google Drive je povezan');
        setup();
      } catch (e) {
        clearInterval(timer);
        const w = $('#gWait');
        if (w) {
          w.textContent = e.message;
          w.className = 'g-wait bad';
        }
      }
    }, 5000);
  }

  // ================= pregled =================
  async function load(params) {
    if (params?.get('provider')) prov = params.get('provider');
    if (params?.get('p')) D.path = params.get('p');
    await refresh();
  }

  async function refresh() {
    try {
      D = await api('GET', `/api/admin/storage/list?${q({ provider: prov, p: D.path, q: search })}`);
      prov = D.provider;
      localStorage.setItem('stProv', prov);
      sel.clear();
      render();
    } catch (e) {
      let others = [];
      try {
        others = (await api('GET', '/api/admin/storage/providers')).providers.filter((x) => x.id !== prov);
      } catch {}
      $('#storageBox').innerHTML = `<div class="panel"><div class="empty">${esc(e.message)}<br><a class="link" href="#settings">Otvori podešavanja skladišta</a>
${others.length ? `<br><button class="link" id="stOther">Prikaži „${esc(others[0].label)}"</button>` : ''}</div></div>`;
      $('#stOther')?.addEventListener('click', () => {
        prov = others[0].id;
        D.path = '/';
        refresh();
      });
    }
  }

  function render() {
    const folders = D.items.filter((i) => i.type === 'folder');
    const files = D.items.filter((i) => i.type === 'file');
    const tabs =
      (D.providers || []).length > 1
        ? `<div class="seg st-prov">${D.providers.map((p) => `<button data-prov="${p.id}" class="${p.id === prov ? 'on' : ''}">${esc(p.label)}</button>`).join('')}</div>`
        : '';
    $('#storageBox').innerHTML = `${tabs}<div class="panel st-panel" id="stDrop">
<div class="toolbar st-bar">
  <nav class="st-crumbs">${(D.crumbs || []).map((c, i) => `${i ? '<span>›</span>' : ''}<button class="crumb" data-go="${esc(c.path)}">${esc(c.name)}</button>`).join('')}</nav>
  <input type="search" id="stSearch" placeholder="Pretraga po imenu" aria-label="Pretraga" value="${esc(search)}">
  <button class="btn sm" id="stNew">Nova fascikla</button>
  <button class="btn sm primary" id="stUp">Otpremi fotografije</button>
  <input type="file" id="stFile" multiple hidden>
</div>
${search ? `<p class="sub small">Rezultati pretrage za „${esc(search)}"${D.truncated ? ' (prvih 400)' : ''} · <button class="link" id="stClear">poništi</button></p>` : ''}
${
  D.items.length
    ? `<div class="st-grid">${D.items.map(tile).join('')}</div>`
    : `<div class="empty">${search ? 'Nema rezultata.' : 'Prazno. Prevucite fotografije ovde da ih otpremite.'}</div>`
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
        : it.image
          ? `<img loading="lazy" src="${thumb(it)}" alt="">`
          : `<div class="st-ico file"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg></div>`;
    return `<div class="st-tile${on}" data-path="${esc(it.path)}" data-type="${it.type}">
<div class="st-thumb">${inner}<button class="st-pick" title="Izaberi"></button></div>
<div class="st-name" title="${esc(it.name)}">${esc(it.name)}</div>
<small>${it.type === 'folder' ? 'fascikla' : fmt.size(it.size)}</small>
</div>`;
  }

  function bind() {
    $$('#storageBox [data-prov]').forEach((b) => (b.onclick = () => {
      prov = b.dataset.prov;
      D.path = '/';
      search = '';
      refresh();
    }));
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
    let t;
    s.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        search = s.value.trim();
        refresh();
      }, 350);
    };
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
          it.image ? preview(it) : window.open(fileUrl(it, true), '_blank');
        }
      };
    });

    $('#actNone').onclick = () => {
      sel.clear();
      $$('.st-tile').forEach((e) => e.classList.remove('on'));
      actions();
    };
    $('#actDl').onclick = () => [...sel].forEach((p) => window.open(`/api/admin/storage/file?${q({ provider: prov, p })}&dl=1`, '_blank'));
    $('#actDel').onclick = remove;
    $('#actSend').onclick = sendDialog;

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
    $('#stActions').hidden = sel.size === 0;
    if (sel.size) $('#stSelCount').textContent = `${sel.size} ${sel.size === 1 ? 'izabrano' : 'izabranih'}`;
  }

  // ================= radnje =================
  async function upload(files) {
    if (!files.length || busy) return;
    busy = true;
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    toast(`Otpremam ${files.length} ${files.length === 1 ? 'fajl' : 'fajlova'}…`);
    try {
      const r = await api('POST', `/api/admin/storage/upload?${q({ provider: prov, p: D.path })}`, fd);
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
        await api('POST', '/api/admin/storage/folder', { provider: prov, p: D.path, name: f.name.value });
        await refresh();
      }
    );
  }

  async function remove() {
    const n = sel.size;
    const where = prov === 'google' ? 'Google kantu, odakle se vraća u roku od 30 dana' : 'fasciklu _kanta u skladištu';
    if (!(await ask(`Obrisati ${n} ${n === 1 ? 'stavku' : 'stavki'}?`, `Premešta se u ${where}.`, 'Obriši', true))) return;
    try {
      await api('POST', '/api/admin/storage/delete', { provider: prov, items: [...sel] });
      toast('Obrisano');
      await refresh();
    } catch (e) {
      toast(e.message);
    }
  }

  function preview(it) {
    const imgs = D.items.filter((x) => x.image);
    let i = imgs.findIndex((x) => x.path === it.path);
    modal.open(`<div class="st-prev"><img id="stPrevImg" src="${thumb(imgs[i])}&s=l" alt=""><div class="st-prev-bar">
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
  }

  // ================= slanje klijentu, vezano za termin =================
  async function sendDialog() {
    const bookings = (await App.load('bookings', true)) || [];
    const today = App.today();
    const opts = bookings
      .filter((b) => !b.cancelled)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 80)
      .map((b) => `<option value="${b.id}" data-email="${esc(b.email || '')}" data-name="${esc(b.clientName || '')}">${esc(b.clientName || '—')} · ${esc(b.catName || '')} · ${fmt.date(b.date)}${b.date <= today && b.status !== 'done' ? ' (čeka obradu)' : ''}</option>`)
      .join('');

    modal.open(
      `<form class="mform"><h3>Slanje fotografija klijentu</h3>
<p class="sub small">${sel.size} ${sel.size === 1 ? 'izabrana stavka' : 'izabranih stavki'} iz skladišta „${esc(D.label || '')}". Fotografije se kopiraju u pošiljku — originali ostaju netaknuti.</p>
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
          provider: prov,
          items: [...sel],
          bookingId: f.bookingId.value,
          salutation: f.salutation.value,
          firstName: f.firstName.value,
          lastName: f.lastName.value,
          email: f.email.value,
          message: f.message.value,
          sendEmail: f.sendEmail.checked,
        });
        toast(`Poslato ${r.fileCount} fotografija · link važi do ${fmt.date(new Date(r.expiresAt).toISOString().slice(0, 10))}`);
        sel.clear();
        await refresh();
      }
    );

    const bk = $('#sendBk');
    bk.onchange = () => {
      const o = bk.selectedOptions[0];
      const f = bk.form;
      if (!o || !o.value) return;
      // clientName je roditelj kad se fotografiše beba, inače sama osoba
      const name = (o.dataset.name || '').trim().split(/\s+/).filter(Boolean);
      f.firstName.value = name[0] || '';
      f.lastName.value = name.slice(1).join(' ') || '';
      f.email.value = o.dataset.email || '';
    };
  }

  App.view('storage', {
    title: 'Skladište fotografija',
    sub: 'Vaše fotografije: pregled, pretraga, otpremanje i slanje klijentu.',
    load,
  });
})();
