// Rad sa datumima u vremenskoj zoni studija (podrazumevano Beograd).
const TZ = process.env.TZ_DISPLAY || 'Europe/Belgrade';
const DAY = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

const MONTHS = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
const WEEKDAYS = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// Delovi datuma za trenutak ts, u zoni studija
function parts(ts) {
  const p = {};
  fmt.formatToParts(new Date(ts)).forEach((x) => (p[x.type] = x.value));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
}

function offsetAt(ts) {
  const p = parts(ts);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(ts / 60000) * 60000;
}

// "2026-10-20" + "10:30" (vreme u Beogradu) → milisekunde
function zoned(dateStr, timeStr = '00:00') {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [h, mi] = String(timeStr || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h || 0, mi || 0);
  let ts = guess - offsetAt(guess);
  ts = guess - offsetAt(ts);
  return ts;
}

const todayStr = (ts = Date.now()) => {
  const p = parts(ts);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
};

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY);
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

// "20. oktobra 2026."
function dateLong(dateStr, withWeekday = false) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${withWeekday ? wd + ', ' : ''}${d}. ${MONTHS[m - 1]} ${y}.`;
}

// "14. oktobra 2026. u 17:16"
function stamp(ts) {
  const p = parts(ts);
  return `${p.d}. ${MONTHS[p.m - 1]} ${p.y}. u ${pad(p.h)}:${pad(p.min)}`;
}

// Starost deteta na određeni dan, kratko i razumljivo
function ageText(birthStr, atStr) {
  if (!isDate(birthStr) || !isDate(atStr)) return '';
  const days = daysBetween(birthStr, atStr);
  if (days < 0) return 'još nije rođeno';
  if (days < 31) return `${days} ${days === 1 ? 'dan' : 'dana'}`;
  if (days < 91) {
    const w = Math.floor(days / 7);
    return `${w} ${w === 1 ? 'nedelja' : w < 5 ? 'nedelje' : 'nedelja'} (${days} dana)`;
  }
  const [y1, m1, d1] = birthStr.split('-').map(Number);
  const [y2, m2, d2] = atStr.split('-').map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (months < 24) return `${months} ${months === 1 ? 'mesec' : months < 5 ? 'meseca' : 'meseci'}`;
  const yrs = Math.floor(months / 12), rest = months % 12;
  const yw = yrs % 10 >= 2 && yrs % 10 <= 4 && (yrs % 100 < 12 || yrs % 100 > 14) ? 'godine' : 'godina';
  return `${yrs} ${yw}${rest ? ` i ${rest} ${rest === 1 ? 'mesec' : rest < 5 ? 'meseca' : 'meseci'}` : ''}`;
}

module.exports = { TZ, DAY, parts, zoned, todayStr, addDays, daysBetween, isDate, isTime, dateLong, stamp, ageText, pad };
