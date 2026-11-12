// Every Legacy grant and budget line, with any results recorded for it (Store 'programs'), for the Dashboard, Story and AI.
// Nothing is estimated: no results recorded means no figure.
(() => {
  const A = window.Analytics, D = window.TACKLE_DATA;
  const PILLAR = { FE: 'Facilities & Equipment', PW: 'Programs & Workforce', INC: 'Inclusion', ACT: 'Activation', PM: 'Management & evaluation' };
  const aud = n => '$' + Math.round(n).toLocaleString('en-AU');
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

  function programs() {
    const list = [];
    for (const g of A.allGrants()) {
      const kind = g.datasetId ? 'upload' : 'grant';
      list.push({ kind, id: slug(`${kind}-${g.recipient || ''}-${g.project}`), name: g.project, recipient: g.recipient, pillar: g.pillar, region: g.region, town: g.town, type: g.type, tags: g.tags || [], cost: g.amount, source: g.source });
    }
    for (const d of D.dashboard) list.push({ kind: 'budget', id: slug(`budget-${d.initiative}`), name: d.initiative, recipient: 'NSWRU', pillar: d.pillar, region: d.region, type: d.initiative, tags: d.tags || [], cost: d.total, years: [d.y1, d.y2, d.y3], status: d.status, source: 'RWC Dashboard' });
    return list;
  }

  const resultsOf = id => (Store.get('programs') || {})[id] || {};
  const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  function metrics(p, r = resultsOf(p.id)) {
    const spent = num(r.spent), base = spent ?? p.cost;
    const per = n => num(n) && n > 0 ? base / n : null;
    return { spent, base, perPerson: per(r.participants), perQualified: per(r.qualified), perEvent: per(r.events),
      leverage: num(r.coFunding) != null && p.cost ? r.coFunding / p.cost : null,
      hasResults: ['participants', 'qualified', 'events', 'coFunding', 'spent'].some(k => num(r[k]) != null) };
  }

  // Only lines with recorded results go to the AI, so the shared data stays stable (and cached) otherwise.
  function contextLines() {
    const lines = programs().filter(p => metrics(p).hasResults).map(p => {
      const m = metrics(p), r = resultsOf(p.id);
      const bits = [`${r.dummy ? '[DUMMY] ' : ''}${p.name} (${p.recipient || 'NSWRU'}, ${p.region}, ${PILLAR[p.pillar] || p.pillar})`, `cost ${aud(p.cost)}`];
      if (m.spent != null) bits.push(`spent ${aud(m.spent)}`);
      if (num(r.participants) != null) bits.push(`${r.participants} people reached (${aud(m.perPerson)} each)`);
      if (num(r.qualified) != null) bits.push(`${r.qualified} new coaches/referees`);
      if (num(r.events) != null) bits.push(`${r.events} sessions/events`);
      if (m.leverage != null) bits.push(`co-funding $${m.leverage.toFixed(2)} per $1`);
      return bits.join('; ');
    });
    return lines.length ? ['LEGACY PROGRAM RESULTS: ' + lines.join(' | ')] : [];
  }

  window.Programs = { programs, metrics, contextLines };
})();
