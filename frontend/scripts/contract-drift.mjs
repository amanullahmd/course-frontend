#!/usr/bin/env node
/**
 * Contract drift check: every endpoint the frontend API client calls (src/lib/api/**) must exist in the backend's
 * committed OpenAPI snapshot (backend/openapi/openapi.json) with the same HTTP method. Optionally (default on) the
 * fields of TypeScript DTO interfaces are compared with the OpenAPI schema of the same name.
 *
 *   node scripts/contract-drift.mjs [--spec ../backend/openapi/openapi.json] [--api-dir src/lib/api]
 *                                   [--types src/lib/api/types.ts] [--no-dto] [--dto-warn-only]
 *                                   [--dto-ignore Name] [--json report.json]
 *
 * Exit code 1 when an endpoint is missing (or, unless --dto-warn-only, a TS DTO declares a field the backend does
 * not have). Fields the backend has but the TS type lacks are only reported.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, "..");

function parseArgs(argv) {
  const args = {
    spec: resolve(frontendDir, "../backend/openapi/openapi.json"),
    apiDir: resolve(frontendDir, "src/lib/api"),
    types: resolve(frontendDir, "src/lib/api/types.ts"),
    dto: true,
    dtoWarnOnly: false,
    // RFC 7807 ProblemDetail: the backend adds code/errors/traceId as dynamic extension properties.
    dtoIgnore: new Set(["ProblemDetail"]),
    json: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--spec") args.spec = resolve(argv[++i]);
    else if (a === "--api-dir") args.apiDir = resolve(argv[++i]);
    else if (a === "--types") args.types = resolve(argv[++i]);
    else if (a === "--no-dto") args.dto = false;
    else if (a === "--dto-warn-only") args.dtoWarnOnly = true;
    else if (a === "--dto-ignore") args.dtoIgnore.add(argv[++i]);
    else if (a === "--json") args.json = resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------------------------------------------
// Source scanning
// ---------------------------------------------------------------------------------------------------------------
function listSources(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listSources(path));
    else if (/\.(ts|tsx|mts)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

/** Strips // and /* comments (keeps string contents and line numbers). */
function stripComments(code) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
    } else if (ch === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") i += 1;
    } else if (ch === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const chunk = code.slice(i, end === -1 ? code.length : end + 2);
      out += chunk.replace(/[^\n]/g, " ");
      i += chunk.length;
    } else {
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      out += ch;
      i += 1;
    }
  }
  return out;
}

/** Reads a string/template literal starting at `i` (which must be a quote). Returns [value, endIndex]. */
function readLiteral(code, i) {
  const quote = code[i];
  let j = i + 1;
  let value = "";
  while (j < code.length) {
    const ch = code[j];
    if (ch === "\\") {
      value += code[j + 1];
      j += 2;
      continue;
    }
    if (ch === quote) return [value, j + 1];
    if (quote === "`" && ch === "$" && code[j + 1] === "{") {
      let depth = 1;
      let k = j + 2;
      while (k < code.length && depth > 0) {
        if (code[k] === "{") depth += 1;
        else if (code[k] === "}") depth -= 1;
        k += 1;
      }
      value += "${" + code.slice(j + 2, k - 1).trim() + "}";
      j = k;
      continue;
    }
    value += ch;
    j += 1;
  }
  return [value, j];
}

function skipWs(code, i) {
  while (i < code.length && /\s/.test(code[i])) i += 1;
  return i;
}

/** Skips a balanced `<...>` generic argument list (if present). */
function skipGenerics(code, i) {
  i = skipWs(code, i);
  if (code[i] !== "<") return i;
  let depth = 0;
  for (; i < code.length; i += 1) {
    if (code[i] === "<") depth += 1;
    else if (code[i] === ">" && code[i - 1] !== "=") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return i;
}

const lineOf = (code, index) => code.slice(0, index).split("\n").length;

function stringConstants(code) {
  const consts = new Map();
  for (const m of code.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*(["'`])/g)) {
    const [value] = readLiteral(code, m.index + m[0].length - 1);
    if (value.startsWith("/api") || value.includes("/api/")) consts.set(m[1], value);
  }
  return consts;
}

/** `${base}/x/${encodeURIComponent(id)}?q=1` → `/api/instructor/x/{}` (null if it is not an API path). */
function normalizeClientPath(raw, consts) {
  let path = raw.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (all, name) => (consts.has(name) ? consts.get(name) : all));
  path = path.replace(/^\$\{\s*(API_URL|SERVER_API_URL)\s*\}/, "");
  const at = path.indexOf("/api/");
  if (at === -1) return null;
  if (at > 0 && !/^https?:\/\/[^/]+$/.test(path.slice(0, at))) return null;
  path = path.slice(at);
  path = path.split("?")[0].split("#")[0];
  path = path.replace(/\$\{[^}]*\}/g, "{}");
  path = path.replace(/\/+$/, "");
  return path || null;
}

function collectClientCalls(files) {
  const calls = [];
  const literals = [];
  for (const file of files) {
    const code = stripComments(readFileSync(file, "utf8"));
    const consts = stringConstants(code);
    const add = (method, raw, index) => {
      const path = normalizeClientPath(raw, consts);
      if (path) calls.push({ method, path, raw, file: relative(frontendDir, file), line: lineOf(code, index) });
    };

    // api.get / api.post / api.put / api.patch / api.delete (path is the first argument)
    for (const m of code.matchAll(/\bapi\.(get|post|put|patch|delete)\b/g)) {
      let i = skipGenerics(code, m.index + m[0].length);
      i = skipWs(code, i);
      if (code[i] !== "(") continue;
      i = skipWs(code, i + 1);
      if (!["'", '"', "`"].includes(code[i])) continue;
      const [raw] = readLiteral(code, i);
      add(m[1].toUpperCase(), raw, m.index);
    }

    // apiFetch(path, { method: "X" }) / serverGet(path) with a literal path
    for (const m of code.matchAll(/\b(apiFetch|serverGet)\b/g)) {
      let i = skipGenerics(code, m.index + m[0].length);
      i = skipWs(code, i);
      if (code[i] !== "(") continue;
      i = skipWs(code, i + 1);
      if (!["'", '"', "`"].includes(code[i])) continue;
      const [raw, end] = readLiteral(code, i);
      const method = /method:\s*["'](\w+)["']/.exec(code.slice(end, end + 200))?.[1] ?? "GET";
      add(method.toUpperCase(), raw, m.index);
    }

    // fetch(`${API_URL}/api/...`, { method: "POST" })
    for (const m of code.matchAll(/\bfetch\s*\(\s*(["'`])/g)) {
      const [raw, end] = readLiteral(code, m.index + m[0].length - 1);
      const method = /^[^)]*?method:\s*["'](\w+)["']/s.exec(code.slice(end, end + 300))?.[1] ?? "GET";
      add(method.toUpperCase(), raw, m.index);
    }

    // Path literals that are built here and requested elsewhere (CSV/PDF download URLs …): path must exist (any method).
    for (const m of code.matchAll(/(["'`])/g)) {
      if (m.index > 0 && code[m.index - 1] === "\\") continue;
      const [raw] = readLiteral(code, m.index);
      if (!/^(\$\{\s*[\w$]+\s*\})?\/api\//.test(raw) && !/^\$\{\s*[\w$]+\s*\}\//.test(raw)) continue;
      if ([...consts.values()].includes(raw)) continue; // the base-path constant itself
      const path = normalizeClientPath(raw, consts);
      if (path && !calls.some((c) => c.file === relative(frontendDir, file) && c.path === path)) {
        literals.push({ method: "ANY", path, raw, file: relative(frontendDir, file), line: lineOf(code, m.index) });
      }
    }

    // xhr.open("POST", `${API_URL}/api/media`)
    for (const m of code.matchAll(/\.open\(\s*["'](\w+)["']\s*,\s*(["'`])/g)) {
      const [raw] = readLiteral(code, m.index + m[0].length - 1);
      add(m[1].toUpperCase(), raw, m.index);
    }
  }
  // A literal is only interesting when no call with the same path was found anywhere.
  const called = new Set(calls.map((c) => c.path));
  const seenLiteral = new Set();
  for (const l of literals) {
    if (called.has(l.path) || seenLiteral.has(l.path)) continue;
    seenLiteral.add(l.path);
    calls.push(l);
  }
  return calls;
}

// ---------------------------------------------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------------------------------------------
const normalizeSpecPath = (path) => path.replace(/\{[^}]+\}/g, "{}").replace(/\/+$/, "");
const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options"];

function specOperations(spec) {
  const ops = new Map(); // normalized path → Set(methods)
  const original = new Map();
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    const key = normalizeSpecPath(path);
    const methods = ops.get(key) ?? new Set();
    for (const m of HTTP_METHODS) if (item[m]) methods.add(m.toUpperCase());
    ops.set(key, methods);
    original.set(key, path);
  }
  return { ops, original };
}

function resolveRef(spec, ref) {
  return ref.replace(/^#\//, "").split("/").reduce((node, key) => node?.[key], spec);
}

function schemaProperties(spec, schema, seen = new Set()) {
  if (!schema) return new Set();
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return new Set();
    seen.add(schema.$ref);
    return schemaProperties(spec, resolveRef(spec, schema.$ref), seen);
  }
  const props = new Set(Object.keys(schema.properties ?? {}));
  for (const part of [...(schema.allOf ?? [])]) for (const p of schemaProperties(spec, part, seen)) props.add(p);
  return props;
}

// ---------------------------------------------------------------------------------------------------------------
// TypeScript DTOs (interfaces in types.ts, incl. `extends` and `Omit<…>`)
// ---------------------------------------------------------------------------------------------------------------
function readBlock(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") {
      depth -= 1;
      if (depth === 0) return [code.slice(open + 1, i), i + 1];
    }
  }
  return [code.slice(open + 1), code.length];
}

function topLevelFields(body) {
  const fields = new Set();
  let depth = 0;
  let line = "";
  for (const ch of body) {
    if (ch === "{" || ch === "(" || ch === "[" || ch === "<") depth += 1;
    if (ch === "}" || ch === ")" || ch === "]" || ch === ">") depth -= 1;
    if ((ch === ";" || ch === "\n") && depth === 0) {
      const m = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/.exec(line);
      if (m) fields.add(m[1]);
      line = "";
    } else if (depth === 0 || (depth === 1 && ch === "{")) line += ch;
    else line += depth > 0 ? "" : ch;
  }
  const m = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/.exec(line);
  if (m) fields.add(m[1]);
  return fields;
}

function parseInterfaces(code) {
  code = stripComments(code);
  const raw = new Map();
  for (const m of code.matchAll(/export\s+interface\s+([A-Za-z_$][\w$]*)(<[^>{]*>)?\s*(?:extends\s+([^{]+))?\{/g)) {
    const [body] = readBlock(code, m.index + m[0].length - 1);
    raw.set(m[1], { own: topLevelFields(body), parents: (m[3] ?? "").trim() });
  }
  const resolved = new Map();
  const fieldsOf = (name, stack = []) => {
    if (resolved.has(name)) return resolved.get(name);
    const entry = raw.get(name);
    if (!entry || stack.includes(name)) return null;
    const fields = new Set(entry.own);
    // extends A, Omit<B, "x" | "y">, Pick<…> is treated like the full parent
    for (const parent of entry.parents.split(/,(?![^<]*>)/).map((p) => p.trim()).filter(Boolean)) {
      const omit = /^Omit<\s*([\w$]+)\s*,\s*([^>]+)>$/.exec(parent);
      const base = omit ? omit[1] : parent.replace(/<.*$/, "");
      const parentFields = fieldsOf(base, [...stack, name]);
      if (!parentFields) continue;
      const omitted = omit ? new Set([...omit[2].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])) : new Set();
      for (const f of parentFields) if (!omitted.has(f)) fields.add(f);
    }
    resolved.set(name, fields);
    return fields;
  };
  for (const name of raw.keys()) fieldsOf(name);
  return resolved;
}

// ---------------------------------------------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv);
  const spec = JSON.parse(readFileSync(args.spec, "utf8"));
  const { ops, original } = specOperations(spec);
  const calls = collectClientCalls(listSources(args.apiDir));

  const segmentsMatch = (clientPath, specPath) => {
    const a = clientPath.split("/");
    const b = specPath.split("/");
    return a.length === b.length && a.every((seg, i) => seg === b[i] || seg === "{}" || b[i] === "{}");
  };
  const matchingPaths = (clientPath) =>
    ops.has(clientPath) ? [clientPath] : [...ops.keys()].filter((p) => segmentsMatch(clientPath, p));

  const missing = [];
  const wrongMethod = [];
  const seen = new Set();
  const usedOps = new Set();
  for (const call of calls) {
    const key = `${call.method} ${call.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const paths = matchingPaths(call.path);
    if (paths.length === 0) {
      missing.push(call);
      continue;
    }
    const allowed = new Set(paths.flatMap((p) => [...ops.get(p)]));
    if (call.method !== "ANY" && !allowed.has(call.method)) {
      wrongMethod.push({ ...call, allowed: [...allowed] });
      continue;
    }
    for (const p of paths) for (const m of ops.get(p)) if (call.method === "ANY" || m === call.method) usedOps.add(`${m} ${p}`);
  }

  const unused = [...ops.entries()]
    .flatMap(([path, methods]) => [...methods].map((m) => `${m} ${path}`))
    .filter((key) => !usedOps.has(key) && !/ \/error$/.test(key))
    .map((key) => key.replace(/ (.*)$/, (_, p) => ` ${original.get(p)}`));

  const dtoErrors = [];
  const dtoInfo = [];
  let compared = 0;
  if (args.dto) {
    const interfaces = parseInterfaces(readFileSync(args.types, "utf8"));
    const schemas = spec.components?.schemas ?? {};
    for (const [name, fields] of interfaces) {
      if (!schemas[name] || args.dtoIgnore.has(name)) continue;
      const props = schemaProperties(spec, schemas[name]);
      if (props.size === 0) continue;
      compared += 1;
      const extra = [...fields].filter((f) => !props.has(f));
      const absent = [...props].filter((p) => !fields.has(p));
      if (extra.length) dtoErrors.push({ name, fields: extra, schemaFields: [...props] });
      if (absent.length) dtoInfo.push({ name, fields: absent });
    }
  }

  // ---- report ----
  const relSpec = relative(process.cwd(), args.spec);
  console.log(`Contract drift check: ${seen.size} endpoint reference(s) in the frontend vs ${relSpec} (${ops.size} paths)\n`);
  for (const c of missing) {
    console.log(`  MISSING   ${c.method} ${c.path}   (${c.file}:${c.line})`);
    if (process.env.GITHUB_ACTIONS) console.log(`::error file=frontend/${c.file},line=${c.line}::${c.method} ${c.path} is not in the OpenAPI snapshot`);
  }
  for (const c of wrongMethod) {
    console.log(`  METHOD    ${c.method} ${c.path}   backend allows ${c.allowed.join(", ")}   (${c.file}:${c.line})`);
    if (process.env.GITHUB_ACTIONS) console.log(`::error file=frontend/${c.file},line=${c.line}::${c.method} ${c.path}: backend allows ${c.allowed.join(", ")}`);
  }
  if (!missing.length && !wrongMethod.length) console.log("  All endpoints used by the frontend exist in the backend contract.");

  if (args.dto) {
    console.log(`\nDTO fields: compared ${compared} TypeScript interface(s) with OpenAPI schemas of the same name`);
    for (const d of dtoErrors) {
      console.log(`  ${args.dtoWarnOnly ? "WARN" : "UNKNOWN"}   ${d.name}: ${d.fields.join(", ")} not in the backend schema`);
    }
    for (const d of dtoInfo) console.log(`  info      ${d.name}: backend also sends ${d.fields.join(", ")}`);
  }
  if (unused.length) {
    console.log(`\n${unused.length} backend operation(s) not called from src/lib/api (informational):`);
    for (const u of unused) console.log(`  - ${u}`);
  }

  if (args.json) {
    writeFileSync(args.json, JSON.stringify({ missing, wrongMethod, dtoErrors, dtoInfo, unused }, null, 2));
  }

  const failed = missing.length > 0 || wrongMethod.length > 0 || (!args.dtoWarnOnly && dtoErrors.length > 0);
  console.log(failed ? "\nResult: DRIFT DETECTED" : "\nResult: no drift");
  process.exit(failed ? 1 : 0);
}

main();
