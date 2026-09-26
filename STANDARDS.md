# Standards for mattrude.org

These rules apply to me and to any AI agent working in this repo. Lines marked (proposed) were suggested by Claude and are not yet my decisions.

## Who writes what
1. I write every word of published prose.
2. AI may search, give feedback, proofread, and point out problems. It does not supply replacement wording.
3. AI may transcribe my voice. A transcript quoted on the site is raw and verbatim, with nothing changed, and is labeled "Voice transcript, unedited".
4. Any other model-written text on the site is quoted and labeled with the model's name.
5. AI does the technical work: HTML, CSS, JS, build scripts, and turning my finished text into pages without changing my words.

## Translation
6. English is the canonical version.
7. Only technical pages are machine-translated. Memoir and personal posts stay in English.
8. Machine translations are labeled clearly at the top of the page.

## Corrections and removals
9. Corrections are published openly on /corrections/.
10. Removed content gets a corrections entry that says what was removed and why.
11. If something is removed for PII or harmful content, the entry says so without repeating it.
12. Removed files are deleted normally. Git history is not rewritten.
13. (proposed) If a future removal involves PII that must not stay public, ask me whether to purge it from git history.

## Privacy
14. Before publishing, check drafts for PII. That includes quasi-identifiers: a place plus a time plus a role can identify someone even without a name.
15. Check voice transcripts too. They pick up every name I say, including misheard ones.
16. Flag, don't delete. I decide what changes.
17. Ask: what would a future employer read here?
18. A post publishes only after I set privacy_reviewed: true.

## Work and positioning
19. Nothing that could conflict with my employer: no offers of outside work or services, and no internal or customer information.
20. I'm an independent learner and researcher who wants to connect and collaborate. The site does not imply a lab or institutional affiliation.

## Style
21. Technical writing follows the ISO plain-language standard (ISO 24495-1:2023).
22. Short, simple sentences. Avoid em dashes.
23. Don't promise future posts inside a post.

## Licensing
24. My writing is licensed CC BY 4.0.

## Workflow
25. I write in the Obsidian vault at vault/. It is gitignored and never committed. I back it up myself.
26. Agents may stage notes and to-do lists in vault/staging/, never prose drafts.
27. Agents commit to main and ask before every push.
