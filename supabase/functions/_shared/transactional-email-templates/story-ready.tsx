import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  storyTitle?: string
  summary?: string
  storyUrl?: string
}

const Email = ({ storyTitle, summary, storyUrl }: Props) => (
  <EmailLayout preview={`Testimonium — ${storyTitle ?? 'a story is ready'}`}>
    <Heading style={styles.heading}>{storyTitle ?? 'A story is ready.'}</Heading>
    <Text style={styles.body}>
      Testimonium has gathered enough threads to synthesize a narrative worth
      reading. No urgency — read it when you can be still with it.
    </Text>
    {summary && <Text style={styles.quote}>{summary}</Text>}
    {storyUrl && <Link href={storyUrl} style={styles.cta}>Read the story</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `Testimonium — ${d.storyTitle ?? 'a story is ready'}`,
  displayName: 'Story ready',
  previewData: { storyTitle: 'The year of quiet returns', summary: 'A pattern of small reconciliations across your metro.', storyUrl: 'https://thecros.app' },
} satisfies TemplateEntry
