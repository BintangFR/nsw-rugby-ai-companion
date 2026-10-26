// Seed data for Tackle AI.
// Source: Dataset/RWC_Legacy_Data_Compilation.xlsx (compiled 24 Sep 2026) and
// Dataset/RWC Dashboard 010926 (2).xlsx. Region population and First Nations
// share are INDICATIVE approximations (ABS 2021, rounded) used only to normalise
// spend - replace them by uploading a dataset with a region column.
window.TACKLE_DATA = (() => {
  const regions = [
    { name: 'Western Sydney',            lat: -33.82, lng: 150.92, metro: true,  pop: 2500, fnShare: 2.8 },
    { name: 'Sydney - East',             lat: -33.89, lng: 151.26, metro: true,  pop: 290,  fnShare: 0.9 },
    { name: 'Sydney - Northern Beaches', lat: -33.73, lng: 151.27, metro: true,  pop: 265,  fnShare: 0.7 },
    { name: 'Sydney - South',            lat: -34.04, lng: 151.10, metro: true,  pop: 230,  fnShare: 1.6 },
    { name: 'Sydney - Inner & Bayside',  lat: -33.93, lng: 151.20, metro: true,  pop: 180,  fnShare: 1.5 },
    { name: 'Hunter',                    lat: -32.65, lng: 151.35, metro: false, pop: 780,  fnShare: 7.0 },
    { name: 'Illawarra',                 lat: -34.42, lng: 150.88, metro: false, pop: 310,  fnShare: 4.3 },
    { name: 'Central West',              lat: -33.30, lng: 149.10, metro: false, pop: 215,  fnShare: 7.5 },
    { name: 'Mid North Coast',           lat: -31.10, lng: 152.85, metro: false, pop: 225,  fnShare: 8.0 },
    { name: 'New England',               lat: -30.00, lng: 151.30, metro: false, pop: 190,  fnShare: 11.0 },
    { name: 'Riverina',                  lat: -35.10, lng: 147.37, metro: false, pop: 160,  fnShare: 6.5 },
    { name: 'Western NSW',               lat: -30.90, lng: 147.80, metro: false, pop: 120,  fnShare: 16.0 },
    { name: 'Southern Tablelands',       lat: -34.75, lng: 149.72, metro: false, pop: 65,   fnShare: 4.0 },
    { name: 'Northern Rivers',           lat: -29.30, lng: 153.10, metro: false, pop: 310,  fnShare: 5.8 },
  ];

  // Aliases used to match uploaded data (region, LGA or town names) to a region.
  const aliases = {
    'Western Sydney': ['western sydney', 'west sydney', 'w. sydney', 'w sydney', 'cumberland', 'parramatta', 'blacktown', 'penrith', 'liverpool', 'fairfield', 'campbelltown', 'merrylands', 'holroyd', 'canterbury-bankstown', 'camden'],
    'Sydney - East': ['sydney - east', 'eastern suburbs', 'woollahra', 'rose bay', 'randwick', 'waverley'],
    'Sydney - Northern Beaches': ['northern beaches', 'manly', 'belrose', 'warringah'],
    'Sydney - South': ['sydney - south', 'sutherland', 'caringbah', 'cronulla', 'menai'],
    'Sydney - Inner & Bayside': ['sydney', 'bayside', 'daceyville', 'inner west', 'city of sydney', 'rockdale', 'concord'],
    'Hunter': ['hunter', 'newcastle', 'maitland', 'muswellbrook', 'scone', 'upper hunter', 'lorn', 'cessnock', 'lake macquarie'],
    'Illawarra': ['illawarra', 'wollongong', 'woonona', 'keiraville', 'shellharbour', 'kiama', 'south coast'],
    'Central West': ['central west', 'orange', 'bathurst', 'mudgee', 'mid-western', 'forbes', 'parkes', 'cowra'],
    'Mid North Coast': ['mid north coast', 'coffs harbour', 'toormina', 'port macquarie', 'kempsey', 'north coast'],
    'New England': ['new england', 'inverell', 'glen innes', 'armidale', 'tamworth', 'moree'],
    'Riverina': ['riverina', 'wagga', 'wagga wagga', 'temora', 'bourkelands', 'griffith', 'southern inland', 'albury'],
    'Western NSW': ['western nsw', 'western plains', 'warren', 'coonamble', 'gulargambone', 'bourke', 'dubbo', 'brewarrina', 'nyngan', 'orana', 'far west'],
    'Southern Tablelands': ['southern tablelands', 'goulburn', 'yass', 'queanbeyan'],
    'Northern Rivers': ['northern rivers', 'yamba', 'clarence valley', 'lismore', 'grafton', 'ballina', 'far north coast'],
  };

  // pillar: FE = Facilities & Equipment, PW = Programs & Workforce, INC = Inclusion
  // tags: women, firstNations, pasifika (Pasifika & CALD), access (disability/accessibility)
  const g = (cat, pillar, recipient, project, type, town, region, amount, tags = []) =>
    ({ source: 'Legacy Grants R1 2025-26', cat, pillar, recipient, project, type, town, region, amount, tags });
  const grants = [
    g(1, 'FE', 'Coffs Harbour Snappers RUC', 'Changeroom upgrades - Coffs Rugby Park', 'Changerooms (inclusive/accessible)', 'Toormina', 'Mid North Coast', 112348, ['women', 'access']),
    g(1, 'FE', 'Coonamble Shire Council', 'Gulargambone Sportsground lighting & changerooms', 'Lighting + changerooms', 'Gulargambone', 'Western NSW', 135200),
    g(1, 'FE', 'Cumberland Council', 'Holroyd Sportsgrounds female-friendly facilities', 'Female-friendly changerooms', 'Holroyd', 'Western Sydney', 150000, ['women']),
    g(1, 'FE', 'Emus Rugby Club', 'Endeavour Oval Field 2 LED lighting', 'Lighting', 'Orange', 'Central West', 87628),
    g(1, 'FE', 'Glen Innes Elks RUFC', 'Irrigation at Glen Innes Rugby Park', 'Drainage / irrigation', 'Glen Innes', 'New England', 108626),
    g(1, 'FE', 'Goulburn RUFC', 'Change room upgrades', 'Changerooms', 'Goulburn', 'Southern Tablelands', 49025),
    g(1, 'FE', 'Inverell Rugby Club', 'Playing Safe Under Lights', 'Lighting', 'Inverell', 'New England', 150000),
    g(1, 'FE', 'Manly RFC', 'Keirle Park refurbishment incl. change rooms', 'Changerooms', 'Manly', 'Sydney - Northern Beaches', 81387),
    g(1, 'FE', 'Mid-Western Regional Council', 'Glen Willow complex PA system upgrade', 'PA / amenity', 'Mudgee', 'Central West', 150000),
    g(1, 'FE', 'Muswellbrook Shire Council', 'Highbrook Park facility upgrades', 'Amenities', 'Muswellbrook', 'Hunter', 103565),
    g(1, 'FE', 'Orange City Rugby Club', 'New amenities building & spectator awning', 'Amenities + shade', 'Orange', 'Central West', 150000),
    g(1, 'FE', 'Port Macquarie-Hastings Council', 'Stuart Park Field 5 subsurface drainage', 'Drainage', 'Port Macquarie', 'Mid North Coast', 105553),
    g(1, 'FE', 'Sutherland Shire Council', 'John Dwyer Reserve lighting & surface renewal', 'Lighting + surface', 'Caringbah South', 'Sydney - South', 150000),
    g(1, 'FE', 'Temora RUFC', 'Multi-purpose facility (training, storage, function)', 'Clubhouse / storage', 'Temora', 'Riverina', 41315),
    g(1, 'FE', 'Wakehurst Rugby Club', 'Change room modernisation', 'Changerooms', 'Belrose', 'Sydney - Northern Beaches', 55405),
    g(1, 'FE', 'Warren Shire Council', 'Victoria Park: hot water, recovery & safety', 'Amenities', 'Warren', 'Western NSW', 31018),
    g(1, 'FE', 'Woollahra Colleagues RUFC', 'Drainage works at Woollahra Oval 2/3', 'Drainage', 'Rose Bay', 'Sydney - East', 150000),
    g(1, 'FE', 'Woonona Shamrocks JRC', 'Youth & girls growth and accessibility', 'Accessibility', 'Woonona', 'Illawarra', 39980, ['women', 'access']),
    g(2, 'PW', 'Central West Rugby Union', 'Referee Support & Development Program', 'Match officials', 'Orange', 'Central West', 16000),
    g(2, 'INC', 'Coffs Harbour Junior RU', 'Crusaders Girls Rugby Safety & Coaching', 'Coaching / female', 'Toormina', 'Mid North Coast', 5500, ['women']),
    g(2, 'PW', 'Coffs Harbour Snappers RUC', 'Coach & athlete development', 'Coaching', 'Toormina', 'Mid North Coast', 12500),
    g(2, 'PW', 'Country Rugby Union of NSW', 'Athlete Physical Development Program', 'Pathways', 'Scone', 'Hunter', 20000),
    g(2, 'INC', 'Forbes Rugby Union Club', 'Female player participation & coaches', 'Coaching / female', 'Forbes', 'Central West', 15477, ['women']),
    g(2, 'PW', 'Illawarra District RU', 'Junior Rugby Pathways Academy', 'Pathways', 'Keiraville', 'Illawarra', 12080),
    g(2, 'PW', 'Illawarra District RU', 'Friday Night Junior 7s expansion', 'Competition', 'Woonona', 'Illawarra', 20000),
    g(2, 'PW', 'Maitland Junior Rugby Club', 'Level 1 & 2 coach development', 'Coaching', 'Lorn', 'Hunter', 5100),
    g(2, 'INC', 'New England Junior RU', 'Inclusive youth participation & pathways', 'Participation', 'Armidale', 'New England', 20000, ['access']),
    g(2, 'PW', 'NSW Country Referees Association', 'Country MO recruitment & education', 'Match officials', 'Daceyville', 'Statewide', 8000),
    g(2, 'INC', 'NSW Junior Rugby Union', 'Juniors All Nations 7s Cup', 'Competition / inclusion', 'Merrylands', 'Western Sydney', 20000, ['pasifika']),
    g(2, 'PW', 'NSW Suburban Rugby Union', 'Rugby Competitions For All', 'Competition', 'Merrylands', 'Western Sydney', 17058),
    g(2, 'PW', 'Southern Inland Referees Assoc.', 'Referee Development Pathway', 'Match officials', 'Bourkelands', 'Riverina', 14410),
    g(2, 'PW', 'Southern Inland Rugby Union', 'Get into Rugby (Walla & Tri Time)', 'Participation', 'Wagga Wagga', 'Riverina', 9474),
    g(2, 'PW', 'Sydney Junior Rugby Union', 'Get into Rugby - Walla Club Initiative', 'Participation', 'Daceyville', 'Sydney - Inner & Bayside', 18750),
    g(2, 'PW', 'Sydney Junior Rugby Union', 'Coaching Junior Rugby Initiative', 'Coaching', 'Daceyville', 'Sydney - Inner & Bayside', 15000),
    g(2, 'INC', "Sydney Women's Rugby Union", 'Tri-Tag Pathways non-contact competition', 'Competition / female', 'Rose Bay', 'Sydney - East', 14601, ['women']),
    g(2, 'PW', 'Western Plains Junior RUC', 'Under 12s Development Program', 'Competition', 'Warren', 'Western NSW', 20000),
    g(2, 'PW', 'Western Plains Junior RUC', 'Junior Coach Development Program', 'Coaching', 'Bourke', 'Western NSW', 20000),
    g(2, 'PW', 'Yamba Buccaneers Rugby Club', 'Clarence Valley 7s schools competition', 'Competition', 'Yamba', 'Northern Rivers', 15000),
  ];

  // NSWRU RWC Legacy Dashboard - 3-year budgets ($). Region 'Statewide' = held centrally by NSWRU.
  const d = (initiative, pillar, region, y1, y2, y3, tags = [], status = '') =>
    ({ source: 'RWC Dashboard', initiative, pillar, region, y1, y2, y3, total: y1 + y2 + y3, tags, status });
  const dashboard = [
    d('Western Sydney GM', 'PW', 'Western Sydney', 65000, 65000, 65000, [], 'In place'),
    d('Western Sydney Club Development Mgr', 'PW', 'Western Sydney', 55000, 65000, 65000, [], 'In place'),
    d('Western Sydney Development Officer', 'PW', 'Western Sydney', 45000, 45000, 45000, [], 'Being recruited'),
    d('Western Sydney Competitions', 'PW', 'Western Sydney', 85000, 75000, 65000, [], '6 schools locked in'),
    d('Western Sydney Rugby Development Centre', 'PW', 'Western Sydney', 75000, 75000, 75000, [], 'Academy implemented'),
    d('Match Official Manager', 'PW', 'Statewide', 55000, 55000, 55000, ['women'], 'In place'),
    d('Hunter/Newcastle Rugby for Good Manager', 'PW', 'Hunter', 50000, 60000, 60000, [], 'In place'),
    d('Hunter Rugby for Good Activities', 'PW', 'Hunter', 10000, 20000, 55000),
    d('First Nations Manager', 'INC', 'Statewide', 45000, 55000, 55000, ['firstNations'], 'In place'),
    d('First Nations Activities', 'INC', 'Statewide', 80000, 80000, 80000, ['firstNations']),
    d('Pasifika & First Nations Leadership', 'INC', 'Statewide', 25000, 25000, 25000, ['firstNations', 'pasifika']),
    d('Pasifika Programs', 'INC', 'Statewide', 55000, 45000, 35000, ['pasifika']),
    d('Integrity & Safeguarding Manager', 'INC', 'Statewide', 42000, 55000, 55000, [], 'JD compiled'),
    d('Integrity Activities', 'INC', 'Statewide', 20000, 20000, 20000),
    d('Female Participation DO', 'INC', 'Statewide', 40000, 50000, 50000, ['women'], 'Casual in place'),
    d('Female Programs & Support', 'INC', 'Statewide', 40000, 40000, 40000, ['women']),
    d('Female Marketing', 'INC', 'Statewide', 10000, 10000, 10000, ['women']),
    d('Workforce Recruitment & Development', 'PW', 'Statewide', 40000, 40000, 25000),
    d('Workforce Leadership', 'PW', 'Statewide', 60000, 60000, 60000),
    d('All Abilities', 'INC', 'Statewide', 15000, 15000, 15000, ['access']),
    d('Pride', 'INC', 'Statewide', 5000, 5000, 5000),
    d('RWC Post-Event Hubs', 'ACT', 'Statewide', 0, 30000, 370000),
    d('Monitoring & Evaluation', 'PM', 'Statewide', 75000, 30000, 75000),
    d('Project Management', 'PM', 'Statewide', 40000, 40000, 40000),
  ];

  // First Nations talent ID workshops (Dashboard H11): North Coast, Central West, Sydney Metro, South Coast, 2 x Southern Inland.
  const firstNationsReach = ['Mid North Coast', 'Central West', 'Sydney - Inner & Bayside', 'Illawarra', 'Riverina'];

  // Targets (Data Compilation "Targets & Baselines" / "Impact Analysis"). Staff can adjust target and
  // target year in the app; status and growth needed are computed in Analytics.kpiTargets().
  // kind 'growth': target = total growth by targetYear from baseYear; actual = latest annual growth (actualYear).
  // kind 'count':  target = number delivered by targetYear, paced evenly from startYear; actual = delivered so far.
  // kind 'share':  baseline/target/actual = % of audited facilities; paced evenly from baseYear.
  // kind 'level':  a value moving from baseline to target (up or down, e.g. a ratio or a churn rate), paced evenly
  //                from baseYear; unit is the suffix shown after the number (':1', '%', ' cases').
  // area: pillar from the project brief - FE (1), PRP Priority Regions & Pathways (2), PW (3), INC (4), ACT RWC Activation (5).
  // Targets without a year in the source are set to the program end (2028) and say so in `source`.
  // measure: id of a yearly series (Analytics.MEASURES) that uploads can supply. When an uploaded file has two or
  // more years of it, the actual is recalculated from that file instead of the figure typed in here.
  const kpis = [
    { id: 'facilities',     area: 'FE', kind: 'count', name: 'Facilities funded', unit: 'facilities', target: 20, startYear: 2025, targetYear: 2028, actual: 'grantsFE', source: 'Project Plan; actual = Round 1 facility grants' },
    { id: 'majorUpgrades',  area: 'FE', kind: 'count', name: 'Major priority facility upgrades', unit: 'upgrades', target: 2, startYear: 2025, targetYear: 2028, actual: null, source: 'Project Plan: Connolly Park (Wagga) + 1 Sydney site; no progress published' },
    { id: 'equipmentClubs', area: 'FE', kind: 'count', name: 'Clubs receiving major equipment', unit: 'clubs', target: 20, startYear: 2025, targetYear: 2028, actual: null, source: 'Project Plan (>20 clubs, scrum machines ~$11k); no recipients published' },
    { id: 'femaleChange',   area: 'FE', kind: 'share', name: 'Facilities with female-friendly changerooms', baseline: 31, baseYear: 2024, target: null, targetYear: 2028, actual: null, source: 'RA Infrastructure audit baseline 31%; no target set yet' },
    { id: 'clubEquipment',  area: 'FE', kind: 'share', name: 'NSW clubs receiving the club equipment grant', baseline: 0, baseYear: 2025, target: 100, targetYear: 2026, actual: null, unit: 'of NSW clubs', source: 'Partner Meeting 1 slides: $350K split evenly, ~$1,500 of equipment to every NSW rugby club, delivery February 2026. No delivery count published' },
    { id: 'r2CoContribution', area: 'FE', kind: 'annual', name: 'Round 2 grant co-contribution', unit: '% of project cost (minimum per project)', target: 25, targetYear: 2027, actual: null, source: 'RWC Legacy Data Compilation (Round 2 notes): up to ~$2.15M in 2026/27 with a 25% co-contribution; outcomes from Nov 2026. Actual = lowest co-contribution share among funded Round 2 projects, once announced' },
    // Pillar 2: Priority Regions & Pathways (Western Sydney and Hunter roles on the RWC Dashboard)
    { id: 'hunterClubStandards', area: 'PRP', kind: 'level', name: 'Hunter clubs at Bronze standard or above', unit: '%', baseline: 96.2, baseYear: 2026, target: 100, targetYear: 2028, actual: 96.2, actualYear: 2026, source: 'Dashboard (Hunter/Newcastle RFG Manager): all Hunter clubs reach Bronze/Developing standard in the RA Club Standards program. Actual: RA Club Impact Program 2026 - Hunter Rugby 15 of 15, Hunter Junior Rugby Union 10 of 11 (1 survey incomplete) = 25 of 26. First measured 2026, so 2026 is the baseline' },
    { id: 'wsHealthCheck',  area: 'PRP', kind: 'annual', name: 'Western Sydney clubs completing the RA Club Health Check', unit: '% of Western Sydney clubs a year', target: 100, targetYear: 2028, actual: null, source: 'Dashboard (WS Club Development Manager): each Western Sydney club completes the RA Club Health Check annually. Completion not published' },
    { id: 'wsR4gFunding',   area: 'PRP', kind: 'annual', name: 'Western Sydney Rugby For Good hub funding raised', unit: 'thousand dollars a year', target: 125, targetYear: 2028, actual: null, source: 'Dashboard (Western Sydney GM): increase Western Sydney funding through the Rugby For Good hub, source $125k annually' },
    { id: 'hunterR4gFunding', area: 'PRP', kind: 'annual', name: 'Hunter Rugby For Good revenue raised', unit: 'thousand dollars a year', target: 100, targetYear: 2028, actual: null, source: 'Dashboard (Hunter/Newcastle RFG Manager): source more than $100k annually through Rugby For Good programs' },
    { id: 'hunterParticipation', area: 'PRP', kind: 'growth', name: 'Hunter participation (all metrics)', baseline: 3290, baseYear: 2025, target: +(1.075 ** 3 - 1).toFixed(4), targetYear: 2028, actual: null, actualYear: 2026, source: 'Dashboard (Hunter/Newcastle RFG Manager): +7.5% a year across clubs, schools, coaches, MOs and administrators, baseline 3,290. Base year assumed 2025' },
    { id: 'wsAcademy',      area: 'PRP', kind: 'annual', name: 'Western Sydney academy players', unit: 'players a season', target: 60, targetYear: 2028, actual: null, source: 'Dashboard (Western Sydney GM): academy with 30 males and 30 females per season. Regional Academy started (16 weeks Nov–Mar); numbers not published' },
    { id: 'wsChurn',        area: 'PRP', kind: 'level', name: 'Western Sydney participant churn', unit: '%', baseline: 48.9, baseYear: 2025, target: 45.9, targetYear: 2028, actual: null, source: 'Dashboard (WS Club Development Manager / DO): reduce churn by 1% a year, baseline 48.9% (read as 1 percentage point a year). Year not given; set to program end 2028' },
    { id: 'wsBoards',       area: 'PRP', kind: 'share', name: 'Western Sydney clubs with gender-balanced boards (40:40:20)', unit: 'of Western Sydney clubs', baseline: 40, baseYear: 2025, target: null, targetYear: 2028, actual: null, source: 'Dashboard (WS Club Development Manager): 40% of clubs meet the 40:40:20 ratio; "drive increase", no number set' },
    { id: 'coaches',        area: 'PW',  kind: 'growth', name: 'Accredited coaches',        baseline: 3514, baseYear: 2024, target: 0.50, targetYear: 2027, actual: 0.18, actualYear: 2025, measure: 'coaches', source: 'Annual Report 2025: +18% YoY' },
    { id: 'mos',            area: 'PW',  kind: 'growth', name: 'Accredited match officials', baseline: 1281, baseYear: 2024, target: 0.75, targetYear: 2027, actual: 0.18, actualYear: 2025, measure: 'matchOfficials', source: 'Annual Report 2025: +18% YoY' },
    { id: 'wsParticipation',area: 'PRP', kind: 'growth', name: 'Western Sydney participation', baseline: 6127, baseYear: 2024, target: +(1.075 ** 3 - 1).toFixed(4), targetYear: 2027, actual: 0.09, actualYear: 2025, source: 'Dashboard: +7.5% a year; Annual Report +9% in 2025' },
    { id: 'xvPlayers',      area: 'PW',  kind: 'growth', name: 'XV club players',           baseline: 38244, baseYear: 2025, target: 0.25, targetYear: 2027, actual: 0.011, actualYear: 2025, measure: 'players', source: 'NSWRU KPI: +25% participants by 2027 from the 2025 count; Annual Report +1.1% in 2025' },
    { id: 'coachRatio',     area: 'PW', kind: 'level', name: 'Players per coach', unit: ':1', baseline: 13, baseYear: 2025, target: 10, targetYear: 2028, actual: 10.2, actualYear: 2026, source: 'Dashboard (Workforce Recruitment): coach to player ratio 10:1, baseline 13:1. Year not given; set to program end 2028. Actual: Rugby Analytics 2026 player:coach ratio 10.2' },
    { id: 'moRatio',        area: 'PW', kind: 'level', name: 'Players per match official', unit: ':1', baseline: 56, baseYear: 2025, target: 30, targetYear: 2028, actual: 42.81, actualYear: 2026, source: 'Dashboard (MO Manager): match officials to player ratio 30:1, baseline 56:1. Year not given; set to program end 2028. Actual: Rugby Analytics 2026 player:MO ratio 42.81' },
    { id: 'moAbuse',        area: 'PW', kind: 'level', name: 'Match official abuse cases', unit: ' cases', baseline: 73, baseYear: 2025, target: 55, targetYear: 2028, actual: null, source: 'Dashboard (MO Manager): 25% reduction in MO abuse cases, baseline 73 (73 × 0.75 ≈ 55). Year not given; set to program end 2028' },
    { id: 'workforceChurn', area: 'PW', kind: 'level', name: 'Workforce churn', unit: '%', baseline: 39.5, baseYear: 2025, target: 36.5, targetYear: 2028, actual: null, source: 'Dashboard (Workforce Recruitment): reduce workforce churn by 1% a year, baseline 39.5% (read as 1 percentage point a year). Year not given; set to program end 2028' },
    { id: 'conferenceNps',  area: 'PW', kind: 'annual', name: 'Workforce conference Net Promoter Score', unit: 'NPS', target: 75, targetYear: 2028, actual: null, source: 'Dashboard (Workforce Recruitment): yearly workforce conference with NPS from attendees above 75' },
    // Inclusion, grouped by community. target: null = the plan sets no number yet (staff can set one with "Adjust targets").
    // kind 'annual': target = number per year until targetYear; actual = latest year's count.
    { id: 'femaleParticipation', area: 'INC', group: 'Women & girls', kind: 'growth', name: 'Female participation', baseline: 7917, baseYear: 2024, target: 0.50, targetYear: 2027, actual: 0.06, actualYear: 2025, measure: 'femaleParticipants', source: "Annual Report 2025: women's game +6%" },
    { id: 'femaleMOs',      area: 'INC', group: 'Women & girls', kind: 'growth', name: 'Female match officials',    baseline: 106,  baseYear: 2024, target: 2.00, targetYear: 2027, actual: null, actualYear: 2025, source: 'Project Plan +200% (~318); 100 new female MOs. No 2025 figure published' },
    { id: 'femaleCoaches',  area: 'INC', group: 'Women & girls', kind: 'growth', name: 'Female coaches',            baseline: 192,  baseYear: 2024, target: 1.50, targetYear: 2027, actual: null, actualYear: 2025, source: 'Project Plan +150% (~480). No 2025 figure published' },
    { id: 'fnTalentId',     area: 'INC', group: 'First Nations', kind: 'annual', name: 'First Nations talent ID workshops', unit: 'workshops a year', target: 6, targetYear: 2028, actual: null, source: 'Project Plan; Dashboard H11 (North Coast, Central West, Sydney Metro, South Coast, 2 x Southern Inland). No delivery count published' },
    { id: 'fnMOs',          area: 'INC', group: 'First Nations', kind: 'growth', name: 'First Nations match officials', baseline: 13, baseYear: 2024, target: null, targetYear: 2027, actual: null, actualYear: 2025, source: 'Dashboard: baseline 13; plan says "increase", no number set' },
    { id: 'fnRoles',        area: 'INC', group: 'First Nations', kind: 'share', name: 'First Nations share of non-playing roles', baseline: 3.8, baseYear: 2025, target: null, targetYear: 2028, actual: null, unit: 'of non-playing roles', source: 'Program Logic: 3.8% of non-playing roles vs 7.5% of players (parity would be 7.5%). No target set' },
    { id: 'fnBursaries',    area: 'INC', group: 'First Nations', kind: 'count', name: 'Coach bursary places for First Nations coaches', unit: 'bursaries', target: null, startYear: 2025, targetYear: 2028, actual: null, source: 'Dashboard H12/H13: bursary places for First Nations (and Pasifika) coaches, $25k a year shared. No number set' },
    { id: 'pasifikaLeaders',area: 'INC', group: 'Pasifika', kind: 'annual', name: 'Pasifika Leadership program attendees', unit: 'attendees a year', target: 20, targetYear: 2028, actual: null, source: 'Dashboard H13: 20+ attendees each year. Inaugural seminar held (Merrylands); attendance not published' },
    { id: 'pasifikaYouthCup', area: 'INC', group: 'Pasifika', kind: 'growth', name: 'Pasifika Youth Cup attendance', baseline: null, baseYear: 2025, target: 0.50, targetYear: 2028, actual: null, actualYear: 2026, source: 'Dashboard H13: grow attendance by 50%. Baseline attendance not recorded' },
    { id: 'pasifikaMOs',    area: 'INC', group: 'Pasifika', kind: 'growth', name: 'Pasifika match officials', baseline: 80, baseYear: 2024, target: null, targetYear: 2027, actual: null, actualYear: 2025, source: 'Dashboard: baseline 80; plan says "increase", no number set' },
    { id: 'pasifikaRoles',  area: 'INC', group: 'Pasifika', kind: 'share', name: 'Pasifika share of non-playing roles', baseline: 4.2, baseYear: 2025, target: null, targetYear: 2028, actual: null, unit: 'of non-playing roles', source: 'Program Logic: 4.2% of non-playing roles vs >11% of players. No target set' },
    { id: 'allAbilities',   area: 'INC', group: 'People with disability', kind: 'count', name: 'All Abilities programs supported', unit: 'programs', target: null, startYear: 2025, targetYear: 2028, actual: null, source: 'Dashboard: support existing programs (Vivability Bathurst, Menai, Rockdale); casual All Abilities coordinator. No number set' },
    { id: 'pride',          area: 'INC', group: 'Pride', kind: 'count', name: 'Pride partnerships and programs', unit: 'programs', target: null, startYear: 2025, targetYear: 2028, actual: null, source: 'Dashboard: approach still being determined ($5k a year). No number set' },
    { id: 'safeguarding',   area: 'INC', group: 'Integrity & safeguarding', kind: 'annual', name: 'Safeguarding & integrity workshops', unit: 'workshops a year', target: 6, targetYear: 2028, actual: null, source: 'Dashboard H15: 6 workshops a year; all clubs compliant with RA standards' },
    // Pillar 5: RWC Activation
    { id: 'rwcHubs',        area: 'ACT', kind: 'count', name: 'RWC event hubs delivered', unit: 'hubs', target: 20, startYear: 2027, targetYear: 2028, actual: null, source: 'Dashboard (RWC Post-Event Hubs): 20 hubs during and after RWC 2027, spread across metro and regional NSW' },
    { id: 'rwcHubParticipants', area: 'ACT', kind: 'count', name: 'RWC event hub participants', unit: 'participants', target: 1000, startYear: 2027, targetYear: 2028, actual: null, source: 'Dashboard (RWC Post-Event Hubs): 20 hubs × a minimum of 50 participants each' },
  ];

  const context = {
    totalLegacyFunding: 10000000,
    facilityAudit: { femaleChangerooms: 31, femaleRefereeRooms: 28, adequateLighting: 62, adequateDrainage: 57, parentChange: 22 },
    facilityTargets: '20 facilities funded; 2 major priority upgrades (Connolly Park Wagga + 1 Sydney site); >20 clubs receive major equipment (scrum machines ~$11k)',
    salariesOnDashboard: 1297000,
    nswruLoss2025: 1094634,
    holroydLeverage: 3.74,
    ratios: { playerToCoach: '13:1 (target 10:1)', playerToMO: '56:1 (target 30:1)' },
    workforceRepresentation: 'First Nations people are 7.5% of players but 3.8% of non-playing roles; Pasifika >11% of players but 4.2% of non-playing roles. Females: 15.3% of players, 7.8% of coaches, 11.5% of match officials, 39.3% of volunteers.',
    westernSydney: '11 Western Sydney LGAs hold ~30% of NSW rugby demand but 11% of players; conversion Fairfield 2.2% vs NSW 32%; <25% of residents within 10 minutes of a club.',
    volunteers: '45% of volunteers give 6+ hours/week; workforce churn baseline 39.5%.',
    equipment: 'Major equipment grants (scrum machines) planned but no recipients published; Round 1 folded equipment into Category 2. MO cards & whistles: $5,087.50 for 250 new referees.',
    round2: 'Round 2 (2026/27): up to ~$2.15M more; outcomes from Nov 2026; 25% co-contribution.',
    socialValue: 'World Rugby SROI: US$3,132 per female player vs US$1,900 per male player per year.',
  };

  // ---------- Impact measurement ----------
  // Only methods published by other organisations are used. Each measure names the framework that defines it;
  // nothing here is a Tackle AI or NSW Rugby invention. New formulas are the evaluation team's job, not this file's.
  // Full detail (formulas, parameters, caveats) is on the Methodology tab (js/methods.js).
  const frameworks = {
    'TPG22-22': { org: 'NSW Treasury', title: 'Evaluation Guidelines (TPG22-22)', year: 2023, url: 'https://arp.nsw.gov.au/assets/ars/attachments/tpg22-22-evaluation-guidelines.pdf',
      use: 'Overall structure: program logic, outputs vs outcomes, baseline and follow-up, evaluation questions. The project brief requires the framework to comply with NSW Treasury guidelines.' },
    'TPG23-08': { org: 'NSW Treasury', title: 'NSW Government Guide to Cost-Benefit Analysis (TPG23-08)', year: 2023, url: 'https://www.treasury.nsw.gov.au/sites/default/files/2023-04/tpg23-08_nsw-government-guide-to-cost-benefit-analysis_202304.pdf',
      use: 'Turning yearly benefits into present values: 5% real central discount rate, mandatory sensitivity tests at 3% and 7%, BCR = PV of benefits ÷ PV of costs.' },
    'OIA-VSL': { org: 'Office of Impact Analysis (PM&C)', title: 'Value of statistical life guidance note', year: 2026, url: 'https://oia.pmc.gov.au/sites/default/files/2026-01/value-statistical-life-guidance-note.pdf',
      use: 'Value of a statistical life year (VSLY) of $253,000 in 2025 dollars, used to value health years gained.' },
    'NSWRL-2026': { org: 'Solucio for NSW Rugby League', title: 'Community Impact of Rugby League in NSW', year: 2026, file: 'NRL community-impact-study_example.pdf',
      use: 'A comparable code\'s published method: economic contribution by expenditure flow analysis (retention rates and ABS-based multipliers), health contribution by DALYs × VSLY, and social capital compared with ABS General Social Survey benchmarks.' },
    'R4G-CBA': { org: 'Balmoral Group Australia for the NSW Positive Rugby Foundation', title: 'Rugby For Good Cost Benefit Analysis / Business Case', year: 2025, file: 'Rugby For Good Business Case Report_Final_04.03.2025[74].pdf',
      use: 'NSW Treasury-aligned CBA of three Rugby For Good programs (BCRs 5.78, 3.14, 3.63) with sourced per-participant benefit values.' },
    'R4G-BRF': { org: 'Balmoral Group Australia for the NSW Positive Rugby Foundation', title: 'Rugby For Good Benefits Realisation Framework', year: 2025, file: 'Rugby For Good Benefits Realisation Framework Report_Final_04.03.2025[59].pdf',
      use: 'Eight benefit areas, each with KPIs, baselines, targets, owner and reporting frequency.' },
    'OECD-SC': { org: 'OECD', title: 'Perspectives on Global Development 2012: Social Cohesion in a Shifting World', year: 2011, url: 'https://doi.org/10.1787/persp_glob_dev-2012-en',
      use: 'Three dimensions of social cohesion: social capital, social inclusion and social mobility (the organising frame used by NSWRL 2026).' },
    'ABS-GSS': { org: 'Australian Bureau of Statistics', title: 'General Social Survey', year: 2020, url: 'https://www.abs.gov.au/statistics/people/people-and-communities/general-social-survey-summary-results-australia',
      use: 'National benchmark questions and results for volunteering, confidants and meeting responsibilities (as reported in NSWRL 2026).' },
    'CDN': { org: 'Cultural Development Network', title: 'Schema of measurable outcomes for cultural engagement (Dunphy & Smithies 2018)', year: 2018, url: 'https://culturaldevelopment.net.au/outcomes/',
      use: 'Five cultural outcomes. Creative Commons: attribute to CDN and do not change the outcome wording without CDN\'s permission.' },
    'EVENTIMPACTS': { org: 'UK Sport and partners (EventScotland, DCMS, Welsh Government, Tourism NI)', title: 'eventIMPACTS toolkit', year: 2010, url: 'https://www.eventimpacts.com/',
      use: 'Industry-standard event evaluation: additional spending in the host area that happens because the event is staged (mainly visitors from outside the area).' },
    'RA-ANALYTICS': { org: 'Rugby Australia', title: 'Rugby Analytics participation dashboard', year: 2026, file: 'NSW_Rugby_Participation_Dashboard_Data.xlsx',
      use: 'Participation definitions: retention = returning this year ÷ participants last year; churn = 1 − retention; recruitment = new this year ÷ participants this year; growth = this year ÷ last year − 1.' },
    'RA-CLUBS': { org: 'Rugby Australia', title: 'Club Impact Program (club standards: Bronze / Silver / Gold)', year: 2026, file: 'NSW_Rugby_Participation_Dashboard_Data.xlsx',
      use: 'Rugby Australia\'s own club standards assessment, reported by zone and association.' },
    'MNW': { org: 'Maiam nayri Wingara Indigenous Data Sovereignty Collective', title: 'Indigenous Data Sovereignty principles', year: 2018, url: 'https://www.maiamnayriwingara.org/',
      use: 'How First Nations data should be collected, owned and used. A protocol for collection, not a measure.' },
    'ECON-KPI': { org: 'NSW Rugby evaluation team', title: 'NSW Rugby Economic KPI Formula Summary', year: 2026, file: 'NSW_Rugby_Economic_KPI_Formula_Summary.xlsx',
      use: 'The nine economic KPI formulas, each referenced to Sport England, NSW Treasury, ASC and NSW Audit Office sources. Calculated on the Impact tab exactly as documented.' },
  };

  // status: measured | partial | none (no data yet). framework: key of `frameworks`. how: the framework's own method.
  // calc: id of the calculator on the Impact tab (js/methods.js) that applies the published formula.
  const impactMethods = {
    social: {
      label: 'Social', question: 'Do people feel connected, included and well?',
      example: 'Women feel safe to play and train because the ground now has women-only changerooms.',
      frameworks: ['OECD-SC', 'R4G-BRF', 'NSWRL-2026', 'RA-ANALYTICS'],
      measures: [
        { name: 'Participant retention, churn and recruitment', framework: 'RA-ANALYTICS', status: 'measured', value: 'Retention 62.1%, churn 37.9%, recruitment 39.2% (2026)', how: 'Rugby Analytics definitions: retention = returning this year ÷ participants last year; churn = 1 − retention; recruitment = new this year ÷ participants this year.', source: 'Rugby Analytics, 22/09/2026' },
        { name: 'Female share of participants', framework: 'RA-ANALYTICS', status: 'measured', value: '18.3% (8,765 of 47,822, 2026)', how: 'Female participants ÷ all registered participants (Rugby Analytics gender split).', source: 'Rugby Analytics, 22/09/2026' },
        { name: 'Social capital: volunteered for a civic organisation in the last 12 months', framework: 'OECD-SC', status: 'none', value: 'No NSW Rugby survey yet. Benchmarks: 42% of sport participants, 19% of the general population', how: 'Ask the ABS General Social Survey question in the participant survey and compare with the national benchmarks, as NSWRL 2026 did (rugby league participants: 77%).', source: 'ABS GSS benchmarks as reported in NSWRL 2026' },
        { name: 'Social capital: three or more people to confide in', framework: 'OECD-SC', status: 'none', value: 'No survey yet. Benchmarks: 58% of sport participants, 37% of the general population', how: 'ABS General Social Survey confidants question, compared with national benchmarks (NSWRL 2026 method).', source: 'ABS GSS benchmarks as reported in NSWRL 2026' },
        { name: 'Social capital: no one to confide in (isolation)', framework: 'OECD-SC', status: 'none', value: 'No survey yet. Benchmarks: 10% of sport participants, 23% of the general population', how: 'ABS General Social Survey confidants question; lower is better (NSWRL 2026 method).', source: 'ABS GSS benchmarks as reported in NSWRL 2026' },
        { name: 'Social inclusion: feeling accepted, valued and safe', framework: 'OECD-SC', status: 'none', value: 'Not yet explored', how: 'OECD social inclusion dimension, explored through interviews and case studies (the qualitative approach NSWRL 2026 used).', source: 'OECD 2011; NSWRL 2026' },
        { name: 'Improved health and wellbeing (Rugby For Good participants)', framework: 'R4G-BRF', status: 'partial', value: '97% reported improvement (2020 baseline); target 97%', how: 'Pre/post participant survey at the start and end of each program (R4G Benefits Realisation Framework, reduced anxiety and depression).', source: '2020 Rugby Benefits Participation Report, via R4G BRF' },
        { name: 'Would seek help if needed', framework: 'R4G-BRF', status: 'partial', value: '62% baseline (Get Talkin\' 2022/23); target at least 70%', how: 'Pre/post participant sentiment survey (R4G BRF, reduced stigma).', source: 'Batyr & NSW Positive Rugby 2022/23, via R4G BRF' },
        { name: 'Negative internal stigma about mental health', framework: 'R4G-BRF', status: 'partial', value: '44% baseline (2022); target below 40%', how: 'Pre/post participant sentiment survey (R4G BRF, reduced stigma).', source: 'NSW Positive Rugby Foundation 2022 survey, via R4G BRF' },
        { name: 'Sense of optimism and belonging', framework: 'R4G-BRF', status: 'partial', value: '+10.4% for Tackle Life students (2023); target at least +10%', how: 'Survey before, at the mid-point and at the end of the program (R4G BRF, stronger community ties).', source: 'Rugby Tackle Life 2023, via R4G BRF' },
        { name: 'Club standards (Rugby Australia Club Impact Program)', framework: 'RA-CLUBS', status: 'measured', value: '314 clubs: 72% Bronze, 18% Silver, 0.6% Gold, 6% not in place, 4% survey incomplete (2026)', how: 'Rugby Australia\'s Club Impact Program status by zone and association.', source: 'Rugby Analytics, 22/09/2026' },
        { name: 'Health benefit in dollars', framework: 'R4G-CBA', status: 'none', value: 'Needs Legacy participant counts', how: 'Per-participant values from the R4G CBA, or the NSWRL DALY × VSLY method, discounted under TPG23-08. See the calculators below.', source: 'R4G CBA 2025; NSWRL 2026; TPG23-08', calc: 'health' },
      ],
    },
    economic: {
      label: 'Economic', question: 'Does rugby bring money and jobs into NSW communities?',
      example: 'The fish and chip shop near the ground is flat out every home game.',
      frameworks: ['ECON-KPI', 'NSWRL-2026', 'R4G-BRF', 'EVENTIMPACTS'],
      measures: [
        { name: 'Nine economic KPIs (utilisation, co-investment, cost recovery, retention, training cost, volunteer hours, inclusion cost, out-of-pocket cost, participation support)', framework: 'ECON-KPI', status: 'none', dynamic: 'econ', value: 'See Economic KPIs below', how: 'Formulas exactly as documented in the evaluation team\'s workbook, each with its official source.', source: 'NSW_Rugby_Economic_KPI_Formula_Summary.xlsx' },
        { name: 'Economic contribution of rugby spending', framework: 'NSWRL-2026', status: 'none', value: 'Needs expenditure by category', how: 'Expenditure flow analysis: spend in each category × NSW retention rate × ABS-based multiplier; participant spend first discounted 50% for substitution. This is economic contribution, not net impact.', source: 'NSWRL 2026', calc: 'contribution' },
        { name: 'Sustainable clubs', framework: 'R4G-BRF', status: 'none', value: 'Not currently tracked', how: 'From club income statements: total revenue rises while the share from traditional funding sources falls (R4G BRF).', source: 'R4G BRF 2025' },
        { name: 'Sustainable employment', framework: 'R4G-BRF', status: 'measured', value: '12 First Nations school-based apprentices (Tackle Life); 10 full-time, 3 part-time and 51 casual program staff (2024)', how: 'Count of First Nations SBATs and FTE jobs running the programs, yearly (R4G BRF).', source: 'NSW Positive Rugby Foundation 2024, via R4G CBA' },
        { name: 'Event visitor spending (RWC hubs, carnivals, State Championships)', framework: 'EVENTIMPACTS', status: 'none', value: 'Not measured. 20 RWC hubs planned for 2027; 2026 State Championships drew 25,657 spectators', how: 'eventIMPACTS: survey attendees for where they live and what they spent; count only additional spending by visitors from outside the host area.', source: 'eventIMPACTS; NSWJRU Impact report 2026' },
      ],
    },
    cultural: {
      label: 'Cultural', question: 'Does rugby strengthen cultural identity and belonging?',
      example: 'Pasifika families now gather at the ground every Saturday - it has become a community meeting place.',
      frameworks: ['CDN', 'RA-ANALYTICS', 'MNW'],
      measures: [
        { name: 'First Nations participants', framework: 'RA-ANALYTICS', status: 'measured', value: '3,174 (6.6% of participants, 2026); +35% since 2022', how: 'Participants recording Aboriginal and/or Torres Strait Islander heritage (Rugby Analytics heritage table). Collect and use under Indigenous Data Sovereignty principles.', source: 'Rugby Analytics, 22/09/2026' },
        { name: 'Pasifika participants (Samoan, Fijian, Tongan)', framework: 'RA-ANALYTICS', status: 'measured', value: '3,486 in 2026 (Samoan 1,277, Fijian 1,145, Tongan 1,064); about 3.8 times the 2022 count (911)', how: 'Sum of the Samoan, Fijian and Tongan heritage rows in Rugby Analytics. Other Pacific groups were cut off in the source screenshot.', source: 'Rugby Analytics, 22/09/2026' },
        { name: 'CDN outcome: sense of belonging to a shared cultural heritage deepened', framework: 'CDN', status: 'none', value: 'No survey yet', how: 'Participant / attendee survey using the CDN outcome, unchanged wording, after events and at season end.', source: 'CDN schema' },
        { name: 'CDN outcome: diversity of cultural expression appreciated', framework: 'CDN', status: 'none', value: 'No survey yet', how: 'Participant / attendee survey using the CDN outcome, unchanged wording.', source: 'CDN schema' },
        { name: 'CDN outcome: new knowledge, ideas and insight gained', framework: 'CDN', status: 'none', value: 'No survey yet', how: 'Participant / attendee survey using the CDN outcome, unchanged wording.', source: 'CDN schema' },
        { name: 'CDN outcome: creativity stimulated', framework: 'CDN', status: 'none', value: 'No survey yet', how: 'Participant / attendee survey using the CDN outcome, unchanged wording.', source: 'CDN schema' },
        { name: 'CDN outcome: aesthetic enrichment experienced', framework: 'CDN', status: 'none', value: 'No survey yet', how: 'Participant / attendee survey using the CDN outcome, unchanged wording.', source: 'CDN schema' },
      ],
    },
  };

  return { regions, aliases, grants, dashboard, firstNationsReach, kpis, context, frameworks, impactMethods };
})();
