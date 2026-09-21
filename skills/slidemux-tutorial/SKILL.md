---
name: slidemux-tutorial
description: Plan and author polished tutorial or presentation source before recording it with SlideMux.
---

# SlideMux tutorial authoring

Read this before creating or redesigning tutorial slides. This skill guides authoring; video generation must reproduce the approved source rather than invent a new layout.

## 1. Establish the brief

Ask only for missing decisions:

- Target: YouTube/course/demo or Shorts/Reels/TikTok
- Format: `landscape` (16:9) or `portrait` (9:16)
- Audience, desired outcome, language, duration, and final CTA
- Brand assets or an existing visual reference

Default to 16:9 for product tutorials and 9:16 for social media. If the user said “social,” “Shorts,” or “product tour” and skipped the rest, default portrait 9:16, 6–8 beats, and one CTA URL — then ask only for what is still missing.

## 2. Plan the story

Use 6–8 beats unless the requested duration needs fewer:

1. Hook: the outcome or tension
2. Context: why it matters
3. Mechanism: the key idea
4. Demonstration: the product proves the claim
5. Result: what changed
6. CTA: one clear next step

Each slide teaches one point. Prefer one short headline and visual evidence over paragraphs or bullet walls. One `slidemux.step()` is one picture; do not pack two screens into one beat unless the voiceover names both states in that order.

## 3. Compose the source

Choose the simplest fitting layout:

- `title`: kicker, headline, optional supporting line
- `split-product`: explanation beside framed product evidence
- `full-product`: product recording with a small contextual caption
- `choice-list`: two to four choices with one active state
- `cta`: outcome recap and one next action

Keep a consistent logo, chapter label, and `current / total` progress treatment. Reuse the product's existing type and colors when available. Do not invent a new visual language on every slide.

For 9:16, stack content vertically, keep the primary message in the center safe area, and leave generous space at the top and bottom for social-platform controls. Never crop the product's important state to force a landscape layout into portrait.

## 4. Review before recording

Capture a screenshot in the target aspect ratio and inspect it. Revise until:

- The canvas is exactly 16:9 or 9:16.
- The headline is readable at phone size.
- No text, controls, or product evidence overflows or is clipped.
- Contrast is sufficient and the active state is not color-only.
- There are no more than two columns in landscape; portrait is normally stacked.
- Platform safe areas are clear in portrait.
- Brand, chapter, and progress chrome are consistent.
- The slide still makes sense when viewed silently.
- Device chrome (notch, status bar) sits in its own band, not on the app header.
- No test overlays (Playwright “Click locator…”, LogBox, toasts).

A screenshot taken *after* the step hides a splash at `t=0`. After recording, also inspect the **first frame** of each step clip. After generate, sample the **muxed** MP4 at each cut — Playwright PNGs are not enough.

Do not use generation as a visual retry loop. Approve the frames first, then record once. Wrong picture = re-record. Wrong words only = change narration, then generate once.

## 5. Record and narrate

Use the `slidemux-video` skill for the record, upload, narration, voice, and generation pipeline. Keep most visual beats on screen for 3–7 seconds. Narration explains why the visible action matters; it does not read UI labels. The voiceover must match the frame: if the headline says “afternoon,” do not say “Saturday morning.”

Processing should validate aspect ratio, safe areas, overflow, text readability, narration fit, and pacing. It must not rearrange approved content or apply surprise AI styling.
