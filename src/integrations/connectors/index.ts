export { salesforceAdapter } from './salesforceAdapter';
export { civicrmAdapter } from './civicrmAdapter';
export { airtableAdapter } from './airtableAdapter';
export { fluentcrmAdapter } from './fluentcrmAdapter';
export { jetpackcrmAdapter } from './jetpackcrmAdapter';
export { wperpAdapter } from './wperpAdapter';
export { dynamics365Adapter } from './dynamics365Adapter';
export { STUB_ADAPTERS } from './stubAdapters';

// Outbound (bi-directional sync) adapters
export { dynamics365Outbound } from './dynamics365Outbound';
export { salesforceOutbound } from './salesforceOutbound';
export { blackbaudOutbound } from './blackbaudOutbound';
export { hubspotOutbound } from './hubspotOutbound';

// Types — inbound
export type {
  ConnectorAdapter,
  NormalizedAccount,
  NormalizedContact,
  NormalizedTask,
  NormalizedEvent,
  NormalizedActivity,
  NormalizedGiving,
  MappingWarning,
} from './types';
export { normalizeDate, safeSnippet, normalizeState } from './types';

// Giving adapters (platform-specific normalizeGiving implementations)
export { bloomerangGivingAdapter } from './givingAdapters';
export { neonCrmGivingAdapter } from './givingAdapters';
export { donorPerfectGivingAdapter } from './givingAdapters';
export { lglGivingAdapter } from './givingAdapters';
// CiviCRM giving is built into civicrmAdapter directly (normalizeGiving method)

// Types — outbound (bi-directional)
export type {
  OutboundAdapter,
  OutboundPayload,
  FieldDiff,
  SyncDirection,
  OutboundEntity,
} from './outboundTypes';
