import { describe, expect, it } from "vitest";
import de from "../../messages/de.json";
import en from "../../messages/en.json";

type Messages = { [key: string]: string | Messages };

/** Flattens nested message objects into `a.b.c → text`. */
function flatten(messages: Messages, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      for (const [k, v] of flatten(value as Messages, path)) out.set(k, v);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

/**
 * Names of the ICU arguments used in a message (`{name}`, `{count, plural, one {# Kurs} other {# Kurse}}` …),
 * including arguments nested inside plural/select branches. Branch texts are not arguments.
 */
function icuArguments(message: string): Set<string> {
  const args = new Set<string>();
  let i = 0;

  const skipQuoted = () => {
    // ICU escaping: '{' … ' is literal text; '' is a single apostrophe.
    if (message[i] === "'" && (message[i + 1] === "{" || message[i + 1] === "}")) {
      const end = message.indexOf("'", i + 1);
      i = end === -1 ? message.length : end + 1;
      return true;
    }
    return false;
  };

  const parseMessage = (stopAtClose: boolean) => {
    while (i < message.length) {
      if (skipQuoted()) continue;
      const ch = message[i];
      if (ch === "{") {
        i += 1;
        parseArgument();
      } else if (ch === "}" && stopAtClose) {
        i += 1;
        return;
      } else {
        i += 1;
      }
    }
  };

  const parseArgument = () => {
    const match = /^\s*([^\s,{}]+)\s*([,}])/.exec(message.slice(i));
    if (!match) throw new Error(`Invalid ICU argument in "${message}"`);
    args.add(match[1]);
    i += match[0].length;
    if (match[2] === "}") return;
    const type = /^\s*(\w+)\s*(,|})/.exec(message.slice(i));
    if (!type) throw new Error(`Invalid ICU argument type in "${message}"`);
    i += type[0].length;
    if (type[2] === "}") return;
    if (["plural", "select", "selectordinal"].includes(type[1])) {
      // `key {message} key {message} … }`
      while (i < message.length) {
        const branch = /^\s*(}|[^\s{}]+\s*\{)/.exec(message.slice(i));
        if (!branch) throw new Error(`Invalid ICU branch in "${message}"`);
        i += branch[0].length;
        if (branch[1] === "}") return;
        parseMessage(true);
      }
    } else {
      // number/date/time styles: skip to the closing brace
      const end = message.indexOf("}", i);
      i = end === -1 ? message.length : end + 1;
    }
  };

  parseMessage(false);
  return args;
}

const enFlat = flatten(en as Messages);
const deFlat = flatten(de as Messages);

describe("message catalogues (messages/en.json, messages/de.json)", () => {
  it("have exactly the same keys", () => {
    const missingInDe = [...enFlat.keys()].filter((k) => !deFlat.has(k));
    const missingInEn = [...deFlat.keys()].filter((k) => !enFlat.has(k));
    expect({ missingInDe, missingInEn }).toEqual({ missingInDe: [], missingInEn: [] });
  });

  it("contain only non-empty strings", () => {
    const invalid = (flat: Map<string, unknown>) =>
      [...flat.entries()].filter(([, v]) => typeof v !== "string" || v.trim() === "").map(([k]) => k);
    expect({ en: invalid(enFlat), de: invalid(deFlat) }).toEqual({ en: [], de: [] });
  });

  it("use the same ICU arguments in both languages", () => {
    const mismatches: string[] = [];
    for (const [key, value] of enFlat) {
      const other = deFlat.get(key);
      if (typeof value !== "string" || typeof other !== "string") continue;
      const a = [...icuArguments(value)].sort();
      const b = [...icuArguments(other)].sort();
      if (a.join() !== b.join()) mismatches.push(`${key}: en {${a.join(", ")}} vs de {${b.join(", ")}}`);
    }
    expect(mismatches).toEqual([]);
  });

  it("have balanced ICU braces", () => {
    const broken: string[] = [];
    for (const [locale, flat] of [["en", enFlat], ["de", deFlat]] as const) {
      for (const [key, value] of flat) {
        if (typeof value !== "string") continue;
        try {
          icuArguments(value);
        } catch {
          broken.push(`${locale}:${key}`);
        }
        let depth = 0;
        for (const ch of value.replace(/'[{}][^']*'/g, "")) {
          if (ch === "{") depth += 1;
          if (ch === "}") depth -= 1;
          if (depth < 0) break;
        }
        if (depth !== 0) broken.push(`${locale}:${key}`);
      }
    }
    expect([...new Set(broken)]).toEqual([]);
  });

  it("are actually translated (German differs from English for most texts)", () => {
    let same = 0;
    for (const [key, value] of enFlat) if (deFlat.get(key) === value) same += 1;
    // Brand names, CEFR levels, "E-Mail"/"Name" etc. may be identical; whole sections must not be.
    expect(same / enFlat.size).toBeLessThan(0.15);
  });
});

describe("icuArguments", () => {
  it("finds simple and nested arguments but not branch texts", () => {
    expect([...icuArguments("Hello {name}")]).toEqual(["name"]);
    expect([...icuArguments("{count, plural, one {# course} other {# courses}}")]).toEqual(["count"]);
    expect([...icuArguments("{count, plural, one {{name} has one} other {{name} has #}}")].sort()).toEqual([
      "count",
      "name",
    ]);
    expect([...icuArguments("{role, select, ADMIN {Admin} other {User}}")]).toEqual(["role"]);
    expect([...icuArguments("No arguments here")]).toEqual([]);
    expect([...icuArguments("Literal '{braces}' only")]).toEqual([]);
  });
});
