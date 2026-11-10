// ===== Site settings =====
const SITE = {
  email: 'pletheonmedianetwork@gmail.com',
};

const COLORS = ['#1d4ed8', '#0b1220', '#2563eb', '#1e293b', '#3b82f6', '#172554', '#1e40af', '#0f172a', '#0284c7', '#334155', '#1e3a8a'];

function genreColor(genre, list) {
  const i = list.indexOf(genre);
  return COLORS[(i < 0 ? 0 : i) % COLORS.length];
}

function genreCounts() {
  if (typeof GENRE_BLURB !== 'undefined') return Object.keys(GENRE_BLURB).map(g => [g, 0]);
  const counts = {};
  (window.BOOKS || []).forEach(b => { counts[b.genre] = (counts[b.genre] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function coveredBooks() {
  return (window.BOOKS || []).filter(b => b.cover);
}

function mailto(subject, body) {
  return `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const GENRE_BLURB = {
  'Spiritual, Esoteric & Religion': 'Faith, metaphysics, energy work',
  'Mental Health & Therapy': 'RSD, DBT, CBT, ADHD, trauma',
  'Self-Help & Mindset': 'Habits, discipline, confidence',
  'Technical & Engineering': 'Manuals, handbooks, textbooks',
  'Communication & Influence': 'Speaking, rapport, persuasion',
  'Health & Medicine': 'Metabolic health, sleep, longevity',
  'Society, History & Current Affairs': 'History, tech, culture',
  'Business, Money & Career': 'Wealth, leadership, careers',
  'Lifestyle & Practical How-To': 'Home, hobbies, practical skills',
  'Exam / Study Guide': 'Certification and exam prep',
  "Reader's Companion": 'Book club and study guides',
};

document.addEventListener('DOMContentLoaded', () => {
  // mobile menu
  const btn = document.querySelector('.menu-btn');
  const nav = document.querySelector('.nav');
  if (btn && nav) {
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  document.querySelectorAll('.js-year').forEach(el => { el.textContent = new Date().getFullYear(); });
  document.querySelectorAll('.js-email').forEach(el => { el.textContent = SITE.email; el.href = `mailto:${SITE.email}`; });

  // Genre tiles come from the fixed list below, not from the book data,
  // so the homepage shows all 11 genres even though the store lists only a few books.
  const genres = Object.keys(GENRE_BLURB).map(g => [g]);
  const genreNames = Object.keys(GENRE_BLURB);
  const covers = coveredBooks();
  const pick = (title) => covers.find(b => b.title.startsWith(title)) || covers[0];

  // hero cover stack
  const stack = document.getElementById('hero-covers');
  if (stack && covers.length) {
    const chosen = [pick('How to Use Chinese'), pick('How to Read the Lunar'), pick('How to Have Conversations with God')];
    stack.insertAdjacentHTML('afterbegin', chosen.map(b => `<img src="${b.cover}" alt="${b.title}">`).join(''));
  }
  const mini = document.getElementById('mini-covers');
  if (mini && covers.length) {
    mini.innerHTML = [pick('How to Control'), pick('How to Connect'), pick('Critique')].map(b => `<img src="${b.cover}" alt="">`).join('');
  }
  const pa = document.getElementById('promo-a-img'); if (pa && covers.length) pa.src = pick('How to Interact').cover;
  const pb = document.getElementById('promo-b-img'); if (pb && covers.length) pb.src = pick('Practical Handbook').cover;

  // genre collection tiles (no titles, just genres)
  const coll = document.getElementById('collection');
  if (coll) {
    coll.innerHTML = genres.map(([g]) =>
      `<a class="coll" href="books.html" style="background:${genreColor(g, genreNames)}"><b>${g}</b><span>${GENRE_BLURB[g] || ''}</span></a>`).join('');
  }

  // ===== theme toggle (white & blue / black & blue) =====
  document.querySelectorAll('.theme-toggle').forEach(t => t.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('pmn-theme', next); } catch (e) {}
  }));

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== hero headline: words rise in one by one =====
  const h1 = document.querySelector('.hero h1');
  if (h1 && !reduce) {
    let i = 0;
    const wrapWords = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span');
            s.className = 'w'; s.textContent = part; s.style.animationDelay = `${0.1 + i++ * 0.08}s`;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          if (n.classList.contains('accent')) { n.classList.add('w'); n.style.animationDelay = `${0.1 + i++ * 0.08}s`; }
          else wrapWords(n);
        }
      });
    };
    wrapWords(h1);
    document.querySelectorAll('.hero .lead, .hero .hero-actions, .hero .hero-proof, .hero .eyebrow, .cover-stack').forEach((el, k) => {
      el.classList.add('fade-in'); el.style.animationDelay = `${0.5 + k * 0.12}s`;
    });
  }

  // ===== scroll reveal =====
  const revealSel = ['.section-head', '.bento .tile', '.stats .stat', '.steps .step', '.collection .coll', '.audience .aud', '.promo', 'form.inquiry', '.contact-points li', '.perks .perk', '.book', '.banner', '.head-row > a'];
  const groups = new Map();
  document.querySelectorAll(revealSel.join(',')).forEach(el => {
    if (el.closest('.hero')) return;
    const parent = el.parentElement;
    const idx = groups.get(parent) || 0;
    groups.set(parent, idx + 1);
    el.classList.add('reveal');
    el.style.setProperty('--d', `${Math.min(idx, 8) * 0.08}s`);
  });
  const counters = document.querySelectorAll('[data-count]');
  const countUp = el => {
    const target = +el.dataset.count, dur = 1600, t0 = performance.now();
    const step = t => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (reduce || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    const co = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      countUp(e.target); co.unobserve(e.target);
    }), { threshold: 0.6 });
    counters.forEach(el => { el.textContent = '0'; co.observe(el); });
  }

  // service inquiry form
  const form = document.getElementById('inquiry');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const body = `Name: ${d.name}\nEmail: ${d.email}\nI am a: ${d.type}\nNumber of books: ${d.count}\nServices needed: ${d.service}\n\nProject details:\n${d.message || ''}`;
      window.location.href = mailto(`Book project inquiry from ${d.name}`, body);
    });
  }
});
