# UI Design System — Next.js + Tailwind CSS v4

This document defines the shared UI foundation for the project based on the supplied design-system screenshots.

Use these rules as the single source of truth for:

- Colors
- Typography
- Spacing
- Border radius
- Elevation and focus
- Tailwind usage
- Component styling conventions

> Font family: **Geist Sans** for UI/prose and **Geist Mono** for code, data, and tabular figures.
>
> Do not hard-code design colors in components. Use root variables / semantic Tailwind tokens instead.

---

## 1. Next.js font setup

Use `next/font/google` in `src/app/layout.tsx`.

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Application",
  description: "Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

---

# 2. Color System

## 2.1 Raw palette

### Orange Brand

| Token | Value |
|---|---|
| `orange-brand-100` | `#FFF3EE` |
| `orange-brand-200` | `#FFE9E0` |
| `orange-brand-300` | `#FFDCCC` |
| `orange-brand-400` | `#FFC6AE` |
| `orange-brand-500` | `#FFA07A` |
| `orange-brand-600` | `#FF7A45` |
| `orange-brand-700` | `#EE4F22` |
| `orange-brand-800` | `#D2401A` |
| `orange-brand-900` | `#B8360F` |
| `orange-brand-1000` | `#4D1403` |

### Background

| Token | Value |
|---|---|
| `background-100` | `#FFFFFF` |
| `background-200` | `#FAFAFA` |

### Gray

| Token | Value |
|---|---|
| `gray-100` | `#F2F2F2` |
| `gray-200` | `#EBEBEB` |
| `gray-300` | `#E6E6E6` |
| `gray-400` | `#EAEAEA` |
| `gray-500` | `#C9C9C9` |
| `gray-600` | `#A8A8A8` |
| `gray-700` | `#8F8F8F` |
| `gray-800` | `#7D7D7D` |
| `gray-900` | `#4D4D4D` |
| `gray-1000` | `#171717` |

### Gray Alpha — rendered values from the reference screenshot

| Token | Value |
|---|---|
| `gray-alpha-100` | `#F2F2F2` |
| `gray-alpha-200` | `#EAEAEA` |
| `gray-alpha-300` | `#E5E5E5` |
| `gray-alpha-400` | `#EBEBEB` |
| `gray-alpha-500` | `#C9C9C9` |
| `gray-alpha-600` | `#C2C2C2` |
| `gray-alpha-700` | `#8F8F8F` |
| `gray-alpha-800` | `#7D7D7D` |
| `gray-alpha-900` | `#4C4C4C` |
| `gray-alpha-1000` | `#171717` |

> The screenshot only exposes the rendered appearance of the alpha palette clearly. If the original Figma file provides canonical RGBA / 8-digit alpha tokens, replace these rendered hex values with the original tokens.

### Blue

| Token | Value |
|---|---|
| `blue-100` | `#F0F7FF` |
| `blue-200` | `#E9F4FF` |
| `blue-300` | `#DFEFFF` |
| `blue-400` | `#CAE7FF` |
| `blue-500` | `#94CCFF` |
| `blue-600` | `#48AEFF` |
| `blue-700` | `#006BFF` |
| `blue-800` | `#0059EC` |
| `blue-900` | `#005FF2` |
| `blue-1000` | `#002359` |

### Red

| Token | Value |
|---|---|
| `red-100` | `#FFEEEF` |
| `red-200` | `#FFE8EA` |
| `red-300` | `#FFE3E4` |
| `red-400` | `#FFD7D6` |
| `red-500` | `#FFB1B3` |
| `red-600` | `#FF676D` |
| `red-700` | `#FC0035` |
| `red-800` | `#EA001D` |
| `red-900` | `#D8001B` |
| `red-1000` | `#47000C` |

### Amber

| Token | Value |
|---|---|
| `amber-100` | `#FFF6DE` |
| `amber-200` | `#FFF4CF` |
| `amber-300` | `#FFF1C1` |
| `amber-400` | `#FFDC73` |
| `amber-500` | `#FFC543` |
| `amber-600` | `#FFA600` |
| `amber-700` | `#FFAE00` |
| `amber-800` | `#FF9300` |
| `amber-900` | `#AA4D00` |
| `amber-1000` | `#561900` |

### Green

| Token | Value |
|---|---|
| `green-100` | `#ECFDEC` |
| `green-200` | `#E5FCE7` |
| `green-300` | `#D3FAD1` |
| `green-400` | `#B9F5BC` |
| `green-500` | `#82EB8D` |
| `green-600` | `#4CE15E` |
| `green-700` | `#28A948` |
| `green-800` | `#279141` |
| `green-900` | `#107D32` |
| `green-1000` | `#003A00` |

### Teal

| Token | Value |
|---|---|
| `teal-100` | `#DEFFFB` |
| `teal-200` | `#DDFEF6` |
| `teal-300` | `#CCF9F1` |
| `teal-400` | `#B1F7EC` |
| `teal-500` | `#52F0DB` |
| `teal-600` | `#00E3C4` |
| `teal-700` | `#00AC96` |
| `teal-800` | `#00927F` |
| `teal-900` | `#007F70` |
| `teal-1000` | `#003F34` |

### Purple

| Token | Value |
|---|---|
| `purple-100` | `#FAF0FF` |
| `purple-200` | `#F9F0FF` |
| `purple-300` | `#F6E8FF` |
| `purple-400` | `#F2D9FF` |
| `purple-500` | `#DFA7FF` |
| `purple-600` | `#C979FF` |
| `purple-700` | `#A000F8` |
| `purple-800` | `#8500D1` |
| `purple-900` | `#7D00CC` |
| `purple-1000` | `#2F004E` |

### Pink

| Token | Value |
|---|---|
| `pink-100` | `#FFE8F6` |
| `pink-200` | `#FFE8F3` |
| `pink-300` | `#FFDFEB` |
| `pink-400` | `#FFD3E1` |
| `pink-500` | `#FDB3CC` |
| `pink-600` | `#F97EA7` |
| `pink-700` | `#F22782` |
| `pink-800` | `#E4106E` |
| `pink-900` | `#C41562` |
| `pink-1000` | `#460523` |

---

## 2.2 Root color variables

Place this in `src/app/globals.css`.

```css
@import "tailwindcss";

:root {
  /* =========================================================
     RAW COLOR TOKENS
     ========================================================= */

  /* Orange brand */
  --orange-brand-100: #fff3ee;
  --orange-brand-200: #ffe9e0;
  --orange-brand-300: #ffdccc;
  --orange-brand-400: #ffc6ae;
  --orange-brand-500: #ffa07a;
  --orange-brand-600: #ff7a45;
  --orange-brand-700: #ee4f22;
  --orange-brand-800: #d2401a;
  --orange-brand-900: #b8360f;
  --orange-brand-1000: #4d1403;

  /* Background */
  --background-100: #ffffff;
  --background-200: #fafafa;

  /* Gray */
  --gray-100: #f2f2f2;
  --gray-200: #ebebeb;
  --gray-300: #e6e6e6;
  --gray-400: #eaeaea;
  --gray-500: #c9c9c9;
  --gray-600: #a8a8a8;
  --gray-700: #8f8f8f;
  --gray-800: #7d7d7d;
  --gray-900: #4d4d4d;
  --gray-1000: #171717;

  /* Gray alpha — rendered values from reference */
  --gray-alpha-100: #f2f2f2;
  --gray-alpha-200: #eaeaea;
  --gray-alpha-300: #e5e5e5;
  --gray-alpha-400: #ebebeb;
  --gray-alpha-500: #c9c9c9;
  --gray-alpha-600: #c2c2c2;
  --gray-alpha-700: #8f8f8f;
  --gray-alpha-800: #7d7d7d;
  --gray-alpha-900: #4c4c4c;
  --gray-alpha-1000: #171717;

  /* Blue */
  --blue-100: #f0f7ff;
  --blue-200: #e9f4ff;
  --blue-300: #dfefff;
  --blue-400: #cae7ff;
  --blue-500: #94ccff;
  --blue-600: #48aeff;
  --blue-700: #006bff;
  --blue-800: #0059ec;
  --blue-900: #005ff2;
  --blue-1000: #002359;

  /* Red */
  --red-100: #ffeeef;
  --red-200: #ffe8ea;
  --red-300: #ffe3e4;
  --red-400: #ffd7d6;
  --red-500: #ffb1b3;
  --red-600: #ff676d;
  --red-700: #fc0035;
  --red-800: #ea001d;
  --red-900: #d8001b;
  --red-1000: #47000c;

  /* Amber */
  --amber-100: #fff6de;
  --amber-200: #fff4cf;
  --amber-300: #fff1c1;
  --amber-400: #ffdc73;
  --amber-500: #ffc543;
  --amber-600: #ffa600;
  --amber-700: #ffae00;
  --amber-800: #ff9300;
  --amber-900: #aa4d00;
  --amber-1000: #561900;

  /* Green */
  --green-100: #ecfdec;
  --green-200: #e5fce7;
  --green-300: #d3fad1;
  --green-400: #b9f5bc;
  --green-500: #82eb8d;
  --green-600: #4ce15e;
  --green-700: #28a948;
  --green-800: #279141;
  --green-900: #107d32;
  --green-1000: #003a00;

  /* Teal */
  --teal-100: #defffb;
  --teal-200: #ddfef6;
  --teal-300: #ccf9f1;
  --teal-400: #b1f7ec;
  --teal-500: #52f0db;
  --teal-600: #00e3c4;
  --teal-700: #00ac96;
  --teal-800: #00927f;
  --teal-900: #007f70;
  --teal-1000: #003f34;

  /* Purple */
  --purple-100: #faf0ff;
  --purple-200: #f9f0ff;
  --purple-300: #f6e8ff;
  --purple-400: #f2d9ff;
  --purple-500: #dfa7ff;
  --purple-600: #c979ff;
  --purple-700: #a000f8;
  --purple-800: #8500d1;
  --purple-900: #7d00cc;
  --purple-1000: #2f004e;

  /* Pink */
  --pink-100: #ffe8f6;
  --pink-200: #ffe8f3;
  --pink-300: #ffdfeb;
  --pink-400: #ffd3e1;
  --pink-500: #fdb3cc;
  --pink-600: #f97ea7;
  --pink-700: #f22782;
  --pink-800: #e4106e;
  --pink-900: #c41562;
  --pink-1000: #460523;

  /* =========================================================
     SEMANTIC COLOR TOKENS
     ========================================================= */

  --background: var(--background-100);
  --surface: var(--background-100);
  --surface-subtle: var(--background-200);

  --foreground: var(--gray-1000);
  --foreground-secondary: var(--gray-900);
  --foreground-muted: var(--gray-800);

  --border: var(--gray-200);
  --border-strong: var(--gray-500);

  --primary: var(--orange-brand-700);
  --primary-hover: var(--orange-brand-800);
  --primary-active: var(--orange-brand-900);
  --primary-subtle: var(--orange-brand-100);
  --primary-foreground: #ffffff;

  --info: var(--blue-700);
  --info-subtle: var(--blue-100);

  --success: var(--green-700);
  --success-subtle: var(--green-100);

  --warning: var(--amber-700);
  --warning-subtle: var(--amber-100);

  --danger: var(--red-700);
  --danger-subtle: var(--red-100);

  --focus-ring: var(--blue-700);
}
```

### Semantic usage rule

Prefer this:

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary-hover">
  Place bid
</button>
```

Instead of this:

```tsx
<button className="bg-[#EE4F22] text-white hover:bg-[#D2401A]">
  Place bid
</button>
```

---

## 2.3 Tailwind v4 mapping

Add after `:root` in `globals.css`.

```css
@theme inline {
  /* Fonts */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  /* Semantic colors */
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-subtle: var(--surface-subtle);
  --color-foreground: var(--foreground);
  --color-foreground-secondary: var(--foreground-secondary);
  --color-foreground-muted: var(--foreground-muted);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);

  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-primary-active: var(--primary-active);
  --color-primary-subtle: var(--primary-subtle);
  --color-primary-foreground: var(--primary-foreground);

  --color-info: var(--info);
  --color-info-subtle: var(--info-subtle);
  --color-success: var(--success);
  --color-success-subtle: var(--success-subtle);
  --color-warning: var(--warning);
  --color-warning-subtle: var(--warning-subtle);
  --color-danger: var(--danger);
  --color-danger-subtle: var(--danger-subtle);
  --color-focus-ring: var(--focus-ring);

  /* Brand ramp */
  --color-brand-100: var(--orange-brand-100);
  --color-brand-200: var(--orange-brand-200);
  --color-brand-300: var(--orange-brand-300);
  --color-brand-400: var(--orange-brand-400);
  --color-brand-500: var(--orange-brand-500);
  --color-brand-600: var(--orange-brand-600);
  --color-brand-700: var(--orange-brand-700);
  --color-brand-800: var(--orange-brand-800);
  --color-brand-900: var(--orange-brand-900);
  --color-brand-1000: var(--orange-brand-1000);
}
```

Now these utilities are available:

```tsx
<div className="bg-background text-foreground" />
<div className="bg-surface-subtle border border-border" />
<button className="bg-primary text-primary-foreground hover:bg-primary-hover" />
<p className="text-foreground-muted" />
<div className="bg-info-subtle text-info" />
<div className="bg-success-subtle text-success" />
<div className="bg-warning-subtle text-warning" />
<div className="bg-danger-subtle text-danger" />
```

---

# 3. Typography

## 3.1 Typography principles

- **Geist Sans**: interface text, headings, buttons, labels, body copy.
- **Geist Mono**: code, data, IDs, tabular figures, technical values.
- Headings use tighter letter spacing as size increases.
- `Copy/14` and `Label/14` should cover most normal interface text.
- Heading weight: **SemiBold / 600**.
- Button and strong label weight: **Medium / 500**.
- Regular labels/copy: **Regular / 400**.

---

## 3.2 Heading scale

| Token | Font | Weight | Size | Line height | Letter spacing |
|---|---|---:|---:|---:|---:|
| `Heading/72` | Geist Sans | 600 | 72px | 72px | -6% (`-0.06em`) |
| `Heading/64` | Geist Sans | 600 | 64px | 64px | -6% (`-0.06em`) |
| `Heading/56` | Geist Sans | 600 | 56px | 56px | -6% (`-0.06em`) |
| `Heading/48` | Geist Sans | 600 | 48px | 56px | -6% (`-0.06em`) |
| `Heading/40` | Geist Sans | 600 | 40px | 48px | -6% (`-0.06em`) |
| `Heading/32` | Geist Sans | 600 | 32px | 40px | -4% (`-0.04em`) |
| `Heading/24` | Geist Sans | 600 | 24px | 32px | -4% (`-0.04em`) |
| `Heading/20` | Geist Sans | 600 | 20px | 26px | -4% (`-0.04em`) |
| `Heading/16` | Geist Sans | 600 | 16px | 24px | -2% (`-0.02em`) |
| `Heading/14` | Geist Sans | 600 | 14px | 20px | -2% (`-0.02em`) |

Recommended usage:

- Hero / marketing: `Heading/72`, `Heading/64`, `Heading/56`
- Main page title: `Heading/48`, `Heading/40`
- Section title: `Heading/32`, `Heading/24`
- Card / component heading: `Heading/20`, `Heading/16`, `Heading/14`

---

## 3.3 Button scale

| Token | Font | Weight | Size | Line height | Letter spacing |
|---|---|---:|---:|---:|---:|
| `Button/16` | Geist Sans | 500 | 16px | 20px | 0 |
| `Button/14` | Geist Sans | 500 | 14px | 20px | 0 |
| `Button/12` | Geist Sans | 500 | 12px | 16px | 0 |

---

## 3.4 Label scale

| Token | Font | Weight | Size | Line height | Letter spacing |
|---|---|---:|---:|---:|---:|
| `Label/20` | Geist Sans | 400 | 20px | 32px | 0 |
| `Label/18` | Geist Sans | 400 | 18px | 28px | 0 |
| `Label/16` | Geist Sans | 400 | 16px | 28px | 0 |
| `Label/14` | Geist Sans | 400 | 14px | 20px | 0 |
| `Label/14 Mono` | Geist Mono | 400 | 14px | 20px | 0 |
| `Label/13` | Geist Sans | 400 | 13px | 16px | 0 |
| `Label/13 Mono` | Geist Mono | 400 | 13px | 20px | 0 |
| `Label/12` | Geist Sans | 400 | 12px | 16px | 0 |
| `Label/12 Mono` | Geist Mono | 400 | 12px | 16px | 0 |
| `Label/14 Strong` | Geist Sans | 500 | 14px | 20px | 0 |
| `Label/13 Strong` | Geist Sans | 500 | 13px | 16px | 0 |
| `Label/12 Strong` | Geist Sans | 500 | 12px | 18px | 0 |
| `Label/16 Strong` | Geist Sans | 500 | 16px | 28px | 0 |

---

## 3.5 Copy scale

| Token | Font | Weight | Size | Line height | Letter spacing |
|---|---|---:|---:|---:|---:|
| `Copy/24` | Geist Sans | 400 | 24px | 36px | 0 |
| `Copy/20` | Geist Sans | 400 | 20px | 36px | 0 |
| `Copy/18` | Geist Sans | 400 | 18px | 28px | 0 |
| `Copy/16` | Geist Sans | 400 | 16px | 24px | 0 |
| `Copy/14` | Geist Sans | 400 | 14px | 20px | 0 |
| `Copy/14 Mono` | Geist Mono | 400 | 14px | 20px | 0 |
| `Copy/13` | Geist Sans | 400 | 13px | 18px | 0 |
| `Copy/13 Mono` | Geist Mono | 400 | 13px | 18px | 0 |

---

## 3.6 Typography root variables

Add to `:root`:

```css
:root {
  /* Font family */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  /* Heading */
  --heading-72-size: 72px;
  --heading-72-line: 72px;
  --heading-72-tracking: -0.06em;

  --heading-64-size: 64px;
  --heading-64-line: 64px;
  --heading-64-tracking: -0.06em;

  --heading-56-size: 56px;
  --heading-56-line: 56px;
  --heading-56-tracking: -0.06em;

  --heading-48-size: 48px;
  --heading-48-line: 56px;
  --heading-48-tracking: -0.06em;

  --heading-40-size: 40px;
  --heading-40-line: 48px;
  --heading-40-tracking: -0.06em;

  --heading-32-size: 32px;
  --heading-32-line: 40px;
  --heading-32-tracking: -0.04em;

  --heading-24-size: 24px;
  --heading-24-line: 32px;
  --heading-24-tracking: -0.04em;

  --heading-20-size: 20px;
  --heading-20-line: 26px;
  --heading-20-tracking: -0.04em;

  --heading-16-size: 16px;
  --heading-16-line: 24px;
  --heading-16-tracking: -0.02em;

  --heading-14-size: 14px;
  --heading-14-line: 20px;
  --heading-14-tracking: -0.02em;
}
```

Optional shared utility classes:

```css
@layer components {
  .heading-72 {
    font-family: var(--font-sans);
    font-size: var(--heading-72-size);
    line-height: var(--heading-72-line);
    letter-spacing: var(--heading-72-tracking);
    font-weight: 600;
  }

  .heading-64 {
    font-family: var(--font-sans);
    font-size: var(--heading-64-size);
    line-height: var(--heading-64-line);
    letter-spacing: var(--heading-64-tracking);
    font-weight: 600;
  }

  .heading-56 {
    font-family: var(--font-sans);
    font-size: var(--heading-56-size);
    line-height: var(--heading-56-line);
    letter-spacing: var(--heading-56-tracking);
    font-weight: 600;
  }

  .heading-48 {
    font-family: var(--font-sans);
    font-size: var(--heading-48-size);
    line-height: var(--heading-48-line);
    letter-spacing: var(--heading-48-tracking);
    font-weight: 600;
  }

  .heading-40 {
    font-family: var(--font-sans);
    font-size: var(--heading-40-size);
    line-height: var(--heading-40-line);
    letter-spacing: var(--heading-40-tracking);
    font-weight: 600;
  }

  .heading-32 {
    font-family: var(--font-sans);
    font-size: var(--heading-32-size);
    line-height: var(--heading-32-line);
    letter-spacing: var(--heading-32-tracking);
    font-weight: 600;
  }

  .heading-24 {
    font-family: var(--font-sans);
    font-size: var(--heading-24-size);
    line-height: var(--heading-24-line);
    letter-spacing: var(--heading-24-tracking);
    font-weight: 600;
  }

  .heading-20 {
    font-family: var(--font-sans);
    font-size: var(--heading-20-size);
    line-height: var(--heading-20-line);
    letter-spacing: var(--heading-20-tracking);
    font-weight: 600;
  }

  .heading-16 {
    font-family: var(--font-sans);
    font-size: var(--heading-16-size);
    line-height: var(--heading-16-line);
    letter-spacing: var(--heading-16-tracking);
    font-weight: 600;
  }

  .heading-14 {
    font-family: var(--font-sans);
    font-size: var(--heading-14-size);
    line-height: var(--heading-14-line);
    letter-spacing: var(--heading-14-tracking);
    font-weight: 600;
  }
}
```

---

# 4. Space System

The layout uses a **4px base unit**.

| Token | Value |
|---|---:|
| `space/1` | 4px |
| `space/2` | 8px |
| `space/3` | 12px |
| `space/4` | 16px |
| `space/6` | 24px |
| `space/8` | 32px |
| `space/10` | 40px |
| `space/16` | 64px |
| `space/24` | 96px |

### Layout rules

- 4px: micro adjustment / tight icon-text relationships.
- 8px: spacing inside a small group.
- 16px: spacing between groups.
- 32–40px: spacing between sections.
- Standard card padding: **24px**.
- Compact card padding: **16px**.
- Hero / large card padding: **32px**.

Add to `:root`:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-16: 64px;
  --space-24: 96px;
}
```

Usage examples:

```tsx
<div className="gap-[var(--space-2)]" />
<section className="py-[var(--space-10)]" />
<div className="p-[var(--space-6)]" />
```

---

# 5. Radius System

| Token | Value | Intended use |
|---|---:|---|
| `radius/sm` | 6px | Controls, cards |
| `radius/md` | 12px | Menus, modals |
| `radius/lg` | 16px | Fullscreen / large surfaces |
| `radius/full` | 9999px | Pills, avatars |

Add to `:root`:

```css
:root {
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
}
```

Tailwind mapping:

```css
@theme inline {
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-full: var(--radius-full);
}
```

Usage:

```tsx
<div className="rounded-sm" />
<div className="rounded-md" />
<div className="rounded-lg" />
<div className="rounded-full" />
```

---

# 6. Elevation & Focus

The reference defines four elevation/focus concepts:

| Token | Purpose |
|---|---|
| `Shadow/Raised` | Cards and slightly elevated surfaces |
| `Shadow/Popover` | Dropdowns, menus, floating UI |
| `Shadow/Modal` | Dialogs and high-priority overlays |
| `Focus/Ring` | Keyboard focus and active focus state |

The screenshot defines the semantic levels but does not expose numeric CSS shadow values. The following values are the project implementation for those levels and should remain subtle.

```css
:root {
  --shadow-raised:
    0 1px 2px rgb(0 0 0 / 0.06),
    0 1px 3px rgb(0 0 0 / 0.08);

  --shadow-popover:
    0 8px 24px rgb(0 0 0 / 0.10),
    0 2px 8px rgb(0 0 0 / 0.06);

  --shadow-modal:
    0 20px 48px rgb(0 0 0 / 0.14),
    0 4px 12px rgb(0 0 0 / 0.08);

  --focus-ring-color: var(--blue-700);
  --focus-ring:
    0 0 0 2px var(--background-100),
    0 0 0 4px var(--focus-ring-color);
}
```

Utility classes:

```css
@layer utilities {
  .shadow-raised {
    box-shadow: var(--shadow-raised);
  }

  .shadow-popover {
    box-shadow: var(--shadow-popover);
  }

  .shadow-modal {
    box-shadow: var(--shadow-modal);
  }

  .focus-ring:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
}
```

Design rule:

> Create hierarchy from **surface color and borders first**. Use shadows as a subtle secondary cue.

---

# 7. Global Base Styles

Recommended global base layer:

```css
@layer base {
  * {
    box-sizing: border-box;
    border-color: var(--border);
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    margin: 0;
    background: var(--background);
    color: var(--foreground);
    font-family: var(--font-geist-sans), Arial, sans-serif;
    font-size: 14px;
    line-height: 20px;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  code,
  pre,
  kbd,
  samp,
  .tabular-data {
    font-family: var(--font-geist-mono), monospace;
  }

  :focus-visible {
    outline: none;
  }
}
```

---

# 8. Recommended Component Conventions

## Button

```tsx
<button
  className="
    focus-ring
    inline-flex items-center justify-center
    rounded-sm
    bg-primary
    px-[var(--space-4)] py-[var(--space-2)]
    text-[14px]/[20px] font-medium
    text-primary-foreground
    transition-colors
    hover:bg-primary-hover
    active:bg-primary-active
    disabled:pointer-events-none disabled:opacity-50
  "
>
  Place bid
</button>
```

## Card

```tsx
<div
  className="
    rounded-sm
    border border-border
    bg-surface
    p-[var(--space-6)]
    shadow-raised
  "
>
  ...
</div>
```

## Label + value

```tsx
<div className="flex items-center gap-[var(--space-2)]">
  <span className="text-[14px]/[20px] text-foreground-muted">
    Current bid
  </span>
  <span className="text-[14px]/[20px] font-medium text-foreground">
    12 bids
  </span>
</div>
```

## Technical / tabular data

```tsx
<span className="font-mono text-[13px]/[18px] tabular-nums">
  AUCTION-00142
</span>
```

---

# 9. Project Rules

1. Never hard-code brand/status colors inside page components when a design token exists.
2. Prefer semantic classes such as `bg-primary`, `text-foreground`, `border-border`.
3. Use raw palette classes/tokens only when a specific tint is intentionally required.
4. Keep normal UI copy primarily at `Copy/14` and labels primarily at `Label/14`.
5. Use `Geist Mono` only for technical data, IDs, prices/data tables, code, and tabular figures.
6. Use the 4px spacing grid. Avoid arbitrary spacing such as `13px`, `19px`, `27px` unless the design explicitly requires it.
7. Keep radius values to 6px, 12px, 16px, or full pill radius.
8. Prefer borders/surfaces before adding shadows.
9. All interactive controls must have a visible keyboard focus ring.
10. Do not create a dark-mode palette until a dark-mode design is supplied.

---

# 10. Quick Reference

```text
FONT
Geist Sans -> UI / prose
Geist Mono -> code / data / tabular figures

DEFAULT UI TEXT
Copy/14  -> 14px / 20px / Regular
Label/14 -> 14px / 20px / Regular
Button/14 -> 14px / 20px / Medium

BRAND
Primary       -> Orange Brand 700  #EE4F22
Primary Hover -> Orange Brand 800  #D2401A
Primary Active-> Orange Brand 900  #B8360F

STATUS
Info    -> Blue 700   #006BFF
Success -> Green 700  #28A948
Warning -> Amber 700  #FFAE00
Danger  -> Red 700    #FC0035

SPACE
4 / 8 / 12 / 16 / 24 / 32 / 40 / 64 / 96

RADIUS
6 / 12 / 16 / 9999

CARD PADDING
Compact 16px
Default 24px
Hero    32px
```

---

## Final structure recommendation

```text
src/
├── app/
│   ├── globals.css       <- all root/theme/base tokens
│   ├── layout.tsx        <- Geist + Geist Mono
│   └── ...
├── components/
│   ├── ui/
│   └── ...
└── ...
```

`globals.css` is the global source of truth. Components consume tokens; components should not redefine the design system.
