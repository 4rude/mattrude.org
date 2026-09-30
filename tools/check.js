/**
 * check.js: the acceptance checks. tools/push.sh runs this before pushing.
 *
 *   node tools/check.js
 *
 * Fails (exit 1) if any of these is wrong:
 *  - the tests (node --test tools/test/*.test.js)
 *  - the build output is out of date
 *  - feed.xml is not well-formed, or an item date doesn't match its post
 *  - a page shows a placeholder (TODO, [your text here], {{...}}, lorem ipsum)
 *  - the full contact address appears in any file in git, in any commit
 *    message, or a mailto: appears in the served HTML
 *  - anything under vault/ is tracked, or vault/ is not ignored
 *  - a words region doesn't match its vault source, apart from marked
 *    privacy removals (skipped, with a note, when the vault file isn't on
 *    this machine)
 *  - a corrections reason or intro isn't word for word in
 *    vault/staging/corrections.md (same skip rule)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { ROOT, PUBLIC, readConfig, listHtmlFiles, rssDate } = require('./lib');
const { verify, words } = require('./verify');
const { readMeta } = require('./generate-index');

let failures = 0;
const ok = msg => console.log(`  ok    ${msg}`);
const fail = msg => { failures++; console.log(`  FAIL  ${msg}`); };
const note = msg => console.log(`  note  ${msg}`);
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const rel = p => path.relative(ROOT, p);

function checkTests() {
  const dir = path.join(ROOT, 'tools', 'test');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).map(f => path.join(dir, f));
  const run = spawnSync(process.execPath, ['--test', ...files], { encoding: 'utf8' });
  const summary = (run.stdout.match(/^# (pass|fail) \d+$/gm) || []).join(', ').replace(/# /g, '');
  if (run.status === 0) ok(`tests (${summary})`);
  else { fail(`tests (${summary})`); console.log(run.stdout.split('\n').filter(l => /^not ok|error:|source|page:/.test(l.trim())).join('\n')); }
}

function snapshot() {
  const out = new Map();
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name !== '.DS_Store') out.set(full, fs.readFileSync(full, 'utf8'));
    }
  };
  walk(PUBLIC);
  return out;
}

function checkBuildCurrent() {
  const before = snapshot();
  const log = console.log;
  console.log = () => {};
  try { require('./build').build(); } finally { console.log = log; }
  const after = snapshot();
  const changed = [...after.keys()].filter(f => before.get(f) !== after.get(f));
  if (changed.length === 0) ok('build output is up to date');
  else fail(`build output was out of date and has now been rebuilt; review and commit: ${changed.map(rel).join(', ')}`);
}

function checkFeed() {
  const feedPath = path.join(PUBLIC, 'feed.xml');
  const xml = fs.readFileSync(feedPath, 'utf8');
  const lint = spawnSync('xmllint', ['--noout', feedPath], { encoding: 'utf8' });
  if (lint.error) note('xmllint not found; feed well-formedness not checked');
  else if (lint.status === 0) ok('feed.xml is well-formed XML');
  else fail(`feed.xml is not well-formed: ${lint.stderr.trim()}`);

  for (const tag of ['title', 'link', 'description']) {
    if (!new RegExp(`<channel>[\\s\\S]*<${tag}>`).test(xml)) fail(`feed.xml channel has no <${tag}>`);
  }

  const index = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'blog', 'post-index.json'), 'utf8'));
  const items = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<pubDate>([^<]+)<\/pubDate>[\s\S]*?<\/item>/g)];
  if (items.length !== index.posts.length) fail(`feed has ${items.length} items but there are ${index.posts.length} posts`);
  let bad = 0;
  for (const [, link, pubDate] of items) {
    const post = index.posts.find(p => link.endsWith(`/blog/posts/${p.slug}`));
    if (!post || pubDate !== rssDate(post.date)) { bad++; fail(`feed item ${link} has pubDate ${pubDate}`); }
  }
  if (!bad) ok(`feed item dates match post dates (${items.length} item(s))`);
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function checkPlaceholders() {
  const pattern = /\bTODO\b|\[your text here\]|\{\{|lorem ipsum/i;
  let found = 0;
  for (const file of listHtmlFiles(PUBLIC)) {
    const text = visibleText(fs.readFileSync(file, 'utf8'));
    const m = text.match(pattern);
    if (m) { found++; fail(`${rel(file)} shows a placeholder: "${m[0]}"`); }
  }
  if (!found) ok('no visible placeholders in served pages');
}

function checkAddress() {
  const { user, domain } = readConfig().contact;
  const address = `${user}@${domain}`.toLowerCase();
  let found = 0;

  const files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
  for (const f of files) {
    const full = path.join(ROOT, f);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) continue;
    if (fs.readFileSync(full, 'latin1').toLowerCase().includes(address)) { found++; fail(`full contact address found in ${f}`); }
  }
  if (git('log', '--all', '--format=%B').toLowerCase().includes(address)) { found++; fail('full contact address found in a commit message'); }
  for (const file of listHtmlFiles(PUBLIC)) {
    if (/mailto:/i.test(fs.readFileSync(file, 'utf8'))) { found++; fail(`mailto: link in served HTML: ${rel(file)}`); }
  }
  if (!found) ok('full contact address is not in any file, commit message, or served page');
}

function checkVault() {
  const tracked = git('ls-files', 'vault').trim();
  if (tracked) fail(`vault files are tracked by git:\n${tracked}`);
  const ignored = spawnSync('git', ['-C', ROOT, 'check-ignore', '-q', 'vault/']).status === 0;
  if (!ignored) fail('vault/ is not ignored by git');
  if (!tracked && ignored) ok('vault/ is ignored and nothing in it is tracked');
}

/** Region name -> vault source, for regions that are not blog posts. */
const REGION_SOURCES = { 'tools-i-use': 'vault/staging/tools-i-use.md' };

function checkWords() {
  let checked = 0;
  for (const file of listHtmlFiles(PUBLIC)) {
    const html = fs.readFileSync(file, 'utf8');
    for (const [, region] of html.matchAll(/<!-- words:([\w-]+) -->/g)) {
      let source = REGION_SOURCES[region];
      if (region === 'post') {
        try { source = readMeta(html, rel(file)).source; } catch (e) { fail(e.message); continue; }
      }
      if (!source) { fail(`${rel(file)}: no known vault source for words:${region}`); continue; }
      const sourcePath = path.join(ROOT, source);
      if (!fs.existsSync(sourcePath)) { note(`${rel(file)}: ${source} not on this machine, words not re-checked`); continue; }
      const result = verify(fs.readFileSync(sourcePath, 'utf8'), html, region);
      checked++;
      if (!result.ok) fail(`${rel(file)} vs ${source}:\n    ${result.errors.join('\n    ')}`);
      else if (result.removed.length) note(`${rel(file)}: ${result.removed.length} privacy removal(s); details: node tools/verify.js ${source} ${rel(file)}${region === 'post' ? '' : ' ' + region}`);
    }
  }
  ok(`words regions re-verified against the vault (${checked})`);
}

function checkCorrections() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'corrections.json'), 'utf8'));
  const texts = [data.intro, ...data.entries.map(e => e.reason)].filter(Boolean);
  if (texts.length === 0) { ok('corrections: no reasons or intro yet'); return; }
  const sourcePath = path.join(ROOT, 'vault', 'staging', 'corrections.md');
  if (!fs.existsSync(sourcePath)) { note('vault/staging/corrections.md not on this machine; reasons not re-checked'); return; }
  const source = ` ${words(fs.readFileSync(sourcePath, 'utf8')).join(' ')} `;
  let bad = 0;
  for (const text of texts) {
    if (!source.includes(` ${words(text).join(' ')} `)) { bad++; fail(`corrections text not found word for word in corrections.md: "${text.slice(0, 60)}..."`); }
  }
  if (!bad) ok(`corrections text matches corrections.md (${texts.length})`);
}

console.log('Checking mattrude.org');
for (const check of [checkTests, checkBuildCurrent, checkFeed, checkPlaceholders, checkAddress, checkVault, checkWords, checkCorrections]) {
  try { check(); } catch (e) { fail(`${check.name} crashed: ${e.message}`); }
}
console.log(failures ? `\n${failures} problem(s). Do not push.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
