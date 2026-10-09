import React from "react";
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props { name?: string; teamName?: string; good?: number; bad?: number; pdfUrl?: string }

const Email = ({ name, teamName = "your team", good = 0, bad = 0, pdfUrl = "#" }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Team Health Review for ${teamName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{`Team Health Review: ${teamName}`}</Heading>
        <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
        <Text style={text}>
          {`Your instructor shared your team's latest health review. ${good} checks passed and ${bad} item${bad === 1 ? "" : "s"} still need${bad === 1 ? "s" : ""} attention.`}
        </Text>
        <Button style={button} href={pdfUrl}>Download the PDF report</Button>
        <Text style={small}>The download link works for 30 days.</Text>
        <Hr style={hr} />
        <Text style={footer}>Your Project Manager is copied on team messages.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Team Health Review: ${d["teamName"] ?? "your team"}`,
  displayName: "Team Health Review",
  previewData: { name: "Aaron", teamName: "Team 01 · Theory Y · Section 04", good: 3, bad: 2, pdfUrl: "https://example.com" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const h1 = { fontSize: "22px", color: "#12263f", margin: "0 0 16px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#33475b" };
const small = { fontSize: "12px", color: "#7d8ca3" };
const button = { backgroundColor: "#12263f", color: "#ffffff", fontSize: "15px", padding: "12px 22px", borderRadius: "6px", textDecoration: "none", display: "inline-block", margin: "8px 0 4px" };
const hr = { borderColor: "#e6e6e6", margin: "24px 0 12px" };
const footer = { fontSize: "12px", color: "#7d8ca3" };
