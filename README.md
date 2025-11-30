# Site notes — how to add posts and maintain content

This README explains how to add new posts and where to put images/GIFs so the theme behaves as implemented.

## Add a new article

- Create a new Markdown file in `content/posts/`, for example `content/posts/my-story.md`.
- Add front matter at the top of the file with the fields described below. The theme reads these fields to render the homepage and article pages.

## Front matter fields (example)

Use the following fields in each post's front matter — this example matches the theme's expectations:

```yaml
author: "Karthika Namboothiri"
title: "Long Island crash map"
date: "2025-03-27"
source: "Newsday"        # organization name shown as the subhead
tags:
  - demographics
  - spatial analysis
  - interactive graphic
image: "/images/crash-map.png"    # primary static image (required for thumbnail)
image2: "/images/crash-map2.png"  # optional second image used on article page; if missing a default placeholder image is used
gif: "/GIF/crash_map_gif.gif"     # optional GIF used on hover
---

Post body goes below the front matter.
```

Notes:
- The `source` field is used by the homepage to show the news organization subhead. If a post does not provide `source`, the template falls back to the site-wide parameter `params.newsOrganization` (set in `config.*`) or the literal `Newsday` as a final fallback.
- `image` is used as the static thumbnail. If you provide a `gif` in the front matter, the homepage will show the GIF when the user hovers the thumbnail or hovers the post card/title.
- `image2` is optional. If not present, the article template uses a default placeholder image for the second image slot on the article page.

## Where to put images and GIFs

- Recommended: put your static assets in the `static/` folder so Hugo will serve them unchanged. For example:
  - `static/images/crash-map.png` → referenced as `/images/crash-map.png`
  - `static/GIF/crash_map_gif.gif` → referenced as `/GIF/crash_map_gif.gif`

Note: You previously used `public/GIF/...`. `public/` is Hugo's output directory (build artifact). To have files available during development and included correctly in the site, add them under `static/` and reference them with a leading `/` as shown above.

If you intentionally want GIFs in `public/GIF`, they will work only after a build (not during dev) — prefer `static/GIF` for editing and preview.

## GIF behavior

- The homepage template renders two image tags inside the thumbnail area: a static image and (optionally) a GIF. CSS switches the static image off and shows the GIF on hover.
- Hovering the post card or the post title will also trigger the GIF (the theme uses `.post-item:hover` so the GIF plays when the user hovers the title).
- For accessibility and performance, keep GIFs small and short. Consider converting GIFs to animated WebP for better compression.

## Substack card

- The Substack card uses `data/substack.json` when present to render the latest item at build time. To change the default text/image shown in the sidebar, edit `data/substack.json`.
- If the `data` file is not present, a client-side script (`static/js/substack-client.js`) will fetch and populate the card at runtime.

## About page

- The About page content lives at `content/pages/about.md`. The site includes a pages-specific template at `layouts/pages/single.html` that renders a single-column page with the image floating to the right on wide screens and moving below the text on mobile (per your request).

## Preview locally

- Start the Hugo dev server (PowerShell):

```powershell
hugo server -D
```

- Open `http://localhost:1313/` and navigate to the post or `/about/` to preview.

## Tips and best practices

- Optimize GIFs to reduce file size (tools: gifsicle, ImageMagick, or convert to animated WebP).
- Keep thumbnail images at consistent aspect ratios (the theme uses a 16:9 thumbnail box by default). Recommended thumbnail width: 280px (CSS will scale it responsively).
- If you prefer the image to never auto-play or to respect `prefers-reduced-motion`, we can add that behavior — ask and I will implement it.

## Troubleshooting

- If an image or GIF doesn't show during development, verify the file exists under `static/` and that the front matter path starts with `/` (e.g. `/images/foo.jpg` or `/GIF/foo.gif`).
- If a page returns "The page you requested doesn't exist", check the post location and front matter `url:` (pages under `content/pages/` will normally map to `/pages/...`, use `url: "/about/"` or move the file to `content/about.md` to publish at `/about/`).


---

## RSS feed — how it works (code-level)

This site uses Hugo's built-in feed generation plus two theme-provided templates for RSS and JSON feed output. Here's exactly how it works and where to change behavior in the code.

- Where the feed templates live:
  - `themes/maverick/layouts/index.xml` — the RSS (XML) template used for the site root feed (generated as `public/index.xml`). You can open this file to see it loops over `.Site.RegularPages` and injects each post's `<item>` using `{{ .Content }}` for the description.
  - `themes/maverick/layouts/index.json` — the JSON feed template (generated as `public/feed.json`). It builds a JSON Feed (jsonfeed.org) with `content_html`, `content_text`, `url`, and timestamps.

- What Hugo actually generates:
  - Site-wide feeds: `public/index.xml` and `public/feed.json` (from the templates above).
  - Section/tag feeds: Hugo automatically generates `section/index.xml` for each section (e.g. `public/posts/index.xml`) and tag feeds at `public/tags/<tag>/index.xml` using the theme's feed rendering (you can inspect `public/` after a build).

- How the templates choose items and content:
  - The RSS template (`index.xml`) in this theme uses `{{ range where .Site.RegularPages "Section" "posts" }}` to include only posts from the `posts` section. If you want a different set (all pages, or include `pages`), change that `where` clause.
  - The template writes `<description>{{ .Content | html }}</description>` — that means the RSS `description` contains the post HTML (images, if included in the post content, will be embedded). If you'd prefer summaries only, replace `{{ .Content }}` with `{{ .Summary }}` or `{{ .Description }}`.

- Where the feed links are exposed in the site header:
  - `themes/maverick/layouts/partials/head.html` contains these lines that add the feed links to the page head:
    - `<link rel="alternate" type="application/atom+xml" href="{{ .Site.BaseURL }}/atom.xml" />`
    - `<link rel="alternate" type="application/json" href="{{ .Site.BaseURL }}/feed.json" />`
  - Those tags make browsers and feed readers discover your feed URLs.

- How to customize the feed templates safely:
  1. Don't edit files under `themes/maverick/` directly if you want to keep the theme updatable. Instead copy the template you want to override into the site's `layouts/` directory and edit there. For example:
     - Copy `themes/maverick/layouts/index.xml` → `layouts/index.xml` and edit `layouts/index.xml`.
  2. Inside the template you can change the `range` (which pages are included), change `{{ .Content }}` → `{{ .Summary }}` to use summaries, and add additional tags like `<media:content>` for images.
  3. To limit feed length, replace the range with `{{ range first 10 (where .Site.RegularPages "Section" "posts") }}` to include only the latest 10 items.

- Substack sidebar & RSS
  - The Substack sidebar in `layouts/partials/substack.html` uses build-time `data/substack.json` when present (see `data/substack.json`) and falls back to the client-side fetcher `static/js/substack-client.js` which attempts to fetch a Substack RSS/Atom feed at runtime. The client-side logic tries direct fetch → proxy → `data/substack.json`.

## Styling notes (brief, code pointers)

- Where styles are compiled: `themes/maverick/layouts/partials/head.html` compiles `assets/scss/styles.scss` (the theme's main stylesheet) and inlines it into the page. If you want to change global styles, edit `assets/scss/styles.scss` in the theme or add a site-level CSS and include it from `layouts/partials/head.html`.
- Homepage thumbnails and GIF behavior are controlled by `layouts/index.html` (the site-level homepage template). Key CSS classes to look for:
  - `.post-thumb` — the fixed thumbnail box (width ~280px) and `aspect-ratio: 16/9`.
  - `.post-thumb img.static` and `.post-thumb img.gif` — static image vs hover GIF. The code uses `.post-item:hover` to trigger the GIF when hovering the card or title.
- About page layout: `layouts/pages/single.html` (created for you) uses `.about-image` (floats right on desktop) and moves the image below the text on small screens.

