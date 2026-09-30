/**
 * verify.js: proves a page shows Matt's words as he wrote them, apart from
 * the removals the publish-post skill is allowed to make.
 *
 *   node tools/verify.js vault/posts/<file>.md public/blog/posts/<file>.html
 *   node tools/verify.js vault/staging/tools-i-use.md public/resume/index.html tools-i-use
 *
 * 1. Gate. The source must say status: ready. A post must also have a title,
 *    a real YYYY-MM-DD date, and kind technical or personal.
 * 2. Left out automatically (the vault file keeps them): %% comments %%,
 *    <!-- comments -->, ![[embeds]], images, ^block-ids, and dataview /
 *    query / tasks code blocks. [[wikilinks]] become their plain text.
 *    Footnotes are kept and listed at the end, in order of first reference.
 * 3. Privacy removals. Where the skill removed text for privacy, the page has
 *    a marker: <!-- removed --> in normal text, or
 *    <span class="removed">[removed]</span> inside transcripts and AI quotes.
 *    Each marker stands for one or more whole words. Every removal is printed.
 * 4. Words. Everything else must match the Markdown word for word. The
 *    Markdown's plain text comes from a simple stripper written here, not
 *    from a Markdown library. Whitespace is normalized, the Markdown symbols
 *    * _ ` ~ are ignored on both sides, and the labels the skill adds
 *    (callout captions, footnote links) are ignored. A changed, added,
 *    moved, or unmarked missing word is a failure.
 * 5. For posts, the title, date, kind, and tags in the page must match.
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
    if (typeof data.title !== 'string' || data.title.trim() === '') errors.push('title is empty');
    if (!isRealDate(data.date)) errors.push(`date "${data.date ?? ''}" is not a real YYYY-MM-DD date`);
    if (!['technical', 'personal'].includes(data.kind)) errors.push(`kind "${data.kind ?? ''}" is not technical or personal`);
  }
  return errors;
}

/* ---------- what the site leaves out ---------- */

const DROPPED_BLOCKS = /^(dataview|dataviewjs|query|tasks)$/i;

/**
 * Take out what can't be published, the same way the skill leaves it out of
 * the page, and move footnotes to the end in order of first reference.
 * Code blocks are kept exactly as written.
 */
function prepareBody(body) {
  const dropped = { comments: 0, embeds: 0, images: 0, blocks: 0 };
  const tally = key => () => { dropped[key]++; return ''; };

  // Split into fenced code blocks and text.
  const chunks = [];
  let fence = null;
  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = line.match(/^\s*(```|~~~)\s*([\w-]*)/);
    if (fence) {
      fence.lines.push(line);
      if (marker && marker[1] === fence.marker && !marker[2]) { chunks.push(fence); fence = null; }
      continue;
    }
    if (marker) { fence = { code: true, marker: marker[1], lang: marker[2], lines: [line] }; continue; }
    const last = chunks[chunks.length - 1];
    if (last && !last.code) last.lines.push(line);
    else chunks.push({ code: false, lines: [line] });
  }
  if (fence) chunks.push(fence);

  // Pass 1: comments, embeds, images, block ids, wikilinks, footnote definitions.
  const definitions = new Map();
  for (const chunk of chunks) {
    if (chunk.code) continue;
    chunk.text = chunk.lines.join('\n')
      .replace(/%%[\s\S]*?(?:%%|$)/g, tally('comments'))
      .replace(/<!--[\s\S]*?(?:-->|$)/g, tally('comments'))
      .replace(/!\[\[[^\]]*\]\]/g, tally('embeds'))
      .replace(/!\[[^\]]*\]\([^)]*\)/g, tally('images'))
      .replace(/[ \t]+\^[A-Za-z0-9-]+[ \t]*$/gm, '')
      .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (m, target, alias) =>
        alias ?? (target.replace(/[#^].*$/, '') || target.replace(/^[#^]+/, '')))
      .replace(/^\[\^([^\]\s]+)\]:[ \t]?(.*(?:\n(?: {2,}|\t).*)*)/gm, (m, id, text) => {
        definitions.set(id, text.replace(/\n[ \t]+/g, '\n'));
        return '';
      });
  }

  // Pass 2: footnote references, in document order.
  const notes = [];
  const used = new Set();
  for (const chunk of chunks) {
    if (chunk.code) continue;
    chunk.text = chunk.text.replace(/\^\[([^\]]*)\]|\[\^([^\]\s]+)\]/g, (m, inline, id) => {
      if (inline !== undefined) { notes.push(inline); return ''; }
      if (!definitions.has(id)) return m; // no definition: Obsidian shows it as plain text
      if (!used.has(id)) { used.add(id); notes.push(definitions.get(id)); }
      return '';
    });
  }
  for (const [id, text] of definitions) if (!used.has(id)) notes.push(text);

  const parts = [];
  for (const chunk of chunks) {
    if (!chunk.code) parts.push(chunk.text);
    else if (DROPPED_BLOCKS.test(chunk.lang)) dropped.blocks++;
    else parts.push(chunk.lines.join('\n'));
  }
  const cleaned = parts.join('\n') + (notes.length ? '\n\n' + notes.join('\n\n') : '');
  return { body: cleaned, dropped, footnotes: notes.length };
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

/** Plain text of a (prepared) Markdown body. */
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
    line = line.replace(/^\s*\[![\w-]+\][+-]?\s*/, '');              // callout markers (a title stays)
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

/** Stands in for a privacy removal marker while comparing. */
const REMOVED = '\u0000';

/** Plain text of a page region. Markers become REMOVED; added labels are ignored. */
function htmlToText(html) {
  const t = html
    .replace(/<!-- removed -->|<span class="removed">\[removed\]<\/span>/g, ` ${REMOVED} `)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<figcaption class="quote-label">Voice transcript, unedited<\/figcaption>/g, ' ')
    .replace(/<figcaption class="quote-label">Written by ([\s\S]*?)<\/figcaption>/g, ' $1 ')
    .replace(/<sup class="footnote-ref">[\s\S]*?<\/sup>/g, '')
    .replace(/<a [^>]*class="footnote-back"[^>]*>[\s\S]*?<\/a>/g, '');
  return decodeEntities(stripTags(t));
}

/**
 * Words for comparison: NFC, no Markdown symbols, single spaces. Closing
 * punctuation standing alone joins the word before it, so "delta ." (left
 * when a comment before the period is taken out) equals "delta.".
 */
function words(text) {
  const out = [];
  for (const w of text.normalize('NFC').replace(/\u00A0/g, ' ').replace(/[*_`~]/g, '').split(/\s+/)) {
    if (!w) continue;
    const prev = out[out.length - 1];
    if (/^[.,;:!?)\]}\u2026]+$/.test(w) && prev !== undefined && prev !== REMOVED) out[out.length - 1] = prev + w;
    else out.push(w);
  }
  return out;
}

function context(list, i) {
  return list.slice(Math.max(0, i - 8), i + 9).join(' ') || '(nothing)';
}

function differenceMessage(source, page, i, note = '') {
  return `words differ at word ${i + 1}${note}\n` +
    `  source: …${context(source, i)}…\n` +
    `  page:   …${context(page, i)}…\n` +
    `  first difference: source "${source[i] ?? '(end)'}" vs page "${page[i] ?? '(end)'}"`;
}

/**
 * Match the page's words to the source's. Each REMOVED marker stands for one
 * or more source words; everything else must be identical and in order.
 * Returns { removed: [text, ...] } or { error }.
 */
function align(source, page) {
  // Runs of words between markers. Adjacent markers count as one.
  const runs = [[]];
  for (const w of page) {
    if (w !== REMOVED) runs[runs.length - 1].push(w);
    else if (runs.length === 1 || runs[runs.length - 1].length) runs.push([]);
  }

  if (runs.length === 1) {
    const n = Math.max(source.length, page.length);
    for (let i = 0; i < n; i++) {
      if (source[i] !== page[i]) {
        return { error: differenceMessage(source, page, i, ` (source has ${source.length} words, page has ${page.length})`) };
      }
    }
    return { removed: [] };
  }

  const matchesAt = (run, at) => at + run.length <= source.length && run.every((w, k) => source[at + k] === w);

  const first = runs[0];
  for (let i = 0; i < first.length; i++) {
    if (source[i] !== first[i]) return { error: differenceMessage(source, first, i, ' (before the first removal)') };
  }

  // Leftmost match for each run keeps the most room for the runs after it;
  // the last run must end exactly where the source ends.
  let pos = first.length;
  const removed = [];
  for (let r = 1; r < runs.length; r++) {
    const run = runs[r];
    let at = -1;
    if (r === runs.length - 1) {
      const start = source.length - run.length;
      if (start >= pos + 1 && matchesAt(run, start)) at = start;
    } else {
      for (let s = pos + 1; s + run.length <= source.length; s++) {
        if (matchesAt(run, s)) { at = s; break; }
      }
    }
    if (at === -1) {
      return {
        error: `the words after removal ${r} don't match the source in order\n` +
          `  page after removal ${r}: …${run.slice(0, 16).join(' ') || '(end)'}…\n` +
          `  source after word ${pos}: …${source.slice(pos, pos + 24).join(' ') || '(end)'}…`,
      };
    }
    removed.push(source.slice(pos, at).join(' '));
    pos = at + run.length;
  }
  return { removed };
}

/* ---------- the check ---------- */

/**
 * @param {string} md    source Markdown, including frontmatter
 * @param {string} html  the page
 * @param {string} region words region name ("post" for blog posts)
 * @returns {{ ok, errors, count, removed, dropped, footnotes }}
 */
function verify(md, html, region = 'post') {
  const { data, body } = parseFrontmatter(md);
  const gate = gateErrors(data, region);
  if (gate.length) {
    return { ok: false, errors: gate.map(e => `refused: ${e}`), count: 0, removed: [], dropped: {}, footnotes: 0 };
  }

  const errors = [];
  const regionHtml = wordsRegion(html, region);
  if (regionHtml === null) {
    return { ok: false, errors: [`page has no <!-- words:${region} --> region`], count: 0, removed: [], dropped: {}, footnotes: 0 };
  }

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
    if (!html.includes(`<h2>${escaped}</h2>`)) errors.push('<h2> does not match the frontmatter title');
    if (!html.includes(`<time datetime="${data.date}">`)) errors.push('the page date does not match the frontmatter date');
  }

  const prepared = prepareBody(body);
  const source = words(mdToText(prepared.body));
  const page = words(htmlToText(regionHtml));
  if (source.length === 0) errors.push('the source has no text');
  const aligned = align(source, page);
  if (aligned.error) errors.push(aligned.error);

  return {
    ok: errors.length === 0,
    errors,
    count: source.length,
    removed: aligned.removed || [],
    dropped: prepared.dropped,
    footnotes: prepared.footnotes,
  };
}

module.exports = { verify, parseFrontmatter, gateErrors, prepareBody, mdToText, htmlToText, words };

if (require.main === module) {
  const [mdPath, htmlPath, region = 'post'] = process.argv.slice(2);
  if (!mdPath || !htmlPath) {
    console.error('Usage: node tools/verify.js <source.md> <page.html> [region]');
    process.exit(2);
  }
  const resolve = p => path.resolve(ROOT, p);
  const result = verify(fs.readFileSync(resolve(mdPath), 'utf8'), fs.readFileSync(resolve(htmlPath), 'utf8'), region);
  if (!result.ok) {
    console.error(`NOT OK: ${mdPath} -> ${htmlPath}, region "${region}"`);
    for (const e of result.errors) console.error(`- ${e}`);
    process.exit(1);
  }

  const removedWords = result.removed.join(' ').split(/\s+/).filter(Boolean).length;
  console.log(removedWords
    ? `OK: the other ${result.count - removedWords} of ${result.count} words match exactly (${mdPath} -> ${htmlPath}, region "${region}")`
    : `OK: all ${result.count} words match exactly (${mdPath} -> ${htmlPath}, region "${region}")`);
  const left = Object.entries(result.dropped).filter(([, n]) => n).map(([k, n]) => `${n} ${n === 1 ? k.replace(/s$/, '') : k}`);
  if (left.length) console.log(`Left out, can't be published: ${left.join(', ')}`);
  if (result.footnotes) console.log(`Footnotes: ${result.footnotes}`);
  if (result.removed.length) {
    console.log(`Removed for privacy (${result.removed.length}):`);
    for (const text of result.removed) console.log(`  - "${text}"`);
  }
}
