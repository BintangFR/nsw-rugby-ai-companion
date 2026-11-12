// Impact > Evidence: match-day check. Compares a daily figure on match or event days with ordinary days, so an effect such
// as local businesses being busier on game day can be measured, not just reported. Works with any daily file that has a
// date column and a number column: a Google Trends download, council spending data (e.g. Spendmapp), takings from a
// local business, or visitor counts. Compares with all other days and with the same weekday, so weekends do not inflate it.
// Describes a difference; it does not prove the match caused it.
(() => {
  const { $, esc, toast } = window.App;
  const A = window.Analytics, D = window.TACKLE_DATA;
  let series = null, last = null;

  // Day as yyyy-mm-dd from 2026-05-09, 09/05/2026 (Australian order) or a spreadsheet serial number.
  function day(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }

  // First column that reads as dates, and the first numeric column after it. Skips preamble rows (Google Trends has some).
  function parse(rows) {
    const start = rows.findIndex(r => r.some(c => day(c)) && r.some((c, i) => i > 0 && Number.isFinite(Number(String(c).replace(/[<,$]/g, '')))));
    if (start < 0) return null;
    const dc = rows[start].findIndex(c => day(c));
    const vc = rows[start].findIndex((c, i) => i !== dc && Number.isFinite(Number(String(c).replace(/[<,$]/g, ''))) && String(c).trim() !== '');
    const header = start > 0 ? rows[start - 1] : [];
    const out = [];
    for (const r of rows.slice(start)) { const d = day(r[dc]), v = Number(String(r[vc] ?? '').replace(/[<,$]/g, '')); if (d && Number.isFinite(v)) out.push({ d, v }); }
    return out.length ? { points: out, label: String(header[vc] || 'Daily value').trim() } : null;
  }

  async function read(file) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
    return parse(rows);
  }

  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  function compare(points, matchDays) {
    const set = new Set(matchDays), on = points.filter(p => set.has(p.d)), off = points.filter(p => !set.has(p.d));
    if (!on.length || !off.length) return null;
    const wd = d => new Date(d + 'T00:00:00Z').getUTCDay(), days = new Set(on.map(p => wd(p.d)));
    const sameWd = off.filter(p => days.has(wd(p.d)));
    const m = mean(on.map(p => p.v)), o = mean(off.map(p => p.v)), w = sameWd.length ? mean(sameWd.map(p => p.v)) : null;
    return { n: on.length, nOff: off.length, nSame: sameWd.length, m, o, w, all: o ? m / o - 1 : null, same: w ? m / w - 1 : null, missing: matchDays.filter(d => !points.some(p => p.d === d)) };
  }

  const pct = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
  const fmt = v => Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-AU') : (+v.toFixed(2)).toLocaleString('en-AU');
  function run() {
    const out = $('#mdResult');
    if (!series) { toast('Choose a daily file first.'); return; }
    const matchDays = $('#mdDays').value.split(/[\s,;]+/).map(day).filter(Boolean);
    if (!matchDays.length) { toast('Enter at least one match or event date.'); return; }
    const r = compare(series.points, matchDays);
    if (!r) { out.innerHTML = '<p class="muted">None of the match dates is in the file, or every day is a match day.</p>'; return; }
    const place = $('#mdPlace').value, what = $('#mdWhat').value.trim() || series.label;
    last = { r, place, what };
    out.innerHTML = `<div class="md-figs">
        <div data-tip="${esc(`Average on the ${r.n} match day(s) ÷ average on the ${r.nSame} other days that fall on the same weekdays − 1. This removes the usual weekend effect.`)}" tabindex="0"><b>${r.same == null ? '–' : pct(r.same)}</b><span>vs the same weekday</span></div>
        <div data-tip="${esc(`Average on the ${r.n} match day(s) ÷ average on all ${r.nOff} other days − 1.`)}" tabindex="0"><b>${r.all == null ? '–' : pct(r.all)}</b><span>vs all other days</span></div>
        <div><b>${fmt(r.m)}</b><span>average on match days (${r.n})</span></div>
        <div><b>${fmt(r.o)}</b><span>average on other days (${r.nOff})</span></div></div>
      <p class="muted small">${esc(what)} in ${esc(place)}.${r.missing.length ? ` ${r.missing.length} date(s) are not in the file: ${r.missing.join(', ')}.` : ''} ${r.n < 3 ? 'Fewer than three match days: treat the result as a first look only.' : ''} A difference shows what happened on those days; it does not prove the match caused it.</p>
      <button class="btn primary" id="mdAdd">Add to evidence (economic)</button>`;
    $('#mdAdd').onclick = add;
  }

  function add() {
    if (!last) return;
    const { r, place, what } = last;
    A.evidenceStore.add({ lens: 'economic', region: place, source: 'Match-day check', text: `${what} on ${r.n} match day(s) compared with ordinary days in ${place}.`,
      metric: `${r.same == null ? '' : `${pct(r.same)} vs the same weekday, `}${r.all == null ? '' : `${pct(r.all)} vs all other days`}`, date: new Date().toISOString().slice(0, 10) });
    window.Impact?.refresh();
    toast('Added to the evidence log.');
  }

  document.addEventListener('app-ready', () => {
    if (!$('#mdCard')) return;
    $('#mdPlace').innerHTML = [...new Set(['Statewide', ...D.regions.map(r => r.name)])].map(n => `<option>${esc(n)}</option>`).join('');
    $('#mdFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { series = await read(f); } catch { series = null; }
      $('#mdFileNote').textContent = series ? `${series.points.length} days read (${series.points[0].d} to ${series.points[series.points.length - 1].d}), column "${series.label}".` : 'No date and number columns found in that file.';
    });
    $('#mdRun').addEventListener('click', run);
  });

  window.MatchDay = { parse, compare, day };
})();
