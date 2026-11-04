import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";

mkdirSync("test-results", { recursive: true });
const output = createWriteStream("test-results/payment-simulation.ndjson");
const errors = createWriteStream("test-results/payment-simulation.err");
// Only HTTP dependencies run here. The Next application runs in Playwright.
const simulation = spawn("postman", [
  "simulation", "run", "postman/simulations/payment.sim.yaml",
  "--port", "3914", "--environment", "postman/environments/Payment.environment.yaml", "--no-history", "--output", "ndjson",
], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
simulation.stdout.pipe(output);
simulation.stderr.pipe(errors);
simulation.stderr.pipe(process.stderr);
simulation.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
simulation.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => simulation.kill(signal));
