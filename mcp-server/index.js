import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { google } from "googleapis";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// setup gmail auth using refresh token
const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

auth.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth });

// create MCP server
const server = new McpServer({
  name: "gmail-mcp-server",
  version: "1.0.0",
});

// ── TOOL 1: List emails ──────────────────────────────────────────
server.tool(
  "gmail_list_messages",
  "Fetch emails from Gmail inbox",
  {
    query: z.string().optional().describe("Gmail search query e.g. is:unread"),
    maxResults: z.number().optional().describe("Max number of emails to fetch"),
  },
  async ({ query = "in:inbox", maxResults = 5 }) => {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });

    const messages = res.data.messages || [];

    if (messages.length === 0) {
      return {
        content: [{ type: "text", text: "No emails found." }],
      };
    }

    // fetch full details for each message
    const detailed = await Promise.all(
      messages.map(async (msg) => {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });

        const headers = full.data.payload.headers;
        const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
        const from = headers.find((h) => h.name === "From")?.value || "Unknown";
        const date = headers.find((h) => h.name === "Date")?.value || "Unknown";

        return `ID: ${msg.id}\nFrom: ${from}\nSubject: ${subject}\nDate: ${date}`;
      })
    );

    return {
      content: [{ type: "text", text: detailed.join("\n\n---\n\n") }],
    };
  }
);

// ── helpers for body extraction ──────────────────────────────────
function decodeBase64Url(data) {
  if (!data) return "";
  return Buffer.from(data, "base64").toString("utf-8");
}

function findPartByMime(node, mime) {
  if (!node) return null;
  if (node.mimeType === mime && node.body?.data) return node;
  for (const p of node.parts || []) {
    const m = findPartByMime(p, mime);
    if (m) return m;
  }
  return null;
}

function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|td|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractBody(payload) {
  const plain = findPartByMime(payload, "text/plain");
  if (plain) return decodeBase64Url(plain.body.data);

  const html = findPartByMime(payload, "text/html");
  if (html) return htmlToText(decodeBase64Url(html.body.data));

  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    return payload.mimeType?.startsWith("text/html") ? htmlToText(raw) : raw;
  }
  return "";
}

// ── TOOL 2: Read full email ──────────────────────────────────────
server.tool(
  "gmail_read_message",
  "Read the full content of a specific email by ID",
  {
    messageId: z.string().describe("The Gmail message ID"),
  },
  async ({ messageId }) => {
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = res.data.payload.headers;
    const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
    const from = headers.find((h) => h.name === "From")?.value || "Unknown";
    const date = headers.find((h) => h.name === "Date")?.value || "Unknown";

    const body = extractBody(res.data.payload);

    return {
      content: [
        {
          type: "text",
          text: `From: ${from}\nDate: ${date}\nSubject: ${subject}\n\nBody:\n${body}`,
        },
      ],
    };
  }
);

// ── TOOL 3: Send email ───────────────────────────────────────────
server.tool(
  "gmail_send_message",
  "Send an email via Gmail",
  {
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body text"),
  },
  async ({ to, subject, body }) => {
    const rawMessage = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      body,
    ].join("\n");

    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    return {
      content: [{ type: "text", text: `Email sent to ${to} successfully.` }],
    };
  }
);

// ── TOOL 4: Draft reply ──────────────────────────────────────────
server.tool(
  "gmail_get_thread",
  "Get full email thread by thread ID for context before replying",
  {
    threadId: z.string().describe("The Gmail thread ID"),
  },
  async ({ threadId }) => {
    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
    });

    const messages = res.data.messages || [];
    const summary = messages.map((msg) => {
      const headers = msg.payload.headers;
      const subject = headers.find((h) => h.name === "Subject")?.value || "";
      const from = headers.find((h) => h.name === "From")?.value || "";
      return `From: ${from}\nSubject: ${subject}`;
    });

    return {
      content: [{ type: "text", text: summary.join("\n\n---\n\n") }],
    };
  }
);

// start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Gmail MCP Server running...");