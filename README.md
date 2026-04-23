# brreg-mcp

MCP server for the Norwegian Central Coordinating Register for Legal Entities (Brønnøysundregistrene / Enhetsregisteret). Gives Claude Code and other MCP-compatible clients direct access to Norwegian company data — lookup, search, roles, subunits, and live updates.

No API key needed. Data is served by the free, public Brønnøysund Open Data API.

## Why

Norwegian devs, accountants, and analysts constantly need to look up orgnumbers, find board members, or track subsidiary changes. Doing it through the web UI is slow; doing it with `curl` loses context. With this MCP, you just ask Claude.

## Install

### Claude Code

Add to your MCP config (`~/.claude/settings.json` or per-project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "brreg": {
      "command": "npx",
      "args": ["-y", "brreg-mcp"]
    }
  }
}
```

Restart Claude Code. Verify with `/mcp` — you should see `brreg` listed with 5 tools.

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "brreg": {
      "command": "npx",
      "args": ["-y", "brreg-mcp"]
    }
  }
}
```

### Cursor / Windsurf / Zed / any MCP client

Same `command: npx`, `args: ["-y", "brreg-mcp"]` configuration.

### Local development

```bash
git clone https://github.com/hellosverre/brreg-mcp
cd brreg-mcp
npm install
npm run build
```

Then point your MCP client at `node /absolute/path/to/brreg-mcp/dist/index.js`.

## Tools

| Tool | What it does |
| --- | --- |
| `lookup_company` | Full details for one company by its 9-digit orgnr — name, address, NACE codes, employees, VAT status, bankruptcy, foundation date. |
| `search_companies` | Search by name and optional filters (municipality, org form, industry code, VAT-registered, bankruptcy status). Paginated. |
| `get_company_roles` | All registered roles (board, CEO, chair, auditor, sole proprietor) for a company. |
| `search_subunits` | Find subunits (branch offices, production sites) — scope to a parent company or by municipality/industry. |
| `get_recent_updates` | Feed of entity changes for monitoring new registrations, bankruptcies, status shifts. |

## Example prompts

> "Look up orgnr 984661177 and show me the board."

> "Find all VAT-registered software consultancies (NACE 62.010) in Oslo."

> "List every subunit of Vygruppen AS."

> "What Norwegian companies were just registered in the last hour?"

## Data source

All data comes from [data.brreg.no](https://data.brreg.no/enhetsregisteret/api/dokumentasjon/en/index.html). Per Brønnøysund's open data terms, the data is free to use. Some endpoints (roles with personal identification numbers) require Maskinporten authentication and are not exposed by this server.

## Development

```bash
npm install          # install deps
npm run dev          # run server in watch mode via tsx
npm run smoke        # hit the real brreg API to verify connectivity
npm run build        # compile to dist/
npx tsx scripts/mcp-probe.ts  # end-to-end stdio test
```

## License

MIT

## Disclaimer

Not affiliated with Brønnøysundregistrene or the Norwegian government. This is an independent open-source project using the public open-data API.
