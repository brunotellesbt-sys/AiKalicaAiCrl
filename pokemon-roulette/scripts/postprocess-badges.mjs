#!/usr/bin/env node
/**
 * Runs scripts/make-badges-transparent.py when a usable Python + Pillow is available.
 *
 * The processed badges are committed under src/assets/badges/, so this step is only
 * needed when new badge images are downloaded. On CI (and on machines without Pillow)
 * a failure here must NOT break the build, otherwise GitHub Pages never deploys.
 */
import { spawnSync } from "node:child_process";

const SCRIPT = "scripts/make-badges-transparent.py";

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: "inherit", shell: false });
}

function hasPython(cmd) {
  const probe = spawnSync(cmd, ["-c", "import PIL"], { stdio: "ignore", shell: false });
  return probe.status === 0;
}

const candidates = ["python3", "python"];

for (const cmd of candidates) {
  // Try to make Pillow available, but never fail because of it (PEP 668 environments
  // reject `pip install` into the system interpreter).
  if (!hasPython(cmd)) {
    run(cmd, ["-m", "pip", "install", "--quiet", "--disable-pip-version-check", "Pillow"]);
  }

  if (!hasPython(cmd)) continue;

  const res = run(cmd, [SCRIPT]);
  if (res.status === 0) process.exit(0);

  console.warn(`Badge post-processing exited with ${res.status}; keeping the downloaded images as-is.`);
  process.exit(0);
}

console.warn("Python + Pillow unavailable; skipping badge post-processing and using the committed badge images.");
process.exit(0);
