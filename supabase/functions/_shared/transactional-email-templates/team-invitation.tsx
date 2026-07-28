import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  inviterName?: string
  gardenName?: string
  role?: string
  acceptUrl?: string
}

const Email = ({ inviterName, gardenName, role, acceptUrl }: Props) => (
  <EmailLayout preview={`You've been invited to join ${gardenName ?? 'a garden'} on CROS`}>
    <Heading style={styles.heading}>You've been invited.</Heading>
    <Text style={styles.body}>
      {inviterName ?? 'A steward'} has invited you to join{' '}
      <strong>{gardenName ?? 'their garden'}</strong> on CROS
      {role ? <> as a <em>{role}</em></> : null}.
    </Text>
    <Text style={styles.quote}>
      Gardens grow well when tended by more than one.
    </Text>
    {acceptUrl && <Link href={acceptUrl} style={styles.cta}>Accept the invitation</Link>}
    <Text style={styles.soft}>
      This invitation is meant for you. If it arrived by mistake, no action is needed.
    </Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `${d.inviterName ?? 'A steward'} invited you to ${d.gardenName ?? 'a garden'} on CROS`,
  displayName: 'Team invitation',
  previewData: { inviterName: 'Anne', gardenName: 'St. Brigid Parish', role: 'Companion', acceptUrl: 'https://thecros.app' },
} satisfies TemplateEntry
