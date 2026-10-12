// Sistem: email nalog i tekstovi poruka, podešavanja, nalog za prijavu.
// Ovde je i zajedničko punjenje/čuvanje svih formulara sa podešavanjima (.sform).
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast } = App;

  // ---------- svi formulari sa podešavanjima ----------
  let settings = {};
  App.loadSettings = async function () {
    const { settings: s, detectedUrl } = await api('GET', '/api/admin/settings');
    settings = s;
    $$('.sform').forEach((form) => {
      [...form.elements].forEach((el) => {
        if (!el.name || !(el.name in s)) return;
        if (el.type === 'checkbox') el.checked = !!s[el.name];
        else if (el.type === 'color') el.value = /^#[0-9a-f]{6}$/i.test(s[el.name]) ? s[el.name] : '#e79aa2';
        else el.value = s[el.name] ?? '';
      });
    });
    const pass = $('#emailForm').smtpPass;
    pass.value = '';
    pass.placeholder = s.hasSmtpPass ? 'Sačuvana. Ostavite prazno da se ne menja.' : '';
    $('#siteUrl').placeholder = detectedUrl;
    const ip = $('#emailForm').imapPass;
    ip.value = '';
    ip.placeholder = s.hasImapPass ? 'Sačuvana. Ostavite prazno da se ne menja.' : '';
    $('#imapLogin').hidden = !!s.imapSameLogin;
    renderLocs(s.locations || []);
    if (!$('#testTo').value) $('#testTo').value = s.notifyEmail || s.contactEmail || s.fromEmail || s.smtpUser || '';
    App.colorDemo?.();
    preview();
  };

  const collect = (form) => {
    const o = {};
    [...form.elements].forEach((el) => {
      if (el.name && !el.name.startsWith('_')) o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    if (form.id === 'locForm') o.locations = $$('#locList input').map((i) => i.value.trim()).filter(Boolean);
    return o;
  };

  // ---------- lokacije ----------
  function renderLocs(list) {
    $('#locList').innerHTML = (list.length ? list : ['']).map((l) => `<div class="loc-row"><input name="_loc" value="${esc(l)}" placeholder="npr. Beograd, Bulevar oslobođenja 299" aria-label="Lokacija"><button type="button" class="btn sm danger" data-rmloc aria-label="Ukloni">Ukloni</button></div>`).join('');
  }
  $('#locAdd').onclick = () => {
    const cur = $$('#locList input').map((i) => i.value);
    renderLocs([...cur, '']);
    $$('#locList input').pop().focus();
  };
  $('#locList').addEventListener('click', (e) => {
    if (!e.target.closest('[data-rmloc]')) return;
    e.target.closest('.loc-row').remove();
  });

  // ---------- pošta (IMAP) ----------
  $('#imapSame').addEventListener('change', (e) => ($('#imapLogin').hidden = e.target.checked));
  $('#gmailImap').onclick = () => {
    ef.imapHost.value = 'imap.gmail.com';
    ef.imapPort.value = 993;
    ef.imapSecure.checked = true;
  };
  $('#imapTest').onclick = async () => {
    const m = $('#imapMsg');
    m.style.color = '';
    m.textContent = 'Čuvam i proveravam vezu…';
    try {
      await saveForm(ef);
      const st = await api('GET', '/api/admin/mail/status');
      if (!st.configured) throw new Error('Upišite IMAP server i podatke za prijavu.');
      if (!st.ok) throw new Error(st.error);
      m.style.color = 'var(--ok)';
      m.textContent = 'Veza radi. Sanduče je u meniju „Pošta“.';
    } catch (err) {
      m.style.color = 'var(--err)';
      m.textContent = err.message;
    }
  };
  async function saveForm(form, msg) {
    await api('PUT', '/api/admin/settings', collect(form));
    if (msg) toast(msg);
  }
  $$('.sform').forEach((form) =>
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button.primary:not([type=button])');
      if (btn) btn.disabled = true;
      try {
        await saveForm(form, 'Izmene su sačuvane');
        if (form.id === 'colorForm') App.refreshBrand();
        await App.loadSettings();
        App.meta = await api('GET', '/api/admin/meta'); // valuta, rok obrade
      } catch (err) {
        toast(err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
    })
  );

  // ---------- email ----------
  const ef = $('#emailForm');
  $('#gmailPreset').onclick = () => {
    ef.smtpHost.value = 'smtp.gmail.com';
    ef.smtpPort.value = 465;
    ef.smtpSecure.checked = true;
    ef.smtpUser.focus();
  };
  ef.smtpPort.addEventListener('change', () => {
    if (ef.smtpPort.value === '465') ef.smtpSecure.checked = true;
    if (ef.smtpPort.value === '587') ef.smtpSecure.checked = false;
  });
  $('#testBtn').onclick = async () => {
    const m = $('#testMsg');
    m.style.color = '';
    m.textContent = 'Čuvam podešavanja i šaljem…';
    $('#testBtn').disabled = true;
    try {
      await saveForm(ef);
      await api('POST', '/api/admin/settings/test-email', { to: $('#testTo').value.trim() });
      m.style.color = 'var(--ok)';
      m.textContent = 'Probni email je poslat. Proverite inbox, a ako ga nema, i folder za neželjenu poštu.';
    } catch (err) {
      m.style.color = 'var(--err)';
      m.textContent = 'Email nije poslat: ' + err.message;
    } finally {
      $('#testBtn').disabled = false;
    }
  };

  // Tri šablona poruka: fotografije, potvrda termina, podsetnik
  const TPL = {
    transfer: {
      subject: 'emailSubject',
      body: 'emailBody',
      btn: 'Preuzmi fotografije',
      ph: [['obracanje', 'obraćanje'], ['ime', 'ime'], ['prezime', 'prezime'], ['poruka', 'lična poruka'], ['datum_isteka', 'datum isteka'], ['broj_fajlova', 'broj fajlova'], ['velicina', 'veličina'], ['studio', 'naziv studija']],
      note: 'Dugme „Preuzmi fotografije“ i logo dodaju se automatski.',
    },
    confirm: {
      subject: 'bookingConfirmSubject',
      body: 'bookingConfirmBody',
      ph: [['klijent', 'klijent'], ['ime', 'ime'], ['prezime', 'prezime'], ['kategorija', 'vrsta fotografisanja'], ['datum', 'datum'], ['vreme', 'vreme'], ['lokacija', 'lokacija'], ['paket', 'paket'], ['cena', 'cena'], ['kapara', 'kapara'], ['ostatak', 'ostatak za uplatu'], ['izrada', 'izrada (album/book)'], ['studio', 'naziv studija']],
      note: '„Klijent“ je ime roditelja ako je upisano, inače ime osobe koja se fotografiše.',
    },
    request: {
      subject: 'requestReplySubject',
      body: 'requestReplyBody',
      ph: [['klijent', 'ime iz upita'], ['kategorija', 'vrsta fotografisanja'], ['datum', 'željeni datum'], ['vreme', 'željeno vreme'], ['lokacija', 'lokacija'], ['studio', 'naziv studija']],
      note: 'Automatski odgovor osobi koja pošalje upit preko sajta. Upit zatim stiže u „Upiti sa sajta“.',
    },
    reminder: {
      subject: 'bookingReminderSubject',
      body: 'bookingReminderBody',
      ph: [['klijent', 'klijent'], ['ime', 'ime'], ['prezime', 'prezime'], ['kategorija', 'vrsta fotografisanja'], ['datum', 'datum'], ['vreme', 'vreme'], ['lokacija', 'lokacija'], ['paket', 'paket'], ['studio', 'naziv studija']],
      note: 'Šalje se dan pre fotografisanja, u satu podešenom u Podešavanjima.',
    },
  };
  let tpl = 'transfer';
  function setTpl(t) {
    tpl = t;
    $$('#tplSeg button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    $$('.tpl').forEach((d) => (d.hidden = d.dataset.t !== t));
    $('#chips').innerHTML = 'Ubacite podatak: ' + TPL[t].ph.map(([k, l]) => `<button type="button" data-ph="{${k}}">${esc(l)}</button>`).join('') + `<br>${esc(TPL[t].note)}`;
    preview();
  }
  $$('#tplSeg button').forEach((b) => (b.onclick = () => setTpl(b.dataset.t)));
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ph]');
    if (!b) return;
    const ta = ef.elements[TPL[tpl].body];
    const s = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, s) + b.dataset.ph + ta.value.slice(ta.selectionEnd ?? s);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = s + b.dataset.ph.length;
    preview();
  });

  function preview() {
    const days = Number(settings.retentionDays) || 3;
    const exp = new Date(Date.now() + days * 864e5);
    const date = App.addDays(App.today(), 7);
    const v = {
      obracanje: 'Draga', ime: 'Dragana', prezime: 'Perić', poruka: 'Hvala vam na divnom danu!',
      datum_isteka: fmt.stampLong(exp), broj_fajlova: '48', velicina: '312 MB', studio: settings.studioName || '',
      klijent: 'Marija Petrović', kategorija: 'Krštenje', datum: fmt.date(date, true), vreme: '11:00', lokacija: 'Hram Svetog Save',
      paket: 'Standard', cena: fmt.money(32500),
    };
    if (tpl !== 'transfer') Object.assign(v, { ime: 'Lazar', prezime: 'Petrović' });
    const fill = (t) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
    $('#mpSubj').textContent = fill(ef.elements[TPL[tpl].subject].value);
    $('#mpBody').textContent = fill(ef.elements[TPL[tpl].body].value).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    $('#mpBtn').hidden = !TPL[tpl].btn;
    $('#mpMeta').textContent = tpl === 'transfer' ? `48 fotografija · 312 MB · Link važi do ${v.datum_isteka}` : [settings.studioName, settings.contactPhone].filter(Boolean).join(' · ');
  }
  ef.addEventListener('input', (e) => {
    if (e.target.hasAttribute('data-preview')) preview();
  });
  setTpl('transfer');

  App.view('email', { role: 'admin', title: 'Email', sub: 'Nalog sa kog se šalju poruke, tekstovi poruka klijentima i obaveštenja za vas.', load: () => App.loadSettings() });

  App.view('settings', { role: 'admin', title: 'Podešavanja', sub: 'Rok obrade, podsetnici, valuta, lokacije i linkovi.', load: () => App.loadSettings() });
})();
