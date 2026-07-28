import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  companionName?: string
  referredBy?: string
  referralUrl?: string
}

const Email = ({ companionName, referredBy, referralUrl }: Props) => (
  <EmailLayout preview={`A companion was referred to your agency`}>
    <Heading style={styles.heading}>A new companion referral.</Heading>
    <Text style={styles.body}>
      {companionName ?? 'A companion'} was referred to your agency
      {referredBy ? <> by {referredBy}</> : ''}. When you're ready, review the
      referral and welcome them at your pace.
    </Text>
    {referralUrl && <Link href={referralUrl} style={styles.cta}>Open the referral</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `New companion referral — ${d.companionName ?? 'someone new'}`,
  displayName: 'New companion referral',
  previewData: { companionName: 'Br. Thomas', referredBy: 'Metro Coordinator', referralUrl: 'https://thecros.app' },
} satisfies TemplateEntry
