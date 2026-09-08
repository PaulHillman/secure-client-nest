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
  missing?: string[];
  appUrl?: string;
}

const Email = ({ name, missing = [], appUrl = "https://clientvault.paulhillman.com/app/dashboard" }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your ClientVault profile still needs a few things</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Finish your ClientVault profile</Heading>
        <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
        <Text style={text}>
          Your team can&apos;t plan around you until your profile is complete. These items are still
          outstanding:
        </Text>
        <Section style={box}>
          {(missing.length ? missing : ["your profile details"]).map((m) => (
            <Text key={m} style={item}>
              • {m}
            </Text>
          ))}
        </Section>
        <Text style={text}>
          For availability, only block the times you absolutely cannot meet — class periods,
          regularly scheduled work shifts and athletic practices. Leave as much time open as
          possible so your team can actually find a slot that works for everyone.
        </Text>
        <Button style={button} href={appUrl}>
          Complete my profile
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          You&apos;ll get this reminder once a day until everything is finished. Your Project
          Manager is copied on team reminders.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your ClientVault profile isn't finished yet",
  displayName: "Profile completion reminder",
  previewData: {
    name: "Nick",
    missing: ["8 skills you have", "5 skills you want to learn", "your weekly availability"],
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
