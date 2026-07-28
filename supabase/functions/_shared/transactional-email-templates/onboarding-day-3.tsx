import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  name?: string
  appUrl?: string
}

const Email = ({ name, appUrl }: Props) => {
  const url = appUrl || 'https://thecros.app'
  return (
    <EmailLayout preview="Day three — noticing what's already there.">
      <Heading style={styles.heading}>Three days in.</Heading>
      <Text style={styles.body}>
        {name ? `${name}, most ` : 'Most '}people who begin a CROS garden are
        surprised by how much they already remember — the small conversations,
        the unfinished threads, the names that keep coming back.
      </Text>
      <Text style={styles.body}>
        Today, try writing one <strong>reflection</strong>. It can be two
        sentences. It might simply be: <em>"I thought of them again today."</em>
      </Text>
      <Link href={`${url}/opportunities`} style={styles.cta}>
        Open a journey
      </Link>
      <Text style={styles.body}>
        Reflections are the heart of CROS. They aren't performance — they are
        memory made visible, so the next moment of care is a little easier.
      </Text>
      <Text style={styles.soft}>
        Prefer to just observe for now? That's welcome, too. The garden waits.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: 'Three days in — a small invitation',
  displayName: 'Onboarding — Day 3',
  previewData: { name: 'Friend', appUrl: 'https://thecros.app' },
} satisfies TemplateEntry
