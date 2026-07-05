import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const spikeDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(spikeDir, "..", "..");
const outPath = join(spikeDir, "context.md");

function excerptLines(relPath, startLine, endLine) {
    const full = join(repoRoot, relPath);
    const lines = readFileSync(full, "utf8").split(/\r?\n/);
    const slice = lines.slice(startLine - 1, endLine);
    return slice.map((line, i) => `${startLine + i}:${line}`).join("\n");
}

function excerptWholeFile(relPath) {
    const full = join(repoRoot, relPath);
    const lines = readFileSync(full, "utf8").split(/\r?\n/);
    return lines.map((line, i) => `${i + 1}:${line}`).join("\n");
}

const sections = [
    {
        heading: "js/socialcalc-3.js — rewrite functions (3663-3875)",
        body: excerptLines("js/socialcalc-3.js", 3663, 3875),
    },
    {
        heading: "js/socialcalc-3.js — filldown/fillright callsite (2386-2503)",
        body: excerptLines("js/socialcalc-3.js", 2386, 2503),
    },
    {
        heading: "js/socialcalc-3.js — paste callsite (2524-2604)",
        body: excerptLines("js/socialcalc-3.js", 2524, 2604),
    },
    {
        heading:
            "js/socialcalc-3.js — insert adjust callsite and names update (2768-2848)",
        body: excerptLines("js/socialcalc-3.js", 2768, 2848),
    },
    {
        heading:
            "js/socialcalc-3.js — delete adjust callsite and names update (2916-3006)",
        body: excerptLines("js/socialcalc-3.js", 2916, 3006),
    },
    {
        heading:
            "js/socialcalc-3.js — movepaste/moveinsert replacement callsite (3108-3397)",
        body: excerptLines("js/socialcalc-3.js", 3108, 3397),
    },
    {
        heading: "js/formula1.js — token constants and operator expansion (44-94)",
        body: excerptLines("js/formula1.js", 44, 94),
    },
    {
        heading: "js/formula1.js — parser entry and coordinate regex (153-220)",
        body: excerptLines("js/formula1.js", 153, 220),
    },
    {
        heading: "js/socialcalc-3.d.ts — public signatures (181-192)",
        body: excerptLines("js/socialcalc-3.d.ts", 181, 192),
    },
    {
        heading: "spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json",
        body: excerptWholeFile(
            "spikes/leanstral-formula-ref/fixtures/formula-rewrite-cases.json",
        ),
    },
    {
        heading: "crates/formula-ref-core/src/lib.rs — Rust core source",
        body: excerptWholeFile("crates/formula-ref-core/src/lib.rs"),
    },
];

let md = "# Leanstral formula reference rewrite — local context\n\n";
for (const s of sections) {
    md += `## ${s.heading}\n\n\`\`\`\n${s.body}\n\`\`\`\n\n`;
}

writeFileSync(outPath, md, "utf8");
console.log(`wrote ${outPath}`);