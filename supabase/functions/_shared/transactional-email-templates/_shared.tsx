/**
 * Shared styles + layout wrapper for CROS app email templates.
 * Warm off-white body, sage green accents, serif headings.
 */
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Link, Hr,
} from 'npm:@react-email/components@0.0.22'

export const brand = {
  bg: '#ffffff',
  surface: '#f6f1e8',
  ink: '#2a221a',
  muted: '#6b6357',
  sage: '#476b57',
  sageSoft: '#e4ece7',
  border: '#e5ded1',
}

export const styles = {
  main: {
    backgroundColor: brand.bg,
    fontFamily: "'Source Serif Pro', Georgia, 'Times New Roman', serif",
    color: brand.ink,
    margin: 0,
    padding: 0,
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '32px 24px 24px',
  },
  card: {
    backgroundColor: brand.surface,
    borderRadius: '12px',
    padding: '32px 28px',
    border: `1px solid ${brand.border}`,
  },
  wordmark: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: '22px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: brand.sage,
    margin: '0 0 20px',
  },
  heading: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: '26px',
    lineHeight: 1.25,
    fontWeight: 500,
    color: brand.ink,
    margin: '0 0 14px',
  },
  body: {
    fontSize: '16px',
    lineHeight: 1.7,
    color: brand.ink,
    margin: '0 0 14px',
  },
  soft: {
    fontSize: '14px',
    lineHeight: 1.65,
    color: brand.muted,
    margin: '0 0 12px',
  },
  cta: {
    display: 'inline-block',
    backgroundColor: brand.sage,
    color: '#ffffff',
    padding: '12px 22px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: 600,
    margin: '8px 0 4px',
  },
  hr: { borderColor: brand.border, margin: '28px 0 18px' },
  footer: {
    fontSize: '12px',
    lineHeight: 1.6,
    color: brand.muted,
    textAlign: 'center' as const,
    margin: '18px 0 0',
  },
  quote: {
    fontStyle: 'italic',
    color: brand.muted,
    borderLeft: `3px solid ${brand.sage}`,
    paddingLeft: '14px',
    margin: '10px 0 18px',
    fontSize: '15px',
    lineHeight: 1.6,
  },
}

interface LayoutProps {
  preview: string
  children: React.ReactNode
}

export const EmailLayout = ({ preview, children }: LayoutProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Text style={styles.wordmark}>CROS</Text>
        <Section style={styles.card}>{children}</Section>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          CROS — a Communal Relationship Operating System.<br />
          You're receiving this because you began a garden at{' '}
          <Link href="https://thecros.app" style={{ color: brand.sage }}>
            thecros.app
          </Link>.
        </Text>
      </Container>
    </Body>
  </Html>
)
