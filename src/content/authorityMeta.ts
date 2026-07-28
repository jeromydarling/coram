/**
 * authorityMeta — Shared metadata, images, and mappings for Authority Hub.
 *
 * WHAT: Category images, route mappings, and labels used across authority pages.
 * WHERE: Authority landing, category pages, and article pages.
 * WHY: Single source of truth for authority visual identity and routing.
 */
import type { AuthoritySection } from './authority';

import weeksImg from '@/assets/authority/authority-weeks.jpg';
import adoptionImg from '@/assets/authority/authority-adoption.jpg';
import storiesImg from '@/assets/authority/authority-stories.jpg';
import leadershipImg from '@/assets/authority/authority-leadership.jpg';
import dispatchesImg from '@/assets/authority/authority-dispatches.jpg';

export const CATEGORY_IMAGES: Record<AuthoritySection['category'], string> = {
  week: weeksImg,
  adoption: adoptionImg,
  story: storiesImg,
  leadership: leadershipImg,
  field_dispatch: dispatchesImg,
};

export const CATEGORY_ROUTE_MAP: Record<AuthoritySection['category'], string> = {
  week: 'weeks',
  adoption: 'adoption',
  story: 'stories',
  leadership: 'leadership',
  field_dispatch: 'field-dispatches',
};
