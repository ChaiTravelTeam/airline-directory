/* Chai Travel Advisors · Partner directory editor · v29 (admins only; uses modalForm/toast from edit.js) */
const LF = {
  partner: () => [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category', type: 'select', options: LAND_CATS.map(c => [c.key, c.name]) },
    { key: 'commission', label: 'Commission', type: 'textarea', rows: 3 },
    { key: 'reservations', label: 'Reservations', type: 'textarea', rows: 3 },
    { key: 'rate_codes', label: 'GDS rate code' },
    { key: 'agency_account', label: 'Agency account', type: 'textarea', rows: 3 },
    { key: 'website_domain', label: 'Website', hint: 'domain only, e.g. fourseasons.com (used for the logo)' },
    { key: 'logo_url', label: 'Logo image URL', type: 'url', hint: 'optional; overrides the website icon' },
    { key: 'is_preferred', label: 'Chai preferred', type: 'checkbox' },
    { key: 'needs_review', label: 'Needs review (admins only)', type: 'checkbox' },
    { key: 'review_notes', label: 'Review notes', hint: 'admins only' },
    { key: 'is_archived', label: 'Archived (hidden from advisors)', type: 'checkbox' }
  ],
  contact: [
    { key: 'kind', label: 'Type', type: 'select', options: [['main', 'Main'], ['entertainment', 'Entertainment'], ['groups', 'Groups'], ['additional', 'Additional'], ['reservations', 'Reservations'], ['other', 'Other']] },
    { key: 'label', label: 'Label', placeholder: 'Main Contact' }, { key: 'name', label: 'Name' }, { key: 'title', label: 'Title' },
    { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'notes', label: 'Notes' }
  ],
  section: [{ key: 'heading', label: 'Heading' }, { key: 'body', label: 'Text', type: 'textarea', rows: 12, hint: 'one paragraph per line; "- " starts a bullet; [label](https://…) makes a link' }],
  listing: () => [
    { key: 'display_name', label: 'Name shown on the index' },
    { key: 'category', label: 'Category', type: 'select', options: LAND_CATS.map(c => [c.key, c.name]) },
    { key: 'subcategory', label: 'Group / country', hint: 'e.g. Global Hotel Brands, or the country for a DMC' },
    { key: 'website_domain', label: 'Brand website', hint: 'optional; gives a sub-brand its own logo' }
  ]
};
const lslug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
async function lrun(p, okMsg) { const { error } = await p; if (error) { toast(error.message, true); return false; } if (okMsg) toast(okMsg); LISTINGS = null; return true; }

async function landAddPartner(category) {
  const v = await modalForm('Add partner', LF.partner(), { category: category || 'hotel' });
  if (!v || !v.name) return;
  const slug = lslug(v.name) + '-' + Math.random().toString(36).slice(2, 6);
  const { data, error } = await sb.from('partners').insert({ ...v, slug, updated_by: session.user.id }).select().single();
  if (error) { toast(error.message, true); return; }
  await sb.from('partner_listings').insert({ partner_id: data.id, category: v.category, display_name: v.name, position: 999999 });
  LISTINGS = null; toast('Partner added'); location.hash = '#/partner/' + slug + '/edit';
}

async function renderPartnerEdit(slug, alive = () => true) {
  if (!landGate()) return;
  const { data: p } = await sb.from('partners').select('*').eq('slug', slug).maybeSingle();
  if (!alive()) return;
  if (!p) { app.innerHTML = '<p class="empty">Partner not found.</p>'; return; }
  const [{ data: contacts }, { data: sections }, { data: listings }] = await Promise.all([
    sb.from('partner_contacts').select('*').eq('partner_id', p.id).order('position'),
    sb.from('partner_sections').select('*').eq('partner_id', p.id).order('position'),
    sb.from('partner_listings').select('*').eq('partner_id', p.id).order('position')
  ]);
  if (!alive()) return;
  app.className = 'epage';
  const row = (html, id, kind) => `<div class="erow"><div class="etext">${html}</div><div class="eact"><button class="btn2 mini" data-act="edit-${kind}" data-id="${id}">Edit</button><button class="btn2 mini" data-act="del-${kind}" data-id="${id}">Delete</button></div></div>`;
  const fact = (l, v) => v ? `<b>${l}:</b> ${esc(v).replace(/\n/g, ' · ')}<br>` : '';
  app.innerHTML = `
  <a class="back" href="#/partner/${esc(p.slug)}">← Back to ${esc(p.name)}</a>
  <div class="ahead"><h2>Edit ${esc(p.name)}</h2></div>
  <section class="s"><h3>Details <button class="btn2 mini" data-act="edit-partner">Edit details</button></h3>
    <div class="erow"><div class="etext">${fact('Category', (landCat(p.category) || {}).name)}${fact('Commission', p.commission)}${fact('Reservations', p.reservations)}${fact('GDS rate code', p.rate_codes)}${fact('Agency account', p.agency_account)}${fact('Website', p.website_domain)}${fact('Logo URL', p.logo_url)}<b>Preferred:</b> ${p.is_preferred ? 'yes' : 'no'} · <b>Archived:</b> ${p.is_archived ? 'yes' : 'no'} · <b>Needs review:</b> ${p.needs_review ? 'yes — ' + esc(p.review_notes || '') : 'no'}</div></div></section>
  <section class="s"><h3>Contacts <button class="btn2 mini" data-act="add-contact">Add contact</button></h3>
    ${contacts.map(c => row(`<b>${esc(c.label || c.kind)}</b> · ${esc([c.name, c.title, c.phone, c.email].filter(Boolean).join(' · '))}`, c.id, 'contact')).join('') || '<p class="empty">None.</p>'}</section>
  <section class="s"><h3>Sections <button class="btn2 mini" data-act="add-section">Add section</button></h3>
    ${sections.map(s => row(`<b>${esc(s.heading || '(no heading)')}</b><br><span class="muted">${esc(s.body.slice(0, 220))}${s.body.length > 220 ? '…' : ''}</span>`, s.id, 'section')).join('') || '<p class="empty">None.</p>'}</section>
  <section class="s"><h3>Index listings <button class="btn2 mini" data-act="add-listing">Add listing</button></h3>
    <p class="muted" style="font-size:13px">Where this partner appears: brand names under a group, or the countries a DMC covers.</p>
    ${listings.map(l => row(`<b>${esc(l.display_name)}</b> · ${esc((landCat(l.category) || {}).name || l.category)}${l.subcategory ? ' · ' + esc(l.subcategory) : ''}${l.website_domain ? ' · ' + esc(l.website_domain) : ''}`, l.id, 'listing')).join('') || '<p class="empty">None — this partner will not appear on any index.</p>'}</section>
  <section class="s"><button class="btn2" data-act="del-partner" style="color:#7A2E2E">Delete this partner</button></section>`;
  const again = () => renderPartnerEdit(p.slug);
  const tbl = { contact: ['partner_contacts', contacts, LF.contact], section: ['partner_sections', sections, LF.section], listing: ['partner_listings', listings, LF.listing()] };
  app.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
    const [op, kind] = b.dataset.act.split('-'), id = b.dataset.id;
    if (kind === 'partner' && op === 'edit') {
      const v = await modalForm('Edit details', LF.partner(), p); if (!v) return;
      if (!v.name) { toast('Name is required', true); return; }
      if (await lrun(sb.from('partners').update({ ...v, updated_at: new Date().toISOString(), updated_by: session.user.id }).eq('id', p.id), 'Saved')) again();
    } else if (kind === 'partner' && op === 'del') {
      if (!await confirmBox(`Delete ${p.name} and all its contacts, sections and listings? This cannot be undone.`)) return;
      if (await lrun(sb.from('partners').delete().eq('id', p.id), 'Partner deleted')) location.hash = '#/partners/' + p.category;
    } else {
      const [table, rows, fields] = tbl[kind];
      if (op === 'add') {
        const v = await modalForm('Add ' + kind, fields, kind === 'listing' ? { category: p.category, display_name: p.name } : {}); if (!v) return;
        if (kind === 'section' && !v.body) { toast('Text is required', true); return; }
        if (kind === 'listing' && !v.display_name) { toast('Name is required', true); return; }
        const pos = rows.length ? Math.max(...rows.map(r => r.position)) + 10 : 0;
        if (await lrun(sb.from(table).insert({ ...v, partner_id: p.id, position: pos }), 'Added')) again();
      } else if (op === 'edit') {
        const cur = rows.find(r => r.id === id); const v = await modalForm('Edit ' + kind, fields, cur); if (!v) return;
        if (await lrun(sb.from(table).update(v).eq('id', id), 'Saved')) again();
      } else if (op === 'del') {
        if (!await confirmBox('Delete this ' + kind + '?')) return;
        if (await lrun(sb.from(table).delete().eq('id', id), 'Deleted')) again();
      }
    }
  });
}
