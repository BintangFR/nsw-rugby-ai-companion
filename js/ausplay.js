// AusPlay (Australian Sports Commission, via the Clearinghouse for Sport): an independent survey baseline for rugby union in
// NSW, read in the browser from Dataset/C4S-AusPlay-NSW-Data-Tables-*.xlsx. Rugby Analytics counts registered players;
// AusPlay estimates everyone who played, from a population survey, so the two together give a fuller starting point.
// Every estimate carries AusPlay's own relative margin of error (table 27), and small ones are flagged exactly as AusPlay
// does: 50–100% "use with caution", over 100% "too unreliable". It is rugby-wide context, never Legacy impact by itself.
(() => {
  const FILE = 'C4S-AusPlay-NSW-Data-Tables-29-October-2026 (1).xlsx';
  const CODES = ['Rugby union', 'Rugby league', 'Touch football', 'Australian football', 'Football/soccer'];
  let data = null, failed = '';

  const rowsOf = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
  // [rate row, number row] for an activity: AusPlay lists every activity twice, rates first, then estimated numbers.
  function activity(rows, code) {
    const hits = rows.map((r, i) => [r, i]).filter(([r]) => String(r[0] ?? '').trim() === code);
    return hits.length >= 2 ? { rate: hits[0][0].slice(1), num: hits[1][0].slice(1) } : null;
  }
  // Header labels for the value columns (the row just above "Participation rate").
  function header(rows) {
    const i = rows.findIndex(r => r.some(c => String(c ?? '').trim() === 'Participation rate'));
    return i > 0 ? rows[i - 1].slice(1).map(h => String(h ?? '').replace(/[^\w\s/-]/g, '').replace(/\s+/g, ' ').trim()) : [];
  }
  // Relative margin of error by size of estimate, for adults or children (table 27), interpolated on a log scale.
  function rmoeTable(rows, label) {
    const i = rows.findIndex(r => r.some(c => String(c ?? '').startsWith(label)));
    if (i < 0) return [];
    const out = [];
    // Each row: size of estimate, then the NSW relative margin (the first two numbers in the row).
    for (const r of rows.slice(i + 2)) { const nums = r.filter(c => Number.isFinite(c)); if (!nums.length) break; if (nums.length >= 2) out.push([nums[0], nums[1]]); }
    return out;
  }
  function rmoe(table, n) {
    if (!table.length || !(n > 0)) return null;
    if (n <= table[0][0]) return table[0][1];
    for (let k = 1; k < table.length; k++) {
      const [x0, y0] = table[k - 1], [x1, y1] = table[k];
      if (n <= x1) return y0 + (y1 - y0) * (Math.log(n) - Math.log(x0)) / (Math.log(x1) - Math.log(x0));
    }
    return table[table.length - 1][1];
  }
  const quality = r => r == null ? '' : r > 1 ? 'too unreliable' : r >= 0.5 ? 'use with caution' : 'reliable enough';

  async function load() {
    try {
      const f = await DataFiles.get(/ausplay.*\.xlsx$/i, FILE);
      if (!f) throw new Error('not uploaded yet: upload the AusPlay NSW data tables (Clearinghouse for Sport) in Data Studio');
      const wb = XLSX.read(f.buffer, { type: 'array' });
      const moe = rowsOf(wb, '27'), adultM = rmoeTable(moe, 'Relative margins of error for adult'), childM = rmoeTable(moe, 'Relative margins of error for child');
      const est = (n, who) => ({ n, rmoe: rmoe(who === 'child' ? childM : adultM, n), get quality() { return quality(this.rmoe); } });
      const pick = (sheet, code) => { const rows = rowsOf(wb, sheet), a = activity(rows, code); return a ? { head: header(rows), ...a } : null; };
      const codes = Object.fromEntries(CODES.map(c => [c, { adults: pick('16', c), children: pick('17', c), orgAdults: pick('19', c), orgChildren: pick('20', c) }]));
      const ru = codes['Rugby union'];
      if (!ru.adults || !ru.children) throw new Error('Rugby union rows not found');
      const col = (t, label) => t.num[t.head.findIndex(h => h.toLowerCase() === label.toLowerCase())];
      const vol = rowsOf(wb, '22'), volRow = vol.find((r, i) => i > vol.findIndex(x => String(x[0] ?? '').startsWith('Estimated number')) && String(r[1] ?? '').trim() === 'Total');
      const vol10 = rowsOf(wb, '23').filter(r => typeof r[0] === 'string' && Number.isFinite(r[1]) && r[1] > 1).map(r => r[0].trim());
      const released = String((rowsOf(wb, 'Index').find(r => String(r[0] ?? '').startsWith('Released')) || [])[1] || '');
      data = {
        file: FILE, released, period: 'July 2025 – June 2026',
        adults: est(col(ru.adults, 'Total'), 'adult'), adultMen: est(col(ru.adults, 'Males'), 'adult'), adultWomen: est(col(ru.adults, 'Females'), 'adult'),
        adultRate: ru.adults.rate[0], adults25to34: est(col(ru.adults, '25-34'), 'adult'),
        children: est(col(ru.children, 'Total'), 'child'), boys: est(col(ru.children, 'Males'), 'child'), girls: est(col(ru.children, 'Females'), 'child'),
        childRate: ru.children.rate[0], children12to14: est(col(ru.children, '12-14'), 'child'),
        clubAdults: est(col(ru.orgAdults, 'Sports club or association'), 'adult'), organisedAdults: est(ru.orgAdults.num[0], 'adult'),
        clubChildren: est(col(ru.orgChildren, 'Sports club or association'), 'child'),
        compare: CODES.filter(c => codes[c].adults).map(c => { const t = codes[c].adults, ch = codes[c].children; const tot = col(t, 'Total'), f = col(t, 'Females');
          return { code: c, adults: tot, femaleShare: tot ? f / tot : null, children: ch ? col(ch, 'Total') : null }; }),
        sportVolunteers: volRow ? volRow[2] : null, ruInTop10Volunteers: vol10.includes('Rugby union'),
      };
    } catch (e) { failed = e.message; data = null; }
    document.dispatchEvent(new CustomEvent('ausplay-ready'));
  }

  const N = v => Math.round(v).toLocaleString('en-AU'), P = v => `${(v * 100).toFixed(0)}%`;
  const tag = e => e?.quality && e.quality !== 'reliable enough' ? ` (${e.quality})` : '';
  const pm = e => e?.rmoe != null ? `±${Math.round(e.rmoe * 100)}%` : '';

  // Rows for the Framework's baseline register: [measure, baseline, latest, source].
  function baselineRows() {
    if (!data) return [];
    const d = data, src = `AusPlay NSW ${d.period} (ASC, released ${d.released}); relative margin of error shown`;
    return [
      ['Rugby union players aged 15+ (AusPlay survey)', `${N(d.adults.n)} ${pm(d.adults)}${tag(d.adults)}`, 'next release', src],
      ['Rugby union players aged 0–14, organised outside school', `${N(d.children.n)} ${pm(d.children)}${tag(d.children)}`, 'next release', src],
      ['Women and girls as a share of rugby union players', `${P(d.adultWomen.n / d.adults.n)} of adults${tag(d.adultWomen)}; ${P(d.girls.n / d.children.n)} of children${tag(d.girls)}`, 'next release', src],
      ['Rugby union played through a sports club', `${P(d.clubAdults.n / d.organisedAdults.n)} of organised adult play; ${P(d.clubChildren.n / d.children.n)} of children`, 'next release', src],
    ];
  }

  // What AusPlay says about the Legacy Program's context, for the Framework, the AI and the presentation.
  function findings() {
    if (!data) return [];
    const d = data, ru = d.compare.find(c => c.code === 'Rugby union'), others = d.compare.filter(c => c.code !== 'Rugby union' && c.femaleShare != null);
    const touch = d.compare.find(c => c.code === 'Touch football');
    const pl = window.Analytics?.measures().players?.series || {}, plY = Object.keys(pl).map(Number).filter(Number.isFinite).sort().pop();
    const ra = plY ? `the ${N(pl[plY])} players Rugby Analytics records for ${plY}` : 'the players Rugby Analytics records';
    return [
      ['Independent baseline before RWC 2027', `About ${N(d.adults.n + d.children.n)} people in NSW played rugby union in ${d.period} (${N(d.adults.n)} aged 15+, ${N(d.children.n)} children): close to ${ra}, from a completely separate source.`, 'Repeat each year from the next AusPlay release; compare with Rugby Analytics.'],
      ['Clubs are where most rugby happens', `${P(d.clubAdults.n / d.organisedAdults.n)} of organised adult rugby and ${P(d.clubChildren.n / d.children.n)} of children's rugby is through a sports club: the part of the game Legacy club grants reach.`, 'Supports targeting Legacy money through clubs; the $5,932 club-sport value applies to this group.'],
      ['Women and girls are the gap', `Women are ${P(d.adultWomen.n / d.adults.n)} of adult rugby union players and girls ${P(d.girls.n / d.children.n)} of children${touch ? `, against ${P(touch.femaleShare)} for touch football` : ''}${others.length ? `; ${others.filter(c => c.femaleShare > ru.femaleShare).length} of ${others.length} comparable codes have a higher female share` : ''}.`, 'Backs the Inclusion pillar and female-friendly facility grants as a priority.'],
      ['Teenagers and young adults carry the game', `The largest groups are 12–14-year-olds (${N(d.children12to14.n)}${tag(d.children12to14)}) and 25–34-year-olds (${N(d.adults25to34.n)}${tag(d.adults25to34)}).`, 'Junior pathway and retention programs reach the ages that matter most.'],
      ['AusPlay is too coarse to see Legacy impact on its own', `Even the adult total has a margin of error of ${pm(d.adults)}; figures for women (${pm(d.adultWomen)}) and girls (${pm(d.girls)}) are ${d.girls.quality}. Rugby union is not among the top 10 activities for volunteers, so AusPlay gives no rugby volunteer figure.`, 'Measure Legacy reach with the tracking tools (attendance, survey); use AusPlay only as state-wide context.'],
    ];
  }

  function contextLines() {
    if (!data) return failed ? [] : [];
    return ['AUSPLAY NSW (independent survey, rugby-wide context only, not Legacy impact; ' + data.period + '): ' + findings().map(([h, t]) => `${h}: ${t}`).join(' | ')];
  }

  document.addEventListener('app-ready', load);
  document.addEventListener('datafile-added', e => { if (/ausplay/i.test(e.detail.name)) { failed = ''; load(); } });
  window.AusPlay = { get data() { return data; }, get failed() { return failed; }, baselineRows, findings, contextLines, FILE };
})();
