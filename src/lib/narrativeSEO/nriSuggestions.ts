/**
 * nriSuggestions — NRI-driven SEO guidance for the Gardener review queue.
 *
 * WHAT: Generates internal linking suggestions, keyword cluster ideas, and essay topic
 *       recommendations based on content patterns and visitor behavior signals.
 * WHERE: Surfaced in Gardener Analytics and Editorial Studio as gentle suggestions.
 * WHY: NRI observes patterns and offers — never publishes automatically.
 */

import { CONTENT_GRAPH, type ContentNode } from '@/lib/contentGraph';

export interface LinkingSuggestion {
  fromPath: string;
  toPath: string;
  toTitle: string;
  reason: string;
}

export interface TopicSuggestion {
  topic: string;
  reason: string;
  archetype?: string;
}

/**
 * Suggests internal links for an essay based on body content keywords.
 * Scans the content graph for relevant connections.
 */
export function suggestInternalLinks(
  essaySlug: string,
  bodyText: string,
  maxSuggestions = 4
): LinkingSuggestion[] {
  const suggestions: LinkingSuggestion[] = [];
  const lowerBody = bodyText.toLowerCase();
  const essayPath = `/essays/${essaySlug}`;

  for (const node of Object.values(CONTENT_GRAPH)) {
    if (node.path === essayPath) continue;

    // Check if the essay body mentions concepts related to this node
    const titleWords = node.title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matched = titleWords.some(word => lowerBody.includes(word));

    if (matched) {
      suggestions.push({
        fromPath: essayPath,
        toPath: node.path,
        toTitle: node.title,
        reason: `This essay mentions themes related to "${node.title}".`,
      });
    }

    if (suggestions.length >= maxSuggestions) break;
  }

  return suggestions;
}

/**
 * Suggests essay topics based on gaps in the content graph.
 * NRI notices what has not been written about yet.
 */
export function suggestEssayTopics(
  existingSlugs: string[],
  archetypeKey?: string
): TopicSuggestion[] {
  const topics: TopicSuggestion[] = [];

  // Suggest archetype-specific content if no essays exist for it
  const archetypeNodes = Object.values(CONTENT_GRAPH).filter(
    n => n.category === 'archetype' || (n.archetypes && archetypeKey && n.archetypes.includes(archetypeKey))
  );

  if (archetypeNodes.length > 0 && existingSlugs.length < 3) {
    topics.push({
      topic: 'A reflection on how your archetype shapes daily community work',
      reason: 'NRI noticed few essays connect directly to your mission archetype.',
      archetype: archetypeKey,
    });
  }

  // Suggest role-based reflections
  const roleCategories = Object.values(CONTENT_GRAPH).filter(n => n.category === 'role');
  const mentionedRoles = roleCategories.filter(
    n => existingSlugs.some(s => s.includes(n.path.replace('/path/', '')))
  );

  if (mentionedRoles.length < roleCategories.length) {
    topics.push({
      topic: 'A field note from a role not yet explored in the library',
      reason: 'Some mission roles have not appeared in published reflections yet.',
    });
  }

  return topics.slice(0, 3);
}
