import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  teamName?: string;
  title?: string;
  senderName?: string;
  note?: string;
  appUrl?: string;
}

const Email = ({
  name,
  teamName = "your team",
  title = "a team item",
  senderName = "Your Project Manager",
  note,
  appUrl = "https://clientvault.paulhillman.com/app/dashboard",
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`A reminder about "${title}"`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{`A reminder about "${title}"`}</Heading>
        <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
        <Text style={text}>
          {`${senderName} is waiting on you for "${title}" for ${teamName}.`}
        </Text>
        {note ? (
          <Section style={box}>
            <Text style={item}>{note}</Text>
          </Section>
        ) : null}
        <Button style={button} href={appUrl}>
          Open ClientVault
        </Button>
        <Hr style={hr} />
        <Text style={footer}>Your Project Manager is copied on team messages.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Reminder: ${data['title'] ?? "a team item"}`,
  displayName: "Nudge reminder",
  previewData: {
    name: "Aaron",
    teamName: "Theory Y",
    title: "Team Setup",
    senderName: "Paul Hillman",
    note: "Please finish your part before tonight's deadline.",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const h1 = { fontSize: "22px", color: "#12263f", margin: "0 0 16px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#33475b" };
const box = {
  backgroundColor: "#f7f5ef",
  borderLeft: "3px solid #b39237",
  padding: "12px 16px",
  margin: "16px 0",
};
const item = { fontSize: "15px", lineHeight: "22px", color: "#33475b", margin: "4px 0" };
const button = {
  backgroundColor: "#12263f",
  color: "#ffffff",
  fontSize: "15px",
  padding: "12px 22px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
  margin: "8px 0 4px",
};
const hr = { borderColor: "#e6e6e6", margin: "24px 0 12px" };
const footer = { fontSize: "12px", color: "#7d8ca3" };
