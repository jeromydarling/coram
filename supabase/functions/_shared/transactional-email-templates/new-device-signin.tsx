import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  device?: string
  location?: string
  when?: string
  secureUrl?: string
}

const Email = ({ device, location, when, secureUrl }: Props) => (
  <EmailLayout preview="A quiet note about a new sign-in">
    <Heading style={styles.heading}>A new sign-in was noticed.</Heading>
    <Text style={styles.body}>
      Your CROS account was accessed from a new device{when ? <> at {when}</> : null}.
    </Text>
    <Text style={styles.soft}>
      Device: {device ?? 'Unknown device'}<br />
      Location: {location ?? 'Unknown location'}
    </Text>
    <Text style={styles.body}>
      If that was you, no action is needed. If not, please secure your account.
    </Text>
    {secureUrl && <Link href={secureUrl} style={styles.cta}>Review account security</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'A new sign-in on your CROS account',
  displayName: 'New device sign-in',
  previewData: { device: 'Safari on iPhone', location: 'Minneapolis, MN', when: 'Jul 27, 9:14am', secureUrl: 'https://thecros.app' },
} satisfies TemplateEntry
