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
  const kpis = [
    { id: 'facilities',     area: 'FE', kind: 'count', name: 'Facilities funded', unit: 'facilities', target: 20, startYear: 2025, targetYear: 2028, actual: 'grantsFE', source: 'Project Plan; actual = Round 1 facility grants' },
    { id: 'majorUpgrades',  area: 'FE', kind: 'count', name: 'Major priority facility upgrades', unit: 'upgrades', target: 2, startYear: 2025, targetYear: 2028, actual: null, source: 'Project Plan: Connolly Park (Wagga) + 1 Sydney site; no progress published' },
    { id: 'equipmentClubs', area: 'FE', kind: 'count', name: 'Clubs receiving major equipment', unit: 'clubs', target: 20, startYear: 2025, targetYear: 2028, actual: null, source: 'Project Plan (>20 clubs, scrum machines ~$11k); no recipients published' },
    { id: 'femaleChange',   area: 'FE', kind: 'share', name: 'Facilities with female-friendly changerooms', baseline: 31, baseYear: 2024, target: null, targetYear: 2028, actual: null, source: 'RA Infrastructure audit baseline 31%; no target set yet' },
    { id: 'coaches',        area: 'PW',  kind: 'growth', name: 'Accredited coaches',        baseline: 3514, baseYear: 2024, target: 0.50, targetYear: 2027, actual: 0.18, actualYear: 2025, source: 'Annual Report 2025: +18% YoY' },
    { id: 'mos',            area: 'PW',  kind: 'growth', name: 'Accredited match officials', baseline: 1281, baseYear: 2024, target: 0.75, targetYear: 2027, actual: 0.18, actualYear: 2025, source: 'Annual Report 2025: +18% YoY' },
    { id: 'wsParticipation',area: 'PW',  kind: 'growth', name: 'Western Sydney participation', baseline: 6127, baseYear: 2024, target: +(1.075 ** 3 - 1).toFixed(4), targetYear: 2027, actual: 0.09, actualYear: 2025, source: 'Dashboard: +7.5% a year; Annual Report +9% in 2025' },
    { id: 'xvPlayers',      area: 'PW',  kind: 'growth', name: 'XV club players',           baseline: 38244, baseYear: 2025, target: 0.25, targetYear: 2027, actual: 0.011, actualYear: 2025, source: 'NSWRU KPI: +25% participants by 2027 from the 2025 count; Annual Report +1.1% in 2025' },
    // Inclusion, grouped by community. target: null = the plan sets no number yet (staff can set one with "Adjust targets").
    // kind 'annual': target = number per year until targetYear; actual = latest year's count.
    { id: 'femaleParticipation', area: 'INC', group: 'Women & girls', kind: 'growth', name: 'Female participation', baseline: 7917, baseYear: 2024, target: 0.50, targetYear: 2027, actual: 0.06, actualYear: 2025, source: "Annual Report 2025: women's game +6%" },
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

  // Social / Economic / Cultural impact measures. status: measured | partial | none (no data yet).
  const impactFramework = {
    social: {
      label: 'Social', question: 'Do people feel safe, welcome and well?',
      example: 'Women feel safe to play and train because the ground now has women-only changerooms.',
      indicators: [
        { name: 'Facilities with female-friendly changerooms', status: 'partial', value: '31% baseline (RA audit); 4 Round 1 projects target women/girls', source: 'Program Logic; R1 grants' },
        { name: 'Women & girls who feel safe at the ground', status: 'none', value: 'No survey yet', source: 'Add a "feel safe" question to the end-of-season survey' },
        { name: 'First Nations players who feel culturally safe and welcome', status: 'none', value: 'No survey yet', source: 'Add a cultural-safety question to the end-of-season survey; co-design with the local First Nations community' },
        { name: 'Female participation growth', status: 'measured', value: '+6% in 2025 (needs ~14.5% p.a.)', source: 'Annual Report 2025' },
        { name: 'Social value per new participant', status: 'partial', value: 'US$3,132 female / US$1,900 male per year', source: 'World Rugby & Portas SROI' },
        { name: 'Rugby for Good mental health reach', status: 'measured', value: '177 Tackle Life students; 35 Get Talkin workshops', source: 'Annual Report 2025' },
        { name: 'Clubs compliant with safeguarding standards', status: 'none', value: 'Club Health Check rolling out', source: 'Dashboard H15' },
      ],
    },
    economic: {
      label: 'Economic', question: 'Does rugby bring money and jobs into the local area?',
      example: 'The fish and chip shop near the ground is flat out every home game.',
      indicators: [
        { name: 'Facility construction spend in local areas', status: 'measured', value: '$1.85M across 18 sites, 68% outside Greater Sydney', source: 'R1 grants' },
        { name: 'Co-investment leverage', status: 'partial', value: 'Holroyd: $1 grant unlocked $3.74 of project spend; Round 2 needs 25% co-contribution', source: 'R1 grants' },
        { name: 'Local business turnover on game / event days', status: 'none', value: 'Not measured', source: 'Short survey of businesses near funded grounds and RWC hubs' },
        { name: 'Visitor and tourism spend (carnivals, RWC hubs)', status: 'none', value: '20 RWC hubs planned ($400k, mostly 2027)', source: 'Dashboard H24' },
        { name: 'Jobs supported (construction + funded roles)', status: 'partial', value: '8 funded roles ($1.30M wages); construction jobs not yet estimated', source: 'Dashboard; NSW Treasury employment calculator' },
        { name: 'First Nations businesses and jobs in funded works', status: 'none', value: 'Not tracked', source: 'Ask councils/contractors for NSW Aboriginal Procurement Policy reporting on funded projects' },
        { name: 'Value of volunteer time', status: 'partial', value: '~$19/hr ASC benchmark; rugby volunteer hours not counted', source: 'ASC Clearinghouse' },
      ],
    },
    cultural: {
      label: 'Cultural', question: 'Does rugby bring communities together and celebrate culture?',
      example: 'Pasifika families now gather at the ground every Saturday - it has become a community meeting place.',
      indicators: [
        { name: 'Pasifika and First Nations share of non-playing roles', status: 'measured', value: 'Pasifika 4.2% vs >11% of players; First Nations 3.8% vs 7.5%', source: 'Program Logic' },
        { name: 'Community and cultural events hosted at funded grounds', status: 'none', value: 'Not tracked', source: 'Venue booking logs' },
        { name: 'Pasifika events and leadership', status: 'partial', value: 'Inaugural Pasifika seminar (Merrylands); target 20+ leaders a year, Youth Cup +50%', source: 'Annual Report; Dashboard H13' },
        { name: 'First Nations talent ID, Development Academy and Reconciliation Action Plan', status: 'partial', value: 'RAP launched; 6 talent ID days a year planned; First Nations Development Academy with Lloyd McDermott Rugby', source: 'Annual Report; Dashboard H11-H12' },
        { name: 'First Nations community carnivals and NAIDOC events (e.g. Ella 7s)', status: 'partial', value: 'Ella 7s on the First Nations activity plan; attendance not tracked', source: 'Dashboard H12' },
        { name: 'Multicultural competitions', status: 'measured', value: 'Juniors All Nations 7s Cup, Cumberland ($20k)', source: 'R1 grants' },
      ],
    },
  };

  return { regions, aliases, grants, dashboard, firstNationsReach, kpis, context, impactFramework };
})();
