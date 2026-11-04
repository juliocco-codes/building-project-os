import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const errors = [];
const slug = text => text.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, "").replace(/\s/g, "-");
function anchors(file) {
  const counts = new Map();
  return readFileSync(file, "utf8").split("\n").filter(line => /^#{1,6} /.test(line)).map(line => {
    const base = slug(line.replace(/^#+ /, ""));
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  });
}
for (const file of files.filter(file => file.endsWith(".md"))) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^https?:\/\//.test(href)) continue;
    if (/^[a-z]+:/i.test(href)) { errors.push(`${file}: unsupported local link ${href}`); continue; }
    const [relative, anchor] = href.split("#");
    const target = relative ? resolve(dirname(file), decodeURIComponent(relative)) : resolve(file);
    if (!existsSync(target)) errors.push(`${file}: missing ${href}`);
    else if (anchor && target.endsWith(".md") && !anchors(target).includes(decodeURIComponent(anchor))) errors.push(`${file}: missing anchor ${href}`);
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log("Local Markdown links and heading anchors passed (remote URLs not fetched).");
