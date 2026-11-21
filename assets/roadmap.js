// Roadmap page: unlocks the encrypted roadmap with the shared access code,
// then renders projects -> series -> books as expandable/collapsible panels.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const CODE_KEY = 'pmn-store-code'; // shared with the bookstore: unlock once, both open

  async function decrypt(enc, code) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  const DONE = /^(done|complete|completed|published|launched|delivered)$/i;
  function statusClass(s) {
    s = (s || '').toLowerCase();
    if (DONE.test(s)) return 'st-done';
    if (/writ|progress|draft|design/.test(s)) return 'st-active';
    if (/review|edit|proof/.test(s)) return 'st-review';
    if (/plan/.test(s)) return 'st-plan';
    if (/hold|block|wait/.test(s)) return 'st-hold';
    return 'st-none';
  }
  const pill = s => `<span class="st ${statusClass(s)}">${esc(s || 'Not started')}</span>`;
  const blank = v => (v && String(v).trim()) ? esc(v) : '<em class="tba">To be added</em>';
  // Tiny formatter for notes: **bold** and *italic* only, applied after escaping.
  const fmt = v => esc(v).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<em>$1</em>');

  function render(data) {
    const projects = data.projects || [];
    const cats = data.categories || [];
    let tab = 'All', q = '';

    const allBooks = projects.flatMap(p => (p.series || []).flatMap(s => s.books || []));
    const doneBooks = allBooks.filter(b => DONE.test(b.status || '')).length;
    const pens = new Set(projects.flatMap(p => (p.series || []).map(s => s.penName).filter(Boolean)));
    $('rm-stats').innerHTML = [
      [projects.length, 'projects'], [projects.reduce((n, p) => n + (p.series || []).length, 0), 'series'],
      [allBooks.length, 'books planned'], [pens.size, 'pen names'], [doneBooks, 'books done']
    ].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('');
    if (data.updated) $('rm-updated').textContent = `Last updated ${data.updated}`;

    const tabs = ['All', ...cats];
    const count = c => c === 'All' ? projects.length : projects.filter(p => (p.categories || []).includes(c)).length;
    $('rm-tabs').innerHTML = tabs.map(c =>
      `<button type="button" role="tab" class="rm-tab" data-tab="${esc(c)}" aria-selected="${c === 'All'}">${esc(c)} <span>${count(c)}</span></button>`).join('');
    $('rm-tabs').addEventListener('click', e => {
      const b = e.target.closest('.rm-tab'); if (!b) return;
      tab = b.dataset.tab;
      $('rm-tabs').querySelectorAll('.rm-tab').forEach(x => x.setAttribute('aria-selected', x === b));
      draw();
    });
    $('rm-q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); draw(); });
    $('rm-expand').addEventListener('click', () => document.querySelectorAll('#rm-list details').forEach(d => d.open = true));
    $('rm-collapse').addEventListener('click', () => document.querySelectorAll('#rm-list details').forEach(d => d.open = false));

    function projectHTML(p, i) {
      const books = (p.series || []).flatMap(s => s.books || []);
      const done = books.filter(b => DONE.test(b.status || '')).length;
      const pct = books.length ? Math.round(done / books.length * 100) : 0;
      const ms = p.milestones || [];
      const seriesHTML = (p.series || []).map((s, si) => `
        <details class="rm-series">
          <summary>
            <span class="rm-num">${si + 1}</span>
            <span class="rm-series-name"><b>${esc(s.name || `Series ${si + 1}`)}</b><small>Pen name: ${blank(s.penName)}</small></span>
            <span class="rm-count">${(s.books || []).length} books</span>
            <span class="rm-chev" aria-hidden="true"></span>
          </summary>
          <div class="rm-series-body">
            ${s.description ? `<p class="rm-desc">${fmt(s.description)}</p>` : ''}
            <div class="rm-author">
              <h4>Author profile · ${blank(s.penName)}</h4>
              <dl>
                ${s.backups ? `<dt>Backup pen names</dt><dd>${esc(s.backups)}</dd>` : ''}
                ${s.targetReader ? `<dt>Target reader</dt><dd>${fmt(s.targetReader)}</dd>` : ''}
                ${s.credential ? `<dt>Credential</dt><dd>${fmt(s.credential)}</dd>` : ''}
                <dt>Niche</dt><dd>${blank(s.author && s.author.niche)}</dd>
                <dt>Bio</dt><dd>${blank(s.author && s.author.bio)}</dd>
                <dt>Voice &amp; style</dt><dd>${blank(s.author && s.author.voice)}</dd>
              </dl>
            </div>
            <ol class="rm-books">
              ${(s.books || []).map((b, bi) => `
                <li>
                  <span class="rm-book-no">Book ${bi + 1}</span>
                  <div class="rm-book-main">
                    <b>${esc(b.title || `Title ${bi + 1}`)}</b>
                    ${b.subtitle ? `<small>${esc(b.subtitle)}</small>` : ''}
                    ${b.notes ? `<p>${esc(b.notes)}</p>` : ''}
                  </div>
                  ${pill(b.status)}
                </li>`).join('')}
            </ol>
            ${(s.evidence || []).length ? `<div class="rm-evidence"><h4>${esc(s.evidenceTitle || 'Research')}</h4><ul>${s.evidence.map(e => `<li>${fmt(e)}</li>`).join('')}</ul></div>` : ''}
            ${s.validate ? `<div class="rm-callout warn"><b>To validate</b><span>${fmt(s.validate)}</span></div>` : ''}
            ${s.note ? `<div class="rm-callout"><b>Note</b><span>${fmt(s.note)}</span></div>` : ''}
          </div>
        </details>`).join('');
      return `
      <details class="rm-project" data-i="${i}" ${i === 0 ? 'open' : ''}>
        <summary>
          <div class="rm-head">
            <div class="rm-title">
              <span class="rm-kicker">${esc(p.client || '')}</span>
              <h2>${esc(p.name)}</h2>
              <div class="rm-tags">${(p.categories || []).map(c => `<span class="rm-tag">${esc(c)}</span>`).join('') || '<span class="rm-tag muted">Type to be added</span>'}</div>
            </div>
            <div class="rm-meta">
              ${pill(p.status)}
              ${books.length ? `<div class="rm-progress" title="${done} of ${books.length} books done"><i style="width:${pct}%"></i></div><small>${done}/${books.length} books done</small>` : ''}
            </div>
            <span class="rm-chev" aria-hidden="true"></span>
          </div>
        </summary>
        <div class="rm-project-body">
          ${p.summary ? `<p class="rm-summary">${esc(p.summary)}</p>` : ''}
          ${seriesHTML ? `<h3 class="rm-sub">Series &amp; books</h3><div class="rm-series-list">${seriesHTML}</div>` : ''}
          ${ms.length ? `<h3 class="rm-sub">Milestones</h3><ul class="rm-milestones">${ms.map(m =>
            `<li class="${m.done ? 'done' : ''}"><span class="box">${m.done ? '✓' : ''}</span><span>${esc(m.label)}</span>${m.due ? `<small>${esc(m.due)}</small>` : ''}</li>`).join('')}</ul>` : ''}
          ${(p.checklist || []).length ? `<h3 class="rm-sub">${esc(p.checklistTitle || 'Checklist')}</h3><ul class="rm-milestones rm-check">${p.checklist.map((m, k) =>
            `<li class="${m.done ? 'done' : ''}"><span class="box">${m.done ? '✓' : k + 1}</span><span>${fmt(m.label)}</span></li>`).join('')}</ul>` : ''}
          ${p.notes ? `<h3 class="rm-sub">Notes</h3><p class="rm-notes">${fmt(p.notes)}</p>` : ''}
          ${!seriesHTML && !ms.length && !p.notes ? '<p class="tba">Plan details will be added here.</p>' : ''}
        </div>
      </details>`;
    }

    function draw() {
      const list = projects.map((p, i) => ({ p, i })).filter(({ p }) =>
        (tab === 'All' || (p.categories || []).includes(tab)) &&
        (!q || JSON.stringify(p).toLowerCase().includes(q)));
      $('rm-list').innerHTML = list.length ? list.map(({ p, i }) => projectHTML(p, i)).join('')
        : '<div class="empty">No projects match. Try another tab or search.</div>';
      if (q) document.querySelectorAll('#rm-list details').forEach(d => d.open = true);
    }
    draw();
  }

  function open(data) {
    $('gate').hidden = true;
    $('rm-main').hidden = false;
    render(data);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const form = $('gate-form'), input = $('gate-code'), msg = $('gate-msg'), btn = $('gate-btn');
    if (!window.crypto || !crypto.subtle) { msg.textContent = 'Your browser cannot open this page. Please update it or try another browser.'; return; }
    const saved = sessionStorage.getItem(CODE_KEY);
    if (saved) { try { open(await decrypt(window.ROADMAP_ENC, saved)); return; } catch (e) {} }
    input.focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      msg.textContent = ''; btn.disabled = true; btn.textContent = 'Checking…';
      const raw = input.value;
      const tries = [...new Set([raw, raw.trim(), raw.trim().replace(/\.+$/, '')])];
      let data = null, used = null;
      for (const t of tries) { try { data = await decrypt(window.ROADMAP_ENC, t); used = t; break; } catch (err) {} }
      btn.disabled = false; btn.textContent = 'Unlock';
      if (!data) {
        msg.textContent = 'That code is not correct. Codes are case sensitive.';
        const card = document.querySelector('.gate-card');
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        input.select();
        return;
      }
      sessionStorage.setItem(CODE_KEY, used);
      open(data);
    });
  });
})();
