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
    <EmailLayout preview="Welcome to CROS — your garden is quietly ready.">
      <Heading style={styles.heading}>
        {name ? `Welcome, ${name}.` : 'Welcome.'}
      </Heading>
      <Text style={styles.body}>
        Your CROS garden is quietly ready. There's no rush to fill it — this is
        a place for memory, discernment, and care, not for metrics.
      </Text>
      <Text style={styles.quote}>
        Begin where you are. One relationship, one reflection at a time.
      </Text>
      <Text style={styles.body}>
        Over the next week, you'll receive three short notes from us — on days
        one, three, and seven — offering gentle invitations. Nothing more.
      </Text>
      <Link href={url} style={styles.cta}>Step into the garden</Link>
      <Text style={styles.soft}>
        If this email found you by mistake, you can safely ignore it.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: 'Welcome to CROS',
  displayName: 'Welcome',
  previewData: { name: 'Friend', appUrl: 'https://thecros.app' },
} satisfies TemplateEntry
