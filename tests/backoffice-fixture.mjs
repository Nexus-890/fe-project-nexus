import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
mkdirSync("test-results", { recursive: true });
const apiPort = process.env.NEXUS_BACKOFFICE_API_PORT || "3920";
const appPort = process.env.NEXUS_BACKOFFICE_APP_PORT || "3110";
const simulation = spawn("postman", ["simulation", "run", "postman/simulations/backoffice.sim.yaml", "--port", apiPort, "--no-history", "--output", "ndjson"], {
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  env: { ...process.env, NEXUS_TEST_PROVIDER_PORT: apiPort, NEXUS_TEST_APP_PORT: appPort },
});
simulation.stdout.pipe(createWriteStream("test-results/backoffice-simulation.ndjson"));
simulation.stderr.pipe(createWriteStream("test-results/backoffice-simulation.err"));
simulation.stderr.pipe(process.stderr);
simulation.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
simulation.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => simulation.kill(signal));
