import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "dist", "index.js");

const child = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const responses: unknown[] = [];

child.stdout.on("data", (chunk: Buffer) => {
  buffer += chunk.toString("utf8");
  let idx: number;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) {
      try {
        responses.push(JSON.parse(line));
      } catch {
        responses.push({ raw: line });
      }
    }
  }
});

function send(obj: unknown) {
  child.stdin.write(JSON.stringify(obj) + "\n");
}

async function waitFor(pred: (r: unknown[]) => boolean, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred(responses)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timeout waiting for response");
}

async function run() {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "probe", version: "0.0.1" },
    },
  });
  await waitFor((r) => r.some((x) => (x as { id?: number }).id === 1));

  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  await waitFor((r) => r.some((x) => (x as { id?: number }).id === 2));

  const listResp = responses.find((x) => (x as { id?: number }).id === 2) as {
    result?: { tools?: Array<{ name: string; description?: string }> };
  };

  const tools = listResp?.result?.tools ?? [];
  console.log(`Tools registered: ${tools.length}`);
  for (const t of tools) {
    console.log(`  - ${t.name}`);
  }

  // Invoke one real tool
  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "lookup_company", arguments: { orgnr: "984661177" } },
  });
  await waitFor((r) => r.some((x) => (x as { id?: number }).id === 3));

  const callResp = responses.find((x) => (x as { id?: number }).id === 3) as {
    result?: { content?: Array<{ text?: string }>; isError?: boolean };
  };

  const text = callResp?.result?.content?.[0]?.text ?? "";
  const preview = text.slice(0, 200).replace(/\s+/g, " ");
  console.log(`lookup_company(984661177) isError=${callResp?.result?.isError ?? false}`);
  console.log(`  preview: ${preview}...`);

  child.kill();

  const ok = tools.length >= 5 && !callResp?.result?.isError;
  process.exit(ok ? 0 : 1);
}

run().catch((e) => {
  console.error("probe failed:", e);
  child.kill();
  process.exit(1);
});
