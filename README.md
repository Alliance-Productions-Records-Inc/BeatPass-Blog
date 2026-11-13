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

## Blog analytics and consent

The active `content/themes/aspect/` theme loads GA4 `G-5K99X60DF6` on both
base layouts. `partials/beatpass-consent-head.hbs` loads
`assets/beatpass-consent.js` synchronously before `ghost_head`; keep this order
and do not add a second GA tag through Ghost Code Injection. All pageviews use
`content_group: "blog"` and the shared `beatpass.ca` GA cookie domain.

The script uses [Google Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent)
in advanced mode: all four consent types default to denied before gtag.js is
loaded, allowing cookieless measurement. A stored `bp_consent=granted` choice
is restored before GA configuration; a stored denial keeps storage disabled.
The shared choice cookie has `Domain=.beatpass.ca`, `Path=/`, `SameSite=Lax`,
`Secure` on HTTPS, and an expiry six months after a choice. No local-storage
copy of the consent or analytics identifiers is created.

`partials/beatpass-consent-notice.hbs` and `assets/beatpass-consent.css` provide
the initial notice, equal Accept/Refuse buttons, and the existing privacy-policy
link. Footer **Privacy preferences** controls reopen the notice. Refusing after
a grant updates consent, clears visible GA cookies at the shared and blog host
scopes, and reloads; returning tabs also check for shared consent changes.

These integration files are explicitly allowed through `.gitignore`; other CMS
content and theme vendor assets stay ignored. Keep the integration when updating
the Aspect theme, and refresh Ghost's theme cache through the normal Ghost
restart/deployment process after changing templates. There is no asset build step.

## Public repository boundaries

Keep CMS content, unpublished editorial sources, planning reports, local agent
settings, database exports, and credential files out of Git. These are ignored;
production configuration and `.env` remain local because the running site needs
them. `.env.example` contains placeholders only.

Before publishing changes, review `git diff --cached` and `git status --short`.
Ignore rules do not remove material from earlier commits. If a credential is
exposed, revoke or rotate it and arrange a separate history cleanup.
