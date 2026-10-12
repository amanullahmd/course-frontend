import { z } from "zod";

// Zod 4 probes `new Function("")` once to decide whether it may JIT-compile parsers. Under the site's CSP (no
// 'unsafe-eval') that probe is reported as a CSP violation, so disable the JIT up front (validation still works).
z.config({ jitless: true });
