# CLAUDE.md

Rules for any AI agent working in this repo.

1. Read `STANDARDS.md` before any change.
2. Never write prose for the site. Matt writes every word. If a page needs text he hasn't written, leave it out and add an item to `vault/staging/site-text-todo.md`.
3. Never commit anything under `vault/`. It is gitignored. Never force-add it.
4. Ask before every `git push`. No exceptions.
5. Publish posts only through the publish-post skill (`.claude/skills/publish-post/SKILL.md`). Never change Matt's words during conversion. The only differences allowed are the leave-outs and marked privacy removals the skill describes, each reported to Matt. The verbatim check must pass. Never edit the vault file.
6. Run `node tools/check.js` before asking to push.
7. The contact address must never appear as one string in the repo, the served HTML, or a commit message. It lives in `site.config.json` as two parts.

## Layout

- `public/` is the only folder Cloudflare Pages serves.
- `node tools/build.js` rebuilds the index, every `<!-- build:NAME -->` region, `_redirects`, and the feed. Don't edit inside build regions by hand.
- `<!-- words:NAME -->` regions hold Matt's words. Only the publish-post skill writes them, and `tools/verify.js` checks them.
- Local preview: `python3 -m http.server 8000 --directory public`.
