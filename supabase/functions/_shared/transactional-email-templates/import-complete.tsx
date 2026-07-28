import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles } from './_shared.tsx'

interface Props {
  source?: string
  peopleCount?: number
  orgCount?: number
  warnings?: number
  reviewUrl?: string
}

const Email = ({ source, peopleCount = 0, orgCount = 0, warnings = 0, reviewUrl }: Props) => (
  <EmailLayout preview={`Import complete — ${source ?? 'your data'} is in`}>
    <Heading style={styles.heading}>Import complete.</Heading>
    <Text style={styles.body}>
      Your import from <strong>{source ?? 'your source'}</strong> finished
      quietly. {peopleCount} {peopleCount === 1 ? 'person' : 'people'} and{' '}
      {orgCount} {orgCount === 1 ? 'organization' : 'organizations'} were added.
    </Text>
    {warnings > 0 && (
      <Text style={styles.soft}>
        {warnings} row{warnings === 1 ? '' : 's'} need a second glance — nothing was lost.
      </Text>
    )}
    {reviewUrl && <Link href={reviewUrl} style={styles.cta}>Review the import</Link>}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `Import complete — ${d.source ?? 'your data'}`,
  displayName: 'Import complete',
  previewData: { source: 'Flocknote CSV', peopleCount: 142, orgCount: 3, warnings: 4, reviewUrl: 'https://thecros.app' },
} satisfies TemplateEntry
