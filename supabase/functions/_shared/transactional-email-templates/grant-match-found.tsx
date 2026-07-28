import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  grantName?: string
  funder?: string
  alignment?: string
  deadline?: string
  grantUrl?: string
}

const Email = ({ grantName, funder, alignment, deadline, grantUrl }: Props) => (
  <EmailLayout preview={`A possible grant match — ${grantName ?? 'discovered'}`}>
    <Heading style={styles.heading}>A grant that seems aligned.</Heading>
    <Text style={styles.body}>
      <strong>{grantName ?? 'A grant'}</strong>
      {funder ? <> from {funder}</> : null} appears to align with your mission.
    </Text>
    {alignment && <Text style={styles.quote}>{alignment}</Text>}
    {deadline && <Text style={styles.soft}>Deadline: {deadline}</Text>}
    {grantUrl && <Link href={grantUrl} style={styles.cta}>Review it</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `Grant match — ${d.grantName ?? 'a possible fit'}`,
  displayName: 'Grant match found',
  previewData: { grantName: 'Neighborhood Trust Fund', funder: 'City Foundation', alignment: 'Aligns with your workforce inclusion narrative.', deadline: 'Aug 15, 2026', grantUrl: 'https://thecros.app' },
} satisfies TemplateEntry
