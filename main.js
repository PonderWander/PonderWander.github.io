// ── INTERSECTION OBSERVER — fade-up animations ────────────────────────────
function observeFadeUp(el) {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const visiblePeers = Array.from(
        document.querySelectorAll('.fade-up:not(.visible)')
      ).filter(peer => {
        const r = peer.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0;
      });
      const delay = Math.max(0, visiblePeers.indexOf(entry.target)) * 80;
      setTimeout(() => entry.target.classList.add('visible'), delay);
      obs.disconnect();
    });
  }, { threshold: 0.05 });
  obs.observe(el);
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.fade-up').forEach(el => observeFadeUp(el));
});

// ── MOBILE NAV ────────────────────────────────────────────────────────────
function toggleMobileNav() {
  const menu = document.getElementById('navMobileMenu');
  const btn  = document.getElementById('navHamburger');
  if (!menu || !btn) return;
  menu.classList.toggle('open');
  btn.classList.toggle('open');
}
function closeMobileNav() {
  const menu = document.getElementById('navMobileMenu');
  const btn  = document.getElementById('navHamburger');
  if (menu) menu.classList.remove('open');
  if (btn)  btn.classList.remove('open');
}
document.addEventListener('click', e => {
  const nav = document.querySelector('nav');
  if (nav && !nav.contains(e.target)) closeMobileNav();
});

// ── PAPER PAGINATION ─────────────────────────────────────────────────────
const PAPERS_PER_PAGE = 4;
let paperCurrentPage  = 0;
let allPapers         = []; // populated from papers.json

// Build a paper-item DOM element from a paper object
function buildPaperItem(paper) {
  const item = document.createElement('div');
  item.className = 'paper-item fade-up';

  const hasFull   = paper.full && paper.full.trim().length > 0;
  const metaDate  = paper.date ? ` · ${paper.date}` : '';

  item.innerHTML = `
    <div>
      <div class="paper-meta">SSRN${metaDate}</div>
      <div class="paper-title">${paper.title}</div>
      <details class="abstract-body">
        <summary>${paper.summary || paper.title}</summary>${hasFull
          ? `<p>${paper.full}<span class="abstract-less" onclick="this.closest('details').removeAttribute('open')"> less</span></p>`
          : ''}
      </details>
      <a href="${paper.url}" class="paper-link" target="_blank">Read on SSRN ↗</a>
    </div>`;

  return item;
}

function renderPage(page) {
  const list       = document.getElementById('paperList');
  const pagination = document.getElementById('paperPagination');
  const totalPages = Math.ceil(allPapers.length / PAPERS_PER_PAGE);

  page = Math.max(0, Math.min(page, totalPages - 1));
  paperCurrentPage = page;

  // remove loading indicator and any existing items
  const loading = document.getElementById('paperLoading');
  if (loading) loading.remove();
  list.querySelectorAll('.paper-item').forEach(el => el.remove());

  // render current page slice
  const slice = allPapers.slice(page * PAPERS_PER_PAGE, (page + 1) * PAPERS_PER_PAGE);
  slice.forEach(paper => {
    const el = buildPaperItem(paper);
    list.appendChild(el);
    observeFadeUp(el);
  });

  // update controls
  const label = document.getElementById('paperPageLabel');
  const prev  = document.getElementById('paperPrev');
  const next  = document.getElementById('paperNext');
  if (label) label.textContent = `${page + 1} / ${totalPages}`;
  if (prev)  prev.disabled  = page === 0;
  if (next)  next.disabled  = page === totalPages - 1;

  // show pagination only if needed
  if (pagination) pagination.style.display = totalPages > 1 ? 'flex' : 'none';
}

function paperPage(dir) {
  renderPage(paperCurrentPage + dir);
  const section = document.getElementById('research');
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadPapers() {
  try {
    const res  = await fetch('./papers.json');
    if (!res.ok) throw new Error(`papers.json not found (${res.status})`);
    allPapers  = await res.json();
    renderPage(0);
  } catch (err) {
    // papers.json not yet generated — leave static fallback HTML in place
    // and init pagination from whatever paper-items are already in the DOM
    console.info('papers.json not available, using static fallback:', err.message);
    const staticItems = Array.from(document.querySelectorAll('#paperList .paper-item'));
    if (!staticItems.length) return;
    // convert static items to data so pagination still works
    allPapers = staticItems.map(el => ({ _el: el }));
    renderPage(0);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadPapers();
});
