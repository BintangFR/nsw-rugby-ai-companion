import { send, readBody, authorised, methodNotAllowed } from './_lib/http.js';

// POST { year?, places: [{ place, region }], extra?: [{ q, lens, place? }], refresh? } -> { items, counts, ms, errors }
// `extra` are searches written by the AI model (deep search); they go through the same filters as every other search.
// Finds public news about places the Legacy Program funds, so the impact can be seen outside NSW Rugby's own records:
// local business and tourism, community activity, First Nations and Pasifika events, grants being reported.
// Sources: Google News and Bing News RSS, plus public social media that allows search without an account: Reddit (search
// feed) and Bluesky (public API). Facebook, Instagram, X and TikTok need approved developer access and are not scraped.
// Headlines, summaries and post text only; no usernames are kept. 6-hour cache.
// A public mention shows something happened near funded work. It does not prove the funding caused it.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
// Statewide searches, a few for each kind of impact. [query, impact type it looks for].
const GENERAL = [
  ['NSW Rugby World Cup Legacy Program', 'social'], ['NSW rugby legacy grant facility upgrade', 'social'], ['NSW rugby club new changerooms lights funding', 'social'],
  ['Rugby World Cup 2027 NSW local business tourism', 'economic'], ['Destination NSW Rugby World Cup 2027', 'economic'], ['Rugby World Cup 2027 regional NSW visitors economy', 'economic'],
  ['rugby carnival boost local economy NSW', 'economic'], ['rugby tournament visitors accommodation regional NSW', 'economic'], ['rugby union sevens carnival town visitors', 'economic'],
  ['rugby tourism regional NSW travel weekend', 'economic'], ['rugby club jerseys merchandise sales NSW', 'economic'], ['rugby carnival accommodation booked out NSW town', 'economic'], ['Rugby World Cup 2027 merchandise jerseys Australia sales', 'economic'],
  ['NSW rugby First Nations Pasifika community program', 'cultural'], ['rugby union NAIDOC round NSW', 'cultural'], ['Aboriginal rugby union carnival NSW', 'cultural'],
  ['Pasifika rugby union NSW community', 'cultural'], ['First Nations rugby union program NSW girls', 'cultural'], ['multicultural rugby union NSW club', 'cultural'],
];
// Clearinghouse for Sport subjects (Australian Sports Commission) that relate to the Legacy Program, each tied to one of
// the three impacts. They guide the extra statewide searches and tag every story with the subject it matches, so public
// evidence is sorted the way the national sport evidence base is. [subject, impact, keywords, search words].
const SUBJECTS = [
  ['Major Sporting Events', 'economic', /world cup|carnival|tournament|championship|event hub|host(ed|ing)? (the|a) /i, 'rugby world cup 2027 NSW event'],
  ['Grants and Funding', 'economic', /grant|funding|funded|investment|legacy program/i, 'rugby club grant funding NSW'],
  ['Rural and Regional Australia', 'economic', /regional|rural|country town|outback/i, 'regional NSW rugby club town'],
  ['Value and Benefits of Sport', 'economic', /economic (impact|boost|benefit)|visitors?|touris[mt]|local business/i, 'rugby event boost local economy NSW'],
  ['Participation in Sport', 'social', /participat|registrations?|players? (numbers|growth)|record numbers|new players/i, 'rugby union participation growth NSW'],
  ['Children and Youth', 'social', /junior|kids|children|youth|schools?|under ?\d{1,2}s?/i, 'junior rugby union NSW club'],
  ['Women', 'social', /women|girls|female/i, 'women girls rugby union NSW'],
  ['Volunteers', 'social', /volunteer|coach(es|ing)?|referee|match official/i, 'rugby club volunteers coaches NSW'],
  ['Disability', 'social', /disabilit|inclusive rugby|wheelchair|all abilities/i, 'inclusive rugby all abilities NSW'],
  ['Safeguarding', 'social', /safeguard|child safe|safety|concussion/i, 'rugby club safety facilities NSW'],
  ['Physical Activity', 'social', /physical activity|fitness|active|health(y)?/i, 'rugby health physical activity community NSW'],
  ['First Nations\' People', 'cultural', /first nations|aboriginal|indigenous|torres strait|naidoc|koori/i, 'First Nations rugby union NSW'],
  ['Cultural Diversity', 'cultural', /pasifika|pacific|samoan|tongan|fijian|multicultural|cald|migrant|refugee/i, 'Pasifika multicultural rugby union NSW'],
  ['Sexuality and Gender', 'cultural', /pride|lgbt|gay|inclusive club/i, 'pride inclusive rugby club NSW'],
  ['Role Models', 'cultural', /role model|wallab|waratah|inspire|hero/i, 'Waratahs Wallabies community visit NSW club'],
];
// Per funded town: rugby in general, then with economic words, then with cultural words (OR so any one word is enough).
const PER_PLACE = [
  ['social', p => `"${p}" rugby`],
  ['economic', p => `"${p}" rugby (business OR tourism OR visitors OR economy OR accommodation OR carnival OR tickets OR merchandise OR jerseys)`],
  ['cultural', p => `"${p}" rugby (Aboriginal OR "First Nations" OR Indigenous OR NAIDOC OR Pasifika OR multicultural)`],
];
const COMMUNITY = /club|communit|junior|girls|women|facilit|field|oval|ground|changeroom|lighting|upgrade|grant|funding|volunteer|business|shop|caf[eé]|restaurant|motel|hotel|accommodation|touris|visitor|econom|jobs|first nations|aboriginal|indigenous|koori|naidoc|pasifika|pacific|multicultural|carnival|tournament|championships?|sevens|inclusive|world cup/i;
// Impact type: whichever has the most keyword matches; social when none match.
const LENS = [['economic', /business(es)?|shops?|caf[eé]s?|restaurants?|\bpubs?\b|motels?|hotels?|accommodation|touris[mt]|travel(led|lers?)?|visitors?|tickets?|sold out|merch(andise)?|jerseys?|apparel|kit sales|econom(y|ic)|jobs|employment|spend(ing)?|trade|sales|booked out|nights|construction|contractors?|investment|boost/gi],
  ['cultural', /first nations|aboriginal|indigenous|torres strait|koori|murri|naidoc|elders?|welcome to country|smoking ceremony|pasifika|pacific island|samoan|tongan|fijian|m[aā]ori|multicultural|cald|refugees?|migrants?|cultur(e|al)|heritage/gi]];
// With no keyword match (Google News gives only a headline), the type of the search that found it is used.
const lensOf = (text, hint) => { let best = [hint || 'social', 0]; for (const [l, re] of LENS) { const n = (text.match(re) || []).length; if (n > best[1]) best = [l, n]; } return best[0]; };
// Other codes and match reports are not about Legacy-funded work.
const NOISE = /rugby league|\bnrl\b|super rugby|moana pasifika|\bwin against\b|\bdefeat(s|ed)?\b|\b\d{1,3}-\d{1,3}\b/i;
// An event (match day, carnival, tournament) and local business or visitors in the same story: the match-day effect.
const EVENT = /\bmatch(es)?\b|game day|carnival|tournament|\bcup\b|grand final|championship|festival|gala day|\bhub\b|sevens|\b7s\b/i;
const BUSINESS = /business|shop|caf[eé]|restaurant|pub\b|motel|hotel|accommodation|touris|travel|visitor|econom|spend|trade|sales|booked out|crowd|tickets?|merch|jerseys?|apparel/i;
// Rugby tourism and merchandise: people travelling for rugby, tickets, jerseys and club merchandise.
const TOURISM = /touris[mt]|travel(led|lers?)?|visitors?|accommodation|booked out|tickets?|sold out|merch(andise)?|jerseys?|apparel|kit sales/i;
const LEGACY = /legacy|rugby world cup|\brwc\b|grant|funding|funded|upgrade|changeroom|lighting|drainage/i;
const cache = new Map();
const TTL = 6 * 60 * 60 * 1000;

async function fetchText(url, ua = UA) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': ua, 'Accept-Language': 'en-AU,en;q=0.9' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}
const decode = s => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&[a-z]+;/g, ' ');
const strip = s => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (item, name) => { const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]).trim() : ''; };
const norm = s => s.toLowerCase().replace(/ - [^-]+$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const items = xml => [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].slice(0, 10).map(m => m[0]);

async function googleNews(q) {
  const xml = await fetchText('https://news.google.com/rss/search?' + new URLSearchParams({ q, hl: 'en-AU', gl: 'AU', ceid: 'AU:en' }));
  return items(xml).map(it => { const source = tag(it, 'source'); return { title: strip(tag(it, 'title')).replace(` - ${source}`, ''), source, date: tag(it, 'pubDate'), url: tag(it, 'link'), snippet: '' }; });
}
async function bingNews(q) {
  const xml = await fetchText('https://www.bing.com/news/search?' + new URLSearchParams({ q, format: 'rss', cc: 'AU', setlang: 'en-AU' }));
  return items(xml).map(it => {
    const link = tag(it, 'link'), u = link.match(/[?&]url=([^&]+)/), url = u ? decodeURIComponent(u[1]) : link;
    // Bing's source name is sometimes wrong, so show the publisher's web address.
    const source = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return tag(it, 'News:Source'); } })();
    return { title: strip(tag(it, 'title')), source, date: tag(it, 'pubDate'), url, snippet: strip(tag(it, 'description')) };
  });
}
// Social media. Posts carry no headline, so the first line of the post is used as the title.
const SOCIAL_UA = 'TackleAI/1.0 (NSW Rugby Legacy impact research, low volume)';
async function reddit(q) {
  const xml = await fetchText('https://www.reddit.com/search.rss?' + new URLSearchParams({ q, sort: 'relevance', t: 'year' }), SOCIAL_UA);
  return [...xml.matchAll(/<entry>[\s\S]*?<\/entry>/g)].slice(0, 10).map(m => m[0]).map(e => {
    const sub = (e.match(/<category[^>]*term="([^"]+)"/) || [])[1] || '';
    return { title: strip(tag(e, 'title')), source: sub ? `Reddit r/${sub}` : 'Reddit', date: tag(e, 'updated'), url: (e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '', snippet: strip(tag(e, 'content')).slice(0, 400), channel: 'social' };
  });
}
async function bluesky(q) {
  const data = JSON.parse(await fetchText('https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?' + new URLSearchParams({ q, limit: '15', sort: 'top' }), SOCIAL_UA));
  return (data.posts || []).map(p => { const text = String(p.record?.text || '').replace(/\s+/g, ' ').trim(), rkey = String(p.uri || '').split('/').pop();
    return { title: text.length > 110 ? text.slice(0, 107) + '…' : text, source: 'Bluesky', date: p.record?.createdAt || '', url: `https://bsky.app/profile/${p.author?.did}/post/${rkey}`, snippet: text, channel: 'social' }; }).filter(p => p.title);
}

async function pool(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; try { out[k] = await fn(list[k]); } catch (e) { out[k] = { error: e.message }; } } }));
  return out;
}

export default async function handler(req, res) {
  if (!authorised(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
  const year = Number(body.year) || new Date().getFullYear();
  const places = (Array.isArray(body.places) ? body.places : []).map(p => ({ place: String(p.place || '').slice(0, 40).trim(), region: String(p.region || '').slice(0, 40) })).filter(p => p.place).slice(0, 25);
  const LENSES = ['economic', 'social', 'cultural'];
  const extra = (Array.isArray(body.extra) ? body.extra : []).map(e => ({ q: String(e.q || '').replace(/[^\w\s"'&()-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120), lens: LENSES.includes(e.lens) ? e.lens : 'social', place: places.find(p => p.place === e.place) }))
    .filter(e => e.q && /rugby/i.test(e.q)).slice(0, 20);
  const key = JSON.stringify([year, places.map(p => p.place), extra.map(e => e.q)]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL && !body.refresh) return send(res, 200, { ...hit.data, cached: true });

  const started = Date.now();
  // Google News is rate-limited, so it is used for the general searches; each place is looked up on Bing News.
  // Each funded town is searched twice: rugby in general, and rugby events with local business or visitors.
  const GENERAL_ALL = [...GENERAL, ...SUBJECTS.map(([, lens, , q]) => [q, lens])];
  const jobs = [...GENERAL_ALL.flatMap(([q, lens]) => [{ q, lens, fn: googleNews }, { q, lens, fn: bingNews }]), ...places.flatMap(p => PER_PLACE.map(([lens, q]) => ({ q: q(p.place), lens, fn: bingNews, place: p }))),
    ...GENERAL.map(([q, lens]) => ({ q, lens, fn: reddit })), ...GENERAL.map(([q, lens]) => ({ q: q.replace(/\bNSW\b/, '').trim(), lens, fn: bluesky })),
    ...places.slice(0, 10).map(p => ({ q: `${p.place} rugby`, lens: 'social', fn: bluesky, place: p })),
    ...extra.flatMap(e => (e.place ? [bingNews, bluesky] : [bingNews, googleNews, bluesky]).map(fn => ({ q: e.q, lens: e.lens, fn, place: e.place, ai: true })))];
  const found = await pool(jobs, 8, j => j.fn(j.q));
  const errors = found.filter(f => f?.error).map(f => f.error);

  const seen = new Map();
  found.forEach((list, i) => (Array.isArray(list) ? list : []).forEach(r => {
    const text = `${r.title} ${r.snippet}`, job = jobs[i];
    if (!r.title || !/rugby/i.test(text) || !COMMUNITY.test(text) || NOISE.test(text)) return;
    // The town must appear as a place, not as someone's surname (Bourke, Forbes, Warren): "in Bourke", "Bourke rugby", "Bourke's".
    if (job.place) { const t = job.place.place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (!new RegExp(`\\b(in|at|from|near|around|across) ${t}\\b|\\b${t}( [A-Z][a-z]+)? (rugby|club)\\b|\\b${t}('s| junior| juniors| shire| council| oval| park| sportsground| district| region| community)\\b`, 'i').test(text)) return; }
    const d = r.date ? new Date(r.date) : null;
    if (d && !isNaN(d) && d.getFullYear() < year - 1) return;
    const k = norm(r.title), prev = seen.get(k);
    if (prev) { if (!prev.snippet) prev.snippet = r.snippet; if (job.place && !prev.place) { prev.place = job.place.place; prev.region = job.place.region; } return; }
    seen.set(k, { ...r, fromAi: !!job.ai, place: job.place?.place || '', region: job.place?.region || '', lens: lensOf(text, job.lens), subjects: SUBJECTS.filter(([, , re]) => re.test(text)).map(([s, l]) => [s, l]).slice(0, 3), lensBy: (LENS.some(([, re]) => (text.match(re) || []).length) ? 'words' : 'search'), legacy: LEGACY.test(text), event: EVENT.test(text), business: BUSINESS.test(text), tourism: TOURISM.test(text) });
  }));
  const list = [...seen.values()].sort((a, b) => (!!b.place - !!a.place) || (b.legacy - a.legacy) || ((new Date(b.date) || 0) - (new Date(a.date) || 0))).slice(0, 120);
  const social = list.filter(it => it.channel === 'social').length;
  const counts = list.reduce((c, it) => (c[it.lens]++, c), { economic: 0, social: 0, cultural: 0 });
  const data = { items: list, counts, social, searches: jobs.length, ms: Date.now() - started, errors: errors.slice(0, 3) };
  if (list.length) cache.set(key, { at: Date.now(), data });
  return send(res, list.length ? 200 : 502, list.length ? data : { ...data, error: `Nothing found (${errors[0] || 'no matching articles'})` });
}
