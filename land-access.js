/* Chai Travel Advisors · People & access (companies, IATA buckets, Excel import) · v30 · admins only
   Route: #/partners-access  (handled by landRoute). Uses modalForm/toast from edit.js. */
const ACC_MODULES = [['air', 'Air'], ['land', 'Land'], ['hr', 'HR'], ['accounting', 'Accounting']];
const accMods = a => (a || []).map(m => (ACC_MODULES.find(x => x[0] === m) || [m, m])[1]).join(', ') || '—';
const accParseMods = s => String(s || '').toLowerCase().split(/[,;\s]+/).filter(m => ACC_MODULES.some(x => x[0] === m));
function accLoadXlsx() {
  return window.XLSX ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the Excel reader')); document.head.appendChild(s); });
}
const ACC_COLS = {
  email: ['email', 'e-mail', 'email address', 'mail', 'user principal name', 'userprincipalname', 'upn', 'username'],
  name: ['name', 'full name', 'display name', 'displayname'],
  role: ['role'], company: ['company', 'company name', 'companyname', 'agency'], iata: ['iata', 'iata number', 'iata #'],
  type: ['type', 'advisor type']
};
function accRows(grid) {           // grid: array of arrays; first row with an email-like header is the header
  if (!grid.length) return [];
  const norm = s => String(s ?? '').trim().toLowerCase();
  let hi = grid.findIndex(r => r.some(c => ACC_COLS.email.includes(norm(c))));
  let map = {};
  if (hi >= 0) { grid[hi].forEach((c, i) => { for (const k in ACC_COLS) if (ACC_COLS[k].includes(norm(c)) && map[k] === undefined) map[k] = i; }); }
  else { hi = -1; map = { email: 0, name: 1, role: 2, company: 3, iata: 4 }; }   // no header: email, name, role, company, IATA
  return grid.slice(hi + 1).map(r => { const o = {}; for (const k in map) o[k] = String(r[map[k]] ?? '').trim(); return o; }).filter(o => o.email || o.name);
}

async function renderAccess(alive = () => true) {
  if (!landGate()) return;
  app.innerHTML = '<p class="muted">Loading…</p>';
  const [{ data: companies, error: e1 }, { data: access, error: e2 }, { data: allow, error: e3 }] = await Promise.all([
    sb.from('companies').select('*').order('name'), sb.from('user_access').select('*'), sb.from('allowlist').select('*').order('email')]);
  if (!alive()) return;
  if (e1 || e2 || e3) { app.innerHTML = `<p class="empty">Couldn’t load (${esc((e1 || e2 || e3).message)}).</p>`; return; }
  app.className = 'epage';
  const accBy = Object.fromEntries(access.map(a => [a.email, a])), coBy = Object.fromEntries(companies.map(c => [c.id, c]));
  const eff = u => { if (u.role === 'admin') return ACC_MODULES.map(m => m[0]); const a = accBy[u.email]; if (!a) return ['air']; const base = (coBy[a.company_id]?.default_modules) || ['air']; return [...new Set([...base, ...a.extra_modules])].filter(m => !a.removed_modules.includes(m)); };
  app.innerHTML = `
  <a class="back" href="#/admin">← Back to Admin</a>
  <div class="ahead"><h2>People &amp; access</h2></div>
  <p class="muted" style="font-size:14px">A company sets which sections its people see by default. A person can be given more (or less) than their company. People with no company see Air only. Land is still hidden from non-admins until partners are published.</p>
  <section class="s"><h3>Companies <button class="btn2 mini" id="co-add">Add company</button></h3>
    ${companies.map(c => `<div class="erow"><div class="etext"><b>${esc(c.name)}</b>${c.iata ? ' · IATA ' + esc(c.iata) : ' · <span class="muted">no IATA</span>'} · sees ${esc(accMods(c.default_modules))} · ${access.filter(a => a.company_id === c.id).length} people</div><div class="eact"><button class="btn2 mini" data-co="${c.id}">Edit</button></div></div>`).join('')}</section>
  <section class="s"><h3>People <small>${allow.length}</small> <button class="btn2 mini" id="imp">Import from Excel</button> <button class="btn2 mini" id="tpl">Download template</button><input type="file" id="impf" accept=".xlsx,.xls,.csv,.tsv,.txt" hidden></h3>
    <div class="tools"><input type="search" id="pq" placeholder="Filter people…"></div>
    <div id="plist">${allow.map(u => { const a = accBy[u.email]; return `<div class="erow" data-h="${esc((u.email + ' ' + (u.full_name || '') + ' ' + (coBy[a?.company_id]?.name || '')).toLowerCase())}"><div class="etext"><b>${esc(u.full_name || u.email)}</b>${u.full_name ? ' · ' + esc(u.email) : ''}${u.role === 'admin' ? ' · admin' : ''}${u.is_active ? '' : ' · <span class="muted">inactive</span>'}<br><span class="muted">${esc(coBy[a?.company_id]?.name || 'No company')}${a?.iata ? ' · IATA ' + esc(a.iata) : ''} · sees ${esc(accMods(eff(u)))}</span></div><div class="eact"><button class="btn2 mini" data-u="${esc(u.email)}">Access</button></div></div>`; }).join('')}</div></section>`;
  const again = () => renderAccess();
  const coFields = [{ key: 'name', label: 'Company name' }, { key: 'iata', label: 'IATA number' }, { key: 'default_modules', label: 'Sections this company sees', hint: 'comma-separated: air, land, hr, accounting' }, { key: 'notes', label: 'Notes' }];
  const coSave = async (v, id) => { if (!v || !v.name) return; const row = { name: v.name, iata: v.iata, notes: v.notes, default_modules: accParseMods(v.default_modules).length ? accParseMods(v.default_modules) : ['air'] }; const { error } = id ? await sb.from('companies').update(row).eq('id', id) : await sb.from('companies').insert(row); if (error) return toast(error.message, true); toast('Saved'); again(); };
  document.getElementById('co-add').onclick = async () => coSave(await modalForm('Add company', coFields, { default_modules: 'air' }));
  app.querySelectorAll('[data-co]').forEach(b => b.onclick = async () => { const c = coBy[b.dataset.co]; coSave(await modalForm('Edit company', coFields, { ...c, default_modules: c.default_modules.join(', ') }), c.id); });
  app.querySelectorAll('[data-u]').forEach(b => b.onclick = async () => {
    const email = b.dataset.u, a = accBy[email] || {};
    const v = await modalForm('Access for ' + email, [
      { key: 'company_id', label: 'Company', type: 'select', options: [['', 'No company (Air only)'], ...companies.map(c => [c.id, c.name])] },
      { key: 'iata', label: 'IATA', hint: 'leave blank to use the company’s' },
      { key: 'extra_modules', label: 'Extra sections for this person', hint: 'comma-separated: air, land, hr, accounting' },
      { key: 'removed_modules', label: 'Sections to hide from this person', hint: 'comma-separated' }],
      { company_id: a.company_id || '', iata: a.iata || '', extra_modules: (a.extra_modules || []).join(', '), removed_modules: (a.removed_modules || []).join(', ') });
    if (!v) return;
    const { error } = await sb.from('user_access').upsert({ email, company_id: v.company_id || null, iata: v.iata, extra_modules: accParseMods(v.extra_modules), removed_modules: accParseMods(v.removed_modules), updated_at: new Date().toISOString() }, { onConflict: 'email' });
    if (error) return toast(error.message, true); toast('Saved'); again();
  });
  const pq = document.getElementById('pq'); pq.oninput = () => { const w = pq.value.toLowerCase().split(/\s+/).filter(Boolean); document.querySelectorAll('#plist .erow').forEach(r => r.style.display = w.every(x => r.dataset.h.includes(x)) ? '' : 'none'); };
  document.getElementById('tpl').onclick = () => { const csv = 'Email,Name,Role,Company,IATA\njane@example.com,Jane Doe,user,' + (companies[0]?.name || 'Chai Travel') + ',\n'; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'people-import-template.csv'; a.click(); };
  const fi = document.getElementById('impf');
  document.getElementById('imp').onclick = () => fi.click();
  fi.onchange = async () => {
    const f = fi.files[0]; fi.value = ''; if (!f) return;
    let rows;
    try { await accLoadXlsx(); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); rows = accRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false })); }
    catch (e) { return toast('Could not read that file: ' + (e.message || e), true); }
    const allowBy = Object.fromEntries(allow.map(u => [u.email, u])), coName = Object.fromEntries(companies.map(c => [c.name.trim().toLowerCase(), c]));
    const seen = new Set(), add = [], upd = [], skip = [], unknownCo = new Set(), aRows = [], uRows = [];
    for (const r of rows) {
      const email = r.email.toLowerCase();
      if (!/^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(email)) { skip.push(`${r.email || r.name || '(blank)'} — not an email address`); continue; }
      if (seen.has(email)) { skip.push(`${email} — duplicate row`); continue; } seen.add(email);
      const cur = allowBy[email], roleIn = (r.role || '').toLowerCase(), role = ['admin', 'user'].includes(roleIn) ? roleIn : (cur?.role || 'user');
      const typeIn = (r.type || '').toLowerCase(), type = ['ic', 'house', 'staff'].includes(typeIn) ? typeIn : (cur?.advisor_type || 'ic');
      if (email === profile.email && role !== 'admin') { skip.push(`${email} — would remove your own admin role`); continue; }
      aRows.push({ email, full_name: r.name || cur?.full_name || null, role, advisor_type: type, is_active: cur ? cur.is_active : true, added_by: cur?.added_by || profile.email });
      (cur ? upd : add).push(email);
      const co = r.company ? coName[r.company.trim().toLowerCase()] : null;
      if (r.company && !co) unknownCo.add(r.company);
      if (co || r.iata) uRows.push({ email, company_id: co ? co.id : (accBy[email]?.company_id || null), iata: r.iata || accBy[email]?.iata || null, extra_modules: accBy[email]?.extra_modules || [], removed_modules: accBy[email]?.removed_modules || [], updated_at: new Date().toISOString() });
    }
    const summary = [`File: ${f.name}`, `${add.length} new people will be added`, `${upd.length} existing people will be updated`, `${uRows.length} will get a company / IATA`, `${skip.length} rows skipped`,
      ...(unknownCo.size ? ['', 'Companies not found (those people are imported WITHOUT a company — add the company first, then re-import):', ...[...unknownCo].map(c => '  • ' + c)] : []),
      ...(skip.length ? ['', 'Skipped:', ...skip.slice(0, 40).map(s => '  • ' + s), ...(skip.length > 40 ? [`  …and ${skip.length - 40} more`] : [])] : [])].join('\n');
    if (!aRows.length) { await modalForm('Nothing to import', [{ key: 's', label: 'Result', type: 'textarea', rows: 10 }], { s: summary }, 'Close'); return; }
    const ok = await modalForm('Review import', [{ key: 's', label: 'Nothing is saved until you press Import', type: 'textarea', rows: 14 }], { s: summary }, 'Import');
    if (!ok) return;
    for (let i = 0; i < aRows.length; i += 200) { const { error } = await sb.from('allowlist').upsert(aRows.slice(i, i + 200), { onConflict: 'email' }); if (error) return toast('Import stopped: ' + error.message, true); }
    for (let i = 0; i < uRows.length; i += 200) { const { error } = await sb.from('user_access').upsert(uRows.slice(i, i + 200), { onConflict: 'email' }); if (error) return toast('People saved, but company step failed: ' + error.message, true); }
    toast(`Imported ${add.length} new, ${upd.length} updated`); again();
  };
}
