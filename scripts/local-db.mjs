// Development only. Keep the server in the foreground; no system services or users are created.
import { spawn } from "node:child_process";
import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
const pkg = `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
const { initdb, postgres } = await import(pkg);
const directory = path.resolve(".local-db");
await mkdir(directory, { recursive: true });
const run = (exe, args) => new Promise((resolve, reject) => { const child = spawn(exe, args, { stdio: "inherit", windowsHide: true, env: process.env }); child.on("error", reject); child.on("exit", code => code === 0 ? resolve() : reject(new Error(`PostgreSQL exited with ${code}`))); });
let initialized = true; try { await access(path.join(directory, "PG_VERSION")); } catch { initialized = false; }
if (!initialized) {
  await mkdir(path.resolve(".data"), { recursive: true });
  const passwordFile = path.join(path.resolve(".data"), `init-${randomUUID()}`);
  await writeFile(passwordFile, "rentops_local\n", { mode: 0o600, flag: "wx" });
  try { await run(initdb, ["-D", directory, "--username=rentops", "--auth=scram-sha-256", `--pwfile=${passwordFile}`, "--encoding=UTF8", "--locale=C"]); }
  finally { await unlink(passwordFile); }
}
const server = spawn(postgres, ["-D", directory, "-h", "127.0.0.1", "-p", "55432"], { stdio: "inherit", windowsHide: true, env: process.env });
let stopping = false;
const stop = () => { if (!stopping) { stopping = true; server.kill("SIGTERM"); } };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
server.on("exit", code => { process.exitCode = stopping ? 0 : code || 0; });
const client = new Client({ connectionString: "postgresql://rentops:rentops_local@127.0.0.1:55432/postgres" });
for (let attempt = 0; attempt < 50; attempt++) {
  const probe = new Client({ connectionString: "postgresql://rentops:rentops_local@127.0.0.1:55432/postgres" });
  try { await probe.connect(); await probe.end(); break; } catch { await probe.end().catch(() => {}); if (attempt === 49) { stop(); throw new Error("Local PostgreSQL did not become ready."); } await new Promise(r => setTimeout(r, 200)); }
}
await client.connect();
if (!(await client.query("SELECT 1 FROM pg_database WHERE datname = 'rentops'")).rowCount) await client.query('CREATE DATABASE "rentops"');
await client.end();
console.log("Local database ready on 127.0.0.1:55432. Keep this terminal open. Development credentials only.");
