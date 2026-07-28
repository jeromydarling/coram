import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  personName?: string
  daysSince?: number
  personUrl?: string
}

const Email = ({ personName, daysSince, personUrl }: Props) => (
  <EmailLayout preview={`A gentle nudge to reflect on ${personName ?? 'someone you walk with'}`}>
    <Heading style={styles.heading}>A quiet nudge.</Heading>
    <Text style={styles.body}>
      It's been {daysSince ?? 'a while'} days since you last reflected on{' '}
      {personName ?? 'someone you have been walking with'}. No pressure — only an
      invitation to notice.
    </Text>
    <Text style={styles.quote}>
      Reflection is how memory becomes discernment.
    </Text>
    {personUrl && <Link href={personUrl} style={styles.cta}>Add a reflection</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `A gentle nudge — reflect on ${d.personName ?? 'someone'}`,
  displayName: 'Reflection nudge',
  previewData: { personName: 'James', daysSince: 14, personUrl: 'https://thecros.app' },
} satisfies TemplateEntry
