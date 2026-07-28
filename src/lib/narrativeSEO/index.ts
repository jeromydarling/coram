/**
 * narrativeSEO — Public barrel export for the Narrative SEO Engine.
 *
 * WHAT: Re-exports all narrative SEO utilities from a single import path.
 * WHERE: Import from '@/lib/narrativeSEO' across marketing pages and operator surfaces.
 * WHY: Clean, discoverable API surface for the SEO engine layer.
 */

export { generateNarrativeSEO, type NarrativeSEOInput, type NarrativeSEOOutput } from './narrativeSEO';
export { generateSemanticKeywords, type KeywordContext } from './semanticKeywords';
export { generateAltText, generateAltTextFromNarrative, type AltTextContext } from './altText';
export { generateEmailPreview, type EmailPreviewInput, type EmailPreviewOutput } from './emailPreview';
export { suggestInternalLinks, suggestEssayTopics, type LinkingSuggestion, type TopicSuggestion } from './nriSuggestions';
