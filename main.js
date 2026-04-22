window.addEventListener('DOMContentLoaded', () => {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 90);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 0px 0px' });
  document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));

  // Fallback: make any .fade-up elements already in the viewport visible immediately
  setTimeout(() => {
    document.querySelectorAll('.fade-up:not(.visible)').forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setTimeout(() => el.classList.add('visible'), i * 90);
      }
    });
  }, 200);
});

// ─── SSRN PAPER LOADER ───────────────────────────────────────────────────────

const SSRN_AUTHOR_URL = 'https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=YOURID';
const ABSTRACT_CHAR_LIMIT = 280;
const PAGE_SIZE = 3;

let allPapers = [];
let shownCount = 0;

async function proxyFetch(url) {
  const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
  const data = await res.json();
  return data.contents;
}

function parseAbstract(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector('.abstract-text p') || doc.querySelector('.abstract-text');
  return el ? el.textContent.trim() : '';
}

async function fetchAbstract(paperUrl) {
  try {
    const html = await proxyFetch(paperUrl);
    return parseAbstract(html);
  } catch { return ''; }
}

function extractDate(row) {
  const meta = row.querySelector('.note.note-list');
  if (!meta) return '';
  const text = meta.textContent;
  const match = text.match(/(\w+ \d{4})/);
  return match ? match[1] : '';
}

function renderPaper(paper, idx) {
  const abstract = paper.abstract || '';
  const isLong = abstract.length > ABSTRACT_CHAR_LIMIT;
  const shortText = isLong ? abstract.slice(0, ABSTRACT_CHAR_LIMIT).trimEnd() + '...' : abstract;
  const uid = `paper-${idx}`;

  const item = document.createElement('div');
  item.className = 'paper-item fade-up';
  item.innerHTML = `
    <div>
      <div class="paper-meta">SSRN${paper.date ? ' · ' + paper.date : ''}</div>
      <div class="paper-title">${paper.title}</div>
      <div class="abstract-body" id="abs-${uid}">
        ${abstract ? `
          <span class="abstract-short" id="short-${uid}">${shortText}</span>
          ${isLong ? `
            <button class="abstract-toggle" id="toggle-${uid}" onclick="toggleAbstract('${uid}')">...more</button>
            <span class="abstract-full" id="full-${uid}">${abstract}
              <button class="abstract-toggle" onclick="toggleAbstract('${uid}')" style="display:inline;margin-left:6px;">less</button>
            </span>
          ` : ''}
        ` : '<span style="color:var(--dim);font-size:11px;">No abstract available.</span>'}
      </div>
      <a href="${paper.url}" class="paper-link" target="_blank">Read on SSRN ↗</a>
    </div>`;
  return item;
}

function toggleAbstract(uid) {
  const shortEl  = document.getElementById(`short-${uid}`);
  const fullEl   = document.getElementById(`full-${uid}`);
  const toggleEl = document.getElementById(`toggle-${uid}`);
  const isExpanded = fullEl.style.display === 'inline';
  shortEl.style.display  = isExpanded ? 'inline' : 'none';
  fullEl.style.display   = isExpanded ? 'none'   : 'inline';
  if (toggleEl) toggleEl.style.display = isExpanded ? 'inline' : 'none';
}

function showMorePapers() {
  const list = document.getElementById('paperList');
  const next = allPapers.slice(shownCount, shownCount + PAGE_SIZE);
  next.forEach((p, i) => {
    const el = renderPaper(p, shownCount + i);
    list.appendChild(el);
    requestAnimationFrame(() => setTimeout(() => el.classList.add('visible'), i * 100));
  });
  shownCount += next.length;
  updateControls();
}

function updateControls() {
  const btn   = document.getElementById('showMoreBtn');
  const label = document.getElementById('paperCountLabel');
  const remaining = allPapers.length - shownCount;
  btn.style.display = remaining > 0 ? 'inline-flex' : 'none';
  label.textContent = `Showing ${shownCount} of ${allPapers.length} papers`;
}

async function loadSSRNPapers() {
  const list    = document.getElementById('paperList');
  const loading = document.getElementById('paperLoading');
  const errEl   = document.getElementById('paperError');

  try {
    const html = await proxyFetch(SSRN_AUTHOR_URL);
    const doc  = new DOMParser().parseFromString(html, 'text/html');

    const rows = Array.from(
      doc.querySelectorAll('div.table.papers-list > div[class*="trow abs abs_"]')
    );

    if (!rows.length) throw new Error('No papers found');

    // collect titles + urls first, then fetch abstracts in parallel
    const paperMeta = rows.map(row => {
      const anchor = row.querySelector('h3 a.title');
      if (!anchor) return null;
      const title = anchor.textContent.trim();
      const href  = anchor.getAttribute('href');
      const url   = href.startsWith('http') ? href : 'https://papers.ssrn.com' + href;
      const date  = extractDate(row);
      return { title, url, date };
    }).filter(Boolean);

    loading.textContent = `Loading abstracts for ${paperMeta.length} papers...`;

    const withAbstracts = await Promise.all(
      paperMeta.map(async p => ({
        ...p,
        abstract: await fetchAbstract(p.url)
      }))
    );

    allPapers = withAbstracts;
    loading.remove();

    // render first page
    const firstBatch = allPapers.slice(0, PAGE_SIZE);
    firstBatch.forEach((p, i) => {
      const el = renderPaper(p, i);
      list.appendChild(el);
      requestAnimationFrame(() => setTimeout(() => el.classList.add('visible'), i * 120));
    });
    shownCount = firstBatch.length;
    updateControls();

  } catch (err) {
    loading.remove();
    errEl.style.display = 'block';
    console.warn('SSRN fetch failed:', err);
  }
}

loadSSRNPapers();
