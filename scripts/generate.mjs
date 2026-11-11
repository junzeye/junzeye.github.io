import { readFile, writeFile, mkdir, cp, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.argv.includes('--replace-html')) {
  console.error('This optional command replaces HTML from content/site.json. For direct HTML edits, use npm run dev or npm run build. To deliberately regenerate, run npm run generate -- --replace-html.');
  process.exit(1);
}
const site = JSON.parse(await readFile(path.join(root, 'content/site.json'), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const links = items => items.map(item => `<a href="${escape(item.url)}">${escape(item.label)}</a>`).join('\n');
const updatedLabel = new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
}).format(new Date(`${site.lastUpdated}T00:00:00Z`));
const authors = paper => paper.authors.map(author => {
  const name = author === paper.selfName ? `<strong>${escape(author)}</strong>` : escape(author);
  return `${name}${paper.equalContribution?.includes(author) ? '<sup class="author-star">*</sup>' : ''}`;
}).join(', ');

const themeToggle = `<button id="theme-toggle" class="theme-toggle" type="button" aria-label="Dark mode" aria-pressed="false" title="Switch to dark mode" hidden>
  <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 13.3A8.5 8.5 0 0 1 10.7 3.5 8.5 8.5 0 1 0 20.5 13.3Z"/></svg>
  <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
</button>`;

const news = site.news.map(item => `<li>
  <time datetime="${escape(item.date)}">${escape(item.label)}</time>
  <p>${item.html}</p>
</li>`).join('\n');

const papers = site.papers.map(paper => `<li>
  <article class="paper" id="${escape(paper.id)}" aria-labelledby="${escape(paper.id)}-title">
    <h3 id="${escape(paper.id)}-title"><a href="${escape(paper.url)}">${escape(paper.title)}</a></h3>
    <p class="authors">${authors(paper)}</p>
    <p class="venue"><span>${escape(paper.venue)}</span>${paper.detail ? ` <span class="venue-separator" aria-hidden="true">·</span> <span class="venue-detail">${escape(paper.detail)}</span>` : ''}</p>
    <p class="paper-summary">${escape(paper.summary)}</p>
    <div class="paper-links">${links(paper.links)}</div>
  </article>
</li>`).join('\n');

const structuredData = JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Person',
  name: site.name, url: `${site.url}/`, image: `${site.url}/assets/portrait.jpg`,
  jobTitle: site.role,
  affiliation: { '@type': 'CollegeOrUniversity', name: site.institution },
  sameAs: site.profileLinks.map(link => link.url)
}).replaceAll('<', '\\u003c');

function documentHead(title, description, canonical = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <meta name="color-scheme" content="light dark">
  ${canonical ? `<link rel="canonical" href="${escape(canonical)}">` : '<meta name="robots" content="noindex">'}
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <script src="/assets/theme.js"></script>
  <link rel="stylesheet" href="/assets/site.css">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:image" content="${escape(site.url)}/assets/portrait.jpg">
  ${canonical ? `<meta property="og:url" content="${escape(canonical)}">` : ''}
  <meta name="twitter:card" content="summary">
</head>`;
}

const html = `${documentHead(site.title, site.description, `${site.url}/`)}
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="wordmark" href="#about" aria-label="${escape(site.name)}, home">${escape(site.shortName)}</a>
      <div class="header-actions">
        <nav aria-label="Main navigation">
          <a href="#about">About</a>
          ${site.news.length ? '<a href="#news">News</a>' : ''}
          <a href="#research">Research</a>
        </nav>
        ${themeToggle}
      </div>
    </div>
  </header>
  <main id="main" class="page">
    <section id="about" class="about" aria-labelledby="name">
      <div class="bio">
        <h1 id="name">${escape(site.name).replace(/\(([^)]*)\)/, '<span>($1)</span>')}</h1>
        ${site.bio.map(paragraph => `<p>${paragraph}</p>`).join('\n        ')}
      </div>
      <aside class="profile" aria-label="Photo and profile links">
        <img class="portrait" src="/assets/portrait.jpg" alt="${escape(site.name)} outdoors near the Golden Gate Bridge" width="640" height="640" fetchpriority="high">
        <p class="affiliation">${site.institutionUrl ? `<a href="${escape(site.institutionUrl)}">${escape(site.institution)}</a>` : escape(site.institution)}</p>
        <div class="profile-links">${links(site.profileLinks)}</div>
        ${site.emailDisplay ? `<p class="profile-email">${escape(site.emailDisplay)}</p>` : ''}
      </aside>
    </section>
    ${site.news.length ? `<section id="news" class="section news" aria-labelledby="news-title">
      <h2 id="news-title">News</h2>
      <ul class="news-list">${news}</ul>
    </section>` : ''}
    <section id="research" class="section research" aria-labelledby="research-title">
      <h2 id="research-title">Selected research</h2>
      <p class="contribution-note">* Equal contribution.</p>
      <ol class="paper-list">${papers}</ol>
    </section>
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-copy">
        <p>© ${escape(site.lastUpdated.slice(0, 4))} ${escape(site.name)}</p>
        <p class="footer-credit">Design inspired by the <a href="https://github.com/alshedivat/al-folio">al-folio</a> theme. Built for <a href="https://pages.github.com/">GitHub Pages</a>.<br>Last updated: <time datetime="${escape(site.lastUpdated)}">${updatedLabel}</time>.</p>
      </div>
      <a class="back-to-top" href="#about">Back to top <span aria-hidden="true">↑</span></a>
    </div>
  </footer>
  <script type="application/ld+json">${structuredData}</script>
</body>
</html>
`;

const notFound = `${documentHead(`Page not found | ${site.name}`, 'This page could not be found.')}
<body>
  <main class="page error-page">
    <p class="error-code">404</p>
    <h1>Page not found</h1>
    <p>The page may have moved, or the link may be incomplete.</p>
    <a href="/">Return to ${escape(site.shortName)}'s homepage <span aria-hidden="true">→</span></a>
  </main>
</body>
</html>
`;

// Save existing editable pages before deliberately regenerating them.
const backup = path.join(root, '.local', 'revisions', `before-generate-${Date.now()}`);
await mkdir(backup, { recursive: true });
for (const file of ['index.html', '404.html', 'robots.txt', 'sitemap.xml']) {
  try { await cp(path.join(root, file), path.join(backup, file)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
console.log(`Previous pages saved in ${backup}`);

// Generate the files served directly by GitHub Pages; no remote build is required.
await stat(path.join(root, 'assets/portrait.jpg'));
await writeFile(path.join(root, 'index.html'), html);
await writeFile(path.join(root, '404.html'), notFound);
await writeFile(path.join(root, '.nojekyll'), '');
await writeFile(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
await writeFile(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(site.url)}/</loc></url></urlset>\n`);

await import('./build.mjs');
