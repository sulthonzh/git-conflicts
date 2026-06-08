import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  esbuildOptions(options) {
    // Only add shebang to CJS output for Node.js compatibility
    if (options.format === 'cjs') {
      options.banner = { js: '#!/usr/bin/env node' };
    }
  },
});
