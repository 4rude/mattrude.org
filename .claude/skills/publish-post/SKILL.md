---
name: publish-post
description: Turn a finished post from Matt's Obsidian vault (vault/posts/*.md) into a page on mattrude.org without changing a word. Also covers the resume's "Tools I use" section and copying corrections reasons. Use when Matt asks to publish, republish, or unpublish a post or staged text.
---

# Publish from the vault

Matt writes every word. You only do formatting. If a step would change, add, drop, or reorder even one word, stop and ask Matt. Read `STANDARDS.md` first.

## 1. Check that it may be published

Read the file's frontmatter. Stop, and tell Matt the reason, if any of these is true:

- `status` is not `ready`.
- `privacy_reviewed` is not `true`. Only Matt sets it. Never change it yourself.
- `title` is empty, `date` is not a real `YYYY-MM-DD` date, or `kind` is not `technical` or `personal`.
- The body uses something the site can't show yet: `%% comments %%`, `[[wikilinks]]`, `![[embeds]]`, images, or footnotes (`[^1]`).

While reading, if you notice possible PII (names, places plus times plus roles, anything internal to Matt's employer), list it for Matt. Don't change it. He decides (STANDARDS.md rules 14 to 19).

## 2. Make the page

1. **File name:** `public/blog/posts/<date>-<slug>.html`. The slug is the title in lowercase ASCII, with words joined by hyphens and punctuation dropped. If a page already exists whose BLOG_META `source` is this vault file, overwrite that page and keep its file name, so the URL doesn't change.
2. **Template:** start from `tools/post-template.html` and replace every placeholder:

   | Placeholder | Value |
   |---|---|
   | `{{TITLE_JSON}}` | the title, JSON-escaped (for BLOG_META) |
   | `{{TITLE_HTML}}` | the title with only `&` `<` `>` `"` escaped as `&amp;` `&lt;` `&gt;` `&quot;` |
   | `{{DATE}}` | `YYYY-MM-DD` from the frontmatter |
   | `{{DATE_DISPLAY}}` | the date as e.g. `January 5, 2026` |
   | `{{TAGS_JSON}}` | the tags as a JSON array, e.g. `["a", "b"]` or `[]` |
   | `{{KIND}}` | `technical` or `personal` |
   | `{{SOURCE}}` | the vault path, e.g. `vault/posts/my-post.md` |
   | `{{CONTENT}}` | the body, converted as below |

3. **Body to HTML.** Convert everything after the frontmatter:
   - Copy every word and every punctuation mark exactly. No smart quotes, no dash changes, no spelling, grammar, or style fixes, no added or removed words. If something looks like a typo, tell Matt. Don't fix it.
   - Escape `&` `<` `>` in text as `&amp;` `&lt;` `&gt;`.
   - Paragraph: `<p>`. Headings: `#` and `##` become `<h3>`, `###` becomes `<h4>`, deeper levels become `<h5>` (the page title is the `<h2>`).
   - Lists: `<ul>` or `<ol>` with `<li>`. Task boxes (`- [ ]`) become plain list items.
   - `*em*` becomes `<em>`, `**strong**` becomes `<strong>`, `==highlight==` becomes `<mark>`, `~~strike~~` becomes `<del>`.
   - `[text](url)` becomes `<a href="url">text</a>`.
   - Inline code becomes `<code>`. Fenced code becomes `<pre><code>` with its lines unchanged.
   - `> quote` becomes `<blockquote><p>…</p></blockquote>`.
   - Tables become `<table>` with `<th>` and `<td>`. A `---` line becomes `<hr>`.
   - Callouts. Use exactly this markup, because the verify script only ignores these two labels:

     ```html
     <figure class="labeled-quote">
     <figcaption class="quote-label">Voice transcript, unedited</figcaption>
     <blockquote>
     <p>…the transcript, unchanged…</p>
     </blockquote>
     </figure>
     ```

     `> [!transcript]` uses the caption above. `> [!ai] <model name>` uses `<figcaption class="quote-label">Written by <model name></figcaption>`.
   - Add nothing else: no summary, intro, caption, alt text, or closing line that isn't in the source.

## 3. Verify, which must pass

```bash
node tools/verify.js vault/posts/<file>.md public/blog/posts/<page>.html
```

It must print `OK`. If it fails, fix the HTML and run it again. Never edit the vault file to make it pass. If you can't make it pass without changing a word, stop and ask Matt.

## 4. Build, check, commit

```bash
node tools/build.js
node tools/check.js
```

Then commit only the files under `public/`, with the message `Publish: <title>`. Never commit `vault/`.

Don't push. Tell Matt the post is committed and he can push with `tools/push.sh`, or ask you to push. Even then, ask before running the push.

## Unpublish a post

Delete the page, add an entry to `data/corrections.json` (the reason stays empty until Matt writes one), run the build and check, and commit. The build adds the redirects.

## "Tools I use" on the resume

Only when `vault/staging/tools-i-use.md` has `status: ready`. Replace the `<!-- Tools I use: ... -->` comment in `public/resume/index.html` with:

```html
<section class="tools-i-use">
    <!-- words:tools-i-use -->
    …the body converted as above; its "# Tools I use" heading becomes <h3>…
    <!-- /words:tools-i-use -->
</section>
```

Verify with `node tools/verify.js vault/staging/tools-i-use.md public/resume/index.html tools-i-use`. If the status goes back to `draft`, remove the section and put the comment back.

## Corrections reasons

Matt writes reasons and the intro in `vault/staging/corrections.md`. Copy one into `data/corrections.json` (`reason` or `intro`) only when he asks, character for character. `node tools/check.js` confirms each one appears word for word in corrections.md.
