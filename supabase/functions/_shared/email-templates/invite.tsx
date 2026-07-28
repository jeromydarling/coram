/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join CROS</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandMark}>CROS</Text>
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          Someone on your team has invited you to{' '}
          <Link href={siteUrl} style={link}>
            <strong>CROS</strong>
          </Link>
          {' '}— the Community Relationship OS. Click below to accept and create
          your account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const brandMark = {
  fontSize: '13px',
  fontWeight: '700' as const,
  letterSpacing: '0.12em',
  color: 'hsl(155, 25%, 35%)',
  margin: '0 0 24px',
  textTransform: 'uppercase' as const,
}
const h1 = {
  fontSize: '22px',
  fontWeight: '600' as const,
  fontFamily: "'Playfair Display', Georgia, serif",
  color: 'hsl(25, 30%, 14%)',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(25, 10%, 50%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(155, 25%, 35%)',
  color: 'hsl(40, 20%, 97%)',
  fontSize: '14px',
  fontWeight: '500' as const,
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: 'hsl(25, 10%, 60%)', margin: '32px 0 0' }
