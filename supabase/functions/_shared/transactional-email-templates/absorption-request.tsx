import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  companionName?: string
  agencyName?: string
  reviewUrl?: string
}

const Email = ({ companionName, agencyName, reviewUrl }: Props) => (
  <EmailLayout preview={`${companionName ?? 'A companion'} would like to fold their garden into ${agencyName ?? 'your tenant'}`}>
    <Heading style={styles.heading}>An absorption request.</Heading>
    <Text style={styles.body}>
      {companionName ?? 'A companion'} has asked to fold their garden into{' '}
      <strong>{agencyName ?? 'your tenant'}</strong>. Their data would join
      yours under your stewardship, with an audit trail.
    </Text>
    <Text style={styles.quote}>
      Absorption is an act of trust. Review it carefully; approve when ready.
    </Text>
    {reviewUrl && <Link href={reviewUrl} style={styles.cta}>Review the request</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `${d.companionName ?? 'A companion'} — absorption request`,
  displayName: 'Absorption request',
  previewData: { companionName: 'Sr. Grace', agencyName: 'St. Brigid Agency', reviewUrl: 'https://thecros.app' },
} satisfies TemplateEntry
