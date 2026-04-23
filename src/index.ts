#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { brregGet, isOrgNr } from "./brreg.js";

const server = new McpServer({
  name: "brreg-mcp",
  version: "0.1.0",
});

function textResult(payload: unknown, isError = false) {
  return {
    isError,
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

server.registerTool(
  "lookup_company",
  {
    title: "Look up Norwegian company by organization number",
    description:
      "Retrieves full details of a Norwegian business entity from the Brønnøysund Register Centre (Enhetsregisteret) by its 9-digit organization number. Returns name, address, industry (NACE) codes, organization form, employee count, VAT registration status, bankruptcy status, foundation date, and more. Use this when the user provides or asks about a specific Norwegian orgnr.",
    inputSchema: {
      orgnr: z
        .string()
        .describe("9-digit Norwegian organization number (organisasjonsnummer), e.g. '923609016'"),
    },
  },
  async ({ orgnr }) => {
    const cleaned = orgnr.replace(/\s+/g, "");
    if (!isOrgNr(cleaned)) {
      return textResult(
        `Invalid organization number: "${orgnr}". Must be exactly 9 digits.`,
        true,
      );
    }
    const result = await brregGet(`/enheter/${cleaned}`);
    if (!result.ok) {
      return textResult(
        `No company found for orgnr ${cleaned}: ${result.error.message}`,
        true,
      );
    }
    return textResult(result.data);
  },
);

server.registerTool(
  "search_companies",
  {
    title: "Search Norwegian companies",
    description:
      "Searches the Norwegian business registry (Enhetsregisteret) by name and optional filters. Returns a paginated list of matching entities. Use this when the user wants to find a company by name, or filter by municipality, industry code, organization form, or registration status.",
    inputSchema: {
      navn: z.string().optional().describe("Company name or substring (case-insensitive)"),
      organisasjonsform: z
        .string()
        .optional()
        .describe(
          "Filter by organization form code, e.g. 'AS' (aksjeselskap), 'ENK' (enkeltpersonforetak), 'ASA', 'DA', 'NUF'",
        ),
      kommunenummer: z
        .string()
        .optional()
        .describe("4-digit municipality number (kommunenummer) to filter by location"),
      postnummer: z.string().optional().describe("4-digit postal code filter"),
      naeringskode: z
        .string()
        .optional()
        .describe("NACE industry code filter (e.g. '62.010' for computer programming)"),
      registrertIMvaregisteret: z
        .boolean()
        .optional()
        .describe("Filter to only VAT-registered companies"),
      konkurs: z
        .boolean()
        .optional()
        .describe("Filter by bankruptcy status (true = only bankrupt, false = only non-bankrupt)"),
      size: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Results per page (1-100, default 20)"),
      page: z.number().int().min(0).default(0).describe("Page number (0-indexed, default 0)"),
    },
  },
  async (args) => {
    const result = await brregGet("/enheter", args);
    if (!result.ok) {
      return textResult(`Search failed: ${result.error.message}`, true);
    }
    return textResult(result.data);
  },
);

server.registerTool(
  "get_company_roles",
  {
    title: "Get roles (board, directors, auditor) of a company",
    description:
      "Retrieves all registered roles — board members (styre), CEO (daglig leder), chair (styreleder), auditor (revisor), sole proprietor (innehaver), etc. — for a Norwegian company. Returns structured role groups with person or entity role-holders. Does NOT include personal identification numbers (that requires Maskinporten auth).",
    inputSchema: {
      orgnr: z.string().describe("9-digit Norwegian organization number"),
    },
  },
  async ({ orgnr }) => {
    const cleaned = orgnr.replace(/\s+/g, "");
    if (!isOrgNr(cleaned)) {
      return textResult(`Invalid organization number: "${orgnr}". Must be exactly 9 digits.`, true);
    }
    const result = await brregGet(`/enheter/${cleaned}/roller`);
    if (!result.ok) {
      return textResult(
        `No roles found for orgnr ${cleaned}: ${result.error.message}`,
        true,
      );
    }
    return textResult(result.data);
  },
);

server.registerTool(
  "search_subunits",
  {
    title: "Search subunits (branch offices) of Norwegian companies",
    description:
      "Searches subunits (underenheter — branch offices, departments, production sites) in the Norwegian business registry. Typically used to find all branches of a parent company, or to locate subunits in a specific municipality. A subunit shares the parent's organization but has its own orgnr for reporting purposes.",
    inputSchema: {
      navn: z.string().optional().describe("Subunit name or substring"),
      overordnetEnhet: z
        .string()
        .optional()
        .describe("9-digit orgnr of the parent entity to list all its subunits"),
      kommunenummer: z.string().optional().describe("4-digit municipality number"),
      naeringskode: z.string().optional().describe("NACE industry code"),
      size: z.number().int().min(1).max(100).default(20),
      page: z.number().int().min(0).default(0),
    },
  },
  async (args) => {
    const result = await brregGet("/underenheter", args);
    if (!result.ok) {
      return textResult(`Subunit search failed: ${result.error.message}`, true);
    }
    return textResult(result.data);
  },
);

server.registerTool(
  "get_recent_updates",
  {
    title: "Get recently updated companies",
    description:
      "Fetches a feed of entities (companies) that were recently updated in the Norwegian business registry. Useful for monitoring changes to specific companies or watching for new registrations / status changes. Each update references the changed entity by orgnr along with the change type and timestamp.",
    inputSchema: {
      dato: z
        .string()
        .optional()
        .describe(
          "ISO-8601 timestamp — return updates from this point onward (e.g. '2026-04-20T00:00:00Z')",
        ),
      oppdateringsid: z
        .number()
        .int()
        .optional()
        .describe("Continue from a specific update id (pagination cursor)"),
      size: z.number().int().min(1).max(5000).default(100),
    },
  },
  async (args) => {
    const result = await brregGet("/oppdateringer/enheter", args);
    if (!result.ok) {
      return textResult(`Updates fetch failed: ${result.error.message}`, true);
    }
    return textResult(result.data);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr so it doesn't corrupt stdio JSON-RPC
  process.stderr.write("brreg-mcp server ready\n");
}

main().catch((err) => {
  process.stderr.write(`brreg-mcp fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
