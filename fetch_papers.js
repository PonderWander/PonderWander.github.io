// fetch_papers.js
// Run with: node fetch_papers.js
// Requires Node 18+ (built-in fetch) — no dependencies needed

const SSRN_AUTHOR_ID = '10215177'; // replace with your SSRN author ID
const RSS_URL        = `https://api.ssrn.com/content/v1/authors/${SSRN_AUTHOR_ID}/papers/rss`;
const OUTPUT_FILE    = './papers.json';
const SUMMARY_LENGTH = 280; // chars before abstract is split into summary/full

import { writeFileSync } from 'fs';
import { parseString }   from 'xml2js'; // not used — we parse manually below

// ── FETCH ──────────────────────────────────────────────────────────────────
async function fetchRSS(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

// ── PARSE ──────────────────────────────────────────────────────────────────
// Manual XML parsing — no dependencies required
function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m  = xml.match(re);
  return m ? decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1').trim()) : '';
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, '') // strip any inline HTML tags
    .trim();
}

function formatDate(pubDate) {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function splitAbstract(abstract, maxLen) {
  if (abstract.length <= maxLen) return { summary: abstract, full: '' };
  // split at last word boundary before maxLen
  const cut   = abstract.lastIndexOf(' ', maxLen);
  const split = cut > 0 ? cut : maxLen;
  return {
    summary: abstract.slice(0, split),
    full:    abstract.slice(split).trim()
  };
}

function parseItems(xml) {
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  const papers = [];
  let match;

  while ((match = itemRe.exec(xml)) !== null) {
    const block    = match[1];
    const title    = extractTag(block, 'title');
    const link     = extractTag(block, 'link')
                     || extractTag(block, 'guid');
    const abstract = extractTag(block, 'description');
    const pubDate  = extractTag(block, 'pubDate');

    if (!title || !link) continue;

    const { summary, full } = splitAbstract(abstract, SUMMARY_LENGTH);

    papers.push({ title, url: link, summary, full, date: formatDate(pubDate) });
  }

  return papers;
}

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Fetching SSRN RSS for author ${SSRN_AUTHOR_ID}...`);
  const xml     = await fetchRSS(RSS_URL);
  const papers  = parseItems(xml);

  if (!papers.length) {
    console.warn('No papers found in feed — check your SSRN_AUTHOR_ID');
    process.exit(1);
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(papers, null, 2));
  console.log(`Wrote ${papers.length} paper(s) to ${OUTPUT_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
