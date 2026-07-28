import { describe, it, expect } from "vitest";
import edgesWorkflow from "../../public/n8n-workflows/emit-relationship-edges-patch.json";
import cronWorkflow from "../../public/n8n-workflows/cron-daily-intelligence-feed.json";

interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: number[];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
}

interface N8nWorkflow {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }>;
  settings: Record<string, unknown>;
  active: boolean;
}

function validateWorkflow(wf: N8nWorkflow) {
  const nodeNames = new Set(wf.nodes.map(n => n.name));
  const nodeIds = new Set(wf.nodes.map(n => n.id));

  // All node names are unique
  expect(nodeNames.size).toBe(wf.nodes.length);
  // All node IDs are unique
  expect(nodeIds.size).toBe(wf.nodes.length);

  // Every connection target references a real node
  for (const [source, conn] of Object.entries(wf.connections)) {
    expect(nodeNames.has(source)).toBe(true);
    for (const outputs of conn.main) {
      for (const target of outputs) {
        expect(nodeNames.has(target.node)).toBe(true);
      }
    }
  }

  // Every node except the trigger should be a connection target
  const targets = new Set<string>();
  for (const conn of Object.values(wf.connections)) {
    for (const outputs of conn.main) {
      for (const t of outputs) targets.add(t.node);
    }
  }
  const triggerNodes = wf.nodes.filter(n => n.type.includes("webhook") || n.type.includes("scheduleTrigger"));
  const nonTriggerNodes = wf.nodes.filter(n => !n.type.includes("webhook") && !n.type.includes("scheduleTrigger"));
  for (const node of nonTriggerNodes) {
    expect(targets.has(node.name)).toBe(true);
  }

  // Every non-trigger node should be reachable from the trigger
  const reachable = new Set<string>();
  const queue = triggerNodes.map(n => n.name);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const conn = wf.connections[current];
    if (conn) {
      for (const outputs of conn.main) {
        for (const t of outputs) queue.push(t.node);
      }
    }
  }
  for (const node of wf.nodes) {
    expect(reachable.has(node.name)).toBe(true);
  }

  return true;
}

describe("Emit Relationship Edges Workflow", () => {
  const wf = edgesWorkflow as unknown as N8nWorkflow;

  it("has valid structure", () => {
    expect(wf.name).toBeTruthy();
    expect(wf.nodes.length).toBeGreaterThanOrEqual(3);
    expect(wf.settings.executionOrder).toBe("v1");
  });

  it("all nodes are connected end-to-end", () => {
    expect(validateWorkflow(wf)).toBe(true);
  });

  it("uses correct credential ID", () => {
    const httpNodes = wf.nodes.filter(n => n.credentials?.httpHeaderAuth);
    expect(httpNodes.length).toBeGreaterThanOrEqual(1);
    for (const node of httpNodes) {
      expect(node.credentials!.httpHeaderAuth.id).toBe("JZ0bvsdogmHU6USf");
    }
  });

  it("has continueOnFail on external HTTP nodes", () => {
    const httpNodes = wf.nodes.filter(n => n.type === "n8n-nodes-base.httpRequest");
    for (const node of httpNodes) {
      expect(node.continueOnFail).toBe(true);
    }
  });

  it("targets correct edge function URL", () => {
    const postNode = wf.nodes.find(n => n.name === "POST Edges to Supabase");
    expect(postNode).toBeTruthy();
    expect(String(postNode!.parameters.url)).toContain("upsert-relationship-edges");
  });

  it("has webhook trigger", () => {
    const trigger = wf.nodes.find(n => n.type.includes("webhook"));
    expect(trigger).toBeTruthy();
  });
});

describe("Cron Daily Intelligence Feed Workflow", () => {
  const wf = cronWorkflow as unknown as N8nWorkflow;

  it("has valid structure", () => {
    expect(wf.name).toBeTruthy();
    expect(wf.nodes.length).toBeGreaterThanOrEqual(3);
    expect(wf.settings.executionOrder).toBe("v1");
  });

  it("all nodes are connected end-to-end", () => {
    expect(validateWorkflow(wf)).toBe(true);
  });

  it("uses correct credential ID on all HTTP nodes", () => {
    const httpNodes = wf.nodes.filter(n => n.credentials?.httpHeaderAuth);
    expect(httpNodes.length).toBeGreaterThanOrEqual(2);
    for (const node of httpNodes) {
      expect(node.credentials!.httpHeaderAuth.id).toBe("JZ0bvsdogmHU6USf");
    }
  });

  it("has continueOnFail on external HTTP nodes", () => {
    const httpNodes = wf.nodes.filter(n => n.type === "n8n-nodes-base.httpRequest");
    for (const node of httpNodes) {
      expect(node.continueOnFail).toBe(true);
    }
  });

  it("calls both edge functions in sequence", () => {
    const feedNode = wf.nodes.find(n => n.name === "Generate Intelligence Feed");
    const priorityNode = wf.nodes.find(n => n.name === "Recalculate Prospect Priority");
    expect(feedNode).toBeTruthy();
    expect(priorityNode).toBeTruthy();
    expect(String(feedNode!.parameters.url)).toContain("generate-daily-intelligence-feed");
    expect(String(priorityNode!.parameters.url)).toContain("recalculate-prospect-priority");
  });

  it("has schedule trigger (not webhook)", () => {
    const trigger = wf.nodes.find(n => n.type.includes("scheduleTrigger"));
    expect(trigger).toBeTruthy();
  });

  it("feed runs before priority scoring", () => {
    const feedConn = wf.connections["Generate Intelligence Feed"];
    expect(feedConn).toBeTruthy();
    const targets = feedConn.main[0].map(t => t.node);
    expect(targets).toContain("Recalculate Prospect Priority");
  });
});
