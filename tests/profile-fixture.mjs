import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";

// Keep the OIDC provider and profile API in one simulation so token evidence is shared.
mkdirSync("test-results", { recursive: true });
const output = createWriteStream("test-results/profile-simulation.ndjson");
const errors = createWriteStream("test-results/profile-simulation.err");
const simulation = spawn("postman", [
  "simulation", "run", "postman/simulations/profile.sim.yaml",
  "--port", "3913", "--no-history", "--output", "ndjson",
], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

simulation.stdout.pipe(output);
simulation.stderr.pipe(errors);
simulation.stderr.pipe(process.stderr);
simulation.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
simulation.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => simulation.kill(signal));
}
