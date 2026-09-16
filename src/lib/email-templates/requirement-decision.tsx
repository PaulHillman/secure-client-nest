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
  approved?: boolean;
  note?: string;
  appUrl?: string;
}

const Email = ({
  name,
  teamName = "your team",
  title = "your submission",
  approved = false,
  note,
  appUrl = "https://clientvault.paulhillman.com/app/dashboard",
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {approved ? `"${title}" was approved` : `"${title}" was sent back for revision`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {approved ? `"${title}" was approved` : `"${title}" needs another pass`}
        </Heading>
        <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
        <Text style={text}>
          {approved
            ? `Your professor approved "${title}" for ${teamName}. Nothing more is needed on this one.`
            : `Your professor sent "${title}" back to ${teamName}. Please make the changes below and submit again.`}
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
    data['approved']
      ? `Approved: ${data['title'] ?? "your submission"}`
      : `Sent back: ${data['title'] ?? "your submission"}`,
  displayName: "Submission decision",
  previewData: {
    name: "Nick",
    teamName: "Theory Y",
    title: "Team Setup",
    approved: false,
    note: "Add the meeting time and confirm everyone's role.",
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
