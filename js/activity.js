// Impact > Overview: activity, dollar value and happiness index for each facility and each region.
// Dollar value = people taking part weekly × the social benefit of weekly community club sport ($5,932 a year, Australian
// Sports Commission & Griffith 2018, via the Clearinghouse for Sport; js/methods.js). One-off attendees are not valued.
// Happiness index = the life satisfaction question from the ASC Community Perceptions Monitor (0-10), so Legacy results compare with national data, averaged over
// respondents, × 10 (0-100). Without a real survey the place is flagged "Survey needed".
// In Demo view (js/demo-view.js) missing results and surveys are filled from demo/Dummy-dataset.csv: they are tagged
// [DUMMY], never count as collected data, and any real figure replaces them.
// Life satisfaction is not converted to dollars: the WELLBY value is HM Treasury (UK) guidance with no Australian equivalent.
(() => {
  const { $, $$, esc, toast } = window.App;
  const D = window.TACKLE_DATA, M = window.Methods;
  const aud = v => '$' + Math.round(v).toLocaleString('en-AU');
  const num = v => Math.round(v).toLocaleString('en-AU');
  const tip = s => `data-tip="${esc(s)}" tabindex="0"`;
  const QUESTION = 'On a scale of 0 to 10, how satisfied are you with your life as a whole at the moment?';
  const DV = window.DemoView, DUMMY_TAG = DV.TAG, DUMMY_NOTE = DV.NOTE;
  let view = 'facility';

  const results = () => Store.get('programs') || {};
  const stored = () => Store.get('wellbeing') || {};
  const count = r => (r && r.participants !== '' && Number.isFinite(Number(r.participants)) ? Number(r.participants) : null);
  const weeklyOf = r => (r && Number.isFinite(Number(r.weekly)) && r.weekly !== '' ? Number(r.weekly) : null);
  const programs = () => window.Programs?.programs() || [];

  // ---------- places ----------
  function facilities() {
    return programs().filter(p => p.pillar === 'FE').map(p => {
      const r = results()[p.id], w = stored()['facility:' + p.id], n = Number.isFinite(w?.people) ? w.people : count(r), wk = Number.isFinite(w?.weekly) ? w.weekly : weeklyOf(r);
      return { key: 'facility:' + p.id, name: p.name, region: p.region, sub: p.recipient,
        activity: n == null ? null : { n, weekly: wk, dummy: !!r?.dummy && !Number.isFinite(w?.people), from: r?.dummy && !Number.isFinite(w?.people) ? `${DUMMY_NOTE} Used as people reached for this grant.` : `Entered for this grant: ${num(n)} people reached` } };
    });
  }
  function regions() {
    const lines = programs().map(p => [p.region, p.id, p.name]);
    return D.regions.map(rg => {
      let activity = null;
      const own = stored()['region:' + rg.name];
      const mine = lines.filter(([reg]) => reg === rg.name).map(([, id, name]) => [name, count(results()[id]), results()[id]?.dummy, weeklyOf(results()[id])]).filter(([, n]) => n != null);
      const wks = mine.filter(x => x[3] != null);
      if (Number.isFinite(own?.people)) activity = { n: own.people, weekly: Number.isFinite(own.weekly) ? own.weekly : null, from: 'Entered for this region' };
      else if (mine.length) activity = { n: mine.reduce((s, [, n]) => s + n, 0), weekly: wks.length ? wks.reduce((s, x) => s + x[3], 0) : null, dummy: mine.some(x => x[2]), from: `People reached by ${mine.length} Legacy-funded line${mine.length > 1 ? 's' : ''} in this region\n${mine.map(([nm, n]) => `• ${nm}: ${num(n)}`).join('\n')}\nPeople in more than one program are counted once per program.` };
      return { key: 'region:' + rg.name, name: rg.name, region: rg.name, activity };
    });
  }

  // Survey result for a place: staff entry (or Demo view), otherwise an uploaded survey (regions only; latest upload wins).
  function survey(place) {
    const own = stored()[place.key];
    if (own && !own.dummy && Number.isFinite(own.mean)) return { ...own, from: 'Entered by staff' };
    if (place.key.startsWith('region:')) {
      const ups = (Store.get('datasets') || []).slice().sort((a, b) => (a.created || 0) - (b.created || 0))
        .flatMap(d => (d.wellbeing || []).map(w => ({ ...w, dataset: d.name }))).filter(w => w.region === place.region);
      const w = ups.pop();
      if (w) return { n: w.n, mean: w.mean, from: `Uploaded survey: ${w.dataset} (${w.sheet}, column "${w.column}")` };
    }
    return own?.dummy ? { ...own, from: DUMMY_NOTE } : null;
  }
  const needsSurvey = p => !survey(p); // in Demo view [DUMMY] figures count, because it assumes all the data is there
  const needsActivity = p => !p.activity;

  // ---------- one row ----------
  function row(p) {
    const s = survey(p), flags = [];
    let dollar = '<span class="muted">–</span>';
    if (p.activity?.weekly != null) {
      const v = p.activity.weekly * M.HEALTH_PER_PERSON;
      dollar = `<b ${tip(`${p.activity.dummy ? '[DUMMY] ' : ''}Social value of the activity\n\n${num(p.activity.weekly)} people taking part weekly × ${M.healthWorking} = ${aud(v)} a year.\n\nOf the ${num(p.activity.n)} people reached, only weekly participants are valued: the $5,932 was measured for playing community club sport once a week, so one-off attendees are left out.\n\nWhere the counts come from: ${p.activity.from}\n\nAn Australian national average, so indicative for this place.`)}>${aud(v)}</b><span class="muted small"> /yr</span>${p.activity.dummy ? ' ' + DUMMY_TAG : ''}`;
    } else if (p.activity) dollar = `<span class="muted" ${tip('People reached are recorded, but not how many take part weekly. Only weekly participants are valued ($5,932 a year each, Australian Sports Commission 2018). Add the weekly count under "Enter a result".')}>Needs weekly count</span>`;
    if (needsActivity(p)) flags.push(['watch', 'Activity data needed', `No count of people using ${p.key.startsWith('facility') ? 'this facility' : 'facilities and programs in this region'} yet. Enter it under "Enter a result" below.`]);

    let happy = '<span class="muted">–</span>';
    if (s) {
      const idx = s.mean * 10;
      happy = `<b ${tip(`${s.dummy ? '[DUMMY] ' : ''}Happiness index: ${idx.toFixed(0)} out of 100\n\nSurvey question (ASC Community Perceptions Monitor): "${QUESTION}"\nAverage answer ${s.mean.toFixed(1)} out of 10 from ${num(s.n)} respondent${s.n === 1 ? '' : 's'}${s.date ? ` (${s.date})` : ''}.\nIndex = average × 10, so it reads on the same 0-100 scale as the app's percentages.\nNational benchmark (CPM, Dec 2022 - Sep 2025, n=17,604): 44% of adults involved in sport score 8-10, against 38% of those not involved; 9% against 13% score 0-3. England (Active Lives 2016-17) averages: 6.51 inactive, 7.24 active.${Number.isFinite(s.before) ? `\n\nChange: ${s.before.toFixed(1)} → ${s.mean.toFixed(1)} = ${(s.mean - s.before >= 0 ? '+' : '') + (s.mean - s.before).toFixed(1)} points on the 0-10 scale. Descriptive, not proof the program caused it.` : ''}\n\nSource: ${s.from}\nNot converted to dollars: the WELLBY value (£13,000 per point per person per year) is UK HM Treasury guidance with no Australian equivalent.`)}>${idx.toFixed(0)}</b><span class="muted small"> /100 · n=${num(s.n)}</span>${s.dummy ? ' ' + DUMMY_TAG : ''}`;
    }
    if (needsSurvey(p)) flags.push(['risk', 'Survey needed', `No life satisfaction survey for this ${p.key.startsWith('facility') ? 'facility' : 'region'} yet. Ask users: "${QUESTION}" Then enter the results below, or upload the survey with a region column and a "life satisfaction" column.`]);

    return `<tr><td><b>${esc(p.name)}</b>${p.sub ? `<br><span class="muted small">${esc(p.sub)}</span>` : ''}</td>${view === 'facility' ? `<td>${esc(p.region)}</td>` : ''}
      <td>${p.activity ? `<span ${tip(`People taking part\n\n${p.activity.from}`)}>${num(p.activity.n)}</span>${p.activity.dummy ? ' ' + DUMMY_TAG : ''}` : '<span class="muted">–</span>'}</td>
      <td>${dollar}</td><td>${happy}</td>
      <td>${flags.map(([c, l, t]) => `<span class="status ${c}" ${tip(t)}>${esc(l)}</span>`).join(' ') || '<span class="status positive">Complete</span>'}</td></tr>`;
  }

  function render() {
    const host = $('#activityTable');
    if (!host) return;
    const places = view === 'facility' ? facilities() : regions();
    const noSurvey = places.filter(needsSurvey).length, noAct = places.filter(needsActivity).length;
    $('#activitySummary').innerHTML = `<span class="status risk" ${tip('Places with no life satisfaction survey.')}>${noSurvey} of ${places.length} need a survey</span> <span class="status watch" ${tip('Places with no count of people taking part.')}>${noAct} need activity data</span>`;
    host.innerHTML = `<table class="pretty-table"><thead><tr><th>${view === 'facility' ? 'Facility' : 'Region'}</th>${view === 'facility' ? '<th>Region</th>' : ''}
      <th ${tip('People reached by Legacy-funded work. Tagged [DUMMY] in Demo view.')}>People taking part</th>
      <th ${tip(`People taking part weekly × ${M.healthWorking}.`)}>Social value</th>
      <th ${tip(`Average answer to the ASC Community Perceptions Monitor life satisfaction question × 10 (0-100). "${QUESTION}"\nNational benchmark: 44% of adults involved in sport score 8-10, against 38% of those not involved (CPM 2022-25).`)}>Happiness index</th><th>Flags</th></tr></thead>
      <tbody>${places.map(row).join('')}</tbody></table>`;
    $('#wbPlace').innerHTML = places.map(p => `<option value="${esc(p.key)}">${esc(p.name)}${view === 'facility' ? ` (${esc(p.region)})` : ''}</option>`).join('');
  }

  document.addEventListener('app-ready', () => {
    if (!$('#activityCard')) return;
    $('#wbQuestion').textContent = QUESTION;
    $$('#activityView button').forEach(b => b.addEventListener('click', () => {
      view = b.dataset.av;
      $$('#activityView button').forEach(x => x.classList.toggle('on', x === b));
      render();
    }));
    $('#wbForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = id => $(id).value === '' ? NaN : Number($(id).value);
      const entry = { people: v('#wbPeople'), weekly: v('#wbWeekly'), n: v('#wbN'), mean: v('#wbMean'), before: v('#wbBefore'), date: $('#wbDate').value };
      const hasSurvey = Number.isFinite(entry.mean);
      if (!Number.isFinite(entry.people) && !hasSurvey) { toast('Enter people reached, or a survey result.'); return; }
      if (hasSurvey && (!(entry.n > 0) || !(entry.mean >= 0 && entry.mean <= 10) || (Number.isFinite(entry.before) && !(entry.before >= 0 && entry.before <= 10)))) { toast('Enter respondents, and averages between 0 and 10.'); return; }
      Store.set('wellbeing', { ...stored(), [$('#wbPlace').value]: entry });
      e.currentTarget.reset();
      render();
      toast('Result saved.');
      document.dispatchEvent(new CustomEvent('data-changed'));
    });
    $('#wbClear').addEventListener('click', () => {
      const k = $('#wbPlace').value, all = { ...stored() };
      if (!all[k]) { toast('Nothing entered for this place.'); return; }
      delete all[k];
      Store.set('wellbeing', all);
      render();
    });
    render();
  });
  document.addEventListener('data-changed', render);
  document.addEventListener('tab', e => { if (e.detail === 'impact') render(); }); // Programs results are saved without an event

  // For the AI briefing: places with an activity count or a survey, with made-up figures marked so they are never quoted as real.
  function contextLines() {
    const lines = [];
    for (const [label, places] of [['FACILITY', facilities()], ['REGION', regions()]]) {
      const known = places.filter(p => p.activity || survey(p));
      lines.push(`${label} ACTIVITY & HAPPINESS (social value = people taking part weekly × $${M.HEALTH_PER_PERSON.toLocaleString('en-AU')}/yr, ASC 2018; happiness = ASC Community Perceptions Monitor life satisfaction 0-10 × 10 (national: 44% of sport-involved adults score 8-10 vs 38% not involved); anything marked [DUMMY] is made up for testing: never report it as a result): `
        + (known.length ? known.map(p => { const s = survey(p); return `${p.name}: ${p.activity ? `${p.activity.dummy ? '[DUMMY] ' : ''}${num(p.activity.n)} people${p.activity.weekly != null ? `, ${num(p.activity.weekly)} weekly, ${aud(p.activity.weekly * M.HEALTH_PER_PERSON)}/yr` : ', weekly count not recorded'}` : 'activity not recorded'}; ${s ? `${s.dummy ? '[DUMMY] ' : ''}happiness ${(s.mean * 10).toFixed(0)}/100 (n=${s.n})` : 'SURVEY NEEDED'}`; }).join(' | ') : 'none recorded')
        + `. ${places.filter(needsSurvey).length} of ${places.length} need a survey, ${places.filter(needsActivity).length} need activity data.`);
    }
    return lines;
  }

  window.Activity = { render, facilities, regions, survey, contextLines, QUESTION };
})();
