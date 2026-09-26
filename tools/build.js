/**
 * build.js: the one build command.
 *
 *   node tools/build.js
 *
 * 1. Writes public/blog/post-index.json (generate-index.js).
 * 2. Fills every <!-- build:NAME --> ... <!-- /build:NAME --> region in
 *    public/**\/*.html. Anything inside those regions is overwritten, so
 *    never edit it by hand. Regions:
 *      footer    shared footer, with the current year
 *      posts     homepage post list (left empty when there are no posts)
 *      postnav   newer/older links on each post
 * 3. Writes public/feed.xml (generate-feed.js).
 *
 * It never touches <!-- words:NAME --> regions. Those hold Matt's words.
 */

const fs = require('fs');
const path = require('path');
const { PUBLIC, readConfig, escapeHtml, displayDate, listHtmlFiles } = require('./lib');
const { generateIndex } = require('./generate-index');
const { generateFeed } = require('./generate-feed');

function footerHtml(config) {
  const year = new Date().getFullYear();
  return [
    `<p>&copy; ${year} Matt Rude. Writing licensed under <a href="https://creativecommons.org/licenses/by/4.0/" rel="license">CC BY 4.0</a> unless noted. <a href="/feed.xml" class="rss-link" title="Subscribe to RSS feed"><img src="/assets/images/Feed-icon.svg" alt="RSS" class="rss-icon"> RSS Feed</a></p>`,
    `<p class="ai-note">Built with the help of AI. <a href="${config.repoUrl}/blob/main/STANDARDS.md">Read more</a></p>`,
  ].join('\n');
}

function postListHtml(posts) {
  if (posts.length === 0) return '';
  const items = posts.map(post => [
    '        <li class="post card">',
    `            <h3><a href="/blog/posts/${post.slug}">${escapeHtml(post.title)}</a></h3>`,
    `            <p class="post-meta"><time datetime="${post.date}">${displayDate(post.date)}</time></p>`,
    '        </li>',
  ].join('\n'));
  return [
    '<section class="blog-posts">',
    '    <h2>Latest Posts</h2>',
    '    <ul class="post-list">',
    ...items,
    '    </ul>',
    '</section>',
  ].join('\n');
}

function postNavHtml(posts, file) {
  const i = posts.findIndex(post => post.file === path.basename(file));
  if (i === -1) return '';
  const link = (post, label) =>
    `<a href="/blog/posts/${post.slug}"><span class="nav-label">${label}</span> <span class="nav-title">${escapeHtml(post.title)}</span></a>`;
  const newer = i > 0 ? link(posts[i - 1], 'Newer Post') : '';
  const older = i < posts.length - 1 ? link(posts[i + 1], 'Older Post') : '';
  if (!newer && !older) return '';
  return [
    '<nav class="post-navigation" aria-label="Other posts">',
    `    <div class="prev-post">${newer}</div>`,
    `    <div class="next-post">${older}</div>`,
    '</nav>',
  ].join('\n');
}

/**
 * Replace the inside of every build region in one file.
 * Output is the same every run for the same input, so a rebuild with
 * nothing new leaves git clean.
 */
function fillRegions(html, file, fillers) {
  return html.replace(
    /^([ \t]*)<!-- build:([\w-]+) -->[\s\S]*?<!-- \/build:\2 -->/gm,
    (match, indent, name) => {
      if (!fillers[name]) {
        throw new Error(`${path.relative(PUBLIC, file)}: unknown build region "${name}"`);
      }
      const content = fillers[name](file);
      const body = content
        ? content.split('\n').map(line => (line ? indent + line : line)).join('\n') + '\n'
        : '';
      return `${indent}<!-- build:${name} -->\n${body}${indent}<!-- /build:${name} -->`;
    }
  );
}

function build() {
  const config = readConfig();
  const posts = generateIndex();

  const fillers = {
    footer: () => footerHtml(config),
    posts: () => postListHtml(posts),
    postnav: file => postNavHtml(posts, file),
  };

  let changed = 0;
  for (const file of listHtmlFiles(PUBLIC)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = fillRegions(before, file, fillers);
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      changed++;
    }
  }
  console.log(`Pages: ${changed} file(s) updated`);

  generateFeed(posts, config);
}

module.exports = { build, fillRegions };

if (require.main === module) {
  try {
    build();
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exit(1);
  }
}
