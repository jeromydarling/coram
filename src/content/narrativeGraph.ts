/**
 * narrativeGraph — Structured semantic knowledge graph for CROS™ narrative pages.
 *
 * WHAT: Defines typed relationships between archetypes, roles, signals, and concepts.
 * WHERE: Used by NarrativeGraphLinks component and Nexus health panel.
 * WHY: Creates an interconnected knowledge ontology for SEO authority and narrative discovery.
 */

export interface GraphNode {
  slug: string;
  label: string;
  path: string;
  type: 'archetype' | 'role' | 'concept' | 'signal';
}

export interface ArchetypeGraphEntry {
  connectsToRoles: string[];
  connectsToSignals: string[];
  connectsToConcepts: string[];
}

export interface RoleGraphEntry {
  connectsToConcepts: string[];
  connectsToArchetypes: string[];
}

export interface ConceptGraphEntry {
  label: string;
  path: string;
  description: string;
  connectsToRoles: string[];
  connectsToArchetypes: string[];
}

/** Archetype → Role / Signal / Concept connections */
export const ARCHETYPE_GRAPH: Record<string, ArchetypeGraphEntry> = {
  church: {
    connectsToRoles: ['shepherd', 'companion', 'visitor'],
    connectsToSignals: ['presence', 'reconnection', 'momentum'],
    connectsToConcepts: ['nri', 'testimonium', 'impulsus', 'communio'],
  },
  digital_inclusion: {
    connectsToRoles: ['shepherd', 'companion', 'steward'],
    connectsToSignals: ['access', 'momentum', 'engagement'],
    connectsToConcepts: ['nri', 'signum', 'provisio'],
  },
  social_enterprise: {
    connectsToRoles: ['shepherd', 'companion', 'steward'],
    connectsToSignals: ['partnership', 'momentum', 'impact'],
    connectsToConcepts: ['nri', 'testimonium', 'relatio'],
  },
  workforce: {
    connectsToRoles: ['shepherd', 'companion', 'visitor'],
    connectsToSignals: ['placement', 'retention', 'momentum'],
    connectsToConcepts: ['nri', 'signum', 'voluntarium'],
  },
  refugee_support: {
    connectsToRoles: ['shepherd', 'companion', 'visitor'],
    connectsToSignals: ['care', 'visit_activity', 'integration'],
    connectsToConcepts: ['nri', 'communio', 'impulsus'],
  },
  education_access: {
    connectsToRoles: ['shepherd', 'companion', 'steward'],
    connectsToSignals: ['enrollment', 'progress', 'graduation'],
    connectsToConcepts: ['nri', 'testimonium', 'provisio'],
  },
  library_system: {
    connectsToRoles: ['shepherd', 'companion', 'steward'],
    connectsToSignals: ['engagement', 'community', 'access'],
    connectsToConcepts: ['nri', 'signum', 'voluntarium'],
  },
};

/** Role → Concept / Archetype connections */
export const ROLE_GRAPH: Record<string, RoleGraphEntry> = {
  shepherd: {
    connectsToConcepts: ['nri', 'testimonium', 'impulsus', 'signum'],
    connectsToArchetypes: ['church', 'digital_inclusion', 'social_enterprise', 'workforce'],
  },
  companion: {
    connectsToConcepts: ['provisio', 'voluntarium', 'communio'],
    connectsToArchetypes: ['church', 'refugee_support', 'workforce'],
  },
  visitor: {
    connectsToConcepts: ['impulsus', 'communio'],
    connectsToArchetypes: ['church', 'refugee_support', 'workforce'],
  },
  steward: {
    connectsToConcepts: ['signum', 'relatio', 'provisio', 'testimonium'],
    connectsToArchetypes: ['digital_inclusion', 'social_enterprise', 'education_access'],
  },
};

/** Concept nodes — the philosophical/feature layer */
export const CONCEPT_GRAPH: Record<string, ConceptGraphEntry> = {
  nri: {
    label: 'NRI™',
    path: '/nri',
    description: 'Narrative Relational Intelligence — human-first awareness.',
    connectsToRoles: ['shepherd', 'companion', 'visitor', 'steward'],
    connectsToArchetypes: ['church', 'digital_inclusion', 'social_enterprise', 'workforce', 'refugee_support'],
  },
  testimonium: {
    label: 'Testimonium',
    path: '/testimonium-feature',
    description: 'Narrative storytelling and insight layer.',
    connectsToRoles: ['shepherd', 'steward'],
    connectsToArchetypes: ['church', 'social_enterprise', 'education_access'],
  },
  impulsus: {
    label: 'Impulsus',
    path: '/impulsus',
    description: 'Private impact scrapbook journal.',
    connectsToRoles: ['shepherd', 'visitor'],
    connectsToArchetypes: ['church', 'refugee_support'],
  },
  signum: {
    label: 'Signum',
    path: '/signum',
    description: 'Signals and discovery intelligence.',
    connectsToRoles: ['shepherd', 'steward'],
    connectsToArchetypes: ['digital_inclusion', 'library_system', 'workforce'],
  },
  communio: {
    label: 'Communio',
    path: '/communio-feature',
    description: 'Cross-organization narrative sharing.',
    connectsToRoles: ['companion', 'visitor'],
    connectsToArchetypes: ['church', 'refugee_support'],
  },
  provisio: {
    label: 'Prōvīsiō',
    path: '/provisio',
    description: 'Technology provisions for communities.',
    connectsToRoles: ['companion', 'steward'],
    connectsToArchetypes: ['digital_inclusion', 'education_access'],
  },
  voluntarium: {
    label: 'Voluntārium',
    path: '/voluntarium',
    description: 'Volunteer coordination and presence.',
    connectsToRoles: ['companion'],
    connectsToArchetypes: ['workforce', 'library_system'],
  },
  relatio: {
    label: 'Relatio',
    path: '/relatio-campaigns',
    description: 'Integration and migration bridges.',
    connectsToRoles: ['steward'],
    connectsToArchetypes: ['social_enterprise'],
  },
};

/* ── Helpers ─────────────────────────────────── */

const ROLE_PATHS: Record<string, string> = {
  shepherd: '/roles/shepherd',
  companion: '/roles/companion',
  visitor: '/roles/visitor',
  steward: '/roles/steward',
};

const ROLE_LABELS: Record<string, string> = {
  shepherd: 'Shepherd',
  companion: 'Companion',
  visitor: 'Visitor',
  steward: 'Steward',
};

const ARCHETYPE_LABELS: Record<string, string> = {
  church: 'Church / Faith Community',
  digital_inclusion: 'Digital Inclusion',
  social_enterprise: 'Social Enterprise',
  workforce: 'Workforce Development',
  refugee_support: 'Refugee Support',
  education_access: 'Education Access',
  library_system: 'Library System',
};

/** Get related GraphNodes for an archetype slug. */
export function getArchetypeRelatedNodes(archKey: string): GraphNode[] {
  const entry = ARCHETYPE_GRAPH[archKey];
  if (!entry) return [];

  const nodes: GraphNode[] = [];

  for (const role of entry.connectsToRoles) {
    if (ROLE_PATHS[role]) {
      nodes.push({ slug: role, label: ROLE_LABELS[role] || role, path: ROLE_PATHS[role], type: 'role' });
    }
  }

  for (const concept of entry.connectsToConcepts) {
    const c = CONCEPT_GRAPH[concept];
    if (c) {
      nodes.push({ slug: concept, label: c.label, path: c.path, type: 'concept' });
    }
  }

  return nodes;
}

/** Get related GraphNodes for a role slug. */
export function getRoleRelatedNodes(roleKey: string): GraphNode[] {
  const entry = ROLE_GRAPH[roleKey];
  if (!entry) return [];

  const nodes: GraphNode[] = [];

  for (const concept of entry.connectsToConcepts) {
    const c = CONCEPT_GRAPH[concept];
    if (c) {
      nodes.push({ slug: concept, label: c.label, path: c.path, type: 'concept' });
    }
  }

  for (const arch of entry.connectsToArchetypes.slice(0, 3)) {
    nodes.push({
      slug: arch,
      label: ARCHETYPE_LABELS[arch] || arch,
      path: `/archetypes/${arch}/deep`,
      type: 'archetype',
    });
  }

  return nodes;
}

/** Get related GraphNodes for a concept slug. */
export function getConceptRelatedNodes(conceptKey: string): GraphNode[] {
  const entry = CONCEPT_GRAPH[conceptKey];
  if (!entry) return [];

  const nodes: GraphNode[] = [];

  for (const role of entry.connectsToRoles.slice(0, 3)) {
    if (ROLE_PATHS[role]) {
      nodes.push({ slug: role, label: ROLE_LABELS[role] || role, path: ROLE_PATHS[role], type: 'role' });
    }
  }

  for (const arch of entry.connectsToArchetypes.slice(0, 2)) {
    nodes.push({
      slug: arch,
      label: ARCHETYPE_LABELS[arch] || arch,
      path: `/archetypes/${arch}/deep`,
      type: 'archetype',
    });
  }

  return nodes;
}

/** Count total nodes, edges, and orphans for health monitoring. */
export function getGraphHealth() {
  const allArchetypes = Object.keys(ARCHETYPE_GRAPH);
  const allRoles = Object.keys(ROLE_GRAPH);
  const allConcepts = Object.keys(CONCEPT_GRAPH);

  const totalNodes = allArchetypes.length + allRoles.length + allConcepts.length;

  let totalEdges = 0;
  for (const e of Object.values(ARCHETYPE_GRAPH)) {
    totalEdges += e.connectsToRoles.length + e.connectsToSignals.length + e.connectsToConcepts.length;
  }
  for (const e of Object.values(ROLE_GRAPH)) {
    totalEdges += e.connectsToConcepts.length + e.connectsToArchetypes.length;
  }
  for (const e of Object.values(CONCEPT_GRAPH)) {
    totalEdges += e.connectsToRoles.length + e.connectsToArchetypes.length;
  }

  // Orphan = concept with no role or archetype connections
  const orphanConcepts = allConcepts.filter((k) => {
    const c = CONCEPT_GRAPH[k];
    return c.connectsToRoles.length === 0 && c.connectsToArchetypes.length === 0;
  });

  return { totalNodes, totalEdges, orphanCount: orphanConcepts.length, orphanConcepts };
}

/** Build DefinedTerm JSON-LD for a concept. */
export function definedTermSchema(conceptKey: string) {
  const c = CONCEPT_GRAPH[conceptKey];
  if (!c) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: c.label,
    description: c.description,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'CROS™ Concepts',
    },
  };
}
