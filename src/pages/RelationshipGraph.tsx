import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useMetros } from '@/hooks/useMetros';
import { useTranslation } from 'react-i18next';

interface GraphNode {
  id: string;
  label: string;
  type: 'opportunity' | 'contact' | 'grant' | 'event';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

const NODE_COLORS: Record<GraphNode['type'], string> = {
  opportunity: 'hsl(var(--primary))',
  contact: 'hsl(142 71% 45%)',
  grant: 'hsl(45 93% 47%)',
  event: 'hsl(262 83% 58%)',
};

const NODE_RADIUS: Record<GraphNode['type'], number> = {
  opportunity: 18,
  contact: 12,
  grant: 14,
  event: 14,
};

function useGraphData(metroId: string | null) {
  return useQuery({
    queryKey: ['relationship-graph', metroId],
    queryFn: async () => {
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const seen = new Set<string>();

      // Fetch opportunities (limit 50 for performance)
      const oppQuery = supabase.from('opportunities').select('id, organization, metro_id').limit(50);
      if (metroId) oppQuery.eq('metro_id', metroId);
      const { data: opps } = await oppQuery;

      const oppIds = new Set<string>();
      for (const o of opps || []) {
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        oppIds.add(o.id);
        nodes.push({ id: o.id, label: o.organization || 'Unknown', type: 'opportunity', x: 0, y: 0, vx: 0, vy: 0 });
      }

      if (oppIds.size === 0) return { nodes, edges };

      // Fetch contacts linked to these opportunities
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, opportunity_id')
        .in('opportunity_id', Array.from(oppIds))
        .limit(100);

      for (const c of contacts || []) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          nodes.push({ id: c.id, label: c.name, type: 'contact', x: 0, y: 0, vx: 0, vy: 0 });
        }
        if (c.opportunity_id) {
          edges.push({ source: c.opportunity_id, target: c.id, label: 'contact' });
        }
      }

      // Fetch grant alignments
      const { data: alignments } = await supabase
        .from('grant_alignment')
        .select('id, org_id, grant_id, score')
        .in('org_id', Array.from(oppIds))
        .limit(50);

      const grantIds = new Set<string>();
      for (const a of alignments || []) {
        grantIds.add(a.grant_id);
        edges.push({ source: a.org_id, target: a.grant_id, label: `fit:${a.score}%` });
      }

      if (grantIds.size > 0) {
        const { data: grants } = await supabase
          .from('grants')
          .select('id, grant_name')
          .in('id', Array.from(grantIds));

        for (const g of grants || []) {
          if (!seen.has(g.id)) {
            seen.add(g.id);
            nodes.push({ id: g.id, label: g.grant_name || 'Grant', type: 'grant', x: 0, y: 0, vx: 0, vy: 0 });
          }
        }
      }

      // Fetch events linked via contacts
      const eventContactIds = (contacts || []).filter(c => c.id).map(c => c.id);
      if (eventContactIds.length > 0) {
        const { data: eventContacts } = await supabase
          .from('contacts')
          .select('id, met_at_event_id')
          .in('id', eventContactIds)
          .not('met_at_event_id', 'is', null)
          .limit(30);

        const eventIds = new Set<string>();
        for (const ec of eventContacts || []) {
          if (ec.met_at_event_id) {
            eventIds.add(ec.met_at_event_id);
            edges.push({ source: ec.id, target: ec.met_at_event_id, label: 'met at' });
          }
        }

        if (eventIds.size > 0) {
          const { data: events } = await supabase
            .from('events')
            .select('id, event_name')
            .in('id', Array.from(eventIds));

          for (const e of events || []) {
            if (!seen.has(e.id)) {
              seen.add(e.id);
              nodes.push({ id: e.id, label: e.event_name || 'Event', type: 'event', x: 0, y: 0, vx: 0, vy: 0 });
            }
          }
        }
      }

      return { nodes, edges };
    },
  });
}

// Simple force simulation
function useForceLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const frameRef = useRef<number>(0);
  const iterRef = useRef(0);

  useEffect(() => {
    if (nodes.length === 0) return;

    // Initialize positions in a circle
    const state = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const r = Math.min(width, height) * 0.3;
      return {
        ...n,
        x: width / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: height / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
      };
    });

    const nodeMap = new Map(state.map(n => [n.id, n]));
    iterRef.current = 0;

    function tick() {
      const alpha = Math.max(0.001, 0.3 * Math.pow(0.99, iterRef.current));
      iterRef.current++;

      // Repulsion
      for (let i = 0; i < state.length; i++) {
        for (let j = i + 1; j < state.length; j++) {
          const dx = state[j].x - state[i].x;
          const dy = state[j].y - state[i].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = (800 / (dist * dist)) * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          state[i].vx -= fx;
          state[i].vy -= fy;
          state[j].vx += fx;
          state[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (dist - 120) * 0.01 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      // Center gravity
      for (const n of state) {
        n.vx += (width / 2 - n.x) * 0.001 * alpha;
        n.vy += (height / 2 - n.y) * 0.001 * alpha;
      }

      // Apply velocities with damping
      for (const n of state) {
        n.vx *= 0.6;
        n.vy *= 0.6;
        n.x += n.vx;
        n.y += n.vy;
        // Clamp to bounds
        n.x = Math.max(30, Math.min(width - 30, n.x));
        n.y = Math.max(30, Math.min(height - 30, n.y));
      }

      const map = new Map(state.map(n => [n.id, { x: n.x, y: n.y }]));
      setPositions(map);

      if (iterRef.current < 200) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [nodes, edges, width, height]);

  return positions;
}

export default function RelationshipGraph() {
  const { t } = useTranslation('relationships');
  const navigate = useNavigate();
  const { data: metros } = useMetros();
  const [metroFilter, setMetroFilter] = useState<string>('all');
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const metroId = metroFilter === 'all' ? null : metroFilter;
  const { data: graphData, isLoading } = useGraphData(metroId);

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  const WIDTH = 900;
  const HEIGHT = 600;

  const positions = useForceLayout(nodes, edges, WIDTH, HEIGHT);

  const handleNodeClick = useCallback((node: GraphNode) => {
    switch (node.type) {
      case 'opportunity':
        navigate(`/opportunities/${node.id}`);
        break;
      case 'contact':
        navigate(`/people/${node.id}`);
        break;
      case 'grant':
        navigate(`/grants/${node.id}`);
        break;
      case 'event':
        navigate(`/events/${node.id}`);
        break;
    }
  }, [navigate]);

  const resetZoom = () => setZoom(1);

  const nodeTypeLabels: Record<GraphNode['type'], string> = {
    opportunity: t('graph.nodeTypes.org'),
    contact: t('graph.nodeTypes.contact'),
    grant: t('graph.nodeTypes.grant'),
    event: t('graph.nodeTypes.event'),
  };

  return (
    <MainLayout title={t('graph.title')} subtitle={t('graph.subtitle')} helpKey="page.relationship-graph" data-testid="graph-root">
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={metroFilter} onValueChange={setMetroFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('graph.allMetros')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('graph.allMetros')}</SelectItem>
              {metros?.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.metro}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(2, z + 0.2))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetZoom}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {(['opportunity', 'contact', 'grant', 'event'] as const).map(type => (
              <div key={type} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[type] }} />
                <span className="text-muted-foreground capitalize">{nodeTypeLabels[type]}</span>
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {t('graph.loading')}
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                {t('graph.noData')}
              </div>
            ) : (
              <div className="overflow-auto">
                <svg
                  width={WIDTH}
                  height={HEIGHT}
                  viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                  className="w-full h-auto min-h-[400px]"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                >
                  {/* Edges */}
                  {edges.map((edge, i) => {
                    const s = positions.get(edge.source);
                    const t = positions.get(edge.target);
                    if (!s || !t) return null;
                    const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
                    return (
                      <line
                        key={i}
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={isHighlighted ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                        strokeWidth={isHighlighted ? 2 : 1}
                        opacity={isHighlighted ? 0.8 : 0.4}
                      />
                    );
                  })}

                  {/* Nodes */}
                  {nodes.map(node => {
                    const pos = positions.get(node.id);
                    if (!pos) return null;
                    const r = NODE_RADIUS[node.type];
                    const isHovered = hoveredNode === node.id;
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onClick={() => handleNodeClick(node)}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          r={isHovered ? r + 3 : r}
                          fill={NODE_COLORS[node.type]}
                          opacity={0.85}
                          stroke={isHovered ? 'hsl(var(--foreground))' : 'none'}
                          strokeWidth={2}
                        />
                        <text
                          y={r + 14}
                          textAnchor="middle"
                          className="text-[10px] fill-muted-foreground pointer-events-none select-none"
                          style={{ fontSize: '10px' }}
                        >
                          {node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground">
          {t('graph.summary', { nodes: nodes.length, edges: edges.length })}
        </div>
      </div>
    </MainLayout>
  );
}
