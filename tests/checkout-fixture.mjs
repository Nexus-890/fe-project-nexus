import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";

// Next runs the actual application; this process serves only its dependencies.
mkdirSync("test-results", { recursive: true });
const output = createWriteStream("test-results/checkout-simulation.ndjson");
const errors = createWriteStream("test-results/checkout-simulation.err");
const simulation = spawn("postman", [
  "simulation", "run", "postman/simulations/checkout.sim.yaml",
  "--port", process.env.NEXUS_TEST_PROVIDER_PORT || "3923", "--no-history", "--output", "ndjson",
], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: { ...process.env, NEXUS_TEST_PROVIDER_PORT: process.env.NEXUS_TEST_PROVIDER_PORT || "3923", NEXUS_TEST_APP_PORT: process.env.NEXUS_TEST_APP_PORT || "3123" } });

simulation.stdout.pipe(output);
simulation.stderr.pipe(errors);
simulation.stderr.pipe(process.stderr);
simulation.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
simulation.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => simulation.kill(signal));
