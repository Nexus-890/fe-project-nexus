import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";

mkdirSync("test-results", { recursive: true });
const simulation = spawn("postman", [
  "simulation", "run", "postman/simulations/order-list.sim.yaml",
  "--port", "3914", "--no-history", "--output", "ndjson",
], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
simulation.stdout.pipe(createWriteStream("test-results/order-list-simulation.ndjson"));
simulation.stderr.pipe(createWriteStream("test-results/order-list-simulation.err"));
simulation.stderr.pipe(process.stderr);
simulation.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
simulation.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => simulation.kill(signal));
