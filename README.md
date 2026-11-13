# BeatPass Blog

Infrastructure, automation scripts, and configuration for the BeatPass blog — powered by [Ghost CMS](https://ghost.org).

**https://blog.beatpass.ca**

---

## Overview

This repository contains the server-side tooling that powers the BeatPass blog, including content deployment pipelines, scheduling automation, YouTube-to-blog synchronization, and SEO configuration.

### Repository Structure

```
.
├── scripts/               # Automation and deployment scripts
│   ├── deploy-content.js  # Bulk content deployment to Ghost
│   ├── schedule-drafts.js # Intelligent post scheduling
│   ├── youtube-sync.js    # YouTube → Ghost video sync pipeline
│   ├── video-api.js       # Video export API server
│   └── load-env.js        # Environment variable loader
├── .env.example           # Environment variable template
├── robots.txt             # Search engine configuration
├── start.js               # Ghost CMS entry point
└── package.json           # Project metadata
```

## Setup

1. Clone the repository into your Ghost installation directory.
2. Copy `.env.example` to `.env` and fill in your credentials.
3. Install script dependencies:
   ```bash
   cd scripts && npm install
   ```
4. Configure Ghost as normal via `ghost-cli`.

## Related

- **[BeatPass Content Designer](https://github.com/alliancewav/BeatPass-ContentDesigner)** — Slide and visual content generation tool for blog articles.
- **[BeatPass](https://beatpass.ca)** — The beat licensing platform.

---

## License

This is proprietary software. All rights reserved by **Alliance Productions Records Inc.**

No part of this repository may be copied, modified, distributed, or reused in any form without explicit written permission. See [LICENSE](./LICENSE) for full terms.

## Contact

Alliance Productions Records Inc.
Email: contact.alliancewav@gmail.com

## Runtime cleanup

Run `node scripts/cleanup-runtime.js` to preview cleanup, then add `--apply` to
remove verified published copies from `content/offline-articles/`, rotated Ghost
logs older than 30 days, and video temporary files older than seven days. Ghost
must be reachable; an inventory failure aborts cleanup. Drafts, scheduled posts,
editorial source manifests, uploads, and YouTube deduplication state are retained.

Article export defaults to scheduled posts. Use `--include-published` only when
an explicit offline export of published articles is needed.

## Public repository boundaries

Keep CMS content, unpublished editorial sources, planning reports, local agent
settings, database exports, and credential files out of Git. These are ignored;
production configuration and `.env` remain local because the running site needs
them. `.env.example` contains placeholders only.

Before publishing changes, review `git diff --cached` and `git status --short`.
Ignore rules do not remove material from earlier commits. If a credential is
exposed, revoke or rotate it and arrange a separate history cleanup.
