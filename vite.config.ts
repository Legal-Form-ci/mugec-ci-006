import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Use Nitro Vercel preset ONLY when building for Vercel.
// Lovable (Cloudflare Workers) publish needs the default tanstackStart
// Cloudflare Worker output. Importing `nitro/vite` statically pulls h3 v2
// into the Worker bundle and breaks it with:
//   "No such module assets/h3-v2"
// So we load nitro dynamically only when actually targeting Vercel.
const isVercelBuild = !!process.env.VERCEL || process.env.LOVABLE_TARGET === "vercel";

export default defineConfig(async ({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(loadedEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  const nitroPlugins: PluginOption[] = [];
  if (isVercelBuild) {
    const { nitro } = await import("nitro/vite");
    nitroPlugins.push(nitro({ preset: "vercel" }));
  }

  return {
    define: envDefine,
    server: { host: "::", port: 8080, strictPort: true },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        server: { entry: "server" },
      }),
      ...nitroPlugins,
      viteReact(),
    ],
  };
});
