import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  personName?: string
  metroName?: string
  communioUrl?: string
}

const Email = ({ personName, metroName, communioUrl }: Props) => (
  <EmailLayout preview={`Someone new began a garden near ${metroName ?? 'you'}`}>
    <Heading style={styles.heading}>A new neighbor.</Heading>
    <Text style={styles.body}>
      {personName ?? 'Someone'} began a garden in {metroName ?? 'your metro'}.
      Communio noticed a possible resonance with your work.
    </Text>
    <Text style={styles.quote}>
      Networks of care are quiet until they aren't.
    </Text>
    {communioUrl && <Link href={communioUrl} style={styles.cta}>See Communio</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `A new neighbor in ${d.metroName ?? 'your metro'}`,
  displayName: 'New person in metro',
  previewData: { personName: 'A steward', metroName: 'Minneapolis', communioUrl: 'https://thecros.app' },
} satisfies TemplateEntry
