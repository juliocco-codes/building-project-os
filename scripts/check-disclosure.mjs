import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Deliberately narrow tripwires, not a secret detector or disclosure approval.
export function disclosureFindings(path, content) {
  const findings = [];
  if (/(^|\/)(\.env(?:\..+)?|state|private|memory|credentials|browser-profile)(\/|$)/i.test(path)
    && !path.endsWith(".env.example")) findings.push("private file or runtime directory");
  const patterns = [
    ["absolute personal home path", /\/(?:Users|home)\/[a-z0-9_.-]+\//i],
    ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["credential token", /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})/],
    ["bearer credential", /Bearer\s+[A-Za-z0-9_.-]{24,}/],
  ];
  for (const [label, pattern] of patterns) if (pattern.test(content)) findings.push(label);
  return findings.map(finding => `${path}: ${finding}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const errors = files.flatMap(file => disclosureFindings(file, readFileSync(file, "utf8")));
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
  else console.log("Disclosure tripwires passed. Review the complete outgoing diff and ancestry separately.");
}
