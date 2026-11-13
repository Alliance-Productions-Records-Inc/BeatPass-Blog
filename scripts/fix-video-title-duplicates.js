#!/usr/bin/env node

// Correct generated "Beat Beat" titles on video posts without changing their URLs.
// Dry run by default. Usage: node scripts/fix-video-title-duplicates.js [--apply]

const jwt = require('jsonwebtoken');
require('./load-env');
const apply = process.argv.includes('--apply');

function token() {
  return jwt.sign({}, Buffer.from(process.env.GHOST_ADMIN_KEY_SECRET, 'hex'), {
    keyid: process.env.GHOST_ADMIN_KEY_ID,
    algorithm: 'HS256', expiresIn: '5m', audience: '/admin/'
  });
}

async function api(method, endpoint, body) {
  const response = await fetch(`${process.env.GHOST_URL}/ghost/api/admin/${endpoint}`, {
    method,
    headers: { Authorization: `Ghost ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.errors?.[0]?.message || JSON.stringify(data)}`);
  return data;
}

async function main() {
  const posts = (await api('GET', 'posts/?limit=all&include=tags')).posts;
  const affected = posts.filter(post =>
    /\bBeat Beat\b/i.test(post.title) &&
    post.tags?.some(tag => tag.name === '#video' || tag.slug === 'hash-video')
  );
  for (const post of affected) {
    const corrected = post.title.replace(/\bBeat Beat\b/gi, 'Beat');
    if (!apply) {
      console.log(`WOULD UPDATE ${post.status} ${post.slug}: ${corrected}`);
      continue;
    }
    const update = {
      title: corrected,
      updated_at: post.updated_at,
      codeinjection_head: post.codeinjection_head?.replace(/\bBeat Beat\b/gi, 'Beat') || null
    };
    if (post.meta_title?.includes('Beat Beat')) update.meta_title = post.meta_title.replace(/\bBeat Beat\b/gi, 'Beat');
    if (post.meta_description?.includes('Beat Beat')) update.meta_description = post.meta_description.replace(/\bBeat Beat\b/gi, 'Beat');
    if (post.custom_excerpt?.includes('Beat Beat')) update.custom_excerpt = post.custom_excerpt.replace(/\bBeat Beat\b/gi, 'Beat');
    const result = await api('PUT', `posts/${post.id}/`, { posts: [update] });
    if (result.posts[0].slug !== post.slug || result.posts[0].status !== post.status || result.posts[0].published_at !== post.published_at) {
      throw new Error(`Video identity, status or schedule changed unexpectedly: ${post.slug}`);
    }
    console.log(`UPDATED ${post.status} ${post.slug}: ${corrected}`);
  }
  console.log(`${apply ? 'Updated' : 'Would update'} ${affected.length} video titles`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
