# mattrude.org

Source for [mattrude.org](https://www.mattrude.org). Plain HTML and CSS, one small script, hosted on Cloudflare Pages. Pushing to `main` deploys.

## Layout

| Path | What it is |
|---|---|
| `public/` | Everything the site serves. Cloudflare Pages deploys only this folder. |
| `tools/` | Node scripts: build, verify, checks, push. No dependencies. |
| `data/corrections.json` | Removed pages. The build makes `/corrections/` and `public/_redirects` from it. |
| `site.config.json` | Site URL, profile links, and the contact address stored as two parts. |
| `.claude/skills/publish-post/` | The procedure Claude follows to publish from the vault. |
| `STANDARDS.md` | Who writes what, privacy, corrections, licensing. |
| `vault/` | Local Obsidian vault. Gitignored and never committed. |

## Publishing a post

1. Write the post in `vault/posts/`. When it's done, set `status: ready`.
2. In Claude Code, ask Claude to publish it. Claude follows `.claude/skills/publish-post/SKILL.md`: a privacy pass, then it turns the Markdown into a page, leaving out what can't be published (Obsidian comments, embeds, private details). `node tools/verify.js` confirms every other word matches (one changed word fails it) and lists each removal. Then Claude builds, commits, and reports what was removed. The vault file is never edited.
3. Push with `tools/push.sh`.

## Commands

```bash
node tools/build.js
```

Writes the post index, homepage list, footers, contact line, corrections list, `_redirects`, and `feed.xml`.

```bash
node tools/check.js
```

Runs every check: tests, build up to date, feed, placeholders, contact address, vault, words. `push.sh` runs it first.

```bash
tools/push.sh
```

Checks, shows the commits that will go out, asks, then pushes `main`.

The build overwrites everything inside `<!-- build:NAME -->` regions, so don't edit them by hand. `<!-- words:NAME -->` regions hold Matt's words. Scripts read them but never write them.

## Local preview

```bash
python3 -m http.server 8000 --directory public
```

The Python server doesn't apply `_redirects`, the 404 page, or extensionless URLs. Those work only on Cloudflare Pages.

## Cloudflare Pages settings

- Build command: none
- Build output directory: `public`

## License

- Code: MIT License. See `LICENSE`.
- Writing on the site: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) unless noted.
