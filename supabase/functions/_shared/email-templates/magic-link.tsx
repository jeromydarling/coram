/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for CROS</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandMark}>CROS</Text>
        <Heading style={h1}>Your sign-in link</Heading>
        <Text style={text}>
          Click below to sign in. This link will expire shortly.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Sign in to CROS
        </Button>
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
