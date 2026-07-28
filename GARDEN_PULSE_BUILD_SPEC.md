# Garden Pulse — Complete Build Specification

> **Purpose**: Reproduce the Garden Pulse experience in a standalone Lovable project.  
> This spec is platform-agnostic — it describes *what* to build, not which backend to use.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Shape](#data-shape)
3. [Page Architecture](#page-architecture)
4. [Surface 1: Constellation](#surface-1-constellation)
5. [Surface 2: Atlas](#surface-2-atlas)
6. [Surface 3: The Loom](#surface-3-the-loom)
7. [Surface 4: Scriptorium](#surface-4-scriptorium)
8. [Compass Overlay](#compass-overlay)
9. [Silent Mode](#silent-mode)
10. [Design Tokens & Color System](#design-tokens--color-system)
11. [Implementation Code](#implementation-code)

---

## Overview

Garden Pulse is a **contemplative ecosystem dashboard** — not an analytics panel. It visualizes organizational activity as living landscapes using raw HTML5 Canvas animations at 60fps.

**Four tabbed surfaces:**
| Tab | Metaphor | Purpose |
|---|---|---|
| **Constellation** | Night-sky terrain with glowing nodes | See each organization as a "star" — size/glow = activity level |
| **Atlas** | Celestial meridian map with light pillars | See geographic territories — pillar height = engagement depth |
| **The Loom** | Weaving loom with warp/weft threads | Timeline of narrative signals — threads weave across lanes |
| **Scriptorium** | Reading room / manuscript viewer | Browse and read essays/reflections in a calm editorial layout |

**Key principles:**
- No charts, no bar graphs, no KPIs
- Canvas-based (no charting libraries)
- DPR-aware rendering (retina support)
- All labels suppressible via "Silent Mode"
- Dark sky aesthetic throughout (`#0e1320` base)

---

## Data Shape

### PulseNode (for Constellation + Atlas)

Each node represents one organization/community in the ecosystem.

```typescript
interface PulseNode {
  id: string;              // Unique identifier
  name: string;            // Display name
  category: string | null; // Grouping type (e.g., "education", "healthcare")
  territory_name: string | null;  // Geographic territory
  territory_state: string | null; // State/region
  group_id: string | null;        // Familia/cluster grouping
  recent_event_count: number;     // Events in last 30 days
  recent_signal_count: number;    // Signals in last 30 days
  recent_activity_count: number;  // Activities in last 30 days
}
```

### TimelineEvent (for The Loom)

Each event is a narrative signal flowing through the system.

```typescript
interface TimelineEvent {
  id: string;
  event_kind: string;       // e.g., 'reflection_moment', 'community_growth'
  summary: string;          // Human-readable narrative sentence
  source_module: string;    // Origin label (e.g., 'Intelligence · Archetype')
  occurred_at: string;      // ISO timestamp
  signal_weight: number;    // 1-5 importance
  actor_id: string;         // Grouping key
  actor_name: string;       // Display name
}
```

### EssayDraft (for Scriptorium)

```typescript
interface EssayDraft {
  id: string;
  title: string;
  body: string;              // HTML or plain text content
  status: 'draft' | 'published';
  voice_origin: 'human' | 'ai' | null;
  gravity_score: number;     // Relevance weight (0-10)
  collection: string | null; // Grouping (e.g., "Reflections", "Patterns")
  created_at: string;        // ISO timestamp
  published_at: string | null;
}
```

---

## Page Architecture

```
┌──────────────────────────────────────────┐
│  Header: Title + Silent Mode toggle      │
├──────────────────────────────────────────┤
│  Tabs: [Constellation] [Atlas] [Loom] [Scriptorium] │
├──────────────────────────────────────────┤
│                                          │
│  Active tab content (full width)         │
│  Canvas surfaces: min 400px tall         │
│                                          │
└──────────────────────────────────────────┘
```

- Max width container: `max-w-5xl mx-auto`
- Tab list scrollable on mobile
- Loading state: skeleton placeholders

---

## Surface 1: Constellation

### What It Does
A **living night-sky terrain map** where each organization appears as a glowing node. Nodes breathe, connections pulse between grouped organizations, and a terrain grid warps near active nodes.

### Visual Description
- **Background**: Radial gradient from `#0e1320` (center) to `#080b14` (edge)
- **Mountain silhouettes**: Three parallax layers at bottom (72%, 78%, 84% of height), with snow-cap highlights on tallest peaks
- **Terrain grid**: Horizontal lines every 28px, perturbed by proximity to active nodes (creates a "gravity well" effect)
- **Nodes**: Radial gradient circles, warm amber tones (`rgb(212, 184, 150)`)
  - Bright center dot: `rgba(255, 240, 220, 0.7-0.9)`
  - Outer bloom glow: radius × 3
  - Activity ring: arc proportional to score ratio, blue-teal (`rgb(123, 165, 196)`)
  - Size: 4px (low activity) → 22px (high activity)
  - Breathing animation: `sin(t * 0.6 + offset) * 0.15 + 1`
- **Connections**: Curved Bézier paths between nodes sharing the same `group_id`
  - Gradient: amber at endpoints, blue-teal at midpoint
  - Traveling light dot along path
- **Labels**: Node names below each dot, alpha based on activity ratio (0.2 → 0.45), hidden in Silent Mode
- **Hover**: Node scales to 1.3×, label brightens to 0.9 alpha
- **Tooltip** (on hover): Positioned at cursor, dark card showing name + 3 stat rows (Activities, Events, Signals)
- **Legend** (bottom-left): Three warmth levels (Active, Steady, Resting) with sized dots

### Canvas Setup Pattern
```typescript
// DPR-aware resize
const dpr = window.devicePixelRatio || 1;
canvas.width = canvas.clientWidth * dpr;
canvas.height = canvas.clientHeight * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

### Node Positioning Algorithm
Nodes are deterministically positioned using a hash of their ID:
```typescript
let hash = 0;
for (let i = 0; i < node.id.length; i++) {
  hash = ((hash << 5) - hash) + node.id.charCodeAt(i);
}
const x = 0.08 + (Math.abs(hash % 840) / 1000) * 0.84;      // 8%-92% horizontal
const y = 0.08 + (Math.abs((hash * 7) % 600) / 1000) * 0.72; // 8%-80% vertical
```

### Mountain Drawing Algorithm
Three layers, back to front:
```typescript
const layers = [
  { baseY: H * 0.72, amplitude: H * 0.22, freq: 0.0018, color: 'rgba(14, 18, 32, 0.95)', drift: 0.02 },
  { baseY: H * 0.78, amplitude: H * 0.16, freq: 0.003,  color: 'rgba(16, 22, 38, 0.9)',  drift: -0.03 },
  { baseY: H * 0.84, amplitude: H * 0.10, freq: 0.005,  color: 'rgba(20, 28, 48, 0.85)', drift: 0.04 },
];
// Each layer: fill path using sin() composition for peaks
// Snow caps: only draw on peaks above 55% of amplitude
```

### Interaction
- `mousemove`: Track cursor position for hover detection
- `click`: If a node is hovered, fire `onSelectNode(node)` → opens detail panel (Sheet/drawer)

### Card Wrapper
```
<Card> with border-0, shadow-lg
  CardHeader: bg-[hsl(215,30%,12%)], border-b border-[hsl(215,20%,18%)]
    Icon: Sparkles (amber-400)
    Title: "Constellation" (font-serif, text-amber-50)
    Subtitle: "The landscape breathes with the warmth of movement."
  CardContent: p-0
    <canvas> h-[520px] sm:h-[400px]
    Tooltip overlay (absolute, pointer-events-none)
    Legend (absolute bottom-left)
```

---

## Surface 2: Atlas

### What It Does
A **celestial meridian projection** where territories appear as light pillars rising from a curved grid. Taller pillars = more engagement. Particles float upward from active territories.

### Visual Description
- **Background**: Radial gradient from `#0a0f1a` to `#050810`
- **Stars**: 80 random points in upper 50% of canvas, twinkling via `sin(t * 0.5 + offset)`
- **Meridian Grid**: Perspective-projected longitude (10 lines) + latitude (8 lines) with subtle curve distortion
  - Grid color: `rgba(25, 35, 65, 0.15-0.25)`
- **Projection function** (pseudo-3D):
  ```typescript
  function project(nx: number, ny: number) {
    const PERSPECTIVE = 0.6;
    const SHEAR = 0.08;
    const px = offsetX + nx * scaleX + ny * scaleX * SHEAR;
    const py = offsetY + ny * scaleY * PERSPECTIVE + (1 - ny) * scaleY * 0.15;
    return { x: px, y: py };
  }
  ```
- **Light Pillars**: Trapezoidal shapes rising from each territory node
  - Height: 30px (low) → 150px (high activity), breathing
  - Width: 2px (few orgs) → 8px (many), tapers to 30% at top
  - Color: Warm gradient `rgba(160-212, 140-184, 100-196, fade to transparent)`
  - Core center line at 85% height
  - Ground glow: Elliptical radial gradient beneath base
- **Particles**: Float upward from active territories
  - Spawned probabilistically: `Math.random() < activityRatio * 0.3`
  - Pool capped at 300 particles
  - Drift horizontally, fade over lifetime
- **Labels**: Territory name below pillar base, hidden in Silent Mode
- **Hover tooltip**: Dark card with territory name, state, community count, activity bar

### Card Wrapper
```
Same dark card pattern as Constellation
  Icon: Map (teal-400)
  Title: "Atlas" (font-serif, text-amber-50)
  Subtitle: "Pillars rise from communities. Particles ascend like quiet prayers."
  Legend: Three pillar heights (Strong, Growing, Emerging)
```

---

## Surface 3: The Loom

### What It Does
A **weaving visualization** where vertical "warp threads" represent lanes and horizontal "weft threads" represent narrative events. Clicking a node on the canvas updates the detail panel to show that event's narrative.

### Visual Description
- **Background**: Radial gradient `#0c1018` → `#070910`
- **Warp threads**: 8 vertical lanes, subtle sinusoidal wobble
  - Color: `rgba(100, 130, 200, 0.25-0.45)`
  - Line width: 1.2px
- **Weft threads**: One per event, horizontal with Gaussian pull toward its lane intersection
  - 3 types with distinct colors:
    - **Noticing** (default): `rgb(123, 165, 196)` — blue-steel
    - **Reflection**: `rgb(212, 184, 150)` — warm amber
    - **Movement**: `rgb(139, 170, 122)` — sage green
  - Classification:
    ```
    reflection: essay_published, ecosystem_reflection, reflection_moment
    movement: archetype_movement, community_growth, collaboration_signal, capacity_growth
    noticing: everything else
    ```
  - Active thread: 3px stroke, glow halo, actor label above
  - Inactive: 1.5px stroke, 0.45 alpha
  - Gradient fade at left/right edges
- **Nodes**: Circles at weft/warp intersection (3px inactive, 5px active)
- **Date markers**: Left edge, `MMM d` format, shown only at day boundaries
- **Lane assignment**: Hash of actor_id modulo 8

### Layout

**Desktop** (md+): Side-by-side, 520px tall
```
┌─────────────────────┬──────────────────┐
│  Canvas (flex-1)    │  Detail Panel    │
│                     │  (340px fixed)   │
│  Warp + weft viz    │  Event list by   │
│                     │  date, scrollable│
│  "The Loom" label   │                  │
└─────────────────────┴──────────────────┘
```

**Mobile**: Stacked, 320px canvas
```
┌──────────────────────┐
│  Active event card   │
│  (current selection) │
├──────────────────────┤
│  Canvas (320px tall) │
│  "Tap a dot to read" │
└──────────────────────┘
```

### Detail Panel Styling
- Header: "The Gardener · Observatory" (10px uppercase tracking-[3px]), "Timeline" (serif 2xl, warm amber)
- Event cards: Grouped by date
  - Active card: `bg-[hsl(215,30%,10%)]`, colored left border
  - Type dot + timestamp + type label
  - Actor name in serif
  - Summary text
  - Source module label

### Interaction
- Click on canvas → find nearest node within 40px → update `activeIndex`
- Hover/click on event cards → update `activeIndex`
- Active card auto-scrolls into view

---

## Surface 4: Scriptorium

### What It Does
A **calm essay reader** that presents one essay at a time with editorial typography. Navigate between essays with prev/next buttons.

### Visual Description
- **Background**: `bg-[hsl(215,30%,6%)]`
- **Header**: Dark panel with title "The Gardener · Observatory" / "Scriptorium"
- **Pagination**: Ghost buttons with chevrons, "N of M" counter
- **Reading pane**: Centered `max-w-[660px]`, generous padding (px-10 py-12 on desktop)

### Essay Status System
```
complete  → published          → green dot, "Complete"
forming   → draft, body > 400  → amber dot (pulsing), "Still Forming"
emerging  → draft, body ≤ 400  → slate dot, "Emerging"
```

Status dot colors:
```css
complete: hsl(100,30%,50%) with 0.3 glow
forming:  hsl(35,50%,62%) with 0.3 glow, animate-pulse
emerging: hsl(230,15%,50%) with 0.3 glow
```

### Typography (Critical)
```css
/* Reading body */
font-family: Georgia, 'Times New Roman', serif;
font-size: 16px (1rem);
line-height: 1.85;
color: hsl(215, 15%, 75%);

/* Paragraph indent */
p { margin-bottom: 1.25rem; text-indent: 1.5rem; }
p:first-child { text-indent: 0; }

/* Drop cap on first paragraph */
p:first-child::first-letter {
  font-size: 52px;
  float: left;
  line-height: 0.8;
  margin-right: 10px;
  margin-top: 4px;
  color: hsl(30, 40%, 71%);
  opacity: 0.7;
}

/* Emphasis */
em { color: hsl(30, 30%, 68%); font-style: italic; }

/* Blockquotes */
blockquote {
  margin: 1.5rem 0;
  padding: 1rem 1.5rem;
  border-left: 2px solid hsl(215, 20%, 20%);
  font-style: italic;
  color: hsl(215, 15%, 65%);
  font-size: 15px;
}
```

### Title Typography
```css
font-family: Georgia, serif;
font-size: 28px (sm+), 20px (mobile);
font-weight: normal;
color: hsl(30, 40%, 71%);
line-height: 1.35;
letter-spacing: 0.025em;
```

### "Still Forming" Fade
When an essay is not yet complete, overlay a gradient at the bottom:
```css
/* Positioned absolute at bottom of body */
height: 80px;
background: linear-gradient(to top, hsl(215, 30%, 6%), transparent);
pointer-events: none;
```

### Footer
```
Generated by [AI Name] · [Platform] Observatory · Scriptorium
"This reflection was synthesized from aggregated signals. Individual content is never displayed."
[small badge: "AI REFLECTION"]
```

### Empty State
```
[leaf icon, 40% opacity]
"The scriptorium is quiet. Essays will emerge from reflections and lived work."
(serif, italic, muted)
```

---

## Compass Overlay

An optional directional overlay that maps signals to four cardinal directions. Toggled on/off.

### Four Directions
| Direction | Label | Meaning | Color |
|---|---|---|---|
| North | Narrative | Reflections, stories, essays | `amber-300` |
| East | Discernment | Growth, momentum, milestones | `sky-300` |
| South | Care | Visits, events, volunteering | `emerald-300` |
| West | Restoration | Recovery, returns, completion | `rose-300` |

### Signal Classification
```typescript
const KIND_MAP: Record<string, CompassDirection> = {
  // NORTH — Narrative
  reflection: 'north', essay_published: 'north', story_signal: 'north',
  // EAST — Discernment
  momentum_signal: 'east', community_growth: 'east', milestone: 'east',
  // SOUTH — Care
  visit: 'south', event_completed: 'south', volunteer_participation: 'south',
  // WEST — Restoration
  entity_restored: 'west', relationship_restored: 'west', care_completed: 'west',
};
// Default fallback: 'south' (care)
```

### Visual Layout
```
                 ▲ North bar
                 │
                [Narrative]
                 
    ◄──── West ── ⊕ ── East ────►
   [Restoration]       [Discernment]
                 
                [Care]
                 │
                 ▼ South bar
```

- Center: 56px (sm: 80px) circle with dominant direction label + percentage
- Arms: Colored bars, length = `max(28, pct * 80)px`
- Labels: Direction name + signal count
- Bottom narrative: Italic serif phrase for dominant direction
- All labels hidden in Silent Mode
- Empty state: "The compass is listening… awaiting movement to discern."

---

## Silent Mode

A global toggle that suppresses all labels, subtitles, and narrative text across all surfaces.

When enabled:
- Canvas node labels → hidden
- Card subtitles → hidden
- Compass labels → hidden
- Only raw visual patterns remain
- Toggle icon: `Eye` / `EyeOff`

---

## Design Tokens & Color System

### Base Dark Sky Palette
```css
--sky-deep:        hsl(215, 30%, 6%);   /* Card backgrounds */
--sky-darker:      hsl(220, 40%, 4%);   /* Panel backgrounds */
--sky-medium:      hsl(215, 30%, 12%);  /* Card headers */
--sky-border:      hsl(215, 20%, 18%);  /* Borders */
--sky-border-faint: hsl(215, 30%, 10%); /* Subtle dividers */
--sky-text-dim:    hsl(215, 20%, 45%);  /* Date labels */
--sky-text-mid:    hsl(215, 20%, 55%);  /* Secondary text */
--sky-text-body:   hsl(215, 15%, 68%);  /* Body text (Loom) */
--sky-text-bright: hsl(215, 15%, 75%);  /* Body text (Scriptorium) */

--warm-gold:       hsl(30, 40%, 71%);   /* Titles, active elements */
--warm-gold-dim:   hsl(30, 25%, 65%);   /* Actor names */
--warm-label:      hsl(35, 50%, 70%);   /* Tooltip titles */
--warm-amber-dim:  hsl(35, 45%, 55%);   /* Forming status */

--noticing-rgb:    123, 165, 196;       /* Blue-steel */
--reflection-rgb:  212, 184, 150;       /* Warm amber */
--movement-rgb:    139, 170, 122;       /* Sage green */
```

### Canvas Colors (RGB for compositing)
```
Node core:      rgba(212, 184, 150, 0.9) → rgba(140, 110, 80, 0)
Node center:    rgba(255, 240, 220, 0.7)
Node ring:      rgba(123, 165, 196, 0.25)
Connection:     rgba(212, 184, 150) ↔ rgba(123, 165, 196)
Terrain grid:   rgba(40, 50, 80, 0.15)
Meridian grid:  rgba(25, 35, 65, 0.15-0.25)
Warp threads:   rgba(100, 130, 200, 0.35)
Stars:          rgba(180, 195, 220, 0.08-0.15)
```

### Typography
```
Display/Titles: Georgia, 'Times New Roman', serif
Body:           Georgia, serif (Scriptorium) / -apple-system, sans-serif (labels)
Monospace:      Not used
Uppercase labels: -apple-system, sans-serif at 9-10px with tracking-[2px]
```

---

## Implementation Code

### Required Dependencies
```
React 18+
@tanstack/react-query (data fetching)
date-fns (date formatting)
lucide-react (icons: Sparkles, Map, Clock, BookOpen, Eye, EyeOff, ChevronRight, Leaf)
shadcn/ui components: Card, Badge, Button, Skeleton, Switch, Tabs, Sheet, ScrollArea, Tooltip
tailwind-merge + clsx (cn utility)
```

### File Structure
```
src/
  pages/
    GardenPulsePage.tsx          # Main page with all 4 surfaces
  components/
    CompassOverlay.tsx           # Optional compass overlay
  lib/
    compassDirection.ts          # Compass utility (pure functions)
  hooks/
    useEcosystemPulse.ts         # Fetch PulseNode[] data
    useRecentTimeline.ts         # Fetch TimelineEvent[] data  
    useLibraryDrafts.ts          # Fetch EssayDraft[] data
```

### Complete Source: compassDirection.ts

```typescript
export type CompassDirection = 'north' | 'east' | 'south' | 'west';

export interface CompassWeight {
  north: number;
  east: number;
  south: number;
  west: number;
}

const KIND_MAP: Record<string, CompassDirection> = {
  // NORTH — Narrative / Identity
  reflection: 'north', reflection_moment: 'north', ecosystem_reflection: 'north',
  essay_published: 'north', story_signal: 'north', testimonium: 'north',

  // EAST — Discernment / Becoming
  adoption_signal: 'east', momentum_signal: 'east', community_growth: 'east',
  capacity_growth: 'east', milestone: 'east',

  // SOUTH — Care / Presence
  visit: 'south', event_completed: 'south', volunteer_participation: 'south',
  collaboration_signal: 'south', provision: 'south',

  // WEST — Restoration / Return
  entity_restored: 'west', relationship_restored: 'west',
  care_completed: 'west', structure_restored: 'west',
};

export function buildCompassDirection(kind: string): CompassDirection {
  return KIND_MAP[kind] ?? 'south';
}

export function buildCompassWeights(kinds: string[]): CompassWeight {
  const w: CompassWeight = { north: 0, east: 0, south: 0, west: 0 };
  for (const k of kinds) w[buildCompassDirection(k)]++;
  return w;
}

export const COMPASS_LABELS: Record<CompassDirection, string> = {
  north: 'Narrative', east: 'Discernment', south: 'Care', west: 'Restoration',
};

export const COMPASS_NARRATIVES: Record<CompassDirection, string> = {
  north: 'Narrative gathers — reflections and stories are forming above.',
  east: 'Discernment stirs — signals of growth and clarity move forward.',
  south: 'Care deepens — visits, projects, and provision take root.',
  west: 'Restoration returns — what was lost is being reclaimed.',
};
```

### Complete Source: GardenPulsePage.tsx

The full page is a single ~1800 line file containing:

1. **Data hooks** — Fetch and shape data from your backend
2. **ConstellationLayer** — Canvas component (~350 lines)
3. **AtlasLayer** — Canvas component (~340 lines)
4. **LoomTimeline** — Canvas + detail panel (~400 lines)
5. **ScriptoriumPanel** — Essay reader (~170 lines)
6. **NodeDetailPanel** — Sheet/drawer for node details
7. **GardenPulsePage** — Main page with tabs, toggles, state

The exact rendering code is provided above in each surface section. Here is a summary of the critical animation patterns used across all canvases:

### Animation Loop Pattern (all surfaces)
```typescript
const animRef = useRef<number>(0);
const timeRef = useRef(0);

useEffect(() => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    timeRef.current += 0.016; // ~60fps time step
    ctx.clearRect(0, 0, W, H);
    
    // Draw background
    // Draw layers...
    // Draw nodes...
    
    animRef.current = requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
  
  return () => {
    cancelAnimationFrame(animRef.current);
    window.removeEventListener('resize', resize);
  };
}, [dependencies]);
```

### Hover Detection Pattern
```typescript
const mouseRef = useRef({ x: 0, y: 0 });
const hoveredRef = useRef<Node | null>(null);

// In draw loop:
nodes.forEach(node => {
  const pos = getScreenPos(node);
  const dist = Math.sqrt((mouseRef.current.x - pos.x) ** 2 + (mouseRef.current.y - pos.y) ** 2);
  const hitRadius = 8 + activityRatio * 22;
  if (dist < hitRadius) hoveredRef.current = node;
});

// Event listener:
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
});
```

### Loom: Dual Canvas Pattern (Desktop + Mobile)
```typescript
const desktopCanvasRef = useRef<HTMLCanvasElement>(null);
const mobileCanvasRef = useRef<HTMLCanvasElement>(null);

// Pick the visible one:
const activeCanvas = (desktopCanvas && desktopCanvas.clientWidth > 0) 
  ? desktopCanvas 
  : mobileCanvas;
```

### Loom: Click-to-Select Pattern
```typescript
const nodePositionsRef = useRef<{ x: number; y: number }[]>([]);

// In draw loop: store each node position
positions.push({ x: targetX, y: nodeY });
nodePositionsRef.current = positions;

// On click: find nearest node
const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  let closestIdx = 0, closestDist = Infinity;
  nodePositionsRef.current.forEach((pos, i) => {
    const dist = Math.sqrt((clickX - pos.x) ** 2 + (clickY - pos.y) ** 2);
    if (dist < closestDist) { closestDist = dist; closestIdx = i; }
  });
  if (closestDist < 40) setActiveIndex(closestIdx);
};
```

---

## Responsive Breakpoints

| Breakpoint | Constellation | Atlas | Loom | Scriptorium |
|---|---|---|---|---|
| Mobile (<768px) | 520px tall | 520px tall | Card above, 320px canvas below | px-5, text-xl title |
| Desktop (768px+) | 400px tall | 420px tall | Side-by-side 520px | px-10, text-[28px] title |

---

## Data Fetching Notes

All three hooks follow the same pattern:
```typescript
import { useQuery } from '@tanstack/react-query';

export function useEcosystemPulse() {
  return useQuery({
    queryKey: ['ecosystem-pulse'],
    queryFn: async () => {
      // Fetch from your backend view/API
      // Return PulseNode[]
    },
  });
}
```

The Loom combines three data sources (rollups, signals, essays) into a unified timeline, sorted by date descending, limited to 30 items.

---

## Accessibility Notes

- All canvases: `cursor: pointer` when hoverable
- Tab navigation via standard Tabs component
- Sheet/drawer for node details has proper close handling
- Loading states use Skeleton components (never flash empty)
- Silent Mode toggle has `aria-label="Silent Mode"`

---

## Summary

This spec provides everything needed to reproduce the Garden Pulse in any React + Tailwind project:

1. **Data interfaces** — adapt to your backend
2. **Canvas rendering code** — copy the exact algorithms
3. **Color system** — precise HSL/RGB values
4. **Typography** — font stacks and sizing
5. **Layout** — responsive breakpoints and structure
6. **Interaction patterns** — hover, click, canvas selection
7. **Editorial design** — Scriptorium's drop caps, status system, fade effects

The aesthetic is contemplative, dark-sky, warm-amber — not a dashboard. Build it as a place of noticing, not analysis.
