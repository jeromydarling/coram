import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles, brand } from './_shared.tsx'

interface Prompt { text: string; url?: string }
interface Props {
  name?: string
  prompts?: Prompt[]
  appUrl?: string
}

const Email = ({ name, prompts = [], appUrl }: Props) => (
  <EmailLayout preview="Your gentle attention prompts for the week">
    <Heading style={styles.heading}>Good morning{name ? `, ${name}` : ''}.</Heading>
    <Text style={styles.body}>
      A few quiet prompts noticed for this week. Take one, or none.
    </Text>
    {prompts.map((p, i) => (
      <Text key={i} style={{ ...styles.body, borderLeft: `2px solid ${brand.sage}`, paddingLeft: '12px' }}>
        {p.url ? <Link href={p.url} style={{ color: brand.ink }}>{p.text}</Link> : p.text}
      </Text>
    ))}
    {prompts.length === 0 && (
      <Text style={styles.soft}>A still week. That's a gift too.</Text>
    )}
    {appUrl && <Link href={appUrl} style={styles.cta}>Open your garden</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'Your week — a gentle Signum brief',
  displayName: 'Weekly Signum brief',
  previewData: {
    name: 'Friend',
    prompts: [
      { text: 'Two households you haven\'t noted in a while.' },
      { text: 'A local pulse worth attending.' },
    ],
    appUrl: 'https://thecros.app',
  },
} satisfies TemplateEntry
