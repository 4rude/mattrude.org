---
name: publish-post
description: Turn a finished post from Matt's Obsidian vault (vault/posts/*.md) into a page on mattrude.org without changing a word, leaving out anything that can't be published (Obsidian-only syntax, private details). Also covers the resume's "Tools I use" section and copying corrections reasons. Use when Matt asks to publish, republish, or unpublish a post or staged text.
---

# Publish from the vault

Matt writes every word. You do the formatting, and you leave out what can't be published. Nothing else changes: no rewording, no fixes, no additions. Leave-outs happen only in the page. **Never edit the vault file.** Read `STANDARDS.md` first.

## 1. Check that it's ready

Stop and tell Matt why if:

- `status` is not `ready`, or
- `title` is empty, `date` is not a real `YYYY-MM-DD` date, or `kind` is not `technical` or `personal`, or
- the **title** itself contains a private detail. Titles can't have removals, so ask him to change it.

`privacy_reviewed` is no longer required. The privacy pass below replaces it.

## 2. Privacy pass

Read the whole post, including transcripts, AI quotes, footnotes and code. Find anything that shouldn't be public:

- names of private people (family, friends, coworkers, customers, people named in transcripts, including misheard names). Public figures, authors and organizations cited as sources are fine, and so is Matt himself.
- contact details, street addresses, account or ID numbers, license plates
- where Matt lives now, more precisely than the city, and routines that would reveal it
- anything internal to his employer: customers, accounts, revenue or other numbers, internal tools, colleagues, anything not already public
- details that point to one private person when combined, such as a place plus a time plus a role
- other people's health, legal, money or relationship details
- secrets in technical posts: passwords, keys, tokens, internal hostnames or IP addresses

**Remove** each one by taking out the whole sentence that contains it, or the whole list item, table row, heading or paragraph. Never remove part of a sentence. Put a marker where it was:

- In normal text: `<!-- removed -->`. Readers see nothing.
- Inside a transcript or AI quote, which are labeled as verbatim: `<span class="removed">[removed]</span>`. Readers see that something was removed.

If you're unsure whether something is private, remove it and say so in your report.

**Keep** anything listed in an optional `keep:` list in the frontmatter, for example `keep: [Cathedral Hill]`. Matt has decided those are fine.

**Flag, don't remove**, anything that's a judgment call rather than private: opinions, criticism of past employers or schools, anything a future employer might read badly. List these in your report.

## 3. Leave out what the site can't show

These come out automatically, and the verify script takes them out the same way:

| In the vault file | In the page |
|---|---|
| `%% comments %%` and `<!-- comments -->` | left out |
| `![[embeds]]` and images `![alt](file)` | left out (images aren't supported yet) |
| block IDs like ` ^abc123` at the end of a line | left out |
| code blocks marked `dataview`, `dataviewjs`, `query` or `tasks` | left out |
| `[[Note]]`, `[[Note\|shown text]]`, `[[#Section]]` | plain text: `Note`, `shown text`, `Section` (no link) |

When you remove something mid-sentence, like a comment before a period, write the sentence as it reads without it: `delta %%note%%.` becomes `delta.`

## 4. Make the page

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

3. **Body to HTML:**
   - Copy every word and every punctuation mark exactly. No smart quotes, no dash changes, no spelling, grammar or style fixes. If something looks like a typo, tell Matt. Don't fix it.
   - Escape `&` `<` `>` in text as `&amp;` `&lt;` `&gt;`.
   - Paragraph: `<p>`. Headings: `#` and `##` become `<h3>`, `###` becomes `<h4>`, deeper levels become `<h5>` (the page title is the `<h2>`).
   - Lists: `<ul>` or `<ol>` with `<li>`. Task boxes (`- [ ]`) become plain list items.
   - `*em*` becomes `<em>`, `**strong**` becomes `<strong>`, `==highlight==` becomes `<mark>`, `~~strike~~` becomes `<del>`.
   - `[text](url)` becomes `<a href="url">text</a>`.
   - Inline code becomes `<code>`. Fenced code becomes `<pre><code>` with its lines unchanged.
   - `> quote` becomes `<blockquote><p>…</p></blockquote>`.
   - Tables become `<table>` with `<th>` and `<td>`. A `---` line becomes `<hr>`.
   - Transcript and AI callouts. Use exactly this markup, because the verify script only ignores these captions:

     ```html
     <figure class="labeled-quote">
     <figcaption class="quote-label">Voice transcript, unedited</figcaption>
     <blockquote>
     <p>…the transcript, unchanged…</p>
     </blockquote>
     </figure>
     ```

     `> [!transcript]` uses the caption above. `> [!ai] <model name>` uses `<figcaption class="quote-label">Written by <model name></figcaption>`.
   - Other callouts (`> [!note] Title` and so on) become a plain `<blockquote>`. The title, if any, becomes `<p><strong>Title</strong></p>`.
   - Footnotes (`[^id]` with `[^id]: text` anywhere in the post, or inline `^[text]`). Number them 1, 2, 3 in order of first reference. Each reference becomes `<sup class="footnote-ref"><a href="#fn-N" id="fnref-N">N</a></sup>`; a repeated reference leaves out the `id`. At the end of the body, add the list in that order:

     ```html
     <section class="footnotes">
     <ol>
     <li id="fn-1">Footnote text. <a href="#fnref-1" class="footnote-back" aria-label="Back to text">↩</a></li>
     </ol>
     </section>
     ```

     A definition that is never referenced still goes at the end of the list.
   - Add nothing else: no summary, intro, caption, alt text or closing line that isn't in the source.

## 5. Verify, which must pass

```bash
node tools/verify.js vault/posts/<file>.md public/blog/posts/<page>.html
```

It must print `OK`. It lists what was left out and every privacy removal, word for word. If it fails, fix the HTML and run it again. Never edit the vault file to make it pass. If you can't make it pass without changing a word, stop and ask Matt.

## 6. Build, check, commit, report

```bash
node tools/build.js
node tools/check.js
```

Commit only the files under `public/`, with the message `Publish: <title>`. The message must never include removed text. Never commit `vault/`.

Then report to Matt:

1. **Removed for privacy:** each removed sentence, quoted from the verify output, and why.
2. **Left out:** the counts from the verify output (comments, embeds, images and so on).
3. **Flagged, not removed:** judgment calls from step 2.
4. The post is committed and not pushed. He can put something back by adding it to `keep:` in the frontmatter (then ask you to republish), and push with `tools/push.sh` or ask you to. Even then, ask before running the push.

## Unpublish a post

Delete the page, add an entry to `data/corrections.json` (the reason stays empty until Matt writes one), run the build and check, and commit. The build adds the redirects.

## "Tools I use" on the resume

Only when `vault/staging/tools-i-use.md` has `status: ready`. Do steps 2 and 3 on it, then replace the `<!-- Tools I use: ... -->` comment in `public/resume/index.html` with:

```html
<section class="tools-i-use">
    <!-- words:tools-i-use -->
    …the body converted as above; its "# Tools I use" heading becomes <h3>…
    <!-- /words:tools-i-use -->
</section>
```

Verify with `node tools/verify.js vault/staging/tools-i-use.md public/resume/index.html tools-i-use`. If the status goes back to `draft`, remove the section and put the comment back.

## Corrections reasons

Matt writes reasons and the intro in `vault/staging/corrections.md`. Copy one into `data/corrections.json` (`reason` or `intro`) only when he asks, character for character. `node tools/check.js` confirms each one appears word for word in corrections.md. Do the privacy pass on it first, and ask him to reword rather than removing anything, because reasons are short.
