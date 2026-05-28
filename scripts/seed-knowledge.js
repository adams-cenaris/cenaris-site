/**
 * Seed the Cenaris chat knowledge base.
 *
 * Usage:
 *   node scripts/seed-knowledge.js
 *
 * Requires:
 *   SITE_URL     — base URL of your deployed site (or http://localhost:3000 for local)
 *   ADMIN_TOKEN  — JWT from /api/admin/auth (or copy from localStorage after logging in)
 *
 * Run with env vars:
 *   SITE_URL=https://cenaris.com.au ADMIN_TOKEN=eyJ... node scripts/seed-knowledge.js
 */

const fs   = require('fs');
const path = require('path');

const SITE_URL   = process.env.SITE_URL || 'http://localhost:3000';
const TOKEN      = process.env.ADMIN_TOKEN;
const SITE_ROOT  = path.join(__dirname, '..');

if (!TOKEN) {
  console.error('\nERROR: Set ADMIN_TOKEN env var.\n');
  console.error('  1. Go to ' + SITE_URL + '/admin/login and sign in');
  console.error('  2. Open DevTools → Application → Local Storage → copy cenaris-admin-token');
  console.error('  3. Run: SITE_URL=https://cenaris.com.au ADMIN_TOKEN=<token> node scripts/seed-knowledge.js\n');
  process.exit(1);
}

// Pages to index — { file, title, url }
const PAGES = [
  { file: 'index.html',          title: 'Cenaris — Home',                      url: '/' },
  { file: 'about.html',          title: 'About Cenaris',                        url: '/about' },
  { file: 'pricing.html',        title: 'Pricing — Cenaris',                    url: '/pricing' },
  { file: 'partner-with-us.html',title: 'Partner Program — Cenaris',            url: '/partner-with-us' },
  { file: 'contact.html',        title: 'Contact Cenaris',                      url: '/contact' },
  { file: 'roi.html',            title: 'ROI Calculator — Cenaris',             url: '/roi' },
  { file: 'audit-readiness-check.html', title: 'Audit Readiness Check — Cenaris', url: '/audit-readiness-check' },
  { file: 'privacy-policy-tcs.html', title: 'Privacy Policy & T&Cs — Cenaris', url: '/privacy-policy-tcs' },
];

function stripHtml(html) {
  return html
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert block elements to newlines
    .replace(/<\/(p|div|li|h[1-6]|td|tr|section|article|header|footer|nav|aside|main|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&rarr;/g, '→')
    .replace(/&middot;/g, '·')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function seedPage({ file, title, url }) {
  const filePath = path.join(SITE_ROOT, file);
  if (!fs.existsSync(filePath)) {
    console.warn('  SKIP  ' + file + ' (file not found)');
    return;
  }

  const html    = fs.readFileSync(filePath, 'utf8');
  const content = stripHtml(html);

  if (content.length < 50) {
    console.warn('  SKIP  ' + file + ' (too little content after stripping)');
    return;
  }

  const sourceUrl = SITE_URL.replace(/\/$/, '') + url;

  const res = await fetch(SITE_URL + '/api/knowledge/seed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + TOKEN,
    },
    body: JSON.stringify({ title, sourceUrl, content }),
  });

  const data = await res.json();
  if (res.ok) {
    console.log('  OK    ' + file + ' — ' + data.chunksCreated + ' chunks created');
  } else {
    console.error('  FAIL  ' + file + ' — ' + (data.error || res.status));
  }
}

async function main() {
  console.log('\nSeeding knowledge base at ' + SITE_URL + '\n');
  for (const page of PAGES) {
    process.stdout.write('Seeding ' + page.file + '… ');
    await seedPage(page);
  }
  console.log('\nDone. The AI assistant will now use this content to answer questions.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
