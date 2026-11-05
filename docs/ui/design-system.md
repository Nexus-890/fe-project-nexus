# Nexus design system

This is the canonical design guidance, consolidated from the previous duplicate design-system documents. The running token implementation is [app/globals.css](../../app/globals.css); [app/layout.tsx](../../app/layout.tsx) installs Geist Sans and Geist Mono. Components consume those tokens and do not redefine the theme.

The former screenshot guide contained reference shades, alpha approximations, typography and shadow examples that differ from the checked-in CSS. The structural rebuild preserves the current rendered implementation. Treat any future reconciliation with Figma as an explicit visual change, rather than pasting an old CSS example over the app.

## Color and surfaces

Use semantic utilities such as `bg-primary`, `text-primary-foreground`, `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `text-danger` and `ring-ring`. Raw palette classes are reserved for an intentional tint that has no semantic equivalent. Do not hardcode brand/status hex values in page components.

| Role | Current token source |
| --- | --- |
| Primary / hover / active | orange-700 / orange-800 / orange-900 |
| Primary text | white |
| Background / foreground | white / gray-1000 |
| Secondary / hover / active | gray-200 / gray-300 / gray-400 |
| Muted surface / text | gray-100 / gray-800 |
| Card / popover | white surfaces with gray-1000 text |
| Border / input | gray-300 |
| Success | green-700 |
| Warning | amber-700 with dark foreground |
| Danger / destructive | red-700 |
| Info / focus ring | blue-700 |

The CSS maps the orange, gray, blue, red, amber, green, teal and purple families through Tailwind's inline theme. Inspect that file for exact shades and available levels. Historical screenshot-only gray-alpha/pink references are not permission to invent new runtime tokens. Obtain canonical RGBA/alpha values from design input before adding or replacing an alpha palette.

Create hierarchy using surfaces and borders first; shadows are a secondary cue. Keep the current light palette. Do not invent a dark-mode palette before an approved design exists.

## Typography

Geist Sans is for interface text, headings, buttons, labels and body copy. Geist Mono is for code, IDs, technical values, prices/data tables and tabular figures. Keep body copy and labels primarily at the 14px design scale when appropriate, while preserving the current global body base of 16px/24px. Headings use weight 600 and tighter tracking; buttons/strong labels use 500; body copy uses 400.

| Heading utility size | Line height | Tracking |
| --- | --- | --- |
| 72 | 72px | -0.03em |
| 64 | 64px | -0.03em |
| 56 | 60px | -0.03em |
| 48 | 56px | -0.03em |
| 40 | 48px | -0.03em |
| 32 | 40px | -0.03em |
| 24 | 32px | -0.02em |
| 20 | 26px | -0.02em |
| 16 | 24px | -0.01em |
| 14 | 20px | -0.01em |

Use large 72/64/56 styles for hero/marketing, 48/40 for main page titles, 32/24 for sections and 20/16/14 for card/component headings when the design calls for them. Existing pages may deliberately use a smaller title scale; moving a file does not authorize changing it.

| Label utility size | Line height | Weight |
| --- | --- | --- |
| 20 | 28px | 500 |
| 18 | 24px | 500 |
| 16 | 20px | 500 |
| 14 | 20px | 500 |
| 13 | 16px | 500 |
| 12 | 16px | 500 |

| Copy utility size | Line height | Weight |
| --- | --- | --- |
| 24 | 36px | 400 |
| 20 | 30px | 400 |
| 18 | 28px | 400 |
| 16 | 24px | 400 |
| 14 | 20px | 400 |
| 13 | 18px | 400 |

For compact controls the original guidance includes button 16/20, 14/20 and 12/16 with weight 500. Compose the current utilities/variants instead of adding duplicate CSS. Use `font-mono` and `tabular-nums` for technical/tabular text when appropriate.

## Spacing, radius and elevation

Use a 4px base grid: 4, 8, 12, 16, 24, 32, 40, 64 and 96px. Avoid arbitrary 13/19/27px spacing unless the design requires it. Use 4px for tiny adjustments, 8px inside small groups, 16px between groups and 32–40px between sections. Typical card padding is 24px, compact 16px and hero/large 32px.

| Radius | Value | Use |
| --- | --- | --- |
| sm | 6px | Controls and cards |
| md | 12px | Menus/modals and existing controls using this scale |
| lg | 16px | Large surfaces |
| full | 9999px | Pills and avatars |

The implemented radius source uses `--ds-radius-*` and the Tailwind mappings, preventing a self-referential token definition. Raised/popover/modal shadow values are the current `--ds-shadow-*` values; do not infer numeric values from a screenshot. Keep shadows subtle and use the appropriate elevation level.

## Base styles and focus

The global stylesheet owns box sizing, borders, body background/font, text reset, form font inheritance, media bounds and selection color. Controls inherit the font. Keep links/buttons semantic and preserve visible keyboard focus; global focus uses a ring-colored 2px outline and 2px offset unless a component deliberately provides an equally visible ring.

Buttons need clear hover/active/disabled states, adequate hit area and a discernible focus ring. Cards use surface/border and optional raised shadow. Labels and values need readable hierarchy rather than decorative shadow. Do not remove outlines without a replacement. Maintain keyboard behavior, status/error announcements, responsive wrapping and input labels while reorganizing components.

This document records guidance, not a second stylesheet. Update the source tokens and relevant visual evidence together for any intentional future design change.
