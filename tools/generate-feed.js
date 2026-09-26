/**
 * generate-feed.js
 *
 * Writes public/feed.xml (RSS 2.0) from the posts in public/blog/posts/.
 * Each item carries the full post body: the text between the
 * <!-- words:post --> markers, with relative URLs made absolute.
 *
 * Usually run through tools/build.js. Can also run on its own:
 *   node tools/generate-feed.js
 */

const fs = require('fs');
const path = require('path');
const { PUBLIC, readConfig, rssDate, wordsRegion } = require('./lib');
const { readPosts, POSTS_DIR } = require('./generate-index');

const FEED_PATH = path.join(PUBLIC, 'feed.xml');
const FEED_TITLE = "Matt Rude's Blog";
// Placeholder until Matt writes a channel description.
const FEED_DESCRIPTION = 'Matt Rude';

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** CDATA cannot contain "]]>", so split any occurrence across two sections. */
function cdata(text) {
  return `<![CDATA[${text.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

/** Make src/href values absolute so images and links work in feed readers. */
function absoluteUrls(html, siteUrl, pageUrl) {
  return html.replace(/(\s(?:src|href)=")([^"]+)(")/gi, (match, before, url, after) => {
    if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return match; // already absolute, mailto:, or #anchor
    return before + new URL(url, siteUrl + pageUrl).href + after;
  });
}

function itemXml(post, siteUrl) {
  const pageUrl = `/blog/posts/${post.slug}`;
  const link = siteUrl + pageUrl;
  const html = fs.readFileSync(path.join(POSTS_DIR, post.file), 'utf8');
  const body = wordsRegion(html, 'post');
  if (body === null) {
    throw new Error(`${post.file}: no <!-- words:post --> region to put in the feed`);
  }

  const categories = (post.tags || [])
    .map(tag => `\n      <category>${escapeXml(tag)}</category>`)
    .join('');

  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${rssDate(post.date)}</pubDate>
      <description>${cdata(absoluteUrls(body.trim(), siteUrl, pageUrl))}</description>${categories}
    </item>
`;
}

function generateFeed(posts = readPosts(), config = readConfig()) {
  const siteUrl = config.siteUrl;
  const year = new Date().getFullYear();

  // lastBuildDate follows the newest post, so rebuilding without a new post
  // doesn't change the file. With no posts it is left out; RSS allows that.
  const lastBuildDate = posts.length
    ? `    <lastBuildDate>${rssDate(posts[0].date)}</lastBuildDate>\n`
    : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${siteUrl}/</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <copyright>© ${year} Matt Rude. Writing licensed under CC BY 4.0 unless noted.</copyright>
${lastBuildDate}${posts.map(post => itemXml(post, siteUrl)).join('')}  </channel>
</rss>
`;

  fs.writeFileSync(FEED_PATH, xml, 'utf8');
  console.log(`Feed: ${posts.length} item(s) -> ${path.relative(process.cwd(), FEED_PATH)}`);
}

module.exports = { generateFeed, FEED_PATH };

if (require.main === module) {
  try {
    generateFeed();
  } catch (error) {
    console.error(`Error generating feed: ${error.message}`);
    process.exit(1);
  }
}
