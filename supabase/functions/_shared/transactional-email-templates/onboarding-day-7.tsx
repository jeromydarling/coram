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
    <EmailLayout preview="One week in — what's quietly begun to bloom.">
      <Heading style={styles.heading}>One week in.</Heading>
      <Text style={styles.body}>
        {name ? `${name}, thank you ` : 'Thank you '}
        for the first week. Whether you added many people or only one — whether
        you wrote reflections or simply looked — the garden has changed because
        you were here.
      </Text>
      <Text style={styles.body}>Three quiet doors, if you'd like to open one:</Text>
      <Text style={styles.body}>
        <strong>· Signum.</strong> A daily prompt of what may deserve attention
        today — never urgent, always human.<br />
        <Link href={`${url}/command-center`} style={{ color: '#476b57' }}>
          Visit your Command Center
        </Link>
      </Text>
      <Text style={styles.body}>
        <strong>· Local Pulse.</strong> Community events and moments already
        happening near your work.<br />
        <Link href={`${url}/find-events`} style={{ color: '#476b57' }}>
          See what's near you
        </Link>
      </Text>
      <Text style={styles.body}>
        <strong>· Testimonium.</strong> The stories your relationships are
        already telling — gathered gently.<br />
        <Link href={`${url}/narratives`} style={{ color: '#476b57' }}>
          Read your narrative
        </Link>
      </Text>
      <Text style={styles.quote}>
        "Attention is the rarest and purest form of generosity." — Simone Weil
      </Text>
      <Text style={styles.soft}>
        From here, we'll only email you when there's something worth your
        attention — no drip, no pressure.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: 'One week with CROS — what may be blooming',
  displayName: 'Onboarding — Day 7',
  previewData: { name: 'Friend', appUrl: 'https://thecros.app' },
} satisfies TemplateEntry
