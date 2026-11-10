function initStore() {
  // Only books with a real cover are listed. To list everything again, set this to false.
  const COVERED_ONLY = false;
  const books = (window.BOOKS || []).map((b, i) => ({ ...b, id: i })).filter(b => !COVERED_ONLY || b.cover);
  const genreNames = genreCounts().map(g => g[0]);
  const state = { q: '', genre: 'All', sort: 'new' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const newest = [...books].sort((a, b) => b.id - a.id);
  const NEW_IDS = new Set(newest.slice(0, 4).map(b => b.id));

  // banner covers
  const bc = $('banner-covers');
  if (bc) bc.innerHTML = newest.filter(b => b.cover).slice(0, 3).map(b => `<img src="${esc(b.cover)}" alt="${esc(b.title)}">`).join('');

  // featured rail
  const rail = $('rail');
  rail.innerHTML = newest.filter(b => b.cover).map(b => `
    <button class="rail-item" type="button" data-id="${b.id}">
      <img src="${esc(b.cover)}" alt="Cover of ${esc(b.title)}" loading="lazy">
      <span>${esc(b.title)}</span>
      <small>${esc(b.author || '')}</small>
    </button>`).join('');
  document.querySelectorAll('.rail-btns button').forEach(btn =>
    btn.addEventListener('click', () => rail.scrollBy({ left: +btn.dataset.dir * 340, behavior: 'smooth' })));

  // genre chips
  const counts = {};
  books.forEach(b => { counts[b.genre] = (counts[b.genre] || 0) + 1; });
  const chips = $('chips');
  chips.innerHTML = [['All', books.length], ...Object.entries(counts).sort((a, b) => b[1] - a[1])].map(([g, n]) =>
    `<button class="chip" data-genre="${esc(g)}" aria-pressed="${g === 'All'}">${esc(g)} · ${n}</button>`).join('');
  chips.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state.genre = b.dataset.genre;
    chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    render();
  });
  $('q').addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); render(); });
  $('sort').addEventListener('change', e => { state.sort = e.target.value; render(); });

  // banner search jumps to the grid
  $('banner-search').addEventListener('submit', e => {
    e.preventDefault();
    const v = e.target.querySelector('input').value;
    $('q').value = v; state.q = v.trim().toLowerCase(); render();
    $('all').scrollIntoView({ behavior: 'smooth' });
  });

  function render() {
    let list = books.filter(b =>
      (state.genre === 'All' || b.genre === state.genre) &&
      (!state.q || `${b.title} ${b.subtitle} ${b.author}`.toLowerCase().includes(state.q)));
    list = state.sort === 'az' ? list.sort((a, b) => a.title.localeCompare(b.title)) : list.sort((a, b) => b.id - a.id);
    $('count').textContent = `Showing ${list.length} book${list.length === 1 ? '' : 's'}`;
    $('grid').innerHTML = list.length ? list.map(b => `
      <article class="book">
        <div class="shot">
          ${NEW_IDS.has(b.id) ? '<span class="badge">NEW</span>' : ''}
          ${b.cover
            ? `<img class="cover-img" src="${esc(b.cover)}" alt="Cover of ${esc(b.title)}" loading="lazy">`
            : `<div class="cover" style="background:${genreColor(b.genre, genreNames)}"><span class="c-genre">${esc(b.genre)}</span><span class="c-title">${esc(b.title)}</span><span class="c-author">${esc(b.author || '')}</span></div>`}
        </div>
        <div class="book-body">
          <span class="genre">${esc(b.genre.split(/[,&]/)[0].trim())}</span>
          <h3>${esc(b.title)}</h3>
          ${b.author ? `<span class="by">by ${esc(b.author)}</span>` : ''}
          ${b.subtitle ? `<span class="sub">${esc(b.subtitle)}</span>` : ''}
          <div class="actions">
            <span class="fmt">Paperback · Ebook</span>
            <button class="btn btn-primary btn-sm" data-id="${b.id}">Order</button>
          </div>
        </div>
      </article>`).join('')
      : '<div class="empty">No books match your search. Try another word or genre.</div>';
  }

  // order dialog
  const dlg = $('order');
  const form = $('order-form');
  let current = null;
  function openOrder(id) {
    current = books.find(x => x.id === id);
    if (!current) return;
    $('order-title').textContent = current.title;
    $('order-author').textContent = current.author ? `by ${current.author}` : '';
    const img = $('order-cover');
    if (current.cover) { img.src = current.cover; img.style.display = ''; } else { img.style.display = 'none'; }
    dlg.showModal();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-id]');
    if (b && (b.closest('#grid') || b.closest('#rail'))) openOrder(+b.dataset.id);
  });
  form.addEventListener('submit', e => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    const d = Object.fromEntries(new FormData(form));
    const body = `Book: ${current.title}${current.subtitle ? ': ' + current.subtitle : ''}\nAuthor: ${current.author || '-'}\nFormat: ${d.format}\nQuantity: ${d.qty}\n\nName: ${d.name}\nEmail: ${d.email}\n\n${d.message || ''}`;
    window.location.href = mailto(`Order inquiry: ${current.title}`, body);
    dlg.close();
  });

  document.querySelectorAll('.js-bulk').forEach(a => {
    a.href = mailto('Bulk book order inquiry', 'Organization:\nBooks / genres of interest:\nApprox. quantity:\nShipping country:\n');
  });

  render();
}

// ===== Access-code lock =====
// The book list is stored encrypted (AES-256-GCM, key derived from the access code with PBKDF2).
// The code itself is never stored in the site; a wrong code simply fails to decrypt.
(function () {
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function unlock(code) {
    const enc = window.BOOKS_ENC;
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  function open(books) {
    window.BOOKS = books;
    document.getElementById('gate').hidden = true;
    document.getElementById('store-main').hidden = false;
    initStore();
  }
  document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('gate-form');
    const input = document.getElementById('gate-code');
    const msg = document.getElementById('gate-msg');
    const btn = document.getElementById('gate-btn');
    if (!window.crypto || !crypto.subtle) {
      msg.textContent = 'Your browser cannot open the bookstore. Please update it or try another browser.';
      return;
    }
    // Stay unlocked for this browser tab after a correct code.
    const saved = sessionStorage.getItem('pmn-store-code');
    if (saved) {
      try { open(await unlock(saved)); return; } catch (e) { sessionStorage.removeItem('pmn-store-code'); }
    }
    input.focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      msg.textContent = '';
      btn.disabled = true; btn.textContent = 'Checking…';
      // Phone keyboards often add a space (or a full stop) after a word.
      // Letters stay case sensitive; only stray spaces and a trailing "." are ignored.
      const raw = input.value;
      const tries = [...new Set([raw, raw.trim(), raw.trim().replace(/\.+$/, '')])];
      let books = null, used = null;
      for (const t of tries) {
        try { books = await unlock(t); used = t; break; } catch (e) {}
      }
      try {
        if (!books) throw new Error('wrong code');
        sessionStorage.setItem('pmn-store-code', used);
        open(books);
      } catch (err) {
        msg.textContent = 'That code is not correct. Codes are case sensitive.';
        const card = document.querySelector('.gate-card');
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        input.select();
      } finally {
        btn.disabled = false; btn.textContent = 'Unlock';
      }
    });
  });
})();
