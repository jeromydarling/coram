import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  planName?: string
  renewalDate?: string
  amount?: string
  billingUrl?: string
}

const Email = ({ planName, renewalDate, amount, billingUrl }: Props) => (
  <EmailLayout preview={`Your CROS subscription renews ${renewalDate ?? 'soon'}`}>
    <Heading style={styles.heading}>A gentle heads-up.</Heading>
    <Text style={styles.body}>
      Your <strong>{planName ?? 'CROS'}</strong> subscription will renew
      {renewalDate ? <> on <strong>{renewalDate}</strong></> : ' soon'}
      {amount ? <> for {amount}</> : null}. No action is needed if you'd like
      to continue.
    </Text>
    {billingUrl && <Link href={billingUrl} style={styles.cta}>Review billing</Link>}
    <Text style={styles.soft}>
      You can pause or cancel at any time — we'll never make it difficult.
    </Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `Your CROS subscription renews ${d.renewalDate ?? 'soon'}`,
  displayName: 'Subscription renewing soon',
  previewData: { planName: 'CROS Insight', renewalDate: 'Aug 3, 2026', amount: '$29', billingUrl: 'https://thecros.app' },
} satisfies TemplateEntry
