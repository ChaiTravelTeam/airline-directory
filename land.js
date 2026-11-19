/* Chai Travel Advisors · Partner directory (land) · v1
   Admin-only preview. Loaded after app.js; uses its sb, app, esc, linkify, isAdmin helpers.
   Routes: #/partners · #/partners/<category> · #/partner/<slug> */
const LAND_CATS = [
  { key: 'hotel', name: 'Hotels', one: 'hotel partner' },
  { key: 'cruise', name: 'Cruise Lines', one: 'cruise line' },
  { key: 'tour_operator', name: 'Tour Operators', one: 'tour operator' },
  { key: 'dmc', name: 'DMCs', one: 'DMC', sub: 'Country' },
  { key: 'villa', name: 'Villas & Apartments', one: 'villa partner' },
  { key: 'ground', name: 'Ground Transportation', one: 'ground partner' },
  { key: 'insurance', name: 'Insurance', one: 'insurer' },
  { key: 'rep_company', name: 'Representation Companies', one: 'rep company' },
  { key: 'service', name: 'Services & Miscellaneous', one: 'service' },
  { key: 'private_jet', name: 'Private Jet', one: 'operator' }
];
const U = id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=70`;
const LAND_PHOTOS = {
  hotel: ['1683290844875-0eee4089069a', '1678913308053-316cee77afe9'],
  cruise: ['1554254648-2d58a1bc3fd5', '1511316695145-4992006ffddb'],
  tour_operator: ['1539635278303-d4002c07eae3', '1507237615867-0d4d2ad6b2d1'],
  dmc: ['1524661135-423995f22d0b', '1516546453174-5e1098a4b4af'],
  villa: ['1613977257365-aaae5a9817ff', '1543489822-c49534f3271f'],
  ground: ['1533630217389-3a5e4dff5683', '1473655587843-eda8944061e8'],
  insurance: ['1519692933481-e162a57d6721', '1523772721666-22ad3c3b6f90'],
  rep_company: ['1686771416282-3888ddaf249b', '1759310610325-2c7cb621e5e3'],
  service: ['1571648393415-d5dfa1785d87', '1571648393926-b03261908235'],
  private_jet: []
};
const landBg = k => ['linear-gradient(180deg,rgba(20,24,32,.05) 30%,rgba(20,24,32,.78) 100%)', ...(LAND_PHOTOS[k] || []).map(id => `url('${U(id)}')`)].join(',');
const landInitials = n => String(n || '?').replace(/[^A-Za-z0-9 &]/g, '').trim().split(/\s+/).filter(w => !/^(the|and|&|of|by)$/i.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
function landLogo(p, cls = '') {
  const src = p.logo_url || (p.website_domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(p.website_domain)}&sz=128` : '');
  return `<span class="llogo ${cls} ${src ? '' : 'nologo'}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('nologo');this.remove()">` : ''}<span class="fb">${esc(landInitials(p.name))}</span></span>`;
}
const landCat = k => LAND_CATS.find(c => c.key === k);
let LISTINGS = null, landQ = '', landSub = '';

async function loadListings() {
  if (LISTINGS) return LISTINGS;
  const { data, error } = await sb.from('partner_listings')
    .select('category,subcategory,display_name,position,partners(id,slug,name,category,commission,is_preferred,needs_review,is_archived,website_domain,logo_url)')
    .order('position').range(0, 4999);
  if (error) throw error;
  LISTINGS = (data || []).filter(l => l.partners);
  return LISTINGS;
}

/* tiny markdown: [label](url), **bold**, "- " lists, "## " headings; everything else linkified text */
function mdInline(t) {
  const keep = [];
  const stash = h => { keep.push(h); return '\u0000' + (keep.length - 1) + '\u0000'; };
  let s = String(t || '').replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (m, label, url) => {
    let u = url.trim();
    if (u.startsWith('/')) u = 'https://chaitravel.sharepoint.com' + u;
    if (!/^(https?:|mailto:|tel:)/i.test(u)) return label;
    const lab = label.replace(/\*+/g, '').trim() || u.replace(/^mailto:/, '');
    return stash(`<a href="${esc(u)}"${u.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(lab)}</a>`);
  });
  s = linkify(s).replace(/\*{2,3}([^*]+?)\*{2,3}/g, '<b>$1</b>').replace(/\*/g, '');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
}
function mdHtml(t) {
  const out = []; let list = [];
  const flush = () => { if (list.length) { out.push('<ul>' + list.map(li => `<li>${mdInline(li)}</li>`).join('') + '</ul>'); list = []; } };
  for (const raw of String(t || '').split('\n')) {
    const l = raw.trim();
    if (!l || l === '##') { flush(); continue; }
    if (l.startsWith('- ')) { list.push(l.slice(2)); continue; }
    flush();
    if (l.startsWith('## ')) out.push(`<h4>${mdInline(l.slice(3))}</h4>`);
    else out.push(`<p>${mdInline(l)}</p>`);
  }
  flush();
  return out.join('');
}

function landGate() {
  if (isAdmin()) return true;
  app.innerHTML = '<div class="notice"><h2 style="margin-top:0">Partner directory</h2><p>This section isn’t open yet.</p><p><a href="#/">Back to airlines</a></p></div>';
  return false;
}

async function renderPartnersHome(alive = () => true) {
  if (!landGate()) return;
  const list = await loadListings(); if (!alive()) return;
  app.className = '';
  const uniq = k => new Set(list.filter(l => l.category === k).map(l => l.partners.id)).size;
  const total = new Set(list.map(l => l.partners.id)).size;
  const hay = landQ.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = hay.length ? list.filter(l => hay.every(w => (l.display_name + ' ' + l.partners.name + ' ' + (l.subcategory || '')).toLowerCase().includes(w))) : [];
  const seen = new Set(), found = [];
  for (const l of hits) { if (seen.has(l.partners.id)) continue; seen.add(l.partners.id); found.push(l); }
  app.innerHTML = `
  <section class="hero lhero"><div class="wrap-in">
    <p class="kicker">Admin preview · ${total} partners</p>
    <h1>Find a partner.</h1>
    <p class="sub">Contacts, commission and booking details for hotels, cruise lines, tour operators and more.</p>
    <div class="tools"><label class="search">${ICON_SEARCH}<input type="search" id="lq" placeholder="Partner, brand or country…" value="${esc(landQ)}" autocomplete="off"></label></div>
  </div></section>
  <div class="wrap-in index-body">
    ${hay.length ? `<div class="grp"><h3>Results<small>${found.length}</small></h3></div>${found.length ? `<div class="grid">${found.slice(0, 60).map(landTile).join('')}</div>` : '<p class="nores">No partners match.</p>'}` : `
    <div class="grp"><h3>Browse by category</h3></div>
    <div class="lmosaic">${LAND_CATS.filter(c => uniq(c.key)).map((c, i) => `<a class="lphoto${i === 0 ? ' big' : ''}" href="#/partners/${c.key}" style="background-image:${landBg(c.key)}"><span class="lp-txt"><span class="lp-n">${uniq(c.key)} ${uniq(c.key) === 1 ? esc(c.one) : esc(c.one) + 's'}</span><span class="lp-nm">${esc(c.name)}</span></span><span class="lp-go" aria-hidden="true">→</span></a>`).join('')}</div>`}
  </div>`;
  const qi = document.getElementById('lq');
  qi.oninput = e => { landQ = e.target.value; const pos = qi.selectionStart; renderPartnersHome().then(() => { const n = document.getElementById('lq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); };
}

function landTile(l) {
  const p = l.partners, alias = l.display_name && l.display_name.toLowerCase() !== p.name.toLowerCase();
  const comm = (p.commission || '').split('\n')[0].replace(/\*/g, '').slice(0, 28);
  return `<a class="tile ltile" href="#/partner/${esc(p.slug)}" title="${esc(p.name)}">
    <span class="top">${landLogo(p)}<span class="lchips">${p.is_preferred ? '<span class="chip vf">Preferred</span>' : ''}${p.needs_review && isAdmin() ? '<span class="chip warn">Review</span>' : ''}</span></span>
    <span class="txt"><span class="nm">${esc(l.display_name || p.name)}</span><span class="lsub">${alias ? esc(p.name) : (comm ? 'Commission ' + esc(comm) : '&nbsp;')}</span></span></a>`;
}

async function renderPartnerCategory(key, alive = () => true) {
  if (!landGate()) return;
  const cat = landCat(key);
  if (!cat) { app.innerHTML = '<p class="empty">Category not found.</p>'; return; }
  const all = (await loadListings()).filter(l => l.category === key && (!l.partners.is_archived || isAdmin()));
  if (!alive()) return;
  app.className = '';
  const hay = landQ.toLowerCase().split(/\s+/).filter(Boolean);
  let rows = all.filter(l => hay.every(w => (l.display_name + ' ' + l.partners.name + ' ' + (l.subcategory || '')).toLowerCase().includes(w)));
  const subs = [...new Set(all.map(l => l.subcategory).filter(Boolean))];
  let body;
  if (cat.sub) {           // many-to-many (DMC by country): one tile per partner, filter by country
    subs.sort((a, b) => a.localeCompare(b));
    if (landSub) rows = rows.filter(l => l.subcategory === landSub);
    const seen = new Set(), uniq = [];
    for (const l of rows) { if (seen.has(l.partners.id)) continue; seen.add(l.partners.id); uniq.push({ ...l, display_name: l.partners.name }); }
    uniq.sort((a, b) => a.display_name.localeCompare(b.display_name));
    body = `<div class="filters"><label class="lsel">${esc(cat.sub)} <select id="lsub"><option value="">All</option>${subs.map(s => `<option${s === landSub ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label><p class="count">${uniq.length} ${esc(cat.name)}</p></div>
      ${uniq.length ? `<div class="grid">${uniq.map(landTile).join('')}</div>` : '<p class="nores">No partners match.</p>'}`;
  } else {
    const groups = subs.length ? subs : [null];
    body = (rows.length ? '' : '<p class="nores">No partners match.</p>') + groups.map(g => {
      const items = rows.filter(l => (l.subcategory || null) === g).sort((a, b) => a.display_name.localeCompare(b.display_name));
      return items.length ? `<div class="grp"><h3>${esc(g || cat.name)}<small>${items.length}</small></h3></div><div class="grid">${items.map(landTile).join('')}</div>` : '';
    }).join('');
  }
  app.innerHTML = `
  <section class="hero lband" style="background-image:linear-gradient(90deg,rgba(20,24,32,.82),rgba(20,24,32,.45)),${(LAND_PHOTOS[key] || []).map(id => `url('${U(id)}')`).join(',') || 'none'}"><div class="wrap-in">
    <p class="kicker"><a href="#/partners">Partners</a> · ${new Set(all.map(l => l.partners.id)).size} on file</p>
    <h1>${esc(cat.name)}</h1>
    <div class="tools"><label class="search">${ICON_SEARCH}<input type="search" id="lq" placeholder="Search ${esc(cat.name.toLowerCase())}…" value="${esc(landQ)}" autocomplete="off"></label></div>
  </div></section>
  <div class="wrap-in index-body">${body}</div>`;
  const qi = document.getElementById('lq');
  qi.oninput = e => { landQ = e.target.value; const pos = qi.selectionStart; renderPartnerCategory(key).then(() => { const n = document.getElementById('lq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); };
  const sel = document.getElementById('lsub'); if (sel) sel.onchange = () => { landSub = sel.value; renderPartnerCategory(key); };
}

async function renderPartner(slug, alive = () => true) {
  if (!landGate()) return;
  app.innerHTML = '<p class="muted">Loading…</p>';
  const { data: p } = await sb.from('partners').select('*').eq('slug', slug).maybeSingle();
  if (!alive()) return;
  if (!p) { app.innerHTML = '<p class="empty">Partner not found.</p>'; return; }
  const [{ data: contacts }, { data: sections }, { data: links }, { data: listings }] = await Promise.all([
    sb.from('partner_contacts').select('*').eq('partner_id', p.id).order('position'),
    sb.from('partner_sections').select('*').eq('partner_id', p.id).order('position'),
    sb.from('partner_links').select('*').eq('partner_id', p.id).order('position'),
    sb.from('partner_listings').select('category,subcategory,display_name').eq('partner_id', p.id).order('position')
  ]);
  if (!alive()) return;
  app.className = '';
  const cat = landCat(p.category) || { name: 'Partners', key: '' };
  const kindName = { main: 'Main contact', entertainment: 'Entertainment', groups: 'Groups', additional: 'Additional contact', reservations: 'Reservations', other: 'Contact' };
  const tel = ph => { const d = ph.replace(/\D/g, ''); return (d.startsWith('1') || ph.trim().startsWith('+')) ? '+' + d : '+1' + d; };
  const fact = (label, v) => v ? `<div class="lfact"><span class="lab">${label}</span><div class="md">${mdHtml(v)}</div></div>` : '';
  const facts = fact('Commission', p.commission) + fact('Reservations', p.reservations) + fact('GDS rate code', p.rate_codes) + fact('Agency account', p.agency_account);
  const people = (contacts || []).length ? `<div class="card people">${contacts.map(c => `<div class="contact">
      <span class="lab">${esc(c.label || kindName[c.kind] || '')}</span>
      ${c.name ? `<span class="name">${esc(c.name)}</span>` : ''}
      ${c.title ? `<span class="muted" style="font-size:13px">${esc(c.title)}</span>` : ''}
      ${c.phone ? `<span class="tel"><a href="tel:${tel(c.phone)}">${esc(c.phone)}</a></span>` : ''}
      ${c.email ? `<span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></span>` : ''}
      ${c.notes ? `<span class="muted" style="font-size:13px">${linkify(c.notes)}</span>` : ''}</div>`).join('')}</div>` : '<div class="card people"><p class="empty">No contact on file.</p></div>';
  const names = [...new Set((listings || []).map(l => l.display_name).filter(n => n && n.toLowerCase() !== p.name.toLowerCase()))];
  const places = p.category === 'dmc' ? [...new Set((listings || []).map(l => l.subcategory).filter(Boolean))].sort() : [];
  const main = [];
  if (isAdmin() && p.needs_review) main.push(`<p class="chai-note admin">${ICON_INFO}<span><b>Needs review (admins only):</b> ${esc(p.review_notes || '')}</span></p>`);
  main.push(`<div class="toprow"><div class="sec"><h3>Contacts</h3>${people}</div><div class="sec"><h3>Booking</h3><div class="card lfacts">${facts || '<p class="empty">No booking details on file.</p>'}</div></div></div>`);
  if (names.length) main.push(`<div class="sec"><h3>Brands &amp; listings</h3><div class="card"><p>${names.map(esc).join(' · ')}</p></div></div>`);
  if (places.length) main.push(`<div class="sec"><h3>Destinations<small>${places.length}</small></h3><div class="card"><p>${places.map(esc).join(' · ')}</p></div></div>`);
  for (const s of (sections || [])) main.push(`<div class="sec">${s.heading ? `<h3>${esc(s.heading)}</h3>` : ''}<div class="card md">${mdHtml(s.body)}</div></div>`);
  if ((links || []).length) main.push(`<div class="sec"><h3>Links</h3><div class="card links">${links.map(l => `<a href="${esc(l.url.startsWith('/') ? 'https://chaitravel.sharepoint.com' + l.url : l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</div></div>`);
  app.innerHTML = `
  <div class="ahead-wrap"><div class="wrap-in">
    <p class="crumb"><a href="#/partners">Partners</a><span>›</span><a href="#/partners/${esc(cat.key)}">${esc(cat.name)}</a><span>›</span><b>${esc(p.name)}</b></p>
    <div class="ahead">${landLogo(p, 'xl')}<div class="ttl"><div class="row1"><h2>${esc(p.name)}</h2>${p.is_preferred ? '<span class="chip vf">Preferred</span>' : ''}${p.is_archived ? '<span class="chip no">Archived</span>' : ''}</div>
      <p class="meta">${esc(cat.name)}${p.commission ? ` · Commission ${esc(p.commission.split('\n')[0].replace(/\*/g, ''))}` : ''}</p></div></div>
  </div></div>
  <div class="body"><div class="wrap-in"><div class="mainc">${main.join('')}</div></div></div>`;
}

/* called from app.js route(); returns a promise when the hash is a land route, else null */
let landLast = '';
function landRoute(alive) {
  const h = location.hash;
  if (h !== landLast) { landQ = ''; landSub = ''; landLast = h; }
  let m;
  if ((m = h.match(/^#\/partner\/([a-z0-9\-]+)/))) return renderPartner(m[1], alive);
  if ((m = h.match(/^#\/partners\/([a-z_]+)/))) return renderPartnerCategory(m[1], alive);
  if (/^#\/partners\/?$/.test(h)) return renderPartnersHome(alive);
  return null;
}
