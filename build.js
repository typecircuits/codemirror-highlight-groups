import { build } from "esbuild";

await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: "dist/index.js",
});
