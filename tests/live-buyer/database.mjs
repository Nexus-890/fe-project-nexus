import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export async function databaseTask(task) {
  let driver = process.env.NEXUS_LIVE_POSTGRES_DRIVER;
  if (!driver) {
    const directory = path.join(os.homedir(), ".m2", "repository", "org", "postgresql", "postgresql");
    const versions = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory())
      .map((entry) => entry.name).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const jar = (await readdir(path.join(directory, version))).find((name) => /^postgresql-[\d.]+\.jar$/.test(name));
      if (jar) { driver = path.join(directory, version, jar); break; }
    }
  }
  if (!driver) throw new Error("Set NEXUS_LIVE_POSTGRES_DRIVER to the installed PostgreSQL JDBC jar.");
  return new Promise((resolve, reject) => {
    const child = spawn("java", ["--class-path", driver, "tests/live-buyer/BuyerLiveDatabase.java", task], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let error = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { error += data; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(JSON.parse(output)) : reject(new Error(`Live database ${task} failed: ${error}`)));
  });
}
