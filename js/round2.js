// Dashboard > Zone view: where Legacy money has reached, by rugby zone, against participation and need.
// Round 2 recipients are already decided (to be announced by the Minister), so this view is for checking that list once it
// is public and for targeting future funding and support, not for choosing Round 2.
// Zones, their associations and their clubs come from NSW Rugby's club list (Dataset/List of all NSW RU Clubs.xlsx: one
// sheet per zone). A grant is placed by the club it names, else by its town appearing in a club name, else by the mapping in
// Dataset/round2-zones.csv (Southern Inland, run by ACT & Southern NSW Rugby, and a region fallback). Umbrella associations
// (Country Rugby Union, NSW Juniors, schools) cover many zones and stay out, as NSW Rugby advised.
// Shows each zone's figures and what stands out against the total. There is no combined score.
// Figures are sums over a zone's associations; someone registered in two associations is counted in both.
(() => {
  const { $, $$, esc } = window.App;
  const A = window.Analytics, D = window.TACKLE_DATA;
  const FILES = { churn: 'Hierarchy Churn (2).xlsx', metrics: 'Hierarchy Metrics.xlsx', heritage: 'Heritage.xlsx', age: 'Key Stats by Age Group.xlsx' };
  const MAP_FILE = 'round2-zones.csv', CLUB_FILE = 'List of all NSW RU Clubs.xlsx';
  const n = v => Math.round(v).toLocaleString('en-AU');
  const pct = v => `${(v * 100).toFixed(1)}%`;
  const money = v => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;
  const tip = s => `data-tip="${esc(s)}" tabindex="0"`;
  let zones = null, mapping = null, clubs = null, failed = '', sortKey = 'perHead', sortDir = 1;
  // Club names reduced to their distinctive words, to match grant recipients.
  const words = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(rugby|union|club|football|inc|incorporated|ltd|rufc|ruc|rfc|jrc|jru|jrufc|jufc|junior|juniors|seniors|the|and|of|rc|council|shire|regional|city|nsw|sydney|district|zone|association|new|south|wales|australia|australian)\b/g, ' ').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  async function clubList() {
    const f = await DataFiles.get(/club/i, CLUB_FILE);
    if (!f) throw new Error(`missing: NSW Rugby's club list (${CLUB_FILE})`);
    const wb = XLSX.read(f.buffer, { type: 'array' });
    const list = [], standards = {};
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
      if (/overview/i.test(name)) { for (const r of rows) if (r[0] && Number.isFinite(r[5])) standards[String(r[0]).trim()] = { gold: r[1], silver: r[2], bronze: r[3], none: r[4], total: r[5] }; continue; }
      for (const r of rows.slice(2)) if (r[0] && r[1]) list.push({ zone: name.trim(), assoc: String(r[0]).trim(), club: String(r[1]).trim(), w: words(r[1]) });
    }
    return { list, standards };
  }

  const num = v => (typeof v === 'number' ? v : Number(v)) || 0;
  // Rows of the first sheet, with blank leading cells filled from the row above (the exports leave repeats blank).
  async function sheet(file, fill) {
    const f = await DataFiles.get(new RegExp('^' + file.replace(/\s*\(\d+\)/, '').replace(/\.xlsx$/i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.*\\.xlsx$', 'i'), file);
    if (!f) throw new Error(`missing: ${file}`);
    const wb = XLSX.read(f.buffer, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
    const last = [];
    return rows.map(r => r.map((v, i) => { if (i < fill) { if (v == null || v === '') return last[i]; last[i] = v; } return v; }));
  }
  const csv = text => text.trim().split(/\r?\n/).slice(1).map(l => { const [type, name, zone, note] = l.split(','); return { type, name, zone, note: note || '' }; });

  async function load() {
    try {
      mapping = csv(D.zoneMapping);
      clubs = await clubList();
      const [churn, metrics, heritage, age] = await Promise.all([sheet(FILES.churn, 2), sheet(FILES.metrics, 2), sheet(FILES.heritage, 3), sheet(FILES.age, 2)]);
      zones = build({ churn, metrics, heritage, age });
    } catch (e) { failed = e.message; zones = null; }
    render();
    document.dispatchEvent(new CustomEvent('round2-ready'));
  }

  function build({ churn, metrics, heritage, age }) {
    const zoneOf = { ...Object.fromEntries(clubs.list.map(c => [c.assoc, c.zone])), ...Object.fromEntries(mapping.filter(m => m.type === 'association').map(m => [m.name, m.zone])) };
    const Z = {}, z = name => (Z[name] ||= { name, assocs: new Set(), ly: 0, ty: 0, ret: 0, players: 0, coaches: 0, fn: 0, pas: 0, herTotal: 0, female: 0, ageTotal: 0, legacy: 0, lines: [], facility: 0 });
    const total = { ly: 0, ty: 0, ret: 0, players: 0, coaches: 0, fn: 0, pas: 0, herTotal: 0, female: 0, ageTotal: 0 };
    const add = (name, k, v) => { const zn = zoneOf[name]; if (zn) { z(zn)[k] += v; z(zn).assocs.add(name); } };
    const head = rows => rows[0].map(h => String(h ?? '').trim());
    // Churn: participants last year / this year and returning participants.
    { const h = head(churn), c = k => h.indexOf(k);
      for (const r of churn.slice(1)) { if (!r[1] || r[0] === 'Grand Total') continue; const nsw = r[0] === 'New South Wales Rugby Union';
        const ly = num(r[c('Participants LY')]), ty = num(r[c('Participants TY')]), ret = num(r[c('Participants Returning TY')]);
        add(r[1], 'ly', ly); add(r[1], 'ty', ty); add(r[1], 'ret', ret);
        if (nsw && zoneOf[r[1]]) { total.ly += ly; total.ty += ty; total.ret += ret; } } }
    { const h = head(metrics), c = k => h.indexOf(k);
      for (const r of metrics.slice(1)) { if (!r[1]) continue; const p = num(r[c('Players TY')]), co = num(r[c('Coaches TY')]); add(r[1], 'players', p); add(r[1], 'coaches', co); if (zoneOf[r[1]]) { total.players += p; total.coaches += co; } } }
    // Heritage: the "Participants #" row for the latest year of each association.
    { const h = head(heritage), FN = h.indexOf('Aboriginal and/ or Torres Strait Islander'), PAS = ['Samoan', 'Tongan', 'Fijian'].map(k => h.indexOf(k));
      const years = heritage.slice(1).map(r => Number(r[2])).filter(Boolean), latest = Math.max(...years);
      for (const r of heritage.slice(1)) { if (!r[1] || Number(r[2]) !== latest || r[3] !== 'Participants #') continue;
        const all = r.slice(4).reduce((s, v) => s + num(v), 0), fn = num(r[FN]), pas = PAS.reduce((s, i) => s + num(r[i]), 0);
        add(r[1], 'herTotal', all); add(r[1], 'fn', fn); add(r[1], 'pas', pas); if (zoneOf[r[1]]) { total.herTotal += all; total.fn += fn; total.pas += pas; } } }
    { const h = head(age), T = h.indexOf('Participants TY'), F = h.indexOf('Female Participants TY');
      for (const r of age.slice(1)) { if (!r[1] || !r[2]) continue; add(r[1], 'ageTotal', num(r[T])); add(r[1], 'female', num(r[F])); if (zoneOf[r[1]]) { total.ageTotal += num(r[T]); total.female += num(r[F]); } } }
    // Round 1 Legacy allocations: by the club the grant names, else its town in a club name, else the CSV mapping.
    const byTown = Object.fromEntries(mapping.filter(m => m.type === 'town').map(m => [m.name, m.zone]));
    const byRegion = Object.fromEntries(mapping.filter(m => m.type === 'region').map(m => [m.name, m.zone]));
    const placeOf = g => {
      // Councils are placed by town: their names (e.g. Port Macquarie-Hastings) can share a word with an unrelated club.
      const rw = /council/i.test(g.recipient || '') ? [] : words(g.recipient);
      const club = rw.length && clubs.list.find(c => c.w.length && (rw.every(w => c.w.includes(w)) || (c.w.length > 1 && c.w.every(w => rw.includes(w)))));
      if (club) return [club.zone, `club list: ${club.club}`];
      const town = g.town && clubs.list.find(c => new RegExp(`\\b${g.town.replace(/[^a-z ]/gi, '')}\\b`, 'i').test(c.club));
      if (town) return [town.zone, `town in club list: ${town.club}`];
      if (byTown[g.town]) return [byTown[g.town], 'mapping file (town)'];
      if (byRegion[g.region]) return [byRegion[g.region], 'mapping file (region fallback)'];
      return [null, ''];
    };
    for (const g of A.allGrants()) { const [zn, via] = placeOf(g); if (!zn) continue; z(zn).legacy += g.amount; z(zn).lines.push(`${g.project} (${g.town || g.region}) ${money(g.amount)} · ${via}`); if (g.pillar === 'FE') z(zn).facility++; }
    for (const d of D.dashboard) { const zn = byRegion[d.region]; if (!zn) continue; z(zn).legacy += d.total; z(zn).lines.push(`${d.initiative} (3-year budget) ${money(d.total)}`); }
    const out = Object.values(Z).filter(x => x.ly || x.ty).map(x => ({ ...x, assocs: [...x.assocs], growth: x.ly ? x.ty / x.ly - 1 : null, churn: x.ly ? 1 - x.ret / x.ly : null, perCoach: x.coaches ? x.players / x.coaches : null,
      fnShare: x.herTotal ? x.fn / x.herTotal : null, pasShare: x.herTotal ? x.pas / x.herTotal : null, femShare: x.ageTotal ? x.female / x.ageTotal : null, perHead: x.ty ? x.legacy / x.ty : null, clubs: clubs.list.filter(c => c.zone === x.name).length, standards: clubs.standards[x.name] || null }));
    const nsw = { growth: total.ty / total.ly - 1, churn: 1 - total.ret / total.ly, perCoach: total.players / total.coaches, fnShare: total.fn / total.herTotal, pasShare: total.pas / total.herTotal, femShare: total.female / total.ageTotal,
      perHead: out.reduce((s, x) => s + x.legacy, 0) / out.reduce((s, x) => s + x.ty, 0) };
    const target = A.kpiTargets().find(k => k.id === 'coachRatio')?.target || 10;
    // What stands out against the total of these zones. Each is a reason to look closer, not a verdict.
    for (const x of out) {
      x.notes = [];
      if (x.growth != null && x.growth < 0) x.notes.push(['Participation falling', `${pct(x.growth)} from 2025 to 2026 (NSW zones ${pct(nsw.growth)}).`]);
      if (!x.facility) x.notes.push(['No Round 1 facility grant', 'None of the Round 1 facility grants is placed in this zone.']);
      if (x.perHead != null && x.perHead < nsw.perHead / 2) x.notes.push(['Low Legacy funding per participant', `${money(x.perHead)} per participant, under half the ${money(nsw.perHead)} across these zones.`]);
      if (x.churn != null && x.churn > nsw.churn + 0.05) x.notes.push(['High churn', `${pct(x.churn)} of last year's participants did not return (NSW zones ${pct(nsw.churn)}).`]);
      if (x.perCoach != null && x.perCoach > target + 2) x.notes.push(['Few coaches for its players', `${x.perCoach.toFixed(1)} players per coach against the plan's ${target}:1.`]);
      if (x.fnShare != null && x.fnShare > nsw.fnShare * 1.5) x.notes.push(['Large First Nations community', `${pct(x.fnShare)} of participants are First Nations (NSW zones ${pct(nsw.fnShare)}).`]);
      if (x.pasShare != null && x.pasShare > nsw.pasShare * 1.5) x.notes.push(['Large Pasifika community', `${pct(x.pasShare)} are Samoan, Tongan or Fijian (NSW zones ${pct(nsw.pasShare)}).`]);
    }
    return { list: out, nsw, target };
  }

  const COLS = [
    ['name', 'Zone', x => `<b>${esc(x.name)}</b>`, 'Rugby zone. Associations in it are on hover.'],
    ['legacy', 'Round 1 Legacy', x => money(x.legacy), 'Known Round 1 grants and region-tagged 3-year budget lines placed in this zone. Statewide budgets are not in any zone. Round 2 is not included until the Minister announces it.'],
    ['perHead', 'Legacy per participant', x => x.perHead == null ? '–' : money(x.perHead), 'Round 1 Legacy allocations ÷ participants in 2026.'],
    ['ty', 'Participants 2026', x => n(x.ty), 'Sum over the zone\'s associations (Rugby Analytics).'],
    ['growth', 'Change since 2025', x => x.growth == null ? '–' : `${x.growth >= 0 ? '+' : ''}${pct(x.growth)}`, 'Participants 2026 ÷ participants 2025 − 1 (Rugby Analytics growth definition).'],
    ['churn', 'Churn', x => x.churn == null ? '–' : pct(x.churn), '1 − returning participants ÷ last year\'s participants (Rugby Analytics). People moving between associations count as leaving, so zone churn runs high.'],
    ['perCoach', 'Players per coach', x => x.perCoach == null ? '–' : x.perCoach.toFixed(1), 'Players ÷ coaches in 2026.'],
    ['fnShare', 'First Nations', x => x.fnShare == null ? '–' : pct(x.fnShare), 'Share of participants recording Aboriginal and/or Torres Strait Islander heritage.'],
    ['pasShare', 'Pasifika', x => x.pasShare == null ? '–' : pct(x.pasShare), 'Samoan, Tongan and Fijian participants as a share of all participants.'],
    ['femShare', 'Female', x => x.femShare == null ? '–' : pct(x.femShare), 'Female participants ÷ participants (age group table).'],
  ];

  function render() {
    const host = $('#round2Table');
    if (!host) return;
    if (failed) { host.innerHTML = `<p class="muted"><b>Upload data to see the zone view.</b> In Data Studio, upload the Rugby Analytics association exports (Hierarchy Churn, Hierarchy Metrics, Heritage, Key Stats by Age Group) and NSW Rugby's club list. Still needed: ${esc(failed.replace(/^missing: /, ''))}.</p>`; if ($('#round2Note')) $('#round2Note').textContent = ''; return; }
    if (!zones) { host.innerHTML = '<p class="muted">Reading the Rugby Analytics files…</p>'; return; }
    const { list, nsw } = zones;
    const sorted = [...list].sort((a, b) => ((a[sortKey] ?? -Infinity) > (b[sortKey] ?? -Infinity) ? 1 : -1) * sortDir * (sortKey === 'name' ? -1 : 1));
    $('#round2Note').innerHTML = `${esc(D.context.round2)} Zones, associations and clubs come from <b ${tip(`NSW Rugby's club list (Dataset/${CLUB_FILE}): ${clubs.list.length} clubs in ${new Set(clubs.list.map(c => c.zone)).size} zones. Each grant is placed by the club it names, else its town in a club name, else Dataset/${MAP_FILE}. Southern Inland clubs play under ACT & Southern NSW Rugby, so they are not in the list. Hover a zone for the grants placed in it and how.`)}>NSW Rugby's club list</b>.`;
    host.innerHTML = `<table class="pretty-table r2-table"><thead><tr>${COLS.map(([k, l, , t]) => `<th data-sort="${k}" class="${sortKey === k ? 'sorted' : ''}" ${tip(`${t}\nClick to sort.`)}>${l}</th>`).join('')}<th>Worth a look</th></tr></thead><tbody>
      ${sorted.map(x => `<tr><td ${tip(`Associations: ${x.assocs.join(', ')}${x.standards ? `\nClubs: ${x.standards.total} (club standards: ${x.standards.silver} Silver, ${x.standards.bronze} Bronze, ${x.standards.none} not in place; NSW Rugby club list)` : x.clubs ? '' : '\nACT & Southern NSW Rugby: not in the NSW Rugby club list'}\n\nRound 1 lines placed here:\n${x.lines.join('\n') || 'none'}`)}>${COLS[0][2](x)}</td>${COLS.slice(1).map(c => `<td class="num">${c[2](x)}</td>`).join('')}
        <td>${x.notes.map(([l, t]) => `<span class="r2-note" ${tip(t)}>${esc(l)}</span>`).join(' ') || '<span class="muted">–</span>'}</td></tr>`).join('')}
      <tr class="r2-total"><td><b>All zones</b></td><td class="num">${money(list.reduce((s, x) => s + x.legacy, 0))}</td><td class="num">${money(nsw.perHead)}</td><td class="num">${n(list.reduce((s, x) => s + x.ty, 0))}</td><td class="num">${pct(nsw.growth)}</td><td class="num">${pct(nsw.churn)}</td><td class="num">${nsw.perCoach.toFixed(1)}</td><td class="num">${pct(nsw.fnShare)}</td><td class="num">${pct(nsw.pasShare)}</td><td class="num">${pct(nsw.femShare)}</td><td></td></tr>
      </tbody></table>`;
    $$('th[data-sort]', host).forEach(th => th.onclick = () => { const k = th.dataset.sort; sortDir = sortKey === k ? -sortDir : 1; sortKey = k; render(); });
  }

  // For the AI briefing and the recommendations.
  function contextLines() {
    if (!zones) return [];
    return ['LEGACY BY RUGBY ZONE (Round 2 recipients are decided but not announced, so this is for checking that list later and for future funding; zone | Round 1 Legacy $ | $ per participant | participants 2026 | change since 2025 | churn | players per coach | First Nations % | Pasifika % | worth a look; zones from NSW Rugby\'s club list): '
      + zones.list.map(x => [x.name, money(x.legacy), x.perHead == null ? '-' : money(x.perHead), n(x.ty), x.growth == null ? '-' : pct(x.growth), x.churn == null ? '-' : pct(x.churn), x.perCoach?.toFixed(1) ?? '-', x.fnShare == null ? '-' : pct(x.fnShare), x.pasShare == null ? '-' : pct(x.pasShare), x.notes.map(([l]) => l).join('; ') || '-'].join(' | ')).join(' || ')];
  }

  document.addEventListener('app-ready', () => { if ($('#round2Card')) { render(); load(); } });
  // A Rugby Analytics export or the club list uploaded in Data Studio: rebuild the zone view.
  document.addEventListener('datafile-added', e => { if (/hierarchy|heritage|key stats|club/i.test(e.detail.name)) { failed = ''; zones = null; render(); load(); } });
  window.Round2 = { contextLines, get zones() { return zones; } };
})();
