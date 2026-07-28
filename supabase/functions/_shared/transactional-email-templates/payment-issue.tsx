import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  planName?: string
  reason?: string
  billingUrl?: string
}

const Email = ({ planName, reason, billingUrl }: Props) => (
  <EmailLayout preview="A gentle note about a payment that didn't go through">
    <Heading style={styles.heading}>A payment needs attention.</Heading>
    <Text style={styles.body}>
      Your last payment for <strong>{planName ?? 'CROS'}</strong> didn't go
      through{reason ? <> — {reason}</> : ''}. Your garden remains open;
      updating your card at your convenience is all that's needed.
    </Text>
    {billingUrl && <Link href={billingUrl} style={styles.cta}>Update payment</Link>}
    <Text style={styles.soft}>
      If this is an error, please reply and we'll sort it together.
    </Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'A payment on your CROS account needs attention',
  displayName: 'Payment issue',
  previewData: { planName: 'CROS Insight', reason: 'the card was declined', billingUrl: 'https://thecros.app' },
} satisfies TemplateEntry
