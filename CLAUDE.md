# Jay Ho — 2026 Portfolio

Context and working agreements for anyone (human or agent) continuing this site.

---

## Where things stand — last worked 27 Oct 2026

**Everything is committed and live.** `main` matches GitHub and jayho.fyi. Recent commits:
`f5ff11d` Inter on non-Apple devices, thin scrollbars · `926c36c` DDA rework, space-based
sections, semantic headings · `7c9ddb6` process visuals, hover clips, Apple spacing, tighter copy.
Commit or push only when Jay asks. Never commit the loose source files in the repo root
(thumbnails, `Costco health care header.png`, `MEC_present.png`, `SFU_logo.svg`, `Vector.png`,
the two `· Walkthrough.mp4` exports); they are untracked on purpose.

**What the 24–25 Oct stretch covered:** Apple-style type (SF Pro) and de-templated design;
Figma Motion walkthrough videos for MEC and DDA; CarePath before/after pairs; Apple-style
process visuals for MEC and a research board for DDA; component close-ups for MEC's features;
looping hover/evolution/load-in clips on DDA; copy cut ~20% with coloured key-phrase highlights;
three spacing/white-space/IA passes against specs Jay pasted; resume reframed for UX/PM roles.

**Open (none agreed):** a source for CarePath's "1 in 3 patients" statistic; one decision Jay
personally drove per project (needs Jay); unused old DDA images (`01-homepage.jpg`,
`02-posters.jpg`, `03-direction.jpg`) could be deleted if Jay agrees.

---

## The site

- **Live at** `jayho.fyi` via GitHub Pages. `CNAME` at repo root holds the domain — never delete or rename it. The old `winterhornet106.github.io/2026-Portfolio` URL redirects here.
- **Stack:** hand-written HTML, CSS and vanilla JS. **No build step, no framework, no package.json.** Edit files directly; what's in the repo is what ships.
- **Pages:** `index.html`, `about.html`, `resume.html`, `contact.html`, and three case studies in `projects/` — `mec.html`, `carepath.html`, `dda.html`.
- **Sources of truth:** MEC copy comes from the Figma file *IAT333 - MEC Client* (Final Slides + Handover Documentation pages). CarePath copy comes from *IAT 438 Final Project Design* (Week 5 FINAL Slides + speaker notes, Week 3 Final Slides for the user testing). Images in `assets/carepath/`. Dutch Design Awards copy comes from *Graphic Experimentation* (IAT 235; part4 and part5 decks, part5_website for screens); images in `assets/dda/`. Jay owned client research (the awards and their categories), exhibition research (the nine-day Dutch Design Week event), the poster explorations and the microsite screens; added per Jay on 24 Oct 2026. Check claims against these before editing.
- **Shared assets:** `assets/styles.css` (one stylesheet, ~2500 lines), `assets/main.js`, images in `assets/mec/`, `assets/carepath/`, `assets/dda/`.
- **Project colour:** each case study's `<body>` carries `cs--mec` / `cs--carepath` / `cs--dda`, which sets `--hl` (MEC green, Costco blue, DDA red). Bold highlights, the quote rule, persona labels, "What I owned" group labels and the section-rail marker all use it. Other pages keep the site blue `--accent`.
- **Fonts:** Apple's pairing via the system stack: SF Pro Display for headings (`--display`), SF Pro Text for everything else (`--sans`). `--mono` now points at `--sans` on purpose: small labels share the text face. Real SF shows on Apple devices; everywhere else gets **Inter** (Google Fonts `@import` at the top of `styles.css`, 25 Oct 2026), the closest legal stand-in, because Windows was falling back to Arial and looked off. Apple devices match SF first, so they never download Inter. Scrollbars are thin and tinted (`scrollbar-width/color` on `html`) so Windows matches Mac. Switched 24 Oct 2026 away from Satoshi + JetBrains Mono, which an audit flagged as AI-default type (old stylesheet in `.verbose-backup/styles-before-apple-type.css`).
- **Colour:** OKLCH throughout. No dark mode exists — don't assume one.

Jay is a product/interaction designer, not primarily an engineer. Explain technical things plainly and briefly when they come up (e.g. what `git pull` does and why), without condescension or lecturing.

**Positioning (24 Oct 2026):** Jay is graduating from SFU with no internship and is job hunting. Copy must stay truthful to the resume: no "independent designer", "embed with founding teams", "shipping" or fields Jay hasn't worked in. The strengths to lean on are real-user research (MEC, CarePath) and team leadership (Assistant Supervisor, World Duty Free YVR, team of 10+).

---

## Hard preferences — follow these

**Writing**

1. **No em dashes in any visible copy.** Ever. Use a period, comma or colon. (Em dashes already present in CSS/JS *comments* are fine and pre-existing — don't go rewriting those.)
2. **Short and concise.** Case studies were deliberately cut from ~350 narrative words to ~215. Don't let them creep back up. Reference portfolios Jay admires: `calebwu.ca/RevisionDojo` and `joannvu.framer.website` — both run ~300–450 narrative words with four nav items.
3. **No setup sentences.** Cut "Two things were happening. First… Second…" scaffolding. Lead with the point.
4. **Don't restate the heading** in the first line of a section.
5. **No widows.** Handled in CSS via `text-wrap: pretty` / `balance` — don't hand-insert `&nbsp;`.

**Structure**

6. **Four nav items per case study.** Non-negotiable shape:
   - carepath: Problem / Research / Highlights / Outcomes (Costco CarePath; replaced Arcline, then Jackalope, 22 Oct 2026 — Jackalope page + images kept in `.verbose-backup/jackalope/`)
   - dda: Problem / Approach / Highlights / Outcomes (Dutch Design Awards microsite; replaced Halcyon 23 Oct 2026, Halcyon kept in `.verbose-backup/halcyon/`)
   - mec: Problem / Research / Solution / Working with MEC
   - "Overview" deliberately is *not* in the TOC rail.
7. **Granularity goes inside sections, not into new sections.** Use the `.cs-insight` card pattern (top rule + heading + body) rather than adding a section. **No numbering** (no "Finding 01", "01 / The problem", "01" indexes): removed 24 Oct 2026 as AI-template filler.
8. **Consistency over everything.** Jay will ask for it repeatedly. Parallel structure across the three case studies is the goal.

**Design**

9. **Compact.** Jay consistently asks for smaller, tighter, shorter. When in doubt, reduce.
10. **Weights:** 700 for the brand wordmark only (`.nav__brand`, `.foot .brand-line`); 600 for the big headlines (hero H1, section H2, project-card titles, `.cs-sublabel`), like Apple's semibold headlines, and for inline `<strong>` key-phrase highlights in case-study prose (added 25 Oct 2026 so hiring managers can scan: one or two per paragraph); 500 elsewhere.
11. Small text is sized in **px**, display type in **rem/clamp**. Don't introduce rem-based small text.

---

## Design system facts

**Spacing scale** (Apple-style 8px system, adopted 25 Oct 2026 from a spec Jay pasted). Use tokens, not raw px.

```
--s-1:4  --s-2:8  --s-3:12  --s-4:16  --s-5:24  --s-6:32
--s-7:48 --s-8:64 --s-9:96  --s-10:128 --s-11:128 (alias, top step)
--section-y: clamp(64px, 3rem + 5vw, 128px)   section padding, fluid
```

Approved values are only 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Sub-8px component padding on chips/pills (2, 5, 6, 7, 10, 14px) is intentional and fine. The old scale (28/40/60/88/120/168/240) is gone; the pre-change stylesheet is in `.verbose-backup/styles-before-apple-spacing.css`.

The spec's targets, as applied: heading to section content 32 (`.sec-head`), paragraph to paragraph 16, icon to label 8, images in a group 16 apart with captions 12 below, sub-sections 64 apart (`.cs-sublabel`), content groups 32 to 48, major sections 64 (phone) to 128 (desktop). Page margins `--gutter: clamp(20px, 5.5vw, 80px)`.

**Layout:** `--container: 1320px`, `--gutter: clamp(20px, 5.5vw, 80px)`, `--r-3` corner radius (fluid: `clamp(16px, 0.75rem + 1.1vw, 32px)`, ~16px phone / ~21px iPad / ~28px laptop; every card and frame uses it; phone screenshots instead keep iPhone 17 proportion, 62/402 of their width).

**Section rhythm** (already automatic, don't fight it):
- `section` and `.section--roomy` = `--section-y` top/bottom (64 to 128px)
- Two adjacent roomy sections auto-tighten to 64px (48 on phones) via `:has()`
- Sections either side of a `.section-divider` get 64px each (32 on phones), so about 190px from one section's last line to the next heading on desktop
- `.sec-head` gives every section 32px to its content
- Sections are separated by **space alone** (white-space rules Jay pasted, 25 Oct 2026). `.section-divider` and `.hero-bridge` still exist for their padding, but draw no line. Lines that remain are functional: `.cs-meta` row, resume/about tables, `.cs-insight` top rules. Don't add decorative rules back.

**Labels:** sentence case, no tracking, no uppercase, no monospace. Don't put an eyebrow label above section headings (removed 24 Oct 2026). Small labels are 11–14px in the text face; in-section sub-headings (`.cs-sublabel`) are 17px semibold ink, not grey labels.

**Heading levels are semantic and never skip** (IA rules Jay pasted, 25 Oct 2026): one H1 per page (contact's is the "Write to" email line), section H2s, then H3/H4 inside. Footer "Contact" is an `h2.foot__h`. Style headings by class, never by changing the level to get a look.

**Avoid the AI-template tells** an audit flagged: display-size full-sentence H1s (hero now caps at 56px), a coloured accent word inside the H1, eyebrows above every heading, 1·2·3 numbering, scroll fade-ups on everything (`.reveal` is now a style-less hook), and one identical hover across 4+ cards (the 3 project cards share an Apple-style lift + 4% image zoom; vary it if a 4th card is added).

**Body text:** 15px/1.6 for card copy, 14px/1.55 for small meta. Cap measures (`max-width: 38ch` etc.) — don't let paragraphs run wide.

**Typography spacing rule:** a label→heading gap, where one exists, must be *tighter* than heading→body (8px → 12px). Not equal, not inverted.

---

## Layout standards Jay holds the site to

Jay has twice pasted in formal layout specs and asked for the site to be checked
against them. Treat these as the standing bar, not one-off requests.

**Multi-column insight sections** (`.cs-insights`, and anything built like it):

- Equal columns, consistent gutters, top divider lines aligned.
- Headings start at the same vertical position (top rule), identical type.
- Headings share font/size/weight/line-height/colour and wrap naturally — **never**
  shrink an individual heading to force it onto one line, and no manual `<br>`.
- **Reserve a consistent heading area** (currently two lines) so heading length can't
  shift the body text. This is why `.cs-insight h3` has `min-height: calc(2 * 1.15em)`.
- Body paragraphs all start at the same baseline, but do **not** force them to equal
  heights — unequal paragraph lengths are fine and expected.
- Stack to one column rather than compressing into narrow columns. `.cs-insights`
  collapses at 1000px for exactly this reason (below that, columns fall under ~270px
  and the 15px body copy drops to ~32 characters a line).

**General layout and spacing:**

- One shared grid, one max content width, consistent page margins. No one-off offsets
  without a clear visual reason.
- Spacing scale on an 8px base (see Design system facts).
- Distinguish three levels: component spacing < content-group spacing < section
  spacing. Related things sit closer than unrelated things. Never flat.
- Cap body measures. Don't let paragraphs run wide.
- Column gaps consistent across grids in the same section. (`.personas` at 24px vs
  `.cs-insights` at 32px is a known, deliberate compromise — see below.)
- Images align to the grid with consistent corner treatment and caption spacing;
  occasional full-bleed is allowed as deliberate emphasis.

**Known deliberate deviation:** `.personas` uses a 24px gap where `.cs-insights` in the
same MEC section uses 32px. Matching them exactly narrows each card enough that
"Gear-Savvy Explorer" wraps. The persona breakpoint was already raised to 1200px to buy
room. If you change persona card width, gap, portrait size or role font, **re-check that
role line** — it's the binding constraint. (The role is an 11px label and the name is the big line, so this has a lot of slack.)

---

## Pills

Every pill is centred by its own box, not the inherited 1.62 line height: `line-height: 1`
plus either a fixed `min-height` with flex centring (buttons, copy button, status) or a
cap-height `text-box` trim with even padding (tags, skill pills, cursor label). All `.btn`
variants carry a 1px border (transparent on primary) so mixed rows match in height.
`:focus-visible` deliberately sets no `border-radius`, so focused pills stay pills.

## Components added recently

| Class | What it is |
|---|---|
| `.cs-sublabel` | Sub-section eyebrow inside a case-study section. Owns the gap below it; the next block drops its own top margin via `.cs-sublabel + *`. |
| `.cs-image--bleed` | Full-width figure for transparent PNGs. No frame, no fill, caption below. |
| `.poster` / `.poster__veil` | Frosted-glass teaser band. Low-res preview under a `backdrop-filter` blur with a centred button that opens the lightbox. |
| `.pdf-modal` + `.pdf-modal__scroll` | Shared lightbox. `bindModal()` in `main.js` drives both the resume PDF and the MEC poster. Heavy asset carries `data-src`: the resume preloads when the page is idle (`data-preload="idle"`), the poster on hover/focus of its opener. Closed modals stay laid out but invisible and `inert` (not `display:none`) so opening is a pure fade + rise; no backdrop blur (too expensive); system cursor returns while open. Click image to zoom to natural width; Escape closes; nav tucks away via `.has-modal` on `<html>`. |
| `.personas` / `.persona` | Three MEC persona cards. CSS **subgrid** so bands align across cards. `--persona-accent` (set from `--hl`) retints the component. The focus band's `margin-top: auto` lives only in the non-subgrid fallback; under subgrid it pushed shorter bands down. |
| `.cs-fixes` / `.cs-fix` | MEC workshop findings: six white problem → fix cards in HTML (gradient icon chip, grey quote, bold fix). 3 / 2 / 1 columns. |
| `.cs-posters` / `.cs-interactions` / `.cs-poster` | DDA: each visual (poster or hover clip) carries its own h3 + line underneath. Posters 3 across (stack at 640px), clips 2 across (stack at 860px). |
| `.cs-compare` | DDA functional vs expressive: two site screens side by side, square corners, labelled below. |
| `.cs-pair` | CarePath before/after phone pair inside each Outcomes card. |
| `.todo-shot` | Draft-only image placeholder (shows on localhost or `?draft`). Unused now; keep for future slots. |

**Behaviour worth knowing (main.js):** the section rail starts hidden in the HTML (`cs-toc is-hidden`) and fades in once the first section reaches the reading line, so it never flashes on load. Rail links scroll smoothly and use `history.replaceState`, so Back leaves the case study instead of stepping through sections. Looping `video[autoplay][loop]` clips hold on their poster under reduced motion. The custom cursor hands over to the system pointer only on `video[controls]`. `img, video` have `user-select: none` so Live Text can't copy words out of screenshots. The back link has an invisible `::after` hit area (16px / 24px).

**Reserved heights keep the persona cards aligned** — the meta line (age · job · experience, styled from `.persona__chips`) holds 2 lines, bios hold 4 lines (bios were cut to ~17 words on 25 Oct), `.cs-insight h3` holds 2 lines. These exist *because* content lengths vary. If you change the copy or font size, re-check them; they're `em`-based so they track font changes.

---

## Working style Jay expects

- **Verify, don't assert.** Check the actual file/source before claiming something. Jay caught a wrong reference once and it mattered.
- **Flag what you didn't do.** If something's broken or out of scope, say so plainly rather than silently leaving it.
- **Correct yourself plainly** when wrong, then move on. No over-apologising.
- **Back up before destructive changes.** There's a `.verbose-backup/` folder (gitignored) holding image originals.
- Jay works in VS Code and writes short, casual instructions, often with typos. Interpret intent generously.

---

## Known gotchas

- **The resume is designed in HTML.** Edit `resume-src/resume.html`, then reprint with headless Chrome (command in that file's header comment) to `assets/resume.pdf`, and regenerate the pop-up image below. Keep it to one page and check the PDF embeds Inter (the resume uses Inter only, not the site's SF stack, for a consistent print read; no links, it is a flat sheet). Experience bullets were reframed for UX/PM on 25 Oct without adding claims; previous version in `.verbose-backup/resume-before-ux/`. The old Word-made resume is in `.verbose-backup/resume-old/`.
- **The resume viewer shows an image, not the PDF.** `assets/resume-page.png` is a render of `assets/resume.pdf` (made with `qlmanage -t -s 2550 -o <dir> assets/resume.pdf`). If the PDF changes, regenerate the PNG or the pop-up shows the old resume. The Download PDF button still serves the real PDF.

- **Missing images fail silently.** Every `<img>` carries `onerror="this.style.display='none'"`, so a broken path just shows the SVG placeholder underneath. Always verify paths resolve on disk.
- **`sips -Z` fits the *longest* side.** For a portrait image, use `sips --resampleWidth N` instead or you'll get the wrong dimension.
- **Video tooling is Swift, not ffmpeg.** Small Swift scripts (AVFoundation) cut clips, re-encode at ~3 Mbps with `shouldOptimizeForNetworkUse`, hold end frames and pull poster frames. AVAssetWriter leaves `*.sb-*` temp files next to its output; delete them before committing.
- **Figma Motion MP4 export can't run from the plugin for big frames.** Jay exports walkthroughs by hand (1440×1024 or 1920×1080, 30/60 fps) into the repo root; they get re-encoded into `assets/`.
- **No image tooling installed** — no PIL, pngquant, oxipng or ImageMagick. Only `sips`, which doesn't optimise PNG output. For photographic content check whether alpha is actually needed (`hasAlpha` can be true while every pixel is opaque) and use JPEG; it's dramatically smaller.

---

## Outstanding

**Process-image placeholders (24 Oct 2026): all resolved 25 Oct 2026.** The `.todo-shot` system (draft-only, `html.is-draft`) is still in main.js/styles.css for future slots, but no page uses it now. MEC process visuals and DDA research board are designed in the Portfolio Figma file ("MEC process visuals" and "DDA process visuals" pages); re-export from there if copy changes.

**All MEC images are in.** `03-presenting-mec.jpg` came from Jay's `MEC_present.png`
(24 Oct 2026, resized to 1600px wide, JPEG). It shows a teammate presenting, with Jay
seated and marked "ME!" in the photo.

The "Spike's first event" storyboard block was removed from the Solution section at Jay's
request (24 Oct 2026); the walkthrough video now closes that section. Don't add it back.

The old `01-app-screens.png` slot (Solution section) is now the app walkthrough video:
`assets/mec/walkthrough.mp4` (Figma Motion export, 1920×1080, 77.8s incl. MEC × SFU end card, ~30 MB, moov at the
front so it streams) with `walkthrough-poster.jpg` as its poster (a frame at 3.6s, pulled
with AVAssetImageGenerator via a small Swift script; there is no ffmpeg). It loads only on
play (`preload="none"`). The local `python3 -m http.server` preview can't seek in it
(no Range support); GitHub Pages can.

DDA has the same kind of video in its Outcomes section: `assets/dda/walkthrough.mp4`
(Figma Motion export from the "DDA walkthrough video" page, 1440×1024, 34.6s incl. closing screen, re-encoded to ~11.5 MB with moov up front) with
`walkthrough-poster.jpg` (frame at 2.4s). Its frame uses `.cs-frame--site.cs-frame--desktop`
(square corners, 1440/1024 aspect).

`02-team-mec-hq.jpg` was filled from the Figma group photo. Figma has no presenting photo.

**MEC's outcome is the handover.** Per Jay (24 Oct 2026): the outcome is a handover document
that answers MEC's business problem through design (full flow, brand guidelines, business case
linking events to loyalty and spending), which MEC can implement if it chooses. That is stated in
"Working with MEC". There are no launch or usage numbers, so don't invent any.


**Avatar sources are 128px max.** The original persona photos were deleted from the repo without backup. If the portrait needs to be larger than 72px, Jay has to re-supply the files.

`.DS_Store` is untracked and gitignored.

**Figma access goes through the Desktop Bridge plugin** (figma-console MCP), not the `plugin:design:figma` connector, which is still unauthorized. Jay opens the Desktop Bridge plugin in a file to connect it. Connected files: Portfolio (Jay's own; editable), IAT 438 Final Project Design and Graphic Experimentation (shared team files: read and export only, never edit), IAT 333 MEC app ideas (FigJam). The DDA walkthrough frame on the "DDA walkthrough video" page has a linked twin that mirrors every edit, so it is **not** a backup; use Figma version history to roll back.

---

## Before you finish any change

- CSS braces balanced
- `node --check assets/main.js`
- All seven pages parse with balanced tags
- Any new image path actually resolves on disk
- No em dashes in visible copy
