# Plan: Frontend Simplification & Standardization

## Context

The Chirp frontend has grown inconsistently — some components use CSS variables from `index.css`, others have hardcoded hex values; some use shadcn, others use native HTML elements. The goal is to make the entire theme changeable via `index.css` alone, standardize shadcn usage, and eliminate repeated class strings throughout the codebase.

---

## What Will NOT Be Touched

- `ChirpLandingPage.tsx` gradient hex values — intentional marketing design, not worth the risk/noise
- `FaceBoundingBox.tsx` / `FaceOverlayImage.tsx` — complex SVG geometry, functional, no UI simplification needed
- `ChirpComingSoonVisual.tsx` — just updated
- Auto-generated files (`routeTree.gen.ts`)

---

## Phase 1 — Add Missing CSS Variables & Utility (`src/index.css`)

Add to the `:root` block under the existing `/* Chirp */` section:

```css
/* Form / input surface */
--chirp-input-bg: #1f1a17;

/* Mobile bottom sheet surface */
--chirp-sheet-bg: #1b181d;

/* Person chip / selection accent (replacing ad-hoc violet-400) */
--chirp-selected-bg: #7c3aed;
--chirp-selected-fg: #ffffff;
```

Add one CSS utility so the gradient button pattern becomes a single reusable class:

```css
@utility bg-chirp-gradient {
  background: linear-gradient(
    135deg,
    var(--chirp-accent-start),
    var(--chirp-accent-end)
  );
}
```

This means any component using `bg-linear-[135deg] from-chirp-accent-start to-chirp-accent-end` just uses `bg-chirp-gradient` instead, and the gradient can be changed in one place.

---

## Phase 2 — FaceStateChip.tsx → use Badge + CSS vars

**File:** `src/chirp/components/FaceStateChip.tsx`

**Problem:** Variant colors are hardcoded (`bg-[#173229]`, `text-emerald-400`, etc.) despite `index.css` already defining `--face-tagged-label-bg`, `--face-tagged-label-fg`, etc.

**Change:** Swap `<span>` for `<Badge variant="outline">` and replace hardcoded colors:

```ts
const variants = {
  tagged:  'border-(--face-tagged)/33 bg-(--face-tagged-label-bg) text-(--face-tagged-label-fg)',
  likely:  'border-(--face-likely)/36 bg-(--face-likely-label-bg) text-(--face-likely-label-fg)',
  unknown: 'border-(--face-unknown)/36 bg-(--face-unknown-label-bg) text-(--face-unknown-label-fg)',
};
// render:
<Badge variant="outline" className={cn('h-[22px] rounded-full px-2 text-[11px] font-medium', variants[variant])}>
  {labels[variant]}
</Badge>
```

---

## Phase 3 — ScrapeStatusChip.tsx → use Badge + CSS vars

**File:** `src/chirp/components/ScrapeStatusChip.tsx`

**Problem:** Same hardcoded hex pattern. Maps well to existing face state variables.

**Change:** Same Badge pattern, map status to existing vars:

```ts
const variants: Record<ScrapeStatus, string> = {
  queued: 'border-chirp-border/30 bg-chirp-surface text-chirp-text-body',
  pending: 'border-chirp-border/30 bg-chirp-surface text-chirp-text-body',
  scraping:
    'border-(--face-likely)/36 bg-(--face-likely-label-bg) text-(--face-likely-label-fg)',
  processing:
    'border-(--face-likely)/36 bg-(--face-likely-label-bg) text-(--face-likely-label-fg)',
  completed:
    'border-(--face-tagged)/33 bg-(--face-tagged-label-bg) text-(--face-tagged-label-fg)',
  skipped: 'border-chirp-border/30 bg-chirp-surface text-chirp-text-dim',
  failed: 'border-destructive/36 bg-destructive/10 text-destructive',
};
```

---

## Phase 4 — PersonChip.tsx → fix color inconsistency

**File:** `src/chirp/components/PersonChip.tsx`

**Problem:** Uses `bg-violet-400` (a hardcoded Tailwind color) which is inconsistent with the warm chirp theme.

**Change:** Replace with the new `--chirp-selected-*` CSS variables:

```
bg-violet-400 text-white  →  bg-(--chirp-selected-bg) text-(--chirp-selected-fg)
```

No structural changes needed.

---

## Phase 5 — MobileFilterSheet.tsx → align colors

**File:** `src/chirp/components/MobileFilterSheet.tsx`

Three fixes:

1. `bg-[#1B181D]` on `<SheetContent>` → `bg-(--chirp-sheet-bg)`
2. Person pill selected state `border-violet-400/50 bg-violet-400/20 text-violet-300` → `border-(--chirp-selected-bg)/50 bg-(--chirp-selected-bg)/20 text-(--chirp-selected-fg)`
3. Apply button gradient `bg-linear-[135deg] from-chirp-accent-start to-chirp-accent-end` → `bg-chirp-gradient`

---

## Phase 6 — login.tsx → fix input bg + nav bug + gradient

**File:** `src/routes/chirp/login.tsx`

Three fixes:

1. Input `bg-[#1F1A17]` → `bg-(--chirp-input-bg)`
2. **Navigation bug** (from security audit): `onSuccess: void navigate(...)` → `onSuccess: () => navigate({ to: '/chirp/gallery', from: '/chirp/login' })`
3. Sign In button gradient → `bg-chirp-gradient`

---

## Phase 7 — GallerySidebar.tsx → extract repeated nav class

**File:** `src/chirp/components/GallerySidebar.tsx`

The active/inactive nav link class string is written out verbatim twice (for "All Photos" and "Uploads" links). Extract to a local helper:

```ts
const navCls = (active: boolean) =>
  cn(
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
    active
      ? 'border border-chirp-border-warm/18 bg-chirp-card text-chirp-text'
      : 'text-chirp-text-body hover:bg-chirp-panel',
  );
```

Apply to both `<Link>` nav items and the people `<button>` items.

---

## Phase 8 — gallery.tsx Upload buttons → gradient utility

**File:** `src/routes/chirp/gallery.tsx`

The Upload button appears twice (desktop header + mobile header) with the same long gradient class string. Replace both with `bg-chirp-gradient`.

---

## Phase 9 — index.tsx glow divs → CSS var opacity

**File:** `src/routes/chirp/index.tsx`

Glow overlays use `rgba(230,162,106,0.08)` / `rgba(230,162,106,0.06)` — these are `--chirp-accent` (#E6A26A) with opacity. Tailwind v4 supports CSS variable colors with opacity modifier:

```
bg-[rgba(230,162,106,0.08)]  →  bg-(--chirp-accent)/8
bg-[rgba(230,162,106,0.06)]  →  bg-(--chirp-accent)/6
```

---

## File Change Summary

| File                                         | Changes                                                |
| -------------------------------------------- | ------------------------------------------------------ |
| `src/index.css`                              | +3 CSS vars + `bg-chirp-gradient` utility              |
| `src/chirp/components/FaceStateChip.tsx`     | `<span>` → `<Badge>`, hardcoded colors → CSS vars      |
| `src/chirp/components/ScrapeStatusChip.tsx`  | `<span>` → `<Badge>`, hardcoded colors → CSS vars      |
| `src/chirp/components/PersonChip.tsx`        | `violet-400` → `--chirp-selected-*` CSS vars           |
| `src/chirp/components/MobileFilterSheet.tsx` | Fix sheet bg, align selection colors, gradient utility |
| `src/routes/chirp/login.tsx`                 | Fix input bg, nav bug, gradient utility                |
| `src/chirp/components/GallerySidebar.tsx`    | Extract nav link class helper                          |
| `src/routes/chirp/gallery.tsx`               | Replace Upload button gradient with utility            |
| `src/routes/chirp/index.tsx`                 | Replace rgba glows with CSS var + opacity              |

---

## Verification

- `npm run build` — no TypeScript errors
- `npm run lint` — no ESLint warnings
- Visual spot-check: gallery, login, upload pages render correctly
- FaceStateChip badges show correct green/amber/slate colors
- ScrapeStatusChip badges show correct colors per status
- Changing `--chirp-accent-start` / `--chirp-accent-end` in `index.css` updates all gradient buttons at once
- Changing `--chirp-selected-bg` updates PersonChip and MobileFilterSheet person pill together
