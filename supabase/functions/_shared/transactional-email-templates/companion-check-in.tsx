import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  companionName?: string
  weeksSince?: number
  companionUrl?: string
}

const Email = ({ companionName, weeksSince, companionUrl }: Props) => (
  <EmailLayout preview={`${companionName ?? 'A companion'} hasn't opened their garden lately`}>
    <Heading style={styles.heading}>A companion may need attention.</Heading>
    <Text style={styles.body}>
      {companionName ?? 'A companion you support'} hasn't opened their garden
      in about {weeksSince ?? 3} weeks. A brief check-in may be a kindness.
    </Text>
    <Text style={styles.quote}>
      Presence is often the most useful thing.
    </Text>
    {companionUrl && <Link href={companionUrl} style={styles.cta}>Open their profile</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `${d.companionName ?? 'A companion'} — a gentle check-in`,
  displayName: 'Companion check-in',
  previewData: { companionName: 'Sr. Ruth', weeksSince: 3, companionUrl: 'https://thecros.app' },
} satisfies TemplateEntry
