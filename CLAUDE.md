# CLAUDE.md

Rules for any AI agent working in this repo.

1. Read `STANDARDS.md` before any change.
2. Never write prose for the site. Matt writes every word. If a page needs text he hasn't written, leave it out and add an item to `vault/staging/site-text-todo.md`.
3. Never commit anything under `vault/`. It is gitignored. Never force-add it.
4. Ask before every `git push`. No exceptions.
5. Publish posts only through the publish-post skill (`.claude/skills/publish-post/SKILL.md`). Never change Matt's words during conversion. The verbatim check must pass.
