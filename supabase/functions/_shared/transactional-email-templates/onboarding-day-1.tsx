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
    <EmailLayout preview="Day one — a small, quiet invitation.">
      <Heading style={styles.heading}>
        {name ? `A gentle first step, ${name}.` : 'A gentle first step.'}
      </Heading>
      <Text style={styles.body}>
        Yesterday you opened a door. Today, if you have a few minutes, try
        adding one person you are already walking with — a companion, a
        neighbor, someone whose name is already on your heart.
      </Text>
      <Text style={styles.body}>
        You don't need to add many. One relationship, tended well, teaches the
        system how you care.
      </Text>
      <Link href={`${url}/people`} style={styles.cta}>
        Add your first person
      </Link>
      <Text style={styles.quote}>
        "The heart of the matter is the matter of the heart." — Dallas Willard
      </Text>
      <Text style={styles.soft}>
        Nothing you write is used for advertising, ranked, or shown to anyone
        outside your community. Reflections remain sacred.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: 'Your first day with CROS',
  displayName: 'Onboarding — Day 1',
  previewData: { name: 'Friend', appUrl: 'https://thecros.app' },
} satisfies TemplateEntry
