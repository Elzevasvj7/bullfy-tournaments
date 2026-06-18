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
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Restablece tu contraseña en Bullfy IB System</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={logoText}>BULLFY</Heading>
          <Text style={tagline}>IB SYSTEM</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Restablecer contraseña</Heading>
          <Text style={text}>
            Recibimos una solicitud para restablecer tu contraseña. Haz click en el botón para elegir una nueva.
          </Text>
          <Button style={button} href={confirmationUrl}>Restablecer Contraseña</Button>
          <Text style={smallText}>
            Si no solicitaste esto, puedes ignorar este email. Tu contraseña no será modificada.
          </Text>
        </Section>
        <Section style={footerSection}>
          <Text style={footerBrand}>© 2026 Bullfy Tech. Todos los derechos reservados.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto' }
const header = { backgroundColor: '#062B63', padding: '24px 25px', textAlign: 'center' as const, borderRadius: '8px 8px 0 0' }
const logoText = { fontSize: '28px', fontWeight: 'bold' as const, color: '#83CBFF', margin: '0', letterSpacing: '2px' }
const tagline = { fontSize: '12px', color: '#A0B1BD', margin: '4px 0 0', letterSpacing: '4px', textTransform: 'uppercase' as const }
const content = { padding: '30px 25px', border: '1px solid #e0e0e0', borderTop: 'none' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#062B63', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const button = { backgroundColor: '#146EF5', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 24px', textDecoration: 'none', fontWeight: 'bold' as const }
const smallText = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
const footerSection = { textAlign: 'center' as const, padding: '16px 25px', borderTop: '1px solid #e0e0e0' }
const footerBrand = { fontSize: '11px', color: '#A0B1BD', margin: '0' }
