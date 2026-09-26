/**
 * lib.js: small helpers shared by the build, feed, and check scripts.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

function readConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** "2026-02-09" -> "February 9, 2026". Pure string work, no time zones. */
function displayDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/**
 * "2026-02-09" -> "Mon, 09 Feb 2026 12:00:00 GMT".
 * A post date is a calendar date, not an instant. Noon UTC falls on the
 * same calendar date in every US time zone.
 */
function rssDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toUTCString();
}

/** All .html files under a folder, sorted, as absolute paths. */
function listHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listHtmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

/**
 * Text between <!-- words:NAME --> and <!-- /words:NAME -->.
 * These regions hold Matt's words. Scripts read them but never write them.
 */
function wordsRegion(html, name) {
  const match = html.match(new RegExp(`<!-- words:${name} -->([\\s\\S]*?)<!-- /words:${name} -->`));
  return match ? match[1] : null;
}

module.exports = {
  ROOT, PUBLIC, readConfig, escapeHtml, displayDate, rssDate, listHtmlFiles, wordsRegion,
};
