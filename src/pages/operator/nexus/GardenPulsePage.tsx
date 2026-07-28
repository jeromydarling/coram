/**
 * GardenPulsePage — Visual Ecosystem View for the Gardener.
 *
 * WHAT: Five-layer contemplative space showing the living ecosystem:
 *       Constellation, Atlas, Timeline, Scriptorium.
 * WHERE: /operator/nexus/garden-pulse — CURA zone.
 * WHY: The Gardener sees movement, not metrics. This replaces dashboards
 *       with a living narrative of growth across the garden.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Sparkles, Map, Clock, Calendar, BookOpen, Eye, EyeOff, ChevronRight, Leaf, Users, Heart, Building2, RotateCcw, Link2
} from 'lucide-react';
import { useRestorationSignals, aggregateRestorationNarrative } from '@/hooks/useRestorationSignals';
import { useProvidenceSignals, getThreadNarrative, getThreadLabel } from '@/hooks/useProvidenceSignals';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { GardenerCompassOverlay } from '@/components/operator/GardenerCompassOverlay';
import { buildCompassWeights, type CompassWeight } from '@/lib/compassDirection';
import { Compass as CompassIcon } from 'lucide-react';
import { NarrativeErrorBoundary } from '@/components/ui/narrative-error-boundary';

// ── Types ──

interface PulseNode {
  tenant_id: string;
  tenant_name: string;
  archetype: string | null;
  metro_name: string | null;
  metro_state: string | null;
  familia_id: string | null;
  recent_event_count: number;
  recent_signal_count: number;
  recent_activity_count: number;
}

// ── Hooks ──

function useEcosystemPulse() {
  return useQuery({
    queryKey: ['garden-pulse-ecosystem'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecosystem_garden_pulse_view')
        .select('*');
      if (error) throw error;
      return (data ?? []) as PulseNode[];
    },
  });
}

function useRecentTimeline() {
  return useQuery({
    queryKey: ['garden-pulse-nri-timeline'],
    queryFn: async () => {
      // Pull from three NRI narrative sources — never private tenant reflections
      const [rollups, signals, essays] = await Promise.all([
        supabase
          .from('archetype_signal_rollups')
          .select('id, archetype_key, generated_story, period_end, tenant_sample_size, reflection_volume, visit_activity, event_presence, momentum_growth, updated_at')
          .order('updated_at', { ascending: false })
          .limit(15),
        supabase
          .from('living_system_signals')
          .select('id, signal_type, anonymized_summary, confidence_score, context_json, created_at')
          .order('created_at', { ascending: false })
          .limit(15),
        supabase
          .from('operator_content_drafts')
          .select('id, title, editorial_mode, status, created_at')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const items: Array<{
        id: string;
        event_kind: string;
        summary: string;
        source_module: string;
        created_at: string | null;
        occurred_at: string;
        signal_weight: number;
        tenant_id: string;
        tenant_name: string;
      }> = [];

      // Archetype rollups → movement threads (anonymized, aggregated)
      for (const r of (rollups.data ?? []) as any[]) {
        const archLabel = (r.archetype_key || '').replace(/_/g, ' ');
        items.push({
          id: r.id,
          event_kind: 'archetype_movement',
          summary: r.generated_story || `${archLabel} communities showing momentum`,
          source_module: 'NRI · Archetype',
          created_at: r.updated_at,
          occurred_at: r.updated_at,
          signal_weight: Math.min(5, (r.momentum_growth ?? 0) + 1),
          tenant_id: r.archetype_key ?? 'ecosystem',
          tenant_name: archLabel.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        });
      }

      // Living system signals → noticing/movement threads (anonymized)
      const signalKindMap: Record<string, string> = {
        reflection_moment: 'ecosystem_reflection',
        community_growth: 'community_growth',
        collaboration_movement: 'collaboration_signal',
        adoption_support_needed: 'adoption_signal',
        capacity_growth: 'capacity_growth',
      };
      for (const s of (signals.data ?? []) as any[]) {
        items.push({
          id: s.id,
          event_kind: signalKindMap[s.signal_type] ?? s.signal_type,
          summary: s.anonymized_summary || 'A pattern is emerging across the ecosystem',
          source_module: 'NRI · Living System',
          created_at: s.created_at,
          occurred_at: s.created_at,
          signal_weight: Math.round((s.confidence_score ?? 0.5) * 5),
          tenant_id: s.signal_type ?? 'ecosystem',
          tenant_name: 'Ecosystem Signal',
        });
      }

      // Published NRI essays → reflection threads
      for (const e of (essays.data ?? []) as any[]) {
        items.push({
          id: e.id,
          event_kind: 'nri_essay_published',
          summary: e.title || 'An NRI reflection has been published',
          source_module: 'NRI · Essay',
          created_at: e.created_at,
          occurred_at: e.created_at,
          signal_weight: 4,
          tenant_id: 'nri-essays',
          tenant_name: 'NRI Narrative',
        });
      }

      // Sort by date, most recent first
      items.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
      return items.slice(0, 30);
    },
  });
}

function useLibraryDrafts() {
  return useQuery({
    queryKey: ['garden-pulse-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_content_drafts')
        .select('id, title, slug, body, status, editorial_mode, voice_origin, gravity_score, collection, created_at, published_at')
        .in('status', ['draft', 'published'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Archetype color helper ──
function archetypeColor(archetype: string | null): string {
  const map: Record<string, string> = {
    catholic_outreach: 'bg-amber-500/60',
    parish: 'bg-amber-400/50',
    digital_inclusion: 'bg-sky-500/50',
    social_enterprise: 'bg-emerald-500/50',
    workforce: 'bg-violet-500/50',
    refugee: 'bg-rose-400/50',
    education: 'bg-blue-400/50',
    library: 'bg-teal-400/50',
    housing: 'bg-orange-400/50',
  };
  return map[archetype ?? ''] ?? 'bg-primary/40';
}

// ── Layer 1: Constellation (Terrain Relief) ──

function ConstellationLayer({ nodes, silentMode, onSelectNode }: {
  nodes: PulseNode[];
  silentMode: boolean;
  onSelectNode: (node: PulseNode) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animRef = React.useRef<number>(0);
  const timeRef = React.useRef(0);
  const mouseRef = React.useRef({ x: 0, y: 0 });
  const hoveredRef = React.useRef<PulseNode | null>(null);
  const [tooltipState, setTooltipState] = React.useState<{
    visible: boolean; x: number; y: number; node: PulseNode | null;
  }>({ visible: false, x: 0, y: 0, node: null });

  // Build positioned node data from tenant_id hash
  const positionedNodes = useMemo(() => {
    return nodes.map((n) => {
      let hash = 0;
      for (let i = 0; i < n.tenant_id.length; i++) hash = ((hash << 5) - hash) + n.tenant_id.charCodeAt(i);
      const x = 0.08 + (Math.abs(hash % 840) / 1000) * 0.84;
      const y = 0.08 + (Math.abs((hash * 7) % 600) / 1000) * 0.72;
      const score = n.recent_event_count + n.recent_signal_count + n.recent_activity_count;
      return { ...n, nx: x, ny: y, score };
    });
  }, [nodes]);

  // Connections between familia groups
  const familiaConnections = useMemo(() => {
    const groups: Record<string, typeof positionedNodes> = {};
    positionedNodes.forEach(n => {
      if (n.familia_id) {
        if (!groups[n.familia_id]) groups[n.familia_id] = [];
        groups[n.familia_id].push(n);
      }
    });
    const conns: { a: typeof positionedNodes[0]; b: typeof positionedNodes[0] }[] = [];
    Object.values(groups).forEach(members => {
      for (let i = 1; i < members.length; i++) {
        conns.push({ a: members[0], b: members[i] });
      }
    });
    return conns;
  }, [positionedNodes]);

  const maxScore = useMemo(() => Math.max(1, ...positionedNodes.map(n => n.score)), [positionedNodes]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, oX = 0, oY = 0, sX = 0, sY = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      oX = 30; oY = 20; sX = W - 60; sY = H - 50;
    }

    function toScreen(nx: number, ny: number) {
      return { x: oX + nx * sX, y: oY + ny * sY };
    }

    function drawTerrainGrid() {
      const t = timeRef.current;
      ctx!.strokeStyle = 'rgba(40, 50, 80, 0.15)';
      ctx!.lineWidth = 0.5;
      const spacing = 28;
      for (let y = oY; y < oY + sY; y += spacing) {
        ctx!.beginPath();
        const waveOff = Math.sin(y * 0.01 + t * 0.3) * 3;
        for (let x = oX; x < oX + sX; x += 4) {
          let perturb = 0;
          positionedNodes.forEach(n => {
            const sp = toScreen(n.nx, n.ny);
            const dist = Math.sqrt((x - sp.x) ** 2 + (y - sp.y) ** 2);
            const intensity = n.score / maxScore;
            if (dist < 100) {
              perturb -= (1 - dist / 100) * intensity * 12 * Math.sin(t * 0.5 + n.nx * 10);
            }
          });
          if (x === oX) ctx!.moveTo(x, y + waveOff + perturb);
          else ctx!.lineTo(x, y + waveOff + perturb);
        }
        ctx!.stroke();
      }
    }

    function drawConnections() {
      const t = timeRef.current;
      familiaConnections.forEach(({ a, b }) => {
        const pa = toScreen(a.nx, a.ny), pb = toScreen(b.nx, b.ny);
        const avgScore = (a.score + b.score) / 2;
        const intensity = avgScore / maxScore;
        const pulse = (Math.sin(t * 0.8 + a.nx * 5 + b.ny * 5) + 1) / 2;
        const alpha = 0.08 + intensity * 0.15 + pulse * 0.06;

        const gradient = ctx!.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
        gradient.addColorStop(0, `rgba(212, 184, 150, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(123, 165, 196, ${alpha * 1.3})`);
        gradient.addColorStop(1, `rgba(212, 184, 150, ${alpha})`);

        ctx!.strokeStyle = gradient;
        ctx!.lineWidth = 0.8 + intensity * 1.2;
        ctx!.beginPath();
        const mx = (pa.x + pb.x) / 2 + (pa.y - pb.y) * 0.1;
        const my = (pa.y + pb.y) / 2 - (pa.x - pb.x) * 0.1;
        ctx!.moveTo(pa.x, pa.y);
        ctx!.quadraticCurveTo(mx, my, pb.x, pb.y);
        ctx!.stroke();

        // Traveling light dot
        const trav = (t * 0.15 + a.nx * 3) % 1;
        const dotX = (1-trav)*(1-trav)*pa.x + 2*(1-trav)*trav*mx + trav*trav*pb.x;
        const dotY = (1-trav)*(1-trav)*pa.y + 2*(1-trav)*trav*my + trav*trav*pb.y;
        ctx!.beginPath();
        ctx!.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(212, 184, 150, ${0.3 + pulse * 0.3})`;
        ctx!.fill();
      });
    }

    function drawNodes() {
      const t = timeRef.current;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      let hovered: PulseNode | null = null;

      positionedNodes.forEach(n => {
        const p = toScreen(n.nx, n.ny);
        const ratio = n.score / maxScore;
        const dist = Math.sqrt((mx - p.x) ** 2 + (my - p.y) ** 2);
        const hitRadius = 8 + ratio * 22;
        const isHovered = dist < hitRadius;
        if (isHovered) hovered = n;

        const breathe = Math.sin(t * 0.6 + n.nx * 8 + n.ny * 5) * 0.15 + 1;
        const baseR = 4 + ratio * 18;
        const r = baseR * breathe * (isHovered ? 1.3 : 1);

        // Ground bloom glow
        const glowR = r * 3;
        const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        glow.addColorStop(0, `rgba(212, 184, 150, ${0.12 + ratio * 0.15})`);
        glow.addColorStop(0.5, 'rgba(212, 184, 150, 0.03)');
        glow.addColorStop(1, 'rgba(212, 184, 150, 0)');
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx!.fillStyle = glow;
        ctx!.fill();

        // People ring (outer arc)
        if (ratio > 0.1) {
          const ringR = r * 1.8;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, ringR, 0, Math.PI * 2 * ratio);
          ctx!.strokeStyle = `rgba(123, 165, 196, ${0.25 + breathe * 0.1})`;
          ctx!.lineWidth = 1.5;
          ctx!.stroke();
        }

        // Core radial node
        const core = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        core.addColorStop(0, 'rgba(212, 184, 150, 0.9)');
        core.addColorStop(0.6, 'rgba(180, 150, 110, 0.4)');
        core.addColorStop(1, 'rgba(140, 110, 80, 0)');
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = core;
        ctx!.fill();

        // Bright center
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 2 + ratio * 2, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 240, 220, ${0.7 + breathe * 0.2})`;
        ctx!.fill();

        // Label
        if (!silentMode) {
          const labelAlpha = isHovered ? 0.9 : (ratio > 0.2 ? 0.45 : 0.2);
          ctx!.font = `${isHovered ? '500' : '300'} ${isHovered ? 11 : 9}px -apple-system, sans-serif`;
          ctx!.fillStyle = `rgba(200, 205, 216, ${labelAlpha})`;
          ctx!.textAlign = 'center';
          const label = n.tenant_name.length > 14 ? n.tenant_name.slice(0, 12) + '…' : n.tenant_name;
          ctx!.fillText(label, p.x, p.y + r + 14);
        }
      });

      hoveredRef.current = hovered;
    }

    function drawMountains() {
      const t = timeRef.current;
      // Three layers of mountain silhouettes, back to front
      const layers = [
        { baseY: H * 0.72, amplitude: H * 0.22, freq: 0.0018, color: 'rgba(14, 18, 32, 0.95)', drift: 0.02 },
        { baseY: H * 0.78, amplitude: H * 0.16, freq: 0.003, color: 'rgba(16, 22, 38, 0.9)', drift: -0.03 },
        { baseY: H * 0.84, amplitude: H * 0.10, freq: 0.005, color: 'rgba(20, 28, 48, 0.85)', drift: 0.04 },
      ];
      layers.forEach(layer => {
        ctx!.beginPath();
        ctx!.moveTo(0, H);
        for (let x = 0; x <= W; x += 2) {
          const n1 = Math.sin((x + t * layer.drift * 10) * layer.freq) * layer.amplitude;
          const n2 = Math.sin((x + 100) * layer.freq * 2.3 + t * 0.01) * layer.amplitude * 0.4;
          const n3 = Math.sin((x + 230) * layer.freq * 0.7) * layer.amplitude * 0.3;
          const peak = layer.baseY - Math.abs(n1 + n2 + n3);
          ctx!.lineTo(x, peak);
        }
        ctx!.lineTo(W, H);
        ctx!.closePath();
        ctx!.fillStyle = layer.color;
        ctx!.fill();
      });

      // Snow caps on the back range (lightest highlight)
      ctx!.beginPath();
      const backLayer = layers[0];
      for (let x = 0; x <= W; x += 2) {
        const n1 = Math.sin((x + t * backLayer.drift * 10) * backLayer.freq) * backLayer.amplitude;
        const n2 = Math.sin((x + 100) * backLayer.freq * 2.3 + t * 0.01) * backLayer.amplitude * 0.4;
        const n3 = Math.sin((x + 230) * backLayer.freq * 0.7) * backLayer.amplitude * 0.3;
        const peak = backLayer.baseY - Math.abs(n1 + n2 + n3);
        // Only draw snow on peaks above a threshold
        if (peak < backLayer.baseY - backLayer.amplitude * 0.55) {
          ctx!.moveTo(x, peak);
          ctx!.lineTo(x, peak + 3);
        }
      }
      ctx!.strokeStyle = 'rgba(180, 200, 220, 0.08)';
      ctx!.lineWidth = 1;
      ctx!.stroke();
    }

    function draw() {
      timeRef.current += 0.016;
      ctx!.clearRect(0, 0, W, H);

      // Background
      const bg = ctx!.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.7);
      bg.addColorStop(0, '#0e1320');
      bg.addColorStop(1, '#080b14');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      drawMountains();
      drawTerrainGrid();
      drawConnections();
      drawNodes();

      // Update tooltip state
      const h = hoveredRef.current;
      if (h) {
        setTooltipState({ visible: true, x: mouseRef.current.x, y: mouseRef.current.y, node: h });
      } else {
        setTooltipState(prev => prev.visible ? { ...prev, visible: false } : prev);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      const r = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onClick = () => {
      if (hoveredRef.current) onSelectNode(hoveredRef.current);
    };
    canvas!.addEventListener('mousemove', onMove);
    canvas!.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas!.removeEventListener('mousemove', onMove);
      canvas!.removeEventListener('click', onClick);
    };
  }, [positionedNodes, familiaConnections, maxScore, silentMode, onSelectNode]);

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <CardHeader className="pb-2 relative z-10 bg-[hsl(215,30%,12%)] border-b border-[hsl(215,20%,18%)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <CardTitle className="text-base font-serif text-amber-50">Constellation</CardTitle>
          {!silentMode && (
            <HelpTooltip
              what="Living night-sky map showing each community as a star in motion."
              where="Garden Pulse → Constellation"
              why="See relationship patterns forming as constellations of care and proximity."
            />
          )}
        </div>
        {!silentMode && (
          <p className="text-xs text-amber-200/40">The landscape breathes with the warmth of movement.</p>
        )}
      </CardHeader>
      <CardContent className="p-0 relative">
        <canvas
          ref={canvasRef}
          className="w-full block h-[520px] sm:h-[400px]"
          style={{ cursor: tooltipState.visible ? 'pointer' : 'default' }}
        />
        {/* Tooltip overlay */}
        {tooltipState.visible && tooltipState.node && (
          <div
            className="absolute pointer-events-none z-50 bg-[hsl(215,30%,8%)]/92 border border-[hsl(215,20%,22%)] backdrop-blur-xl rounded-lg px-4 py-3 min-w-[160px]"
            style={{ left: tooltipState.x + 16, top: tooltipState.y - 30 }}
          >
            <p className="font-serif text-lg text-[hsl(35,50%,70%)] mb-1">{tooltipState.node.tenant_name}</p>
            <div className="flex justify-between text-xs text-[hsl(215,20%,55%)]">
              <span>Activities</span>
              <span className="text-amber-100">{tooltipState.node.recent_activity_count}</span>
            </div>
            <div className="flex justify-between text-xs text-[hsl(215,20%,55%)]">
              <span>Events</span>
              <span className="text-amber-100">{tooltipState.node.recent_event_count}</span>
            </div>
            <div className="flex justify-between text-xs text-[hsl(215,20%,55%)]">
              <span>Signals</span>
              <span className="text-amber-100">{tooltipState.node.recent_signal_count}</span>
            </div>
          </div>
        )}
        {/* Legend */}
        {!silentMode && (
          <div className="absolute bottom-3 left-3 z-30 bg-[hsl(215,30%,12%)]/80 backdrop-blur-sm rounded-lg p-2.5 border border-[hsl(215,20%,22%)]">
            <p className="text-[10px] uppercase tracking-wider text-amber-200/40 mb-1.5">Warmth</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[hsl(35,50%,70%)] shadow-[0_0_8px_3px_hsla(35,50%,70%,0.5)]" />
                <span className="text-[10px] text-amber-100/60">Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[hsl(35,50%,60%,0.5)]" />
                <span className="text-[10px] text-amber-100/60">Steady</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400/50" />
                <span className="text-[10px] text-amber-100/60">Resting</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Layer 2: Atlas (Celestial Meridians) ──

function AtlasLayer({ nodes, silentMode }: { nodes: PulseNode[]; silentMode: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animRef = React.useRef<number>(0);
  const timeRef = React.useRef(0);
  const mouseRef = React.useRef({ x: 0, y: 0 });
  const particlesRef = React.useRef<{ x: number; y: number; color: string; speed: number; life: number; size: number; drift: number }[]>([]);
  const starsRef = React.useRef<{ x: number; y: number; s: number; b: number }[] | null>(null);
  const [tooltipState, setTooltipState] = React.useState<{
    visible: boolean; x: number; y: number; metro: { name: string; state: string | null; count: number; activity: number } | null;
  }>({ visible: false, x: 0, y: 0, metro: null });

  // Aggregate metros with normalized positions
  const metroData = useMemo(() => {
    const metroMap: Record<string, { name: string; state: string | null; count: number; activity: number }> = {};
    nodes.forEach(n => {
      if (n.metro_name) {
        const key = n.metro_name;
        if (metroMap[key]) {
          metroMap[key].count++;
          metroMap[key].activity += n.recent_activity_count;
        } else {
          metroMap[key] = { name: n.metro_name, state: n.metro_state, count: 1, activity: n.recent_activity_count };
        }
      }
    });
    const metros = Object.values(metroMap);
    const maxAct = Math.max(1, ...metros.map(m => m.activity));
    const maxCnt = Math.max(1, ...metros.map(m => m.count));

    return metros.map((m, i) => {
      // Spread metros across the projection space using name hash
      let hash = 0;
      for (let j = 0; j < m.name.length; j++) hash = ((hash << 5) - hash) + m.name.charCodeAt(j);
      const nx = 0.08 + (Math.abs(hash % 840) / 1000) * 0.84;
      const ny = 0.08 + (Math.abs((hash * 7) % 600) / 1000) * 0.84;
      return { ...m, nx, ny, actRatio: m.activity / maxAct, cntRatio: m.count / maxCnt };
    });
  }, [nodes]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, oX = 0, oY = 0, sX = 0, sY = 0;
    const PERSPECTIVE = 0.6;
    const SHEAR = 0.08;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      oX = 60; oY = 40; sX = W - 120; sY = H - 100;
      starsRef.current = null; // regenerate on resize
    }

    function project(nx: number, ny: number) {
      const px = oX + nx * sX + ny * sX * SHEAR;
      const py = oY + ny * sY * PERSPECTIVE + (1 - ny) * sY * 0.15;
      return { x: px, y: py };
    }

    function drawMeridians() {
      const t = timeRef.current;
      ctx!.lineWidth = 0.5;
      // Longitude
      for (let i = 0; i <= 10; i++) {
        const nx = i / 10;
        ctx!.beginPath();
        ctx!.strokeStyle = `rgba(25, 35, 65, ${0.2 + Math.sin(t * 0.2 + i) * 0.05})`;
        for (let j = 0; j <= 40; j++) {
          const ny = j / 40;
          const p = project(nx, ny);
          const curve = Math.sin(ny * Math.PI) * 15 * (0.5 - Math.abs(nx - 0.5));
          if (j === 0) ctx!.moveTo(p.x + curve, p.y);
          else ctx!.lineTo(p.x + curve, p.y);
        }
        ctx!.stroke();
      }
      // Latitude
      for (let j = 0; j <= 8; j++) {
        const ny = j / 8;
        ctx!.beginPath();
        ctx!.strokeStyle = `rgba(25, 35, 65, ${0.15 + Math.sin(t * 0.15 + j * 0.5) * 0.05})`;
        for (let i = 0; i <= 40; i++) {
          const nx = i / 40;
          const p = project(nx, ny);
          const curve = Math.sin(nx * Math.PI) * 8 * (0.5 - Math.abs(ny - 0.5));
          if (i === 0) ctx!.moveTo(p.x, p.y + curve);
          else ctx!.lineTo(p.x, p.y + curve);
        }
        ctx!.stroke();
      }
    }

    function drawPillars() {
      const t = timeRef.current;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      let hovered: typeof metroData[0] | null = null;

      // Sort by y for painter's algorithm
      const sorted = [...metroData].sort((a, b) => a.ny - b.ny);

      sorted.forEach(m => {
        const p = project(m.nx, m.ny);
        const pillarH = 30 + m.actRatio * 120;
        const pillarW = 2 + m.cntRatio * 6;
        const breathe = Math.sin(t * 0.5 + m.nx * 8 + m.ny * 6) * 0.06 + 1;
        const curH = pillarH * breathe;
        const isHover = Math.sqrt((mx - p.x) ** 2 + (my - p.y) ** 2) < (12 + m.cntRatio * 20);
        if (isHover) hovered = m;
        const hm = isHover ? 1.2 : 1;

        // Ground glow
        const gg = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, 20 + m.cntRatio * 30);
        gg.addColorStop(0, `rgba(212, 184, 150, ${0.08 + m.cntRatio * 0.08})`);
        gg.addColorStop(1, 'rgba(212, 184, 150, 0)');
        ctx!.beginPath();
        ctx!.ellipse(p.x, p.y, 20 + m.cntRatio * 30, 8 + m.cntRatio * 12, 0, 0, Math.PI * 2);
        ctx!.fillStyle = gg;
        ctx!.fill();

        // Light pillar
        const warmR = Math.round(160 + m.actRatio * 52);
        const warmG = Math.round(140 + m.actRatio * 44);
        const warmB = Math.round(100 + (1 - m.actRatio) * 96);
        const pg = ctx!.createLinearGradient(p.x, p.y, p.x, p.y - curH * hm);
        pg.addColorStop(0, `rgba(${warmR}, ${warmG}, ${warmB}, ${0.35 + m.cntRatio * 0.25})`);
        pg.addColorStop(0.4, `rgba(${warmR}, ${warmG}, ${warmB}, 0.12)`);
        pg.addColorStop(1, `rgba(${warmR}, ${warmG}, ${warmB}, 0)`);

        const hw = pillarW * hm;
        ctx!.beginPath();
        ctx!.moveTo(p.x - hw, p.y);
        ctx!.lineTo(p.x - hw * 0.3, p.y - curH * hm);
        ctx!.lineTo(p.x + hw * 0.3, p.y - curH * hm);
        ctx!.lineTo(p.x + hw, p.y);
        ctx!.closePath();
        ctx!.fillStyle = pg;
        ctx!.fill();

        // Core line
        ctx!.beginPath();
        ctx!.moveTo(p.x, p.y);
        ctx!.lineTo(p.x, p.y - curH * hm * 0.85);
        ctx!.strokeStyle = `rgba(${warmR}, ${warmG}, ${warmB}, ${0.15 + m.cntRatio * 0.2})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();

        // Base node
        const nr = 3 + m.cntRatio * 4;
        const ng = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, nr);
        ng.addColorStop(0, 'rgba(255, 240, 220, 0.9)');
        ng.addColorStop(1, `rgba(${warmR}, ${warmG}, ${warmB}, 0.3)`);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, nr, 0, Math.PI * 2);
        ctx!.fillStyle = ng;
        ctx!.fill();

        // Particles for active metros
        if (m.cntRatio > 0.15 && Math.random() < m.cntRatio * 0.3) {
          particlesRef.current.push({
            x: p.x + (Math.random() - 0.5) * 6,
            y: p.y - curH * 0.3,
            color: `${warmR}, ${warmG}, ${warmB}`,
            speed: 0.3 + m.actRatio * 0.8,
            life: 1, size: Math.random() * 2 + 0.5,
            drift: (Math.random() - 0.5) * 0.3,
          });
        }

        // Label
        if (!silentMode) {
          const la = isHover ? 0.9 : (m.cntRatio > 0.25 ? 0.5 : 0.2);
          ctx!.font = `${isHover ? 'bold' : 'normal'} ${isHover ? 11 : 9}px -apple-system, sans-serif`;
          ctx!.textAlign = 'center';
          ctx!.fillStyle = `rgba(200, 205, 216, ${la})`;
          const label = m.name.length > 16 ? m.name.slice(0, 14) + '…' : m.name;
          ctx!.fillText(label, p.x, p.y + 16 + m.cntRatio * 6);
        }

        if (isHover && !silentMode) {
          ctx!.font = "300 11px Georgia, serif";
          ctx!.fillStyle = 'rgba(212, 184, 150, 0.7)';
          ctx!.fillText(`${m.count} ${m.count === 1 ? 'community' : 'communities'}`, p.x, p.y - curH * hm - 8);
        }
      });

      // Update tooltip
      if (hovered) {
        setTooltipState({ visible: true, x: mx, y: my, metro: hovered });
      } else {
        setTooltipState(prev => prev.visible ? { ...prev, visible: false } : prev);
      }
    }

    function drawParticles() {
      particlesRef.current = particlesRef.current.filter(p => {
        const alpha = p.life * 0.6;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${p.color}, ${alpha})`;
        ctx!.fill();
        p.y -= p.speed;
        p.x += p.drift;
        p.life -= 0.008;
        return p.life > 0;
      });
      if (particlesRef.current.length > 300) particlesRef.current = particlesRef.current.slice(-300);
    }

    function draw() {
      timeRef.current += 0.016;
      ctx!.clearRect(0, 0, W, H);

      // Background
      const bg = ctx!.createRadialGradient(W * 0.5, H * 0.6, 0, W * 0.5, H * 0.6, W * 0.8);
      bg.addColorStop(0, '#0a0f1a');
      bg.addColorStop(1, '#050810');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      // Stars
      if (!starsRef.current) {
        starsRef.current = Array.from({ length: 80 }, () => ({
          x: Math.random() * W, y: Math.random() * H * 0.5,
          s: Math.random() * 1.2 + 0.3, b: Math.random(),
        }));
      }
      starsRef.current.forEach(star => {
        const twinkle = Math.sin(timeRef.current * 0.5 + star.b * 20) * 0.3 + 0.5;
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.s, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(180, 195, 220, ${twinkle * 0.15})`;
        ctx!.fill();
      });

      drawMeridians();
      drawPillars();
      drawParticles();

      animRef.current = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      const r = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas!.addEventListener('mousemove', onMove);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas!.removeEventListener('mousemove', onMove);
    };
  }, [metroData, silentMode]);

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <CardHeader className="pb-2 bg-[hsl(215,30%,12%)] border-b border-[hsl(215,20%,18%)]">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-teal-400" />
          <CardTitle className="text-base font-serif text-amber-50">Atlas</CardTitle>
          {!silentMode && (
            <HelpTooltip
              what="Celestial meridian map — pillars of light rise from active territories."
              where="Garden Pulse → Atlas"
              why="Notice where care is unfolding. Height encodes depth of engagement."
            />
          )}
        </div>
        {!silentMode && (
          <p className="text-xs text-amber-200/40">Pillars rise from communities. Particles ascend like quiet prayers.</p>
        )}
      </CardHeader>
      <CardContent className="p-0 relative">
        <canvas
          ref={canvasRef}
          className="w-full block h-[520px] sm:h-[420px]"
          style={{ cursor: tooltipState.visible ? 'pointer' : 'default' }}
        />
        {/* Tooltip */}
        {tooltipState.visible && tooltipState.metro && (
          <div
            className="absolute pointer-events-none z-50 bg-[hsl(215,30%,6%)]/94 border border-[hsl(215,20%,18%)] border-l-[3px] border-l-[hsl(35,50%,70%)] backdrop-blur-xl rounded px-4 py-3 min-w-[170px]"
            style={{ left: tooltipState.x + 18, top: tooltipState.y - 30 }}
          >
            <p className="font-serif text-xl text-[hsl(35,50%,70%)] mb-1">{tooltipState.metro.name}</p>
            {tooltipState.metro.state && (
              <p className="text-[10px] text-[hsl(215,20%,45%)] mb-1">{tooltipState.metro.state}</p>
            )}
            <div className="flex justify-between text-xs text-[hsl(215,20%,50%)]">
              <span>Communities</span>
              <span className="text-amber-100 font-medium">{tooltipState.metro.count}</span>
            </div>
            <div className="flex justify-between text-xs text-[hsl(215,20%,50%)]">
              <span>Recent Activity</span>
              <span className="text-amber-100 font-medium">{tooltipState.metro.activity}</span>
            </div>
            <div className="h-[3px] bg-[hsl(215,20%,18%)] rounded-full mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(35,50%,70%)] to-[hsl(200,40%,60%)]"
                style={{ width: `${Math.min(100, tooltipState.metro.activity * 8 + 15)}%` }}
              />
            </div>
          </div>
        )}
        {/* Legend */}
        {!silentMode && (
          <div className="absolute bottom-3 left-3 z-10 bg-[hsl(215,30%,12%)]/80 backdrop-blur-sm rounded-lg p-2.5 border border-[hsl(215,20%,22%)]">
            <p className="text-[10px] uppercase tracking-wider text-amber-200/40 mb-1.5">Meridian Light</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-4 rounded-full bg-[hsl(35,50%,70%,0.6)]" />
                <span className="text-[10px] text-amber-100/50">Strong</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-3 rounded-full bg-[hsl(35,50%,60%,0.35)]" />
                <span className="text-[10px] text-amber-100/50">Growing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-2 rounded-full bg-[hsl(35,50%,50%,0.2)]" />
                <span className="text-[10px] text-amber-100/50">Emerging</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Layer 3: The Loom (Living Timeline) ──

interface LoomEvent {
  id: string;
  event_kind: string;
  summary: string;
  source_module: string;
  created_at: string | null;
  occurred_at: string;
  signal_weight: number;
  tenant_id: string;
  tenant_name: string;
}

const LOOM_TYPE_COLORS: Record<string, { r: number; g: number; b: number }> = {
  noticing: { r: 123, g: 165, b: 196 },
  reflection: { r: 212, g: 184, b: 150 },
  movement: { r: 139, g: 170, b: 122 },
};

function loomRhythmType(kind: string): 'noticing' | 'reflection' | 'movement' {
  if (['nri_essay_published', 'ecosystem_reflection', 'reflection_moment'].includes(kind)) return 'reflection';
  if (['archetype_movement', 'community_growth', 'collaboration_signal', 'capacity_growth'].includes(kind)) return 'movement';
  return 'noticing';
}

function LoomTimeline({ silentMode }: { silentMode: boolean }) {
  const { data: rawEvents, isLoading } = useRecentTimeline();
  const desktopCanvasRef = useRef<HTMLCanvasElement>(null);
  const mobileCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const nodePositionsRef = useRef<{ x: number; y: number }[]>([]);
  const LANE_COUNT = 8;

  const events: (LoomEvent & { type: string; lane: number })[] = useMemo(() => {
    if (!rawEvents?.length) return [];
    return rawEvents.map((e: any, i: number) => {
      // Assign lane from tenant_id hash
      let hash = 0;
      for (let j = 0; j < e.tenant_id.length; j++) hash = ((hash << 5) - hash) + e.tenant_id.charCodeAt(j);
      return {
        ...e,
        type: loomRhythmType(e.event_kind),
        lane: Math.abs(hash) % LANE_COUNT,
      };
    });
  }, [rawEvents]);

  // Canvas rendering
  useEffect(() => {
    // Pick the visible canvas (desktop or mobile)
    const desktopCanvas = desktopCanvasRef.current;
    const mobileCanvas = mobileCanvasRef.current;
    const activeCanvas = (desktopCanvas && desktopCanvas.clientWidth > 0) ? desktopCanvas : mobileCanvas;
    if (!activeCanvas || !events.length) return;
    canvasRef.current = activeCanvas;
    const canvas = activeCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;
    let mounted = true;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      if (W === 0 || H === 0) return; // Skip if not laid out yet
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Use ResizeObserver to detect when canvas gets its layout dimensions
    const ro = new ResizeObserver(() => {
      if (canvas!.clientWidth > 0 && canvas!.clientHeight > 0) {
        resize();
      }
    });

    function draw() {
      timeRef.current += 0.012;
      const t = timeRef.current;
      ctx!.clearRect(0, 0, W, H);

      // Background — matching dark sky aesthetic
      const bg = ctx!.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, W * 0.7);
      bg.addColorStop(0, '#0c1018');
      bg.addColorStop(1, '#070910');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      const margin = 50;
      const laneWidth = (W - margin * 2) / (LANE_COUNT - 1);
      const rowHeight = Math.min(40, (H - 120) / events.length);
      const topY = 60;

      // Warp threads (vertical, faint)
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        const x = margin + lane * laneWidth;
        const wobble = Math.sin(t * 0.3 + lane * 1.5);
        ctx!.beginPath();
        for (let y = topY; y < H - 40; y += 2) {
          const wx = x + Math.sin(y * 0.008 + t * 0.2 + lane) * 8 + wobble * 3;
          if (y === topY) ctx!.moveTo(wx, y);
          else ctx!.lineTo(wx, y);
        }
        ctx!.strokeStyle = `rgba(100, 130, 200, ${0.35 + Math.sin(t * 0.2 + lane) * 0.1})`;
        ctx!.lineWidth = 1.2;
        ctx!.stroke();
      }

      // Weft threads (events weaving horizontally)
      const positions: { x: number; y: number }[] = [];
      events.forEach((ev, i) => {
        const y = topY + 20 + i * rowHeight;
        const targetX = margin + ev.lane * laneWidth;
        const c = LOOM_TYPE_COLORS[ev.type] ?? LOOM_TYPE_COLORS.noticing;
        const isActive = i === activeIndex;
        const breathe = Math.sin(t * 0.5 + i * 0.8) * 0.15 + 1;
        const baseAlpha = isActive ? 0.85 : 0.45;

        const startX = margin - 30;
        const endX = W - margin + 30;

        ctx!.beginPath();
        for (let x = startX; x <= endX; x += 3) {
          const pull = Math.exp(-((x - targetX) ** 2) / (8000 + (isActive ? 2000 : 6000)));
          const baseY = y + Math.sin(x * 0.015 + i * 2 + t * 0.3) * (3 + pull * 8);
          const weaveY = baseY - pull * (8 + (isActive ? 6 : 0));
          if (x === startX) ctx!.moveTo(x, weaveY);
          else ctx!.lineTo(x, weaveY);
        }

        const grad = ctx!.createLinearGradient(startX, 0, endX, 0);
        grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
        grad.addColorStop(0.15, `rgba(${c.r}, ${c.g}, ${c.b}, ${baseAlpha * 0.5})`);
        grad.addColorStop(0.4, `rgba(${c.r}, ${c.g}, ${c.b}, ${baseAlpha})`);
        grad.addColorStop(0.6, `rgba(${c.r}, ${c.g}, ${c.b}, ${baseAlpha})`);
        grad.addColorStop(0.85, `rgba(${c.r}, ${c.g}, ${c.b}, ${baseAlpha * 0.5})`);
        grad.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);

        ctx!.strokeStyle = grad;
        ctx!.lineWidth = isActive ? 3 : 1.5;
        ctx!.stroke();

        // Node at lane intersection
        const nodeY = y + Math.sin(targetX * 0.015 + i * 2 + t * 0.3) * 3 - 8;
        positions.push({ x: targetX, y: nodeY });

        if (isActive) {
          const glow = ctx!.createRadialGradient(targetX, nodeY, 0, targetX, nodeY, 25 * breathe);
          glow.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0.2)`);
          glow.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
          ctx!.beginPath();
          ctx!.arc(targetX, nodeY, 25 * breathe, 0, Math.PI * 2);
          ctx!.fillStyle = glow;
          ctx!.fill();
        }

        ctx!.beginPath();
        const nodeR = isActive ? 5 : 3;
        ctx!.arc(targetX, nodeY, nodeR, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${isActive ? 1 : 0.6})`;
        ctx!.fill();

        // Actor label on active
        if (isActive && !silentMode) {
          ctx!.font = "normal 11px Georgia, 'Times New Roman', serif";
          ctx!.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.7)`;
          ctx!.textAlign = 'center';
          const actorLabel = ev.tenant_name.length > 20 ? ev.tenant_name.slice(0, 18) + '…' : ev.tenant_name;
          ctx!.fillText(actorLabel, targetX, nodeY - 14);

          ctx!.font = "normal 9px -apple-system, sans-serif";
          ctx!.fillStyle = 'rgba(160, 170, 200, 0.4)';
          ctx!.fillText(format(new Date(ev.occurred_at), 'h:mm a'), targetX, nodeY + 18);
        }
      });

      // Date markers on left
      events.forEach((ev, i) => {
        const dateStr = format(new Date(ev.occurred_at), 'yyyy-MM-dd');
        const prevDateStr = i > 0 ? format(new Date(events[i - 1].occurred_at), 'yyyy-MM-dd') : '';
        if (i === 0 || dateStr !== prevDateStr) {
          const y = topY + 20 + i * rowHeight;
          ctx!.font = "normal 9px -apple-system, sans-serif";
          ctx!.fillStyle = 'rgba(50, 60, 90, 0.5)';
          ctx!.textAlign = 'right';
          ctx!.fillText(format(new Date(ev.occurred_at), 'MMM d'), margin - 16, y + 3);
        }
      });
      nodePositionsRef.current = positions;

      animRef.current = requestAnimationFrame(draw);
    }

    ro.observe(canvas);
    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      mounted = false;
      ro.disconnect();
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [events, activeIndex, silentMode]);

  // Scroll active card into view
  useEffect(() => {
    const el = cardRefs.current[activeIndex];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  if (isLoading) return <Skeleton className="h-[500px]" />;

  if (!events.length) {
    return (
      <Card className="border-0 shadow-lg bg-[hsl(215,30%,8%)]">
        <CardContent className="py-16 text-center">
          <p className="text-sm font-serif italic text-[hsl(215,20%,50%)]">
            The loom is still. Threads will appear as communities move.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group events by date for the detail panel
  const groupedByDate: { date: string; label: string; events: typeof events }[] = [];
  let currentDate = '';
  events.forEach((ev) => {
    const dateStr = format(new Date(ev.occurred_at), 'yyyy-MM-dd');
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groupedByDate.push({
        date: dateStr,
        label: format(new Date(ev.occurred_at), 'EEE, MMM d'),
        events: [],
      });
    }
    groupedByDate[groupedByDate.length - 1].events.push(ev);
  });

  const typeLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

  const typeDotColor = (t: string) => {
    if (t === 'noticing') return 'bg-[hsl(207,35%,63%)]';
    if (t === 'reflection') return 'bg-[hsl(30,40%,71%)]';
    return 'bg-[hsl(100,25%,57%)]';
  };

  const activeBarColor = (t: string) => {
    if (t === 'noticing') return 'border-l-[hsl(207,35%,63%)]';
    if (t === 'reflection') return 'border-l-[hsl(30,40%,71%)]';
    return 'border-l-[hsl(100,25%,57%)]';
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    if (!canvas || !events.length || !nodePositionsRef.current.length) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let closestIdx = 0;
    let closestDist = Infinity;
    nodePositionsRef.current.forEach((pos, i) => {
      const dist = Math.sqrt((clickX - pos.x) ** 2 + (clickY - pos.y) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });
    if (closestDist < 40) {
      setActiveIndex(closestIdx);
    }
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden bg-[hsl(215,30%,6%)]">
      {/* Desktop: side-by-side canvas + detail panel */}
      <div className="hidden md:flex" style={{ height: 520 }}>
        {/* Canvas panel */}
        <div className="flex-1 relative min-w-0">
          <canvas ref={desktopCanvasRef} className="w-full h-full block cursor-pointer" onClick={handleCanvasClick} />
          {!silentMode && (
            <div className="absolute bottom-4 left-5 z-10">
              <p className="text-[10px] uppercase tracking-[2px] text-[hsl(215,20%,45%)]">
                The Loom
              </p>
              <p className="text-[11px] italic text-[hsl(215,20%,50%)] mt-1 max-w-[380px] leading-relaxed font-serif">
                Each narrative thread is woven from aggregated signals. Where patterns cross, meaning forms.
              </p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="w-[340px] flex-shrink-0 border-l border-[hsl(215,30%,12%)] flex flex-col bg-[hsl(215,40%,5%)]">
          <div className="px-6 py-5 border-b border-[hsl(215,30%,12%)]">
            <p className="font-serif text-[13px] uppercase tracking-[3px] text-[hsl(215,20%,55%)]">
              The Gardener · Observatory
            </p>
            <p className="font-serif text-2xl tracking-wide text-[hsl(30,40%,71%)] mt-0.5">
              Timeline
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="py-2">
              {groupedByDate.map((group) => (
                <React.Fragment key={group.date}>
                  <div className="px-6 pt-3 pb-1.5 font-serif text-[10px] uppercase tracking-[2px] text-[hsl(215,20%,45%)]">
                    {group.label}
                  </div>
                  {group.events.map((ev) => {
                    const globalIdx = events.indexOf(ev);
                    const isActive = globalIdx === activeIndex;
                    return (
                      <div
                        key={ev.id}
                        ref={(el) => { cardRefs.current[globalIdx] = el; }}
                        className={`px-6 py-4 border-b border-[hsl(215,30%,10%)] cursor-pointer transition-colors relative
                          ${isActive ? `bg-[hsl(215,30%,10%)] border-l-2 ${activeBarColor(ev.type)}` : 'hover:bg-[hsl(215,30%,8%)] border-l-2 border-l-transparent'}`}
                        onClick={() => setActiveIndex(globalIdx)}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${typeDotColor(ev.type)}`} />
                          <span className="text-[10px] uppercase tracking-wider text-[hsl(215,20%,50%)]">
                            {format(new Date(ev.occurred_at), 'h:mm a')} · {typeLabel(ev.type)}
                          </span>
                        </div>
                        <p className="font-serif text-[13px] text-[hsl(30,25%,65%)] mb-1">
                          {ev.tenant_name}
                        </p>
                        {!silentMode && (
                          <p className="text-[13px] leading-relaxed text-[hsl(215,15%,68%)]">
                            {ev.summary || ev.event_kind.replace(/_/g, ' ')}
                          </p>
                        )}
                        <p className="text-[10px] text-[hsl(215,20%,50%)] mt-1.5">
                          {ev.source_module}
                        </p>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Mobile: canvas with clickable dots + single active card below */}
      <div className="md:hidden flex flex-col">
        {/* Active reflection card — most recent first, shown at top */}
        {events[activeIndex] && (
          <div className={`px-5 py-4 border-b border-[hsl(215,30%,10%)] border-l-2 ${activeBarColor(events[activeIndex].type)}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${typeDotColor(events[activeIndex].type)}`} />
                <span className="text-[10px] uppercase tracking-wider text-[hsl(215,20%,55%)]">
                  {format(new Date(events[activeIndex].occurred_at), 'h:mm a')} · {typeLabel(events[activeIndex].type)}
                </span>
              </div>
              <span className="text-[10px] text-[hsl(215,20%,45%)]">
                {activeIndex + 1} / {events.length}
              </span>
            </div>
            <p className="font-serif text-sm text-[hsl(30,25%,70%)] mb-1">
              {events[activeIndex].tenant_name}
            </p>
            {!silentMode && (
              <p className="text-sm leading-relaxed text-[hsl(215,15%,72%)]">
                {events[activeIndex].summary || events[activeIndex].event_kind.replace(/_/g, ' ')}
              </p>
            )}
            <p className="text-[10px] text-[hsl(215,20%,50%)] mt-1.5">
              {events[activeIndex].source_module} · {format(new Date(events[activeIndex].occurred_at), 'EEE, MMM d')}
            </p>
          </div>
        )}

        {/* Canvas with loom visualization — tap dots to change reflection */}
        <div className="relative" style={{ height: 320 }}>
          <canvas
            ref={mobileCanvasRef}
            className="w-full h-full block cursor-pointer"
            onClick={handleCanvasClick}
          />
          {!silentMode && (
            <div className="absolute bottom-3 left-4 z-10">
              <p className="text-[10px] uppercase tracking-[2px] text-[hsl(215,20%,45%)]">
                The Loom
              </p>
              <p className="text-[10px] italic text-[hsl(215,20%,50%)] mt-0.5 font-serif">
                Tap a dot to read its thread.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Layer 4: Seasonal Rhythm ──

function SeasonalRhythm({ silentMode }: { silentMode: boolean }) {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed

  const seasons = [
    { key: 'advent', label: 'Advent', months: [11, 0], color: 'bg-violet-400/50', secular: 'Year End Reflection' },
    { key: 'christmas', label: 'Christmas', months: [0], color: 'bg-amber-300/50', secular: 'New Beginnings' },
    { key: 'lent', label: 'Lent', months: [1, 2, 3], color: 'bg-purple-400/40', secular: 'Spring Preparation' },
    { key: 'easter', label: 'Easter', months: [3, 4], color: 'bg-yellow-300/50', secular: 'Spring Renewal' },
    { key: 'pentecost', label: 'Pentecost', months: [5], color: 'bg-red-400/40', secular: 'Early Summer Energy' },
    { key: 'ordinary', label: 'Ordinary Time', months: [6, 7, 8, 9, 10], color: 'bg-emerald-400/30', secular: 'Sustained Growth' },
  ];

  const currentSeason = seasons.find(s => s.months.includes(month)) ?? seasons[5];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <CardTitle className="text-base font-serif">Seasonal Rhythm</CardTitle>
          {!silentMode && (
            <HelpTooltip
              what="The rhythm of the year — revealing cadence of mission, not performance."
              where="Garden Pulse → Seasonal Rhythm"
              why="Mission has seasons. Recognizing rhythm prevents burnout and brings intentionality."
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5 mb-4">
          {seasons.map(s => (
            <div
              key={s.key}
              className={`flex-1 h-3 rounded-full ${s.color} ${s.key === currentSeason.key ? 'ring-2 ring-primary/50 ring-offset-1' : 'opacity-40'} transition-all`}
              title={s.label}
            />
          ))}
        </div>
        {!silentMode && (
          <div className="text-center space-y-1">
            <p className="text-sm font-serif font-medium text-foreground">
              {currentSeason.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentSeason.secular} · {format(now, 'MMMM yyyy')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Layer 5: The Scriptorium ──

type ScriptoriumStatus = 'complete' | 'forming' | 'emerging';

function deriveStatus(d: any): ScriptoriumStatus {
  if (d.status === 'published') return 'complete';
  if (d.body && d.body.length > 400) return 'forming';
  return 'emerging';
}

const STATUS_META: Record<ScriptoriumStatus, { label: string; dotClass: string; textClass: string }> = {
  complete: { label: 'Complete', dotClass: 'bg-[hsl(100,30%,50%)] shadow-[0_0_4px_hsla(100,30%,50%,0.3)]', textClass: 'text-[hsl(100,25%,55%)]' },
  forming: { label: 'Still Forming', dotClass: 'bg-[hsl(35,50%,62%)] shadow-[0_0_4px_hsla(35,50%,62%,0.3)] animate-pulse', textClass: 'text-[hsl(35,45%,55%)]' },
  emerging: { label: 'Emerging', dotClass: 'bg-[hsl(230,15%,50%)] shadow-[0_0_4px_hsla(230,15%,50%,0.3)]', textClass: 'text-[hsl(230,15%,55%)]' },
};

function ScriptoriumPanel({ silentMode }: { silentMode: boolean }) {
  const { data: drafts, isLoading } = useLibraryDrafts();
  const [currentIndex, setCurrentIndex] = useState(0);

  const items = useMemo(() => {
    return (drafts ?? []).map((d: any) => ({
      ...d,
      derivedStatus: deriveStatus(d),
    }));
  }, [drafts]);

  // Clamp index
  const safeIndex = Math.min(currentIndex, Math.max(0, items.length - 1));
  const activeItem = items[safeIndex] ?? null;
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < items.length - 1;

  if (isLoading) return <Skeleton className="h-[520px]" />;

  if (!items.length) {
    return (
      <Card className="border-0 shadow-lg bg-[hsl(215,30%,6%)]">
        <CardContent className="py-16 text-center">
          <Leaf className="w-5 h-5 text-primary/40 mx-auto mb-3" />
          <p className="text-sm font-serif italic text-[hsl(215,20%,55%)]">
            The scriptorium is quiet. Essays will emerge from reflections and lived work.
          </p>
        </CardContent>
      </Card>
    );
  }

  const st = activeItem ? STATUS_META[activeItem.derivedStatus as ScriptoriumStatus] : STATUS_META.emerging;
  const bodyHtml = activeItem?.body || '';
  const plainBody = bodyHtml.replace(/<[^>]*>/g, '');
  const isForming = activeItem?.derivedStatus !== 'complete';

  return (
    <Card className="border-0 shadow-lg overflow-hidden bg-[hsl(215,30%,6%)]">
      {/* Header + navigation */}
      <div className="px-5 sm:px-8 py-5 border-b border-[hsl(215,30%,10%)] bg-[hsl(215,40%,5%)]/90">
        <p className="font-serif text-[11px] sm:text-[13px] uppercase tracking-[3px] text-[hsl(215,20%,55%)]">
          The Gardener · Observatory
        </p>
        <p className="font-serif text-xl sm:text-2xl tracking-wide text-[hsl(30,40%,71%)] mt-0.5">
          Scriptorium
        </p>
        {!silentMode && (
          <p className="text-[11px] italic text-[hsl(215,20%,60%)] mt-2 leading-relaxed">
            Essays and reflections emerging from lived work.
          </p>
        )}
        {/* Pagination controls */}
        <div className="flex items-center gap-3 mt-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[hsl(215,20%,60%)] hover:text-[hsl(30,40%,71%)] disabled:opacity-20"
            disabled={!hasPrev}
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            aria-label="Previous essay"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </Button>
          <span className="text-[11px] text-[hsl(215,20%,55%)] tabular-nums">
            {safeIndex + 1} of {items.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[hsl(215,20%,60%)] hover:text-[hsl(30,40%,71%)] disabled:opacity-20"
            disabled={!hasNext}
            onClick={() => setCurrentIndex(i => Math.min(items.length - 1, i + 1))}
            aria-label="Next essay"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Reading pane */}
      <ScrollArea className="h-[55vh] min-h-[340px] max-h-[600px]">
        {activeItem ? (
          <div className="max-w-[660px] mx-auto px-5 sm:px-10 py-8 sm:py-12">
            {/* Status */}
            <div className="flex items-center gap-2 mb-5">
              <div className={`w-[7px] h-[7px] rounded-full ${st.dotClass}`} />
              <span className={`text-[10px] uppercase tracking-[1.5px] ${st.textClass}`}>
                {st.label}
              </span>
            </div>

            {/* Title */}
            <h2 className="font-serif text-xl sm:text-[28px] font-normal text-[hsl(30,40%,71%)] leading-[1.35] mb-2 tracking-wide">
              {activeItem.title}
            </h2>

            {/* Byline */}
            {activeItem.voice_origin === 'nri' && (
              <p className="text-xs italic text-[hsl(215,15%,55%)] mb-1.5">
                Synthesized by <span className="text-[hsl(215,15%,65%)] not-italic">NRI</span>
              </p>
            )}

            {/* Meta */}
            <div className="text-[10px] text-[hsl(215,15%,55%)] tracking-wide mb-8 pb-5 border-b border-[hsl(215,30%,14%)]">
              <span className="text-[hsl(215,15%,60%)]">{activeItem.collection || 'Reflections'}</span>
              {' · '}{format(new Date(activeItem.created_at), 'MMMM d, yyyy')}
              {activeItem.gravity_score > 0 && (
                <> · <span className="text-[hsl(215,15%,60%)]">Gravity: {activeItem.gravity_score}</span></>
              )}
            </div>

            {/* Body */}
            <div className="relative">
              <div
                className="font-serif text-base leading-[1.85] text-[hsl(215,15%,75%)]
                  [&_p]:mb-5 [&_p]:indent-6 [&_p:first-child]:indent-0
                  [&_p:first-child]:first-letter:text-[52px] [&_p:first-child]:first-letter:float-left
                  [&_p:first-child]:first-letter:leading-[0.8] [&_p:first-child]:first-letter:mr-2.5
                  [&_p:first-child]:first-letter:mt-1 [&_p:first-child]:first-letter:text-[hsl(30,40%,71%)]
                  [&_p:first-child]:first-letter:opacity-70
                  [&_em]:text-[hsl(30,30%,68%)] [&_em]:italic
                  [&_blockquote]:my-6 [&_blockquote]:px-6 [&_blockquote]:py-4
                  [&_blockquote]:border-l-2 [&_blockquote]:border-[hsl(215,20%,20%)]
                  [&_blockquote]:italic [&_blockquote]:text-[hsl(215,15%,65%)] [&_blockquote]:text-[15px]"
                dangerouslySetInnerHTML={{
                  __html: plainBody
                    ? `<p>${plainBody.split('\n\n').filter(Boolean).join('</p><p>')}</p>`
                    : '<p>This reflection is still gathering its words…</p>',
                }}
              />
              {isForming && (
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[hsl(215,30%,6%)] to-transparent pointer-events-none" />
              )}
            </div>

            {/* Footer */}
            <div className="mt-10 pt-5 border-t border-[hsl(215,30%,14%)] text-[10px] text-[hsl(215,15%,50%)] tracking-wide leading-relaxed">
              <span className="text-[hsl(215,15%,58%)]">Generated by NRI</span> · CROS™ Observatory · Scriptorium<br />
              This reflection was synthesized from aggregated signals. Individual content is never displayed.
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border border-[hsl(215,20%,18%)] text-[9px] tracking-wider text-[hsl(215,15%,55%)]">
                <div className="w-1 h-1 rounded-full bg-[hsl(30,40%,62%)] opacity-50" />
                NRI REFLECTION
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full py-20">
            <p className="font-serif italic text-[hsl(215,20%,55%)]">No essay selected</p>
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}

// ── Node Detail Panel ──

function NodeDetailPanel({ node, open, onClose }: {
  node: PulseNode | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!node) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[340px]">
        <SheetHeader>
          <SheetTitle className="font-serif">{node.tenant_name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            {node.archetype && (
              <Badge variant="outline" className="text-xs">
                {node.archetype.replace(/_/g, ' ')}
              </Badge>
            )}
            {node.metro_name && (
              <p className="text-sm text-muted-foreground">
                {node.metro_name}{node.metro_state ? `, ${node.metro_state}` : ''}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recent Movement (30 days)</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-lg font-semibold">{node.recent_event_count}</p>
                <p className="text-[10px] text-muted-foreground">Signals</p>
              </div>
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-lg font-semibold">{node.recent_activity_count}</p>
                <p className="text-[10px] text-muted-foreground">Activities</p>
              </div>
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-lg font-semibold">{node.recent_signal_count}</p>
                <p className="text-[10px] text-muted-foreground">Living Signals</p>
              </div>
            </div>
          </div>
          {node.familia_id && (
            <div className="p-3 rounded-md border border-border/30 bg-muted/10">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs text-muted-foreground">Part of a Familia</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ──

export default function GardenPulsePage() {
  const [silentMode, setSilentMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<PulseNode | null>(null);
  const [activeTab, setActiveTab] = useState('constellation');
  const [showProvidence, setShowProvidence] = useState(false);
  const [showCompass, setShowCompass] = useState(() => {
    try { return localStorage.getItem('garden-compass') === 'true'; } catch { return false; }
  });

  const { data: nodes = [], isLoading } = useEcosystemPulse();
  const { data: restorationSignals = [] } = useRestorationSignals({ limit: 20 });
  const restorationNarrative = aggregateRestorationNarrative(restorationSignals);
  const { data: providenceSignals = [] } = useProvidenceSignals(showProvidence);

  // Compass weights — derived from existing timeline signals (pure computation, no API)
  const { data: timelineEvents } = useRecentTimeline();
  const compassWeights: CompassWeight = useMemo(
    () => buildCompassWeights((timelineEvents ?? []).map((e: any) => e.event_kind)),
    [timelineEvents],
  );

  const toggleCompass = (val: boolean) => {
    setShowCompass(val);
    try { localStorage.setItem('garden-compass', String(val)); } catch {}
  };

  return (
    <TooltipProvider>
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            🌿 Garden Pulse
          </h1>
          {!silentMode && (
            <p className="text-sm text-muted-foreground mt-1">
              This is not a map of organizations. It is a map of movement.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Providence toggle */}
          <div className="flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-amber-500/70" />
            <Switch
              checked={showProvidence}
              onCheckedChange={setShowProvidence}
              aria-label="Show narrative threads"
            />
            {!silentMode && (
              <span className="text-[10px] text-muted-foreground">Threads</span>
            )}
          </div>
          {/* Compass toggle */}
          <div className="flex items-center gap-1.5">
            <CompassIcon className="w-3.5 h-3.5 text-primary/60" />
            <Switch
              checked={showCompass}
              onCheckedChange={toggleCompass}
              aria-label="Show compass overlay"
            />
            {!silentMode && (
              <span className="text-[10px] text-muted-foreground">Compass</span>
            )}
          </div>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {silentMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </span>
            <Switch
              checked={silentMode}
              onCheckedChange={setSilentMode}
              aria-label="Silent Mode"
            />
            {!silentMode && (
              <span className="text-[10px] text-muted-foreground">Silent</span>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full overflow-x-auto justify-start sm:justify-center">
            <TabsTrigger value="constellation" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> {!silentMode && 'Constellation'}
            </TabsTrigger>
            <TabsTrigger value="atlas" className="gap-1.5">
              <Map className="w-3.5 h-3.5" /> {!silentMode && 'Atlas'}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {!silentMode && 'The Loom'}
            </TabsTrigger>
            <TabsTrigger value="scriptorium" className="gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> {!silentMode && 'Scriptorium'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="constellation">
            <div className="relative">
              <NarrativeErrorBoundary layerName="Compass">
                {showCompass && <GardenerCompassOverlay weights={compassWeights} silentMode={silentMode} />}
              </NarrativeErrorBoundary>
              <ConstellationLayer nodes={nodes} silentMode={silentMode} onSelectNode={setSelectedNode} />
            </div>
          </TabsContent>
          <TabsContent value="atlas">
            <div className="relative">
              <NarrativeErrorBoundary layerName="Compass">
                {showCompass && <GardenerCompassOverlay weights={compassWeights} silentMode={silentMode} />}
              </NarrativeErrorBoundary>
              <AtlasLayer nodes={nodes} silentMode={silentMode} />
            </div>
          </TabsContent>
          <TabsContent value="timeline">
            <LoomTimeline silentMode={silentMode} />
          </TabsContent>
          <TabsContent value="scriptorium">
            <ScriptoriumPanel silentMode={silentMode} />
          </TabsContent>
        </Tabs>
      )}

      {/* Restoration Threads — soft gold narrative layer */}
      <NarrativeErrorBoundary layerName="Restoration">
        {restorationNarrative.total > 0 && !silentMode && (
          <Card className="border-amber-200/40 bg-amber-50/10 dark:bg-amber-900/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-500/70" />
                <p className="text-sm font-serif text-muted-foreground italic">
                  {restorationNarrative.narrativePhrase}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 ml-6">
                Moments of restoration — care remembered.
              </p>
            </CardContent>
          </Card>
        )}
      </NarrativeErrorBoundary>

      {/* Providence Threads — Gardener-only narrative overlay */}
      <NarrativeErrorBoundary layerName="Providence">
        {showProvidence && providenceSignals.length > 0 && !silentMode && (
          <Card className="border-amber-200/40 bg-amber-50/10 dark:bg-amber-900/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-amber-500/70" />
                <CardTitle className="text-base font-serif">A thread has formed</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {providenceSignals.slice(0, 5).map(ps => (
                <Tooltip key={ps.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 py-1.5 cursor-default">
                      <div className="h-px flex-1 bg-amber-300/30" />
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300/50 text-amber-700/70">
                        {getThreadLabel(ps.thread_type)}
                      </Badge>
                      <div className="h-px flex-1 bg-amber-300/30" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px]">
                    <p className="text-xs font-serif italic">{ps.narrative_phrase || getThreadNarrative(ps.thread_type)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Moments of restoration — care remembered.</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </CardContent>
          </Card>
        )}

        {showProvidence && providenceSignals.length === 0 && !silentMode && (
          <Card className="border-amber-200/20 bg-amber-50/5">
            <CardContent className="py-4 text-center">
              <p className="text-sm font-serif italic text-muted-foreground">
                No threads visible yet. Providence reveals itself over time.
              </p>
            </CardContent>
          </Card>
        )}
      </NarrativeErrorBoundary>

      <NodeDetailPanel
        node={selectedNode}
        open={!!selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
    </TooltipProvider>
  );
}
