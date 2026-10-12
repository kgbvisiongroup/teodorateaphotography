const nodemailer = require('nodemailer');
const { esc, fill, formatDate, formatSize, palette } = require('./util');

// server.js postavlja funkciju koja vraća putanju do trenutnog logoa
let logoPath = () => null;
function setLogoResolver(fn) {
  logoPath = fn;
}

function transport(s) {
  if (!s.smtpHost) throw new Error('SMTP server nije podešen (Email → SMTP).');
  return nodemailer.createTransport({
    host: s.smtpHost,
    port: Number(s.smtpPort) || 587,
    secure: !!s.smtpSecure,
    auth: s.smtpUser ? { user: s.smtpUser, pass: s.smtpPass } : undefined,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
  });
}

function from(s) {
  const addr = s.fromEmail || s.smtpUser;
  if (!addr) throw new Error('Email pošiljaoca nije podešen.');
  return { name: s.fromName || s.studioName, address: addr };
}

function vars(t, s, link) {
  return {
    obracanje: t.salutation || '',
    ime: t.firstName,
    prezime: t.lastName,
    link,
    datum_isteka: formatDate(t.expiresAt),
    broj_fajlova: String(t.files.length),
    velicina: formatSize(t.totalSize),
    poruka: t.message || '',
    studio: s.studioName,
  };
}

// Prazna {poruka} ne sme da ostavi višak praznih redova.
const cleanText = (text) => text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

function textToHtml(text) {
  return esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Podnožje svake poruke: svi podaci studija (telefon, email, sajt, Instagram, adrese)
function footer(s) {
  const line1 = [s.contactPhone, s.contactEmail, s.website].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');
  const ig = s.instagram ? (/^https?:/i.test(s.instagram) ? 'Instagram' : '@' + String(s.instagram).replace(/^@/, '')) : '';
  const locs = (s.locations || []).filter(Boolean).map(esc);
  return [`<b style="color:#8a7476;">${esc(s.studioName)}</b>`, line1, esc(ig), ...locs].filter(Boolean).join('<br>');
}

// Kartica u emailu – izgleda kao kartica u programu (loyalty ili poklon vaučer)
function cardHtml(p, s, c) {
  const label = (t) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9c8486;letter-spacing:.3px;">${t}</div>`;
  const big = (t) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#4a3236;letter-spacing:1px;">${t}</div>`;
  const logo = logoPath() ? `<img src="cid:studio-logo" alt="" height="40" style="display:block;height:40px;width:auto;border:0;">` : '';
  let body;
  if (c.kind === 'voucher') {
    // Isti raspored kao u panelu i na štampi: naslov, ZA / OD / VAŽI DO, PORUKA i kontakt
    const vbox = (lbl, val, h = 0) =>
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${p.deep};border-radius:2px;"><tr><td style="padding:7px 10px 9px;${h ? `height:${h}px;vertical-align:top;` : ''}">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.6px;color:${p.deep};">${lbl}</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:${p.deep};">${val || '&nbsp;'}</div></td></tr></table>`;
    const vline = (t) => (t ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${p.deep};padding:2px 0;">${t}</div>` : '');
    const locs = (s.locations || []).filter(Boolean).map(esc).join('<br>');
    body = `<div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;text-align:center;font-size:24px;line-height:1.6;color:${p.deep};">
Poklanjam ti najlepšu uspomenu<br>jer je to najvredniji poklon</div>
${c.value ? `<div style="font-family:Georgia,'Times New Roman',serif;text-align:center;font-size:17px;color:${p.deep};padding-top:8px;">${esc(c.value)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
<td width="36%" style="padding-right:8px;">${vbox('ZA', esc(c.name))}</td>
<td width="32%" style="padding-right:8px;">${vbox('OD', esc(c.from || ''))}</td>
<td width="32%">${vbox('VAŽI DO', esc(c.validUntil))}</td></tr></table>
<div style="margin-top:10px;">${vbox('PORUKA', esc(c.message || '').replace(/\n/g, '<br>'), 110)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
<td width="50%" style="vertical-align:top;">${vline(esc(s.contactEmail))}${vline(esc(s.contactPhone))}</td>
<td width="50%" style="vertical-align:top;">${vline(esc(s.website))}${vline(locs)}</td></tr></table>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:${p.deep};opacity:.6;text-align:right;padding-top:10px;">${esc(c.code)}</div>`;
  } else {
    body = `${logo}
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${p.deep};letter-spacing:1px;margin-top:14px;">LOYALTY KARTICA</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#4a3236;margin:4px 0 26px;">${esc(c.name)}</div>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:30px;">${label('Broj kartice')}${big(esc(c.number))}</td>
<td>${label('Popust')}${big(esc(c.discount) + '%')}</td></tr></table>`;
  }
  // Vaučer je širi (ležeći format), loyalty kartica ostaje kao do sada
  const w = c.kind === 'voucher' ? 560 : 460;
  const bg =
    c.kind === 'voucher'
      ? `background-color:${p.blush};`
      : `background-color:${p.blush};background-image:linear-gradient(135deg,#ffffff 0%,${p.blush} 55%,${p.blush2} 100%);`;
  return `<tr><td style="padding:6px 28px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${w}px;margin:0 auto;border-radius:18px;border:1px solid ${p.line};${bg}">
<tr><td style="padding:24px 26px;">${body}</td></tr></table></td></tr>`;
}

function layout(s, inner) {
  const p = palette(s.accentColor);
  const hasLogo = !!logoPath();
  const head = hasLogo
    ? `<img src="cid:studio-logo" alt="${esc(s.studioName)}" width="260" style="display:block;margin:0 auto;max-width:260px;height:auto;border:0;">`
    : `<div style="font-family:Georgia,serif;font-size:24px;letter-spacing:2px;color:${p.strong};">${esc(s.studioName)}</div>`;
  return {
    hasLogo,
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${p.blush};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.blush};padding:36px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 30px rgba(120,60,60,.08);">
<tr><td style="padding:34px 36px 18px;text-align:center;">${head}</td></tr>
<tr><td style="padding:0 36px;"><div style="height:1px;background:${p.line};"></div></td></tr>
${inner(p)}
</table>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#a08c8c;padding-top:20px;">${footer(s)}</div>
</td></tr></table></body></html>`,
  };
}

function attachments(hasLogo) {
  return hasLogo ? [{ filename: 'logo.png', path: logoPath(), cid: 'studio-logo' }] : [];
}

async function sendTransfer(t, s, link) {
  const v = vars(t, s, link);
  const body = cleanText(fill(s.emailBody, v));
  const subject = fill(s.emailSubject, v);
  const imgs = t.files.filter((f) => !/\.zip$/i.test(f.name)).length;
  const zips = t.files.length - imgs;
  const meta = [imgs && `${imgs} ${imgs % 10 >= 2 && imgs % 10 <= 4 && (imgs % 100 < 12 || imgs % 100 > 14) ? 'fotografije' : 'fotografija'}`, zips && `${zips} ZIP`, v.velicina]
    .filter(Boolean)
    .join(' · ');
  const { html, hasLogo } = layout(
    s,
    (p) => `<tr><td style="padding:28px 36px 6px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:#4a3a3c;">${textToHtml(body)}</td></tr>
<tr><td align="center" style="padding:6px 36px 14px;">
<a href="${esc(link)}" style="display:inline-block;background:${p.strong};color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:.5px;padding:15px 38px;border-radius:999px;">Preuzmi fotografije</a>
</td></tr>
<tr><td style="padding:4px 36px 34px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#a08c8c;">${esc(meta)}<br>Link važi do ${esc(v.datum_isteka)}</td></tr>`
  );
  await transport(s).sendMail({
    from: from(s),
    to: { name: `${t.firstName} ${t.lastName}`, address: t.email },
    replyTo: s.replyTo || s.contactEmail || undefined,
    subject,
    text: `${body}\n\nPreuzimanje: ${link}`,
    html,
    attachments: attachments(hasLogo),
  });
}

async function sendDownloadNotice(t, s) {
  const { html, hasLogo } = layout(
    s,
    () => `<tr><td style="padding:28px 36px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#4a3a3c;">
<p style="margin:0 0 12px;"><b>${esc(t.firstName)} ${esc(t.lastName)}</b> (${esc(t.email)}) je preuzeo/la fotografije.</p>
<p style="margin:0;color:#a08c8c;font-size:14px;">Poslato: ${esc(formatDate(t.createdAt))} · ${t.files.length} fajl(ova)</p></td></tr>`
  );
  await transport(s).sendMail({
    from: from(s),
    to: studioEmail(s),
    subject: `Preuzeto: ${t.firstName} ${t.lastName}`,
    text: `${t.firstName} ${t.lastName} (${t.email}) je preuzeo/la fotografije.`,
    html,
    attachments: attachments(hasLogo),
  });
}

async function sendTest(s, to) {
  const { html, hasLogo } = layout(
    s,
    () => `<tr><td style="padding:28px 36px 34px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#4a3a3c;"><p style="margin:0;">Email podešavanja rade ispravno. ✓</p></td></tr>`
  );
  await transport(s).sendMail({ from: from(s), to, subject: 'Test – ' + s.studioName, text: 'Email podešavanja rade ispravno.', html, attachments: attachments(hasLogo) });
}

// Opšta poruka u stilu studija: tekst (sa praznim redovima) + opciono dugme i sitan tekst ispod.
// Koriste je zakazivanja, podsetnici i loyalty kartice; novi moduli mogu isto.
async function sendSimple(s, { to, toName, subject, body, cta, meta, highlight, card }) {
  const text = cleanText(body);
  const { html, hasLogo } = layout(
    s,
    (p) => `<tr><td style="padding:28px 36px ${cta || highlight || card ? 10 : 30}px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:#4a3a3c;">${textToHtml(text)}</td></tr>
${card ? cardHtml(p, s, card) : ''}
${highlight ? `<tr><td style="padding:0 36px 18px;"><div style="background:${p.blush};border-radius:12px;padding:18px 20px;font-family:Arial,Helvetica,sans-serif;color:#4a3a3c;font-size:15px;line-height:1.7;">${highlight}</div></td></tr>` : ''}
${cta ? `<tr><td align="center" style="padding:6px 36px 14px;"><a href="${esc(cta.url)}" style="display:inline-block;background:${p.strong};color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;padding:15px 38px;border-radius:999px;">${esc(cta.text)}</a></td></tr>` : ''}
${meta ? `<tr><td style="padding:4px 36px 30px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#a08c8c;">${esc(meta)}</td></tr>` : ''}`
  );
  await transport(s).sendMail({
    from: from(s),
    to: toName ? { name: toName, address: to } : to,
    replyTo: s.replyTo || s.contactEmail || undefined,
    subject,
    text: text + (cta ? `\n\n${cta.text}: ${cta.url}` : ''),
    html,
    attachments: attachments(hasLogo),
  });
}

// Kome stižu obaveštenja za studio (podsetnici za obradu, preuzimanja)
const studioEmail = (s) => s.notifyEmail || s.contactEmail || s.fromEmail || s.smtpUser || '';

module.exports = { sendTransfer, sendDownloadNotice, sendTest, sendSimple, studioEmail, setLogoResolver, cleanText, fill, transport, from, layout, attachments, textToHtml };
