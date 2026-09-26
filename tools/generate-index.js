/**
 * generate-index.js
 *
 * Scans public/blog/posts/*.html, reads the BLOG_META block at the top of
 * each post, and writes public/blog/post-index.json (newest first).
 *
 * Usually run through tools/build.js. Can also run on its own:
 *   node tools/generate-index.js
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'public', 'blog', 'posts');
const INDEX_PATH = path.join(__dirname, '..', 'public', 'blog', 'post-index.json');

/**
 * Read BLOG_META from a post's HTML.
 * Throws if the block is missing or invalid, so a broken post never
 * silently drops out of the index.
 */
function readMeta(html, file) {
  const match = html.match(/<!--\s*BLOG_META\s*({[\s\S]*?})\s*END_BLOG_META\s*-->/);
  if (!match) {
    throw new Error(`${file}: no BLOG_META block`);
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (e) {
    throw new Error(`${file}: BLOG_META is not valid JSON (${e.message})`);
  }
  if (!meta.title || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date || '')) {
    throw new Error(`${file}: BLOG_META needs a title and a YYYY-MM-DD date`);
  }
  return meta;
}

/** Build the post list. A missing or empty posts folder means zero posts. */
function readPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];

  const posts = fs.readdirSync(POSTS_DIR)
    .filter(file => file.endsWith('.html'))
    .map(file => {
      const meta = readMeta(fs.readFileSync(path.join(POSTS_DIR, file), 'utf8'), file);
      return { ...meta, file, slug: file.replace(/\.html$/, '') };
    });

  // Newest first. YYYY-MM-DD strings sort correctly as text.
  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  return posts;
}

function generateIndex() {
  const posts = readPosts();
  // No timestamp here, so the file only changes when the posts change.
  const index = { count: posts.length, posts };
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`Index: ${posts.length} post(s) -> ${path.relative(process.cwd(), INDEX_PATH)}`);
  return posts;
}

module.exports = { generateIndex, readPosts, readMeta, POSTS_DIR };

if (require.main === module) {
  try {
    generateIndex();
  } catch (error) {
    console.error(`Error generating index: ${error.message}`);
    process.exit(1);
  }
}
