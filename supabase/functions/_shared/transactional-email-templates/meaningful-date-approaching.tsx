import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  personName?: string
  occasion?: string
  daysAway?: number
  personUrl?: string
}

const Email = ({ personName, occasion, daysAway, personUrl }: Props) => {
  const when = typeof daysAway === 'number'
    ? daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`
    : 'soon'
  return (
    <EmailLayout preview={`${personName ?? 'Someone you tend'} — ${occasion ?? 'a meaningful date'} ${when}`}>
      <Heading style={styles.heading}>A meaningful date is near.</Heading>
      <Text style={styles.body}>
        {personName ? <>{personName}'s </> : 'A '}
        {occasion ?? 'meaningful date'} is {when}. A note, a call, or a
        moment of prayer may be welcome.
      </Text>
      <Text style={styles.quote}>
        Small remembrances are how relationships stay alive.
      </Text>
      {personUrl && <Link href={personUrl} style={styles.cta}>Open their page</Link>}
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: (d) => `${d.personName ?? 'Someone'} — ${d.occasion ?? 'a meaningful date'} is near`,
  displayName: 'Meaningful date approaching',
  previewData: { personName: 'Maria', occasion: 'birthday', daysAway: 3, personUrl: 'https://thecros.app' },
} satisfies TemplateEntry
