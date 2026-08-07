#!/usr/bin/env node
/**
 * Downloads badge images from Bulbagarden Archives into src/assets/badges/
 * so the app can serve them locally (GitHub Pages friendly).
 *
 * Source URLs use Special:FilePath/<filename> (MediaWiki redirect to the real file).
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const BADGES_TS = path.resolve("src/app/services/badges-service/badges-data.ts");
const OUT_ROOT = path.resolve("src/assets/badges");

// IMPORTANT: Bulbagarden Archives answers 403 to browser-like User-Agents (hotlink/bot
// protection). A descriptive, non-browser UA is served normally, so keep it that way —
// sending a Chrome UA here makes every download fail and breaks the whole build.
const UA =
  "pokemon-roulette-badge-fetcher/1.0 (+https://github.com/zeroxm/pokemon-roulette)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function fileExists(p) {
  try {
    const st = await fs.stat(p);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

async function downloadTo(url, destAbs, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": UA },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error("Empty response");
      await ensureDir(path.dirname(destAbs));
      await fs.writeFile(destAbs, buf);
      return;
    } catch (err) {
      if (i === attempts) throw err;
      // exponential-ish backoff
      await sleep(500 * i);
    }
  }
}

async function main() {
  const force = process.argv.includes("--force");

  const ts = await fs.readFile(BADGES_TS, "utf8");

  // Matches: gen8/Fighting_Badge.png etc (works for both template strings and literals)
  const re = /gen(\d+)\/([A-Za-z0-9_]+\.png)/g;

  const wanted = new Map(); // key => {gen, filename}
  for (let m; (m = re.exec(ts)); ) {
    const gen = Number(m[1]);
    const filename = m[2];
    const key = `gen${gen}/${filename}`;
    wanted.set(key, { gen, filename });
  }

  const list = [...wanted.values()].sort(
    (a, b) => a.gen - b.gen || a.filename.localeCompare(b.filename)
  );

  if (!list.length) {
    console.error("No badge paths found in badges-data.ts");
    process.exit(1);
  }

  console.log(`Badges to ensure locally: ${list.length}`);

  // simple concurrency pool
  const concurrency = Number(process.env.BADGE_DL_CONCURRENCY || 6);
  let idx = 0;
  let done = 0;

  const missing = [];

  async function worker() {
    while (idx < list.length) {
      const cur = list[idx++];
      const rel = `gen${cur.gen}/${cur.filename}`;
      const dest = path.join(OUT_ROOT, rel);

      if (!force && (await fileExists(dest))) {
        done++;
        continue;
      }

      const url = `https://archives.bulbagarden.net/wiki/Special:FilePath/${cur.filename}`;

      try {
        await downloadTo(url, dest);
        done++;
        if (done % 10 === 0 || done === list.length) {
          console.log(`Downloaded ${done}/${list.length}`);
        }
      } catch (e) {
        // Keep going to surface every failure in one run.
        console.warn(`WARN: could not fetch ${rel} — ${e?.message || e}`);
        missing.push(rel);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (missing.length === 0) {
    console.log("All badge images are present.");
    return;
  }

  // A refresh must never break the deploy.
  //
  // The badge images are committed under src/assets/badges/, so this step only has work to
  // do when a new badge is added. Bulbagarden blocks GitHub Actions runners outright (every
  // request 403s from CI, whatever User-Agent is sent), and killing the build over an
  // unreachable third party would take the whole site down for a cosmetic asset. Anything
  // still missing degrades to the in-game placeholder instead.
  console.warn(
    `\n${missing.length} of ${list.length} badge image(s) could not be refreshed and are not ` +
      `present locally:\n  ${missing.join("\n  ")}\n` +
      `Continuing the build — run this script from a machine Bulbagarden allows, then commit ` +
      `src/assets/badges/.`
  );
}

main().catch((e) => {
  // Same reasoning: badges are a build-time convenience, never a deploy blocker.
  console.warn("WARN: badge preparation failed, continuing with the committed images.");
  console.warn(e?.stack || String(e));
});
