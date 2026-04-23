import { brregGet } from "../src/brreg.js";

type Check = { name: string; run: () => Promise<unknown> };

const VY_ORGNR = "984661177"; // Vygruppen AS
const EQUINOR_ORGNR = "923609016"; // Equinor ASA

const checks: Check[] = [
  {
    name: "lookup Vygruppen AS",
    run: () => brregGet(`/enheter/${VY_ORGNR}`),
  },
  {
    name: "lookup Equinor ASA",
    run: () => brregGet(`/enheter/${EQUINOR_ORGNR}`),
  },
  {
    name: "search 'equinor' limit 3",
    run: () => brregGet("/enheter", { navn: "equinor", size: 3 }),
  },
  {
    name: "roles for Equinor",
    run: () => brregGet(`/enheter/${EQUINOR_ORGNR}/roller`),
  },
  {
    name: "subunits of Vygruppen",
    run: () => brregGet("/underenheter", { overordnetEnhet: VY_ORGNR, size: 3 }),
  },
  {
    name: "recent updates (size 3)",
    run: () => brregGet("/oppdateringer/enheter", { size: 3 }),
  },
  {
    name: "lookup non-existent orgnr (expect 404)",
    run: () => brregGet("/enheter/000000000"),
  },
];

async function main() {
  let passed = 0;
  let failed = 0;
  for (const c of checks) {
    process.stdout.write(`  ${c.name} ... `);
    try {
      const res = (await c.run()) as { ok: boolean; data?: unknown; error?: unknown };
      const isExpected404 = c.name.includes("non-existent") && !res.ok;
      if (res.ok || isExpected404) {
        process.stdout.write("OK\n");
        passed++;
      } else {
        process.stdout.write(`FAIL — ${JSON.stringify(res.error)}\n`);
        failed++;
      }
    } catch (e) {
      process.stdout.write(`THROW — ${e instanceof Error ? e.message : String(e)}\n`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
