/**
 * Tests for tools/verify.js. Run all tests with:  node --test tools/test/*.test.js
 *
 * The fixture is filler text, not prose. The page is made the same way the
 * publish-post skill makes one: tools/post-template.html with its
 * placeholders filled.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { verify, parseFrontmatter } = require('../verify');
const { escapeHtml, displayDate } = require('../lib');

const FIXTURES = path.join(__dirname, 'fixtures');
const MD = fs.readFileSync(path.join(FIXTURES, 'post.md'), 'utf8');
const CONTENT = fs.readFileSync(path.join(FIXTURES, 'post-content.html'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'post-template.html'), 'utf8');

function page({ content = CONTENT, title = 'Alpha Bravo "Test"', date = '2026-01-05', tags = ['test', 'filler'] } = {}) {
  return TEMPLATE
    .replaceAll('{{TITLE_JSON}}', JSON.stringify(title).slice(1, -1))
    .replaceAll('{{TITLE_HTML}}', escapeHtml(title))
    .replaceAll('{{DATE}}', date)
    .replaceAll('{{DATE_DISPLAY}}', displayDate(date))
    .replaceAll('{{TAGS_JSON}}', JSON.stringify(tags))
    .replaceAll('{{KIND}}', 'technical')
    .replaceAll('{{SOURCE}}', 'tools/test/fixtures/post.md')
    .replace('{{CONTENT}}', content.trim());
}

/** A minimal post: frontmatter from the fixture plus the given body. */
function post(body) {
  return MD.slice(0, MD.indexOf('---', 4) + 4) + body;
}

function assertOk(result) {
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.ok, true);
}

function assertFails(result, pattern) {
  assert.strictEqual(result.ok, false, 'expected verify to fail');
  assert.match(result.errors.join('\n'), pattern);
}

/* ---------- exact words ---------- */

test('a faithful conversion passes', () => {
  const result = verify(MD, page());
  assertOk(result);
  assert.ok(result.count > 50);
  assert.deepStrictEqual(result.removed, []);
});

test('changing one word in the page fails', () => {
  const changed = CONTENT.replace('golf <em>hotel</em>', 'gulf <em>hotel</em>');
  assert.notStrictEqual(changed, CONTENT);
  assertFails(verify(MD, page({ content: changed })), /source "golf" vs page "gulf"/);
});

test('changing one word in the source fails', () => {
  const changed = MD.replace('Tango uniform', 'Tango uniforms');
  assertFails(verify(changed, page()), /source "uniforms" vs page "uniform"/);
});

test('dropping one word without a removal marker fails', () => {
  assertFails(verify(MD, page({ content: CONTENT.replace('yankee zulu', 'zulu') })), /words differ/);
});

test('curly quotes instead of straight ones fail', () => {
  assertFails(verify(MD, page({ content: CONTENT.replace("Foxtrot's", 'Foxtrot’s') })), /Foxtrot/);
  assertFails(verify(MD, page({ content: CONTENT.replace("Foxtrot's", 'Foxtrot&rsquo;s') })), /Foxtrot/);
});

test('an em dash instead of two hyphens fails', () => {
  assertFails(verify(MD, page({ content: CONTENT.replace('two -- golf', 'two — golf') })), /words differ/);
});

test('an added word, even in a label, fails', () => {
  const changed = CONTENT.replace('Written by Example Model 1', 'Written by Example Model 1 (edited)');
  assertFails(verify(MD, page({ content: changed })), /words differ/);
});

test('callout labels are ignored but the model name must survive', () => {
  const noLabel = CONTENT.replace('<figcaption class="quote-label">Voice transcript, unedited</figcaption>\n', '');
  assertOk(verify(MD, page({ content: noLabel })));
  const noModel = CONTENT.replace('Written by Example Model 1', 'Written by');
  assertFails(verify(MD, page({ content: noModel })), /Example/);
});

/* ---------- the gate ---------- */

test('status other than ready is refused', () => {
  assertFails(verify(MD.replace('status: ready', 'status: draft'), page()), /refused: status is "draft"/);
});

test('privacy_reviewed is no longer required', () => {
  assertOk(verify(MD.replace('privacy_reviewed: true', 'privacy_reviewed: false'), page()));
  assertOk(verify(MD.replace('privacy_reviewed: true\n', ''), page()));
});

test('a bad date or kind is refused', () => {
  assertFails(verify(MD.replace('date: 2026-01-05', 'date: 2026-02-30'), page()), /refused: date/);
  assertFails(verify(MD.replace('kind: technical', 'kind: memoir'), page()), /refused: kind/);
});

test('a page title or date that differs from the frontmatter fails', () => {
  assertFails(verify(MD, page({ title: 'Alpha Bravo Test' })), /title/);
  assertFails(verify(MD, page({ date: '2026-01-06' })), /date/);
});

/* ---------- left out automatically ---------- */

test('Obsidian and HTML comments are left out of the page', () => {
  const md = post('Alpha %%private note%% bravo.\n\n%%\nwhole\nblock\n%%\n\nCharlie <!-- hidden --> delta %%x%%.\n');
  const result = verify(md, page({ content: '<p>Alpha bravo.</p>\n<p>Charlie delta.</p>' }));
  assertOk(result);
  assert.strictEqual(result.dropped.comments, 4);
  assertFails(verify(md, page({ content: '<p>Alpha private note bravo.</p>\n<p>Charlie delta.</p>' })), /words differ/);
});

test('embeds, images and block ids are left out', () => {
  const md = post('Alpha ![[Pasted image 1.png]] bravo ![a diagram](pic.png) charlie. ^block-1\n');
  const result = verify(md, page({ content: '<p>Alpha bravo charlie.</p>' }));
  assertOk(result);
  assert.strictEqual(result.dropped.embeds, 1);
  assert.strictEqual(result.dropped.images, 1);
});

test('dataview and query blocks are left out, other code is kept', () => {
  const md = post('Alpha.\n\n```dataview\nLIST FROM "posts"\n```\n\n```js\nlet x = 1;\n```\n');
  const result = verify(md, page({ content: '<p>Alpha.</p>\n<pre><code>let x = 1;\n</code></pre>' }));
  assertOk(result);
  assert.strictEqual(result.dropped.blocks, 1);
});

test('wikilinks become their plain text', () => {
  const md = post('See [[Other note]] and [[Other note#Part|this part]] or [[#Section]].\n');
  assertOk(verify(md, page({ content: '<p>See Other note and this part or Section.</p>' })));
});

test('[[ inside code is kept literally', () => {
  const md = MD.replace('code delta_two <tag>', 'if [[ -f x ]]; then echo; fi');
  const html = CONTENT.replace('code delta_two &lt;tag&gt;', 'if [[ -f x ]]; then echo; fi');
  assertOk(verify(md, page({ content: html })));
});

test('footnotes are listed at the end in order of first reference', () => {
  const md = post('Alpha[^b] bravo[^a] charlie^[Inline note.] delta[^b].\n\n[^a]: Source A.\n[^b]: Source B,\n    continued.\n');
  const html = [
    '<p>Alpha<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1</a></sup> bravo<sup class="footnote-ref"><a href="#fn-2" id="fnref-2">2</a></sup> charlie<sup class="footnote-ref"><a href="#fn-3" id="fnref-3">3</a></sup> delta<sup class="footnote-ref"><a href="#fn-1">1</a></sup>.</p>',
    '<section class="footnotes">',
    '<ol>',
    '<li id="fn-1">Source B,<br>continued. <a href="#fnref-1" class="footnote-back" aria-label="Back to text">↩</a></li>',
    '<li id="fn-2">Source A. <a href="#fnref-2" class="footnote-back" aria-label="Back to text">↩</a></li>',
    '<li id="fn-3">Inline note. <a href="#fnref-3" class="footnote-back" aria-label="Back to text">↩</a></li>',
    '</ol>',
    '</section>',
  ].join('\n');
  const result = verify(md, page({ content: html }));
  assertOk(result);
  assert.strictEqual(result.footnotes, 3);
  assertFails(verify(md, page({ content: html.replace('Source A.', 'Source Z.') })), /words differ/);
});

/* ---------- privacy removals ---------- */

test('a marked privacy removal passes and is reported', () => {
  const md = post('Alpha bravo. I met Jane Doe at Acme. Charlie delta.\n');
  const result = verify(md, page({ content: '<p>Alpha bravo. <!-- removed --> Charlie delta.</p>' }));
  assertOk(result);
  assert.deepStrictEqual(result.removed, ['I met Jane Doe at Acme.']);
});

test('removals at the start and end, and inside a transcript, are reported', () => {
  const md = post('Jane said hi. Alpha bravo.\n\n> [!transcript]\n> Uh, call Bob at home. Charlie.\n\nDelta. Bob again.\n');
  const html = [
    '<p><!-- removed --> Alpha bravo.</p>',
    '<figure class="labeled-quote">',
    '<figcaption class="quote-label">Voice transcript, unedited</figcaption>',
    '<blockquote>',
    '<p><span class="removed">[removed]</span> Charlie.</p>',
    '</blockquote>',
    '</figure>',
    '<p>Delta. <!-- removed --></p>',
  ].join('\n');
  const result = verify(md, page({ content: html }));
  assertOk(result);
  assert.deepStrictEqual(result.removed, ['Jane said hi.', 'Uh, call Bob at home.', 'Bob again.']);
});

test('a removal marker cannot hide a changed or added word elsewhere', () => {
  const md = post('Alpha bravo. I met Jane. Charlie delta echo.\n');
  assertFails(verify(md, page({ content: '<p>Alpha bravo. <!-- removed --> Charlie delta echoes.</p>' })), /removal 1/);
  assertFails(verify(md, page({ content: '<p>Alpha bravo. <!-- removed --> Charlie very delta echo.</p>' })), /removal 1/);
  assertFails(verify(md, page({ content: '<p>Alpha bravo! <!-- removed --> Charlie delta echo.</p>' })), /before the first removal/);
});

test('a removal marker must stand for at least one word', () => {
  const md = post('Alpha bravo charlie.\n');
  assertFails(verify(md, page({ content: '<p>Alpha bravo <!-- removed --> charlie.</p>' })), /removal 1/);
});

test('a removal cannot reorder words', () => {
  const md = post('Alpha bravo. Secret here. Charlie delta.\n');
  assertFails(verify(md, page({ content: '<p>Charlie delta. <!-- removed --> Alpha bravo.</p>' })), /words differ|removal/);
});

/* ---------- frontmatter and regions ---------- */

test('frontmatter parser reads the vault template and Obsidian list styles', () => {
  // Same text as vault/templates/post.md (the vault is not in git).
  const template = [
    '---',
    'title:',
    'date:            # YYYY-MM-DD',
    'tags: []',
    'kind:            # technical | personal',
    'status: draft    # draft | ready',
    'privacy_reviewed: false   # I set this to true myself after checking PII and what an employer would read',
    '---',
    '',
  ].join('\n');
  const { data } = parseFrontmatter(template);
  assert.deepStrictEqual(data, { title: '', date: '', tags: [], kind: '', status: 'draft', privacy_reviewed: false });

  const { data: obsidian } = parseFrontmatter('---\ntitle: "C# tips: part 1"\ntags:\n  - a\n  - b\nstatus: ready\n---\nBody');
  assert.deepStrictEqual(obsidian, { title: 'C# tips: part 1', tags: ['a', 'b'], status: 'ready' });
});

test('the tools-i-use region only needs status: ready', () => {
  const md = '---\nstatus: ready\n---\n# Tools I use\n\nAlpha bravo.\n';
  const html = '<!-- words:tools-i-use -->\n<h3>Tools I use</h3>\n<p>Alpha bravo.</p>\n<!-- /words:tools-i-use -->';
  assertOk(verify(md, html, 'tools-i-use'));
  assertFails(verify(md.replace('ready', 'draft'), html, 'tools-i-use'), /refused: status/);
});
