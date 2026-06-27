# Design

## Design System Overview

申途 Navigator is a compact productivity extension with restrained product UI. It uses one sans-serif stack, structured panels, quiet state color, and dense but breathable forms. The visual system should make users feel that their application data is organized and reviewable.

## Color Palette

Use OKLCH tokens in CSS. The surface is a neutral graphite-tinted white, not cream. The main brand color is a composed teal used for primary actions, selected navigation, and focus rings. A warm amber accent is reserved for pending/review states.

- Background: `--ca-bg`
- Surface: `--ca-surface`
- Raised surface: `--ca-surface-raised`
- Ink: `--ca-text`
- Muted text: `--ca-text-secondary`, `--ca-text-muted`
- Primary: `--ca-primary`
- Accent: `--ca-accent`
- Success / warning / danger / info semantic colors

## Typography

Use Inter when available, falling back to system UI, PingFang SC, Microsoft YaHei, and sans-serif. Product UI uses fixed font sizes, not viewport-fluid type. Labels are sentence case in normal tracking; avoid uppercase tracked micro-labels.

## Components

- Buttons: 8px radius, stable height, clear focus ring, no gradient text or decorative shine.
- Cards and panels: flat white surfaces with 1px borders and subtle shadows only where elevation helps.
- Tabs and side navigation: selected state uses background tint and left/under marker with 1px or tokenized subtle accent, not thick decorative stripes.
- Forms: compact, legible controls with visible focus states and placeholder contrast.
- Status surfaces: semantic background plus text, never color alone.

## Layout

Extension popup stays compact with a clear primary action. Side panel prioritizes the fill workflow, then results and AI answer tools. Options page uses a persistent left rail and a centered content column with responsive single-column forms on narrow widths.

## Motion

Motion is brief and purposeful: hover lift within 150-180ms, status reveal within 180ms, spinner for loading. Disable non-essential transforms and animations under `prefers-reduced-motion`.

## Anti-patterns To Avoid

No glassmorphism as a default material. No page-wide gradients, gradient text, decorative floating shapes, or emoji-heavy visual hierarchy. Cards should not be nested unless the inner element is a distinct repeated item.
