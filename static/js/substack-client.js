// Clean Substack client: fetches the latest post into a plain `entity` and
// exposes simple hooks for the page to render it.
// Behavior: try direct feed (CORS) -> proxy feed -> /data/substack.json fallback.

(function () {
  const FEED = 'https://murkyspaces.substack.com/feed';
  const PROXY_URL = 'https://api.allorigins.win/raw?url='; // replace with your proxy if you have one

  // Small helper: strip HTML tags from a string
  function stripHtml(s) {
    if (!s) return '';
    return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Extract a reasonable image URL from an RSS/Atom item element
  function extractImageFromItem(el, contentHtml) {
    if (!el && !contentHtml) return '';
    // 1) enclosure
    try {
      if (el) {
        const enc = el.querySelector && el.querySelector('enclosure');
        if (enc && enc.getAttribute) {
          const u = enc.getAttribute('url');
          if (u) return u;
        }
      }
    } catch (e) {}

    // 2) look in provided HTML for og:image or first img
    const html = contentHtml || (el && (el.querySelector('content') || el.querySelector('description')) && (el.querySelector('content') || el.querySelector('description')).textContent) || '';
    if (html) {
      let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (m && m[1]) return m[1];
      m = html.match(/<img[^>]+(?:srcset=|data-src=|data-lazy-src=|src=)["']?([^"' >]+)["' >]/i);
      if (m && m[1]) {
        let u = m[1];
        if (u.includes(',')) u = u.split(',')[0].trim().split(' ')[0];
        return u;
      }
    }

    return '';
  }

  // Parse RSS/Atom and return entity or null
  function parseRss(xmlText) {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlText, 'application/xml');

      // RSS items
      const item = xml.querySelector && (xml.querySelector('item') || xml.querySelector('entry'));
      if (!item) return null;

      const isAtom = item.tagName && item.tagName.toLowerCase() === 'entry';
      const title = (item.querySelector('title') && item.querySelector('title').textContent) || '';
      let link = '';
      if (isAtom) {
        const linkEl = item.querySelector('link[rel="alternate"]') || item.querySelector('link');
        link = linkEl ? (linkEl.getAttribute('href') || linkEl.textContent) : '';
      } else {
        const linkEl = item.querySelector('link');
        link = linkEl ? linkEl.textContent : (item.querySelector('guid') ? item.querySelector('guid').textContent : '');
      }

      const pubDate = (item.querySelector('pubDate') && item.querySelector('pubDate').textContent) || (item.querySelector('updated') && item.querySelector('updated').textContent) || '';
      const descNode = item.querySelector('description') || item.querySelector('summary') || item.querySelector('content');
      const description = descNode ? stripHtml(descNode.textContent) : '';
      const image = extractImageFromItem(item, descNode && descNode.textContent);

      return { title, link, pubDate, description, image };
    } catch (err) {
      console.warn('parseRss failed', err);
      return null;
    }
  }

  async function fetchTextWithFallback() {
    // Try direct fetch (may be CORS-blocked)
    try {
      const r = await fetch(FEED, { cache: 'no-cache', mode: 'cors' });
      if (r.ok) return await r.text();
    } catch (e) {
      // ignore
    }
    // Try proxy
    try {
      const url = PROXY_URL + encodeURIComponent(FEED);
      const r = await fetch(url, { cache: 'no-cache' });
      if (r.ok) return await r.text();
    } catch (e) {
      // ignore
    }
    return null;
  }

  // If no image in feed, try to fetch article page via proxy to get og:image
  async function fetchArticleImage(articleUrl) {
    if (!articleUrl) return '';
    try {
      const url = PROXY_URL + encodeURIComponent(articleUrl);
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) return '';
      const html = await r.text();
      let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (m && m[1]) return m[1];
      m = html.match(/<img[^>]+(?:srcset=|data-src=|data-lazy-src=|src=)["']?([^"' >]+)["' >]/i);
      if (m && m[1]) return m[1].split(',')[0].trim().split(' ')[0];
    } catch (e) {
      // ignore
    }
    return '';
  }

  // Public: fetch latest entity or null
  async function fetchLatestEntity() {
    // 1) feed text
    const text = await fetchTextWithFallback();
    if (text) {
      const ent = parseRss(text);
      if (ent && (!ent.image && ent.link)) {
        // try article page for image
        ent.image = await fetchArticleImage(ent.link) || ent.image || '';
      }
      if (ent && (ent.title || ent.link)) return ent;
    }

    // 2) fallback to local data file
    try {
      const r = await fetch('/data/substack.json', { cache: 'no-cache' });
      if (r.ok) {
        const data = await r.json();
        if (data && data.items && data.items.length) {
          const it = data.items[0];
          return { title: it.title, link: it.link, pubDate: it.pubDate, description: it.snippet || '', image: it.enclosure || it.image || '' };
        }
      }
    } catch (e) {
      // ignore
    }

    return null;
  }

  // Simple placeholder population; page can override by defining window.renderSubstack
  function populate(entity) {
    if (!entity) return;
    const titleEl = document.getElementById('substack-title');
    const linkEl = document.getElementById('substack-link');
    const imgEl = document.getElementById('substack-image');
    const descEl = document.getElementById('substack-desc');
    const dateEl = document.getElementById('substack-date');

    if (linkEl && entity.link) linkEl.href = entity.link;
    if (titleEl) titleEl.textContent = entity.title || '';
    if (imgEl) {
      // allow a configurable fallback image via data-default-src on the <img>
      const defaultImg = (imgEl.getAttribute && imgEl.getAttribute('data-default-src')) || '';
      if (entity.image) {
        imgEl.src = entity.image;
        imgEl.style.display = '';
        delete imgEl.dataset._fallback;
      } else if (defaultImg) {
        imgEl.src = defaultImg;
        imgEl.style.display = '';
        imgEl.dataset._fallback = 'true';
      } else {
        imgEl.style.display = 'none';
        delete imgEl.dataset._fallback;
      }
    }
    if (descEl) descEl.innerHTML = entity.description || '';
    if (dateEl) dateEl.textContent = entity.pubDate || '';
  }

  // Bootstrap: fetch entity, populate placeholders, dispatch event and call optional renderer
  async function init() {
    try {
      const rootMsg = document.getElementById('substack-title') || document.getElementById('substack-feed') || document.body;
      const hero = document.querySelector('.substack-hero') || rootMsg || document.body;

      // locate card element; no spinner or style hiding — rely on server-render or client populate
      let cardEl = document.querySelector('.substack-card');

      // retry loop: keep trying until we get an entity, with backoff
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      let backoff = 2000; // start 2s
      let ent = null;
      while (!ent) {
        if (rootMsg) rootMsg.dataset.substackLoading = 'trying';
        ent = await fetchLatestEntity();
        if (ent) break;
        console.warn('substack-client: fetch failed, retrying in', backoff, 'ms');
        await sleep(backoff);
        backoff = Math.min(60000, Math.floor(backoff * 1.5)); // cap 60s
      }

      // no spinner to remove; card visuals not modified

      populate(ent);
      // event and renderer hooks
      document.dispatchEvent(new CustomEvent('substack:loaded', { detail: ent }));
      if (typeof window.renderSubstack === 'function') {
        try { window.renderSubstack(ent); } catch (e) { console.warn('renderSubstack failed', e); }
      }
      if (rootMsg) { rootMsg.dataset.substackLoading = 'done'; }
      console.debug('substack-client: loaded entity', ent);
    } catch (err) {
      console.error('substack-client init error', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Expose for testing
  window.__substack_fetchLatestEntity = fetchLatestEntity;
})();
