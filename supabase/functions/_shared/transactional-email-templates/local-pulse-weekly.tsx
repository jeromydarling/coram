import * as React from 'npm:react@18.3.1'
import { Heading, Text, Link, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, styles, brand } from './_shared.tsx'

interface Item { title: string; when?: string; where?: string; url?: string }
interface Props {
  metroName?: string
  items?: Item[]
  pulseUrl?: string
}

const Email = ({ metroName, items = [], pulseUrl }: Props) => (
  <EmailLayout preview={`This week near ${metroName ?? 'you'} — a few gentle signals`}>
    <Heading style={styles.heading}>Signum — this week near {metroName ?? 'you'}.</Heading>
    <Text style={styles.body}>
      A few things noticed in your community. Take what serves; leave the rest.
    </Text>
    {items.map((it, i) => (
      <div key={i} style={{ marginBottom: '14px' }}>
        <Text style={{ ...styles.body, margin: '0 0 4px', fontWeight: 600 }}>
          {it.url ? <Link href={it.url} style={{ color: brand.ink }}>{it.title}</Link> : it.title}
        </Text>
        <Text style={styles.soft}>
          {[it.when, it.where].filter(Boolean).join(' · ')}
        </Text>
      </div>
    ))}
    {items.length === 0 && (
      <Text style={styles.soft}>Nothing pressing this week. Rest is also faithful.</Text>
    )}
    {pulseUrl && (<><Hr style={styles.hr} /><Link href={pulseUrl} style={styles.cta}>Open Signum</Link></>)}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d) => `Signum — this week near ${d.metroName ?? 'you'}`,
  displayName: 'Local Pulse weekly',
  previewData: {
    metroName: 'Minneapolis',
    items: [
      { title: 'Neighborhood listening session', when: 'Wed 6pm', where: 'Powderhorn', url: 'https://thecros.app' },
      { title: 'Refugee welcome coffee', when: 'Sat 10am', where: 'Whittier' },
    ],
    pulseUrl: 'https://thecros.app',
  },
} satisfies TemplateEntry
