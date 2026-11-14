import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";

mkdirSync("test-results", { recursive: true });
const output = createWriteStream("test-results/auction-simulation.ndjson");
const errors = createWriteStream("test-results/auction-simulation.err");
const simulation = spawn("postman", [
  "simulation", "run", "postman/simulations/auction.sim.yaml", "--port", "3928",
  "--environment", "postman/environments/Auction.environment.yaml", "--no-history", "--output", "ndjson",
], {
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  env: { ...process.env, NEXUS_TEST_PROVIDER_PORT: "3928", NEXUS_TEST_APP_PORT: "3118" },
});
simulation.stdout.pipe(output);
simulation.stderr.pipe(errors);
simulation.stderr.pipe(process.stderr);
simulation.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
simulation.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => simulation.kill(signal));
