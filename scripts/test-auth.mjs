import { mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = mkdtempSync(path.join(tmpdir(), "nexus-auth-tests-"));

try {
  const tests = readdirSync(path.join(root, "tests"))
    .filter((name) => name.endsWith(".test.ts"));
  const program = ts.createProgram({
    rootNames: [
      ...tests.map((name) => path.join(root, "tests", name)),
      path.join(root, "providers/AuthProvider.tsx"),
      path.join(root, "hooks/auth/useAuth.ts"),
      path.join(root, "providers/AppProviders.tsx"),
    ],
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmitOnError: true,
      types: ["node"],
      rootDir: root,
      outDir: output,
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }));
    process.exitCode = 1;
  } else {
    program.emit();
    symlinkSync(path.join(root, "node_modules"), path.join(output, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    const result = spawnSync(process.execPath, [
      "--test",
      ...tests.map((name) => path.join(output, "tests", name.replace(/\.ts$/, ".js"))),
    ], { cwd: root, stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
