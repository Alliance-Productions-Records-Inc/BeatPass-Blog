#!/usr/bin/env node
'use strict';

// Dry run by default. Only removes offline copies verified as published in Ghost,
// rotated logs older than 30 days, and video temporary files older than 7 days.
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
require('./load-env');
const root = path.resolve(__dirname, '..');

function articleSlug(markdown) {
  const metadata = markdown.match(/<!--\s*GHOST METADATA\b([\s\S]*?)-->/);
  return metadata?.[1].match(/^Slug:\s*([a-z0-9-]+)\s*$/m)?.[1];
}

async function publishedSlugs(resource) {
  const slugs = new Set();
  let page = 1;
  do {
    const token = jwt.sign({}, Buffer.from(process.env.GHOST_ADMIN_KEY_SECRET, 'hex'), {
      keyid: process.env.GHOST_ADMIN_KEY_ID, algorithm: 'HS256', expiresIn: '5m', audience: '/admin/'
    });
    const query = new URLSearchParams({ filter: 'status:published', fields: 'slug,status', limit: '100', page: String(page) });
    const response = await fetch(`${process.env.GHOST_URL}/ghost/api/admin/${resource}/?${query}`, {
      headers: { Authorization: `Ghost ${token}` }, signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`Ghost ${resource} inventory failed: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data[resource]) || !data.meta?.pagination) throw new Error('Invalid Ghost inventory');
    for (const item of data[resource]) if (item.status === 'published') slugs.add(item.slug);
    page = data.meta.pagination.next;
  } while (page);
  return slugs;
}

async function main() {
  const apply = process.argv.includes('--apply');
  for (const key of ['GHOST_URL', 'GHOST_ADMIN_KEY_ID', 'GHOST_ADMIN_KEY_SECRET']) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
  // Fetch both inventories before touching any file; failed requests abort cleanup.
  const posts = await publishedSlugs('posts');
  const pages = await publishedSlugs('pages');
  const candidates = [];
  function collect(relative, eligible) {
    const dir = path.join(root, relative);
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue; // Never follow symlinks or descend into uploads.
      const file = path.join(dir, entry.name);
      const stat = fs.lstatSync(file);
      if (stat.isFile() && eligible(entry.name, stat, file)) candidates.push({ file, bytes: stat.size });
    }
  }
  collect('content/offline-articles', (name, stat, file) => {
    if (!name.endsWith('.md')) return false;
    const slug = articleSlug(fs.readFileSync(file, 'utf8'));
    return Boolean(slug && (posts.has(slug) || pages.has(slug)));
  });
  collect('content/logs', (name, stat) => /\.log\.\d+(?:\.gz)?$/.test(name) && Date.now() - stat.mtimeMs > 30 * 86400000);
  collect('scripts/video-tmp', (name, stat) => Date.now() - stat.mtimeMs > 7 * 86400000);
  let bytes = 0;
  for (const item of candidates) {
    console.log(`${apply ? 'Removing' : 'Would remove'} ${path.relative(root, item.file)} (${item.bytes} bytes)`);
    if (apply) fs.unlinkSync(item.file);
    bytes += item.bytes;
  }
  console.log(`${apply ? 'Removed' : 'Found'} ${candidates.length} files; ${(bytes / 1024 / 1024).toFixed(2)} MiB. ${apply ? '' : 'Use --apply to remove.'}`);
}

module.exports = { articleSlug };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
