/**
 * verify.js: proves a page shows Matt's words exactly as he wrote them.
 *
 *   node tools/verify.js vault/posts/<file>.md public/blog/posts/<file>.html
 *   node tools/verify.js vault/staging/tools-i-use.md public/resume/index.html tools-i-use
 *
 * 1. Gate. The source must say status: ready. A post must also say
 *    privacy_reviewed: true and have a title, a real YYYY-MM-DD date, and
 *    kind technical or personal.
 * 2. Syntax the site can't show yet is refused: %% comments %%, [[links]],
 *    ![[embeds]], images, footnotes.
 * 3. Words. The plain text of the Markdown (from a simple stripper written
 *    here, not from any Markdown library) is compared with the text of the
 *    page's <!-- words:NAME --> region (tags stripped, entities decoded).
 *    Whitespace is normalized, and the Markdown symbols * _ ` ~ are ignored
 *    on both sides. The two labels added for callouts are ignored.
 *    Any other difference, even one word, is a failure.
 * 4. For posts, the title, date, kind, and tags in the page must match.
 *
 * Exit code 0 means OK. Anything else means do not publish.
 */

const fs = require('fs');
const path = require('path');
const { ROOT, wordsRegion, escapeHtml } = require('./lib');
const { readMeta } = require('./generate-index');

/* ---------- frontmatter ---------- */

/** Remove a trailing "# comment" that is not inside quotes. */
function stripComment(value) {
  const quoted = value.match(/^\s*("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')/);
  if (quoted) return quoted[1];
  return value.replace(/(^|\s)#.*$/, '');
}

function scalar(raw) {
  const v = stripComment(raw).trim();
  if (/^"(.*)"$/.test(v)) return v.slice(1, -1).replace(/\\(["\\])/g, '$1');
  if (/^'(.*)'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\[.*\]$/.test(v)) {
    return v.slice(1, -1).split(',').map(s => scalar(s)).filter(s => s !== '');
  }
  return v;
}

/**
 * Parse the small YAML subset the vault uses: key: value, inline lists
 * [a, b], block lists (- a), quotes, true/false, # comments. This covers
 * both the template and what Obsidian's Properties panel writes.
 */
function parseFrontmatter(md) {
  const m = md.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { data: null, body: md };

  const data = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && listKey) {
      if (!Array.isArray(data[listKey])) data[listKey] = [];
      data[listKey].push(scalar(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:(.*)$/);
    if (!kv) throw new Error(`frontmatter line not understood: "${line}"`);
    const value = stripComment(kv[2]).trim();
    data[kv[1]] = value === '' ? '' : scalar(kv[2]);
    listKey = value === '' ? kv[1] : null;
  }
  return { data, body: md.slice(m[0].length) };
}

function isRealDate(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, mo, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** Reasons this source may not be published. Empty array means OK. */
function gateErrors(data, region) {
  if (!data) return ['no frontmatter block (--- ... ---) at the top of the file'];
  const errors = [];
  if (data.status !== 'ready') errors.push(`status is "${data.status ?? ''}", not "ready"`);
  if (region === 'post') {
    if (data.privacy_reviewed !== true) errors.push('privacy_reviewed is not true (only Matt sets this)');
    if (typeof data.title !== 'string' || data.title.trim() === '') errors.push('title is empty');
    if (!isRealDate(data.date)) errors.push(`date "${data.date ?? ''}" is not a real YYYY-MM-DD date`);
    if (!['technical', 'personal'].includes(data.kind)) errors.push(`kind "${data.kind ?? ''}" is not technical or personal`);
  }
  return errors;
}

/* ---------- syntax the site can't show yet ---------- */

const UNSUPPORTED = [
  [/%%/, 'Obsidian comment (%% ... %%). It may hold private notes. Remove it or ask for support.'],
  [/!\[\[/, 'Obsidian embed (![[...]]). Not supported yet.'],
  [/\[\[/, 'Obsidian wikilink ([[...]]). Use a normal Markdown link instead.'],
  [/!\[[^\]]*\]\(/, 'image. Not supported yet.'],
  [/\[\^[^\]]+\]/, 'footnote ([^1]). Not supported yet.'],
];

function unsupportedErrors(body) {
  const errors = [];
  let inFence = false;
  body.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    const text = line.replace(/(`+)[\s\S]*?\1/g, ''); // ignore inline code
    for (const [re, why] of UNSUPPORTED) {
      if (re.test(text)) { errors.push(`body line ${i + 1}: ${why}`); break; }
    }
  });
  return errors;
}

/* ---------- text extraction ---------- */

const INLINE_TAGS = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i',
  'ins', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var']);

/** Inline tags vanish; block tags become a space, so words never merge. */
function stripTags(html) {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g,
    (m, name) => (INLINE_TAGS.has(name.toLowerCase()) ? '' : ' '));
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201C', rdquo: '\u201D', copy: '\u00A9', middot: '\u00B7',
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Inline Markdown for text outside code. */
function inlineMdToText(text) {
  return decodeEntities(stripTags(text
    .replace(/\\\r?\n/g, ' ')                               // backslash line break
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')                // [text](url) -> text
    .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1')        // <https://...> -> url
    .replace(/==(\S(?:[^=]*\S)?)==/g, '$1')                 // ==highlight==
  ).replace(/\\([\\`*_{}[\]()#+\-.!|>~<])/g, '$1'));        // backslash escapes
}

/** Plain text of a Markdown body, written independently of any Markdown library. */
function mdToText(md) {
  const segments = []; // { code: bool, text }
  let inFence = false;
  let buffer = [];
  const flush = () => {
    if (buffer.length) segments.push({ code: false, text: buffer.join('\n') });
    buffer = [];
  };

  for (let line of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; flush(); continue; }
    if (inFence) { segments.push({ code: true, text: line }); continue; }

    line = line.replace(/^\s*(>\s?)+/, '');                          // blockquote markers
    line = line.replace(/^\s*\[!(transcript|ai)\][+-]?\s*/i, '');    // callout markers (model name stays)
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) continue;           // horizontal rule
    if (/^\s*=+\s*$/.test(line)) continue;                           // setext underline
    if (/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('-')) continue; // table separator
    line = line.replace(/^\s*#{1,6}\s+/, '');                        // heading marks
    line = line.replace(/^\s*([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, ''); // list marks, task boxes
    if (/^\s*\|/.test(line)) line = line.replace(/\|/g, ' ');        // table pipes
    buffer.push(line);
  }
  flush();

  return segments.map(s => {
    if (s.code) return s.text;
    // Split out inline code so its contents are taken literally.
    return s.text.split(/(`+)([\s\S]*?)\1/).map((part, i) => {
      if (i % 3 === 1) return '';      // the backtick run itself
      if (i % 3 === 2) return part;    // code contents
      return inlineMdToText(part);
    }).join('');
  }).join('\n');
}

/** Plain text of a page region, ignoring only the two labels callouts add. */
function htmlToText(html) {
  const t = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<figcaption class="quote-label">Voice transcript, unedited<\/figcaption>/g, ' ')
    .replace(/<figcaption class="quote-label">Written by ([\s\S]*?)<\/figcaption>/g, ' $1 ');
  return decodeEntities(stripTags(t));
}

/** Words for comparison: NFC, no Markdown symbols, single spaces. */
function words(text) {
  return text.normalize('NFC')
    .replace(/\u00A0/g, ' ')
    .replace(/[*_`~]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function firstDifference(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return -1;
}

function context(list, i) {
  return list.slice(Math.max(0, i - 8), i + 9).join(' ') || '(nothing)';
}

/* ---------- the check ---------- */

/**
 * @param {string} md    source Markdown, including frontmatter
 * @param {string} html  the page
 * @param {string} region words region name ("post" for blog posts)
 * @returns {{ ok: boolean, errors: string[], count: number }}
 */
function verify(md, html, region = 'post') {
  const { data, body } = parseFrontmatter(md);
  let errors = gateErrors(data, region);
  if (errors.length) return { ok: false, errors: errors.map(e => `refused: ${e}`), count: 0 };

  errors = unsupportedErrors(body);
  if (errors.length) return { ok: false, errors: errors.map(e => `refused: ${e}`), count: 0 };

  const regionHtml = wordsRegion(html, region);
  if (regionHtml === null) return { ok: false, errors: [`page has no <!-- words:${region} --> region`], count: 0 };

  if (region === 'post') {
    let meta;
    try { meta = readMeta(html, 'page'); } catch (e) { errors.push(e.message); }
    if (meta) {
      if (meta.title !== data.title) errors.push(`BLOG_META title "${meta.title}" != frontmatter title "${data.title}"`);
      if (meta.date !== data.date) errors.push(`BLOG_META date ${meta.date} != frontmatter date ${data.date}`);
      if (meta.kind !== data.kind) errors.push(`BLOG_META kind ${meta.kind} != frontmatter kind ${data.kind}`);
      const tags = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);
      if (JSON.stringify(meta.tags || []) !== JSON.stringify(tags)) errors.push(`BLOG_META tags ${JSON.stringify(meta.tags)} != frontmatter tags ${JSON.stringify(tags)}`);
    }
    const escaped = escapeHtml(data.title);
    if (!html.includes(`<title>${escaped} | Matt Rude</title>`)) errors.push('<title> does not match the frontmatter title');
    if (!new RegExp(`<h2>${escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h2>`).test(html)) errors.push('<h2> does not match the frontmatter title');
    if (!html.includes(`<time datetime="${data.date}">`)) errors.push('the page date does not match the frontmatter date');
  }

  const source = words(mdToText(body));
  const page = words(htmlToText(regionHtml));
  if (source.length === 0) errors.push('the source has no text');
  const i = firstDifference(source, page);
  if (i !== -1) {
    errors.push(
      `words differ at word ${i + 1} (source has ${source.length} words, page has ${page.length})\n` +
      `  source: …${context(source, i)}…\n` +
      `  page:   …${context(page, i)}…\n` +
      `  first difference: source "${source[i] ?? '(end)'}" vs page "${page[i] ?? '(end)'}"`
    );
  }
  return { ok: errors.length === 0, errors, count: source.length };
}

module.exports = { verify, parseFrontmatter, gateErrors, mdToText, htmlToText, words };

if (require.main === module) {
  const [mdPath, htmlPath, region = 'post'] = process.argv.slice(2);
  if (!mdPath || !htmlPath) {
    console.error('Usage: node tools/verify.js <source.md> <page.html> [region]');
    process.exit(2);
  }
  const resolve = p => path.resolve(ROOT, p);
  const result = verify(fs.readFileSync(resolve(mdPath), 'utf8'), fs.readFileSync(resolve(htmlPath), 'utf8'), region);
  if (result.ok) {
    console.log(`OK: ${result.count} words match exactly (${mdPath} -> ${htmlPath}, region "${region}")`);
  } else {
    console.error(`NOT OK: ${mdPath} -> ${htmlPath}, region "${region}"`);
    for (const e of result.errors) console.error(`- ${e}`);
    process.exit(1);
  }
}
