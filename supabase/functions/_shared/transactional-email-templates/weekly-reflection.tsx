import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  name?: string
  appUrl?: string
  peopleAdded?: number
  reflectionsWritten?: number
  meaningfulDates?: number
  summary?: string
}

const line = (label: string, n?: number) => {
  if (!n || n < 1) return null
  return (
    <Text style={styles.body} key={label}>
      · <strong>{n}</strong> {label}
    </Text>
  )
}

const Email = ({
  name, appUrl, peopleAdded, reflectionsWritten, meaningfulDates, summary,
}: Props) => {
  const url = appUrl || 'https://thecros.app'
  const anyActivity = (peopleAdded ?? 0) + (reflectionsWritten ?? 0) + (meaningfulDates ?? 0) > 0
  return (
    <EmailLayout preview="A quiet weekly reflection from your garden.">
      <Heading style={styles.heading}>
        {name ? `A quiet week, ${name}.` : 'A quiet week.'}
      </Heading>
      {summary ? (
        <Text style={styles.quote}>{summary}</Text>
      ) : (
        <Text style={styles.body}>
          A small note from the garden — a few things worth noticing from the
          past seven days.
        </Text>
      )}
      {anyActivity ? (
        <>
          {line('people you tended to', peopleAdded)}
          {line('reflections written', reflectionsWritten)}
          {line('meaningful dates approaching', meaningfulDates)}
        </>
      ) : (
        <Text style={styles.body}>
          A quiet week — nothing needing your attention. That is its own kind
          of grace.
        </Text>
      )}
      <Link href={`${url}/command-center`} style={styles.cta}>
        Step into the garden
      </Link>
      <Text style={styles.soft}>
        You can adjust or pause these reflections anytime in your settings.
      </Text>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: 'A quiet weekly reflection from CROS',
  displayName: 'Weekly Reflection',
  previewData: {
    name: 'Friend',
    appUrl: 'https://thecros.app',
    peopleAdded: 2,
    reflectionsWritten: 3,
    meaningfulDates: 1,
  },
} satisfies TemplateEntry
