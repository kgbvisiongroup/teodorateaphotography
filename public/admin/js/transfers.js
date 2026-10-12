// Slanje fotografija (JPG i ZIP zajedno, prevlačenjem) i pregled poslatog sa istorijom preuzimanja.
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, copy } = App;

  // ---------- novo slanje ----------
  let files = [];
  const input = $('#fileInput');
  const drop = $('#drop');
  const isImg = (f) => /\.(jpe?g)$/i.test(f.name);
  const accepts = (f) => /\.(jpe?g|zip)$/i.test(f.name);
  let bookings = [];

  async function loadNew(params) {
    const sel = $('#sendBooking');
    bookings = (await api('GET', '/api/admin/bookings')).filter((b) => !b.cancelled && b.date <= App.addDays(App.today(), 1) && b.date >= App.addDays(App.today(), -120)).reverse();
    const want = params.get('booking');
    sel.innerHTML =
      '<option value="">Bez zakazivanja</option>' +
      bookings.map((b) => `<option value="${b.id}">${esc(fmt.dateShort(b.date))} · ${esc(b.firstName)} ${esc(b.lastName)} · ${esc(b.catName)}${b.status === 'sent' || b.status === 'downloaded' ? ' · već poslato' : ''}</option>`).join('');
    if (want) {
      sel.value = want;
      if (sel.value !== want) {
        // zakazivanje izvan liste (npr. starije) – dodaj ga
        const b = await api('GET', '/api/admin/bookings/' + want).catch(() => null);
        if (b) {
          bookings.push(b);
          sel.add(new Option(`${fmt.dateShort(b.date)} · ${b.firstName} ${b.lastName} · ${b.catName}`, b.id));
          sel.value = want;
        }
      }
      fillFromBooking();
      $('#done').hidden = true;
      $('#sendForm').hidden = false;
    }
  }

  function fillFromBooking() {
    const f = $('#sendForm');
    const b = bookings.find((x) => x.id === f.bookingId.value);
    if (!b) return;
    let first = b.firstName, last = b.lastName;
    if (b.parentName) {
      const parts = b.parentName.trim().split(/\s+/);
      first = parts.shift();
      last = parts.join(' ') || b.lastName;
    }
    f.firstName.value = first;
    f.lastName.value = last;
    f.email.value = b.email || '';
  }
  $('#sendBooking').addEventListener('change', fillFromBooking);

  function addFiles(list) {
    const arr = [...list];
    const bad = arr.filter((f) => !accepts(f));
    const seen = new Set(files.map((f) => f.name + f.size));
    arr.filter(accepts).forEach((f) => {
      if (!seen.has(f.name + f.size)) files.push(f);
    });
    if (bad.length) toast(`${bad.length} ${bad.length === 1 ? 'fajl nije dodat' : 'fajlova nije dodato'}: dozvoljeni su JPG i ZIP.`);
    renderFiles();
  }

  // Sličice se prave tek kada su vidljive, pa i stotine velikih fotografija ne usporavaju stranicu
  let urls = [];
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const img = e.target;
          const f = files[+img.dataset.i];
          if (f && !img.src) {
            const u = URL.createObjectURL(f);
            urls.push(u);
            img.src = u;
          }
          io.unobserve(img);
        }
      }, { root: null, rootMargin: '200px' })
    : null;
  const ZIP_ICON = '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M10 6h2M10 9h2M10 12h2M10 15h2v3h-2z"/></svg>';
  function renderFiles() {
    urls.forEach(URL.revokeObjectURL);
    urls = [];
    const total = files.reduce((a, f) => a + f.size, 0);
    const imgs = files.filter(isImg).length;
    const zips = files.length - imgs;
    $('#fileSummary').hidden = !files.length;
    $('#fileSumText').textContent = files.length ? [imgs && fmt.photos(imgs), zips && `${zips} ZIP`].filter(Boolean).join(' + ') + `, ukupno ${fmt.size(total)}` : '';
    const g = $('#fileGrid');
    const MAX = 400;
    g.innerHTML =
      files
        .slice(0, MAX)
        .map((f, i) =>
          isImg(f)
            ? `<div class="fi"><img data-i="${i}" alt="" decoding="async"><span class="nm">${esc(f.name)}</span><button type="button" data-rm="${i}" aria-label="Ukloni ${esc(f.name)}">×</button></div>`
            : `<div class="fi zipf"><span class="zi">${ZIP_ICON}</span><span class="nm">${esc(f.name)} · ${fmt.size(f.size)}</span><button type="button" data-rm="${i}" aria-label="Ukloni ${esc(f.name)}">×</button></div>`
        )
        .join('') + (files.length > MAX ? `<div class="more">i još ${files.length - MAX}</div>` : '');
    $$('img[data-i]', g).forEach((img) => (io ? io.observe(img) : (img.src = URL.createObjectURL(files[+img.dataset.i]))));
  }
  $('#fileGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    files.splice(+b.dataset.rm, 1);
    renderFiles();
  });
  $('#clearFiles').onclick = () => {
    files = [];
    renderFiles();
  };
  drop.onclick = () => input.click();
  drop.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  };
  input.onchange = () => {
    addFiles(input.files);
    input.value = '';
  };
  // Prevlačenje: na polje, ali i bilo gde na ekranu „Novo slanje“
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (App.current !== 'new' || !e.dataTransfer?.types?.includes('Files')) return;
    dragDepth++;
    drop.classList.add('over');
  });
  window.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) {
      dragDepth = 0;
      drop.classList.remove('over');
    }
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    drop.classList.remove('over');
    if (App.current === 'new' && e.dataTransfer?.files?.length && !$('#sendForm').hidden) addFiles(e.dataTransfer.files);
  });

  let uploading = null;
  $('#sendForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const err = (m) => ($('#sendErr').textContent = m);
    err('');
    if (!f.firstName.value.trim() || !f.lastName.value.trim()) return err('Upišite ime i prezime klijenta.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return err('Proverite email adresu klijenta.');
    if (!files.length) return err('Dodajte fotografije ili ZIP.');

    const fd = new FormData();
    // polja idu pre fajlova – server ih proverava tokom prijema
    ['bookingId', 'salutation', 'firstName', 'lastName', 'email', 'message'].forEach((k) => fd.append(k, f[k].value.trim()));
    fd.append('sendEmail', f.sendEmail.checked ? 'true' : 'false');
    files.forEach((file) => fd.append('files', file, file.name));

    const total = files.reduce((a, x) => a + x.size, 0);
    const xhr = new XMLHttpRequest();
    uploading = xhr;
    const t0 = Date.now();
    $('#progress').hidden = false;
    $('#sendBtn').disabled = true;
    $('#sendBtn').textContent = 'Šaljem…';
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const p = ev.loaded / ev.total;
      $('#progBar').style.width = (p * 100).toFixed(1) + '%';
      $('#progPct').textContent = Math.floor(p * 100) + '%';
      const speed = ev.loaded / Math.max((Date.now() - t0) / 1000, 0.5);
      const rest = (ev.total - ev.loaded) / Math.max(speed, 1);
      $('#progInfo').textContent = p >= 1 ? 'Završavam i šaljem email…' : `${fmt.size(ev.loaded)} od ${fmt.size(total)}, još oko ${rest > 90 ? Math.ceil(rest / 60) + ' min' : Math.ceil(rest) + ' s'}`;
    };
    const end = () => {
      uploading = null;
      $('#sendBtn').disabled = false;
      $('#sendBtn').textContent = 'Pošalji';
      $('#progress').hidden = true;
      $('#progBar').style.width = '0';
    };
    xhr.onload = () => {
      end();
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 401) return location.reload();
      if (xhr.status !== 200) return err(data.error || `Slanje nije uspelo (greška ${xhr.status}).`);
      showDone(data, f.sendEmail.checked);
    };
    xhr.onerror = () => {
      end();
      err('Veza je prekinuta. Proverite internet i pošaljite ponovo.');
    };
    xhr.open('POST', '/api/admin/transfers');
    xhr.send(fd);
  });
  window.addEventListener('beforeunload', (e) => {
    if (uploading) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function showDone(t, wanted) {
    $('#sendForm').hidden = true;
    $('#done').hidden = false;
    $('#doneTitle').textContent = `Poslato za ${t.firstName} ${t.lastName}`;
    const m = $('#doneMail');
    m.style.color = '';
    if (!wanted) m.textContent = 'Email nije poslat. Kopirajte link i pošaljite ga klijentu.';
    else if (t.emailSentAt) m.textContent = `Email sa linkom je poslat na ${t.email}.`;
    else {
      m.textContent = `Fotografije su sačuvane, ali email nije poslat: ${t.emailError} Proverite podešavanja emaila ili kopirajte link.`;
      m.style.color = 'var(--err)';
    }
    $('#doneLink').value = t.link;
    $('#openDone').href = t.link;
    $('#doneExp').textContent = `${[t.imageCount && fmt.photos(t.imageCount), t.fileCount - t.imageCount && `${t.fileCount - t.imageCount} ZIP`].filter(Boolean).join(' + ')}, ${fmt.size(t.totalSize)}. Link važi do ${fmt.stampLong(t.expiresAt)}.${t.booking ? ' Povezano sa zakazivanjem i označeno kao obrađeno.' : ''}`;
  }
  $('#copyDone').onclick = () => copy($('#doneLink').value);
  $('#again').onclick = () => {
    $('#sendForm').reset();
    files = [];
    renderFiles();
    $('#done').hidden = true;
    $('#sendForm').hidden = false;
    history.replaceState(null, '', '#new');
    $('#sendForm').firstName.focus();
  };

  App.view('new', { title: 'Novo slanje', sub: 'Prevucite fotografije (JPG) ili ZIP, može i zajedno.', load: loadNew, noReload: true });

  // ---------- poslato ----------
  let items = [];
  let scope = 'active';
  function dlText(t) {
    if (!t.downloads) return '<span class="tag warn">Nije preuzeto</span>';
    return `<span class="tag ok">Preuzeto ${t.downloads}×</span>`;
  }
  function rowHtml(t) {
    let mail;
    if (t.emailSentAt) mail = '<span class="tag ok">Email poslat</span>';
    else if (t.emailError) mail = `<span class="tag err" title="${esc(t.emailError)}">Email nije poslat</span>`;
    else mail = '<span class="tag">Bez emaila</span>';
    const log = (t.downloadLog || []).slice(0, 15);
    const counts = [t.imageCount && fmt.photos(t.imageCount), t.fileCount - (t.imageCount || 0) > 0 && `${t.fileCount - (t.imageCount || 0)} ZIP`].filter(Boolean).join(' + ') || `${t.fileCount} fajl(ova)`;
    return `<div class="tr" data-id="${t.id}">
<div class="who"><span class="ava">${esc(fmt.initials(t.firstName, t.lastName))}</span><div><b>${esc(t.firstName)} ${esc(t.lastName)}</b><span class="em">${esc(t.email)}</span>${t.booking ? `<a class="em link" href="#booking/${esc(t.bookingId)}">${esc(t.booking)}</a>` : ''}<div class="tags">${t.active ? mail : `<span class="tag">${t.endReason === 'obrisano' ? 'Obrisano ručno' : 'Isteklo'}</span>`}${dlText(t)}</div></div></div>
<div class="cell"><b>${counts}, ${fmt.size(t.totalSize)}</b>poslato ${fmt.stamp(t.createdAt)}</div>
<div class="cell">${t.downloads ? `<b>Preuzeto ${fmt.stamp(t.lastDownloadAt)}</b>${t.downloads > 1 ? `prvi put ${fmt.stamp(t.firstDownloadAt)}` : ''}` : `<b>${t.active ? fmt.left(t.expiresAt) : 'link istekao'}</b>${t.active ? `do ${fmt.stamp(t.expiresAt)}` : ''}`}
${log.length ? `<details class="dlog"><summary>Istorija preuzimanja</summary><ul class="log">${log.map((x) => `<li>${fmt.stamp(x.at)} · ${x.kind === 'all' ? 'sve odjednom' : esc(x.file || 'fajl')}</li>`).join('')}</ul></details>` : ''}</div>
<div class="acts">${t.active ? `<button class="btn sm" data-act="copy">Kopiraj link</button><a class="btn sm" href="${esc(t.link)}" target="_blank" rel="noopener">Otvori</a><button class="btn sm" data-act="resend">Pošalji email</button><button class="btn sm" data-act="extend">Produži</button><button class="btn sm danger" data-act="del">Obriši</button>` : ''}</div></div>`;
  }
  App.transferRow = rowHtml;

  function renderList() {
    const q = $('#search').value.trim().toLowerCase();
    const shown = q ? items.filter((t) => `${t.firstName} ${t.lastName} ${t.email} ${t.booking || ''}`.toLowerCase().includes(q)) : items;
    $('#list').innerHTML = shown.length
      ? shown.map(rowHtml).join('')
      : `<div class="empty">${items.length ? 'Nema rezultata za tu pretragu.' : scope === 'active' ? 'Nema aktivnih linkova.<br><a class="btn primary" href="#new">Novo slanje</a>' : 'Arhiva je prazna. Ovde se čuvaju slanja čiji su linkovi istekli, sa vremenima preuzimanja.'}</div>`;
  }
  async function loadList() {
    items = await api('GET', '/api/admin/transfers' + (scope === 'history' ? '?scope=history' : ''));
    if (scope === 'active') $('#navCount').textContent = items.length || '';
    $$('#listScope button').forEach((b) => b.classList.toggle('on', b.dataset.s === scope));
    renderList();
  }
  $('#search').addEventListener('input', renderList);
  $$('#listScope button').forEach((b) => (b.onclick = () => {
    scope = b.dataset.s;
    loadList();
  }));

  async function rowAction(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('.tr').dataset.id;
    let t = items.find((x) => x.id === id);
    if (!t) {
      items = await api('GET', '/api/admin/transfers');
      t = items.find((x) => x.id === id);
    }
    const act = b.dataset.act;
    if (act === 'copy') return copy(t.link);
    const name = `${t.firstName} ${t.lastName}`;
    b.disabled = true;
    try {
      if (act === 'resend') {
        if (!(await ask('Poslati email ponovo?', `${name} će ponovo dobiti poruku sa linkom na ${t.email}.`, 'Pošalji'))) return;
        await api('POST', `/api/admin/transfers/${t.id}/resend`);
        toast('Email je poslat');
      } else if (act === 'extend') {
        await api('POST', `/api/admin/transfers/${t.id}/extend`, {});
        toast('Rok je produžen');
      } else if (act === 'del') {
        if (!(await ask(`Obrisati fotografije za ${name}?`, 'Fotografije se trajno brišu i link odmah prestaje da radi. Zapis ostaje u arhivi.', 'Obriši', true))) return;
        await api('DELETE', `/api/admin/transfers/${t.id}`);
        toast('Obrisano');
      }
      App.reloadCurrent();
    } catch (err) {
      toast(err.message);
    } finally {
      b.disabled = false;
    }
  }
  $('#list').addEventListener('click', rowAction);
  $('#recent').addEventListener('click', rowAction);

  App.view('list', {
    title: 'Poslato',
    sub: 'Linkovi za preuzimanje i kada su fotografije preuzete. Posle isteka fotografije se brišu, a zapis ostaje u arhivi.',
    actions: '<a class="btn primary" href="#new">Novo slanje</a>',
    load: loadList,
  });
})();
