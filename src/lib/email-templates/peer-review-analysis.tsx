import React from 'react';
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import type { TemplateEntry } from './registry';
interface Props { name?: string; body?: string; subject?: string }
const Email = ({ name = 'Student', body = '', subject = 'Individual peer-review analysis' }: Props) => (
  <Html lang="en" dir="ltr"><Head /><Preview>{subject}</Preview><Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}><Container style={{ padding: '24px', maxWidth: '640px' }}><Heading>ClientVault — {name}</Heading>{body.split('\n\n').map((paragraph, i) => <Text key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: '24px', fontSize: '15px' }}>{paragraph}</Text>)}</Container></Body></Html>
);
export const template = { component: Email, subject: (data: Record<string, any>) => data.subject || 'Individual peer-review analysis', displayName: 'Individual peer-review analysis', previewData: { name: 'Student', body: 'Your individual peer-review analysis.', subject: 'Your peer-review analysis' } } satisfies TemplateEntry;