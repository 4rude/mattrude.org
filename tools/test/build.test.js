/**
 * Tests for the build: redirects, dates, and region filling.
 * Run all tests with:  node --test tools/test/
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { redirectsText, fillRegions } = require('../build');
const { rssDate } = require('../lib');

const ROOT = path.join(__dirname, '..', '..');

test('every removed post redirects to /corrections/ with a 301, with and without .html', () => {
  const corrections = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'corrections.json'), 'utf8'));
  const rules = redirectsText(corrections);
  const committed = fs.readFileSync(path.join(ROOT, 'public', '_redirects'), 'utf8');
  assert.strictEqual(committed, rules, 'public/_redirects is out of date: run node tools/build.js');

  const expected = [
    '/blog/posts/2025-03-25-launching-my-personal-website',
    '/blog/posts/2025-04-02-why-technology-is-more-affordable-than-ever',
    '/blog/posts/2025-05-01-security-on-a-budget',
    '/blog/posts/2026-02-09-site-update-and-ai-transparency',
  ];
  const lines = new Set(rules.split('\n'));
  for (const p of expected) {
    assert.ok(lines.has(`${p}.html /corrections/ 301`), `${p}.html`);
    assert.ok(lines.has(`${p} /corrections/ 301`), p);
  }
});

test('RSS dates are noon UTC and fall on the post date in every US time zone', () => {
  assert.strictEqual(rssDate('2026-02-09'), 'Mon, 09 Feb 2026 12:00:00 GMT');
  assert.strictEqual(rssDate('2026-07-04'), 'Sat, 04 Jul 2026 12:00:00 GMT');
  const zones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
    'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Puerto_Rico',
    'Pacific/Guam', 'Pacific/Pago_Pago'];
  for (const date of ['2026-01-15', '2026-07-15', '2026-03-08', '2026-11-01']) {
    for (const timeZone of zones) {
      const shown = new Date(rssDate(date)).toLocaleDateString('en-CA', { timeZone });
      assert.strictEqual(shown, date, `${date} in ${timeZone}`);
    }
  }
});

test('filling regions is repeatable and leaves words regions alone', () => {
  const html = [
    '<main>',
    '    <!-- build:footer -->',
    '    old footer',
    '    <!-- /build:footer -->',
    '<!-- words:post -->',
    '<p>Alpha bravo.</p>',
    '<!-- /words:post -->',
    '</main>',
  ].join('\n');
  const fillers = { footer: () => '<p>new</p>' };
  const once = fillRegions(html, 'x.html', fillers);
  assert.strictEqual(fillRegions(once, 'x.html', fillers), once);
  assert.match(once, /    <!-- build:footer -->\n    <p>new<\/p>\n    <!-- \/build:footer -->/);
  assert.match(once, /<!-- words:post -->\n<p>Alpha bravo.<\/p>\n<!-- \/words:post -->/);
  assert.throws(() => fillRegions('<!-- build:nope --><!-- /build:nope -->', 'x.html', fillers), /unknown build region/);
});
