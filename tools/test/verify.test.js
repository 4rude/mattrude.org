/**
 * Tests for tools/verify.js. Run all tests with:  node --test tools/test/
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

function assertFails(result, pattern) {
  assert.strictEqual(result.ok, false, 'expected verify to fail');
  assert.match(result.errors.join('\n'), pattern);
}

test('a faithful conversion passes', () => {
  const result = verify(MD, page());
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.ok, true);
  assert.ok(result.count > 50);
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

test('dropping one word fails', () => {
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

test('a missing callout label is caught', () => {
  const changed = CONTENT.replace('<figcaption class="quote-label">Voice transcript, unedited</figcaption>\n', '');
  // Removing the label is not a word change, but the model name must survive.
  assert.strictEqual(verify(MD, page({ content: changed })).ok, true);
  const noModel = CONTENT.replace('Written by Example Model 1', 'Written by');
  assertFails(verify(MD, page({ content: noModel })), /Example/);
});

test('status other than ready is refused', () => {
  assertFails(verify(MD.replace('status: ready', 'status: draft'), page()), /refused: status is "draft"/);
});

test('privacy_reviewed false is refused', () => {
  assertFails(verify(MD.replace('privacy_reviewed: true', 'privacy_reviewed: false'), page()), /refused: privacy_reviewed/);
});

test('privacy_reviewed as a string is refused', () => {
  assertFails(verify(MD.replace('privacy_reviewed: true', 'privacy_reviewed: "yes"'), page()), /refused: privacy_reviewed/);
});

test('a bad date or kind is refused', () => {
  assertFails(verify(MD.replace('date: 2026-01-05', 'date: 2026-02-30'), page()), /refused: date/);
  assertFails(verify(MD.replace('kind: technical', 'kind: memoir'), page()), /refused: kind/);
});

test('Obsidian comments, wikilinks and footnotes are refused', () => {
  assertFails(verify(MD + '\n%% private note %%\n', page()), /Obsidian comment/);
  assertFails(verify(MD + '\nSee [[Other note]].\n', page()), /wikilink/);
  assertFails(verify(MD + '\nAlpha[^1].\n', page()), /footnote/);
});

test('[[ inside code is not treated as a wikilink', () => {
  const md = MD.replace('code delta_two <tag>', 'if [[ -f x ]]; then echo; fi');
  const html = CONTENT.replace('code delta_two &lt;tag&gt;', 'if [[ -f x ]]; then echo; fi');
  assert.deepStrictEqual(verify(md, page({ content: html })).errors, []);
});

test('a page title that differs from the frontmatter fails', () => {
  assertFails(verify(MD, page({ title: 'Alpha Bravo Test' })), /title/);
});

test('a page date that differs from the frontmatter fails', () => {
  assertFails(verify(MD, page({ date: '2026-01-06' })), /date/);
});

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
  assert.strictEqual(verify(md, html, 'tools-i-use').ok, true);
  assertFails(verify(md.replace('ready', 'draft'), html, 'tools-i-use'), /refused: status/);
});
