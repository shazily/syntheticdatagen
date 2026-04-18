import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const canonicalBlog = path.resolve(
  __dirname,
  "../../../docs/agentic-api-series/interactive-cbdc-blog"
);

/** Ensures GA4 (gtag) is present on every built HTML entry if a template ever omits it. */
function googleAnalyticsInjectionPlugin() {
  const measurementId = "G-QZ9NFYW2F0";
  const snippet = `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${measurementId}');
    </script>`;
  return {
    name: "html-inject-google-analytics",
    transformIndexHtml(html) {
      if (/googletagmanager\.com\/gtag\/js/i.test(html)) return html;
      return html.replace(/<head(\s[^>]*)?>/i, (open) => `${open}${snippet}`);
    },
  };
}

export default defineConfig({
  plugins: [googleAnalyticsInjectionPlugin(), react()],
  base: "./",
  build: {
    outDir: "live",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        "part-1": path.resolve(__dirname, "part-1.html"),
        "part-2": path.resolve(__dirname, "part-2.html"),
        "part-3": path.resolve(__dirname, "part-3.html"),
        "part-4": path.resolve(__dirname, "part-4.html"),
        "part-5": path.resolve(__dirname, "part-5.html"),
        "part-6": path.resolve(__dirname, "part-6.html"),
        "part-7": path.resolve(__dirname, "part-7.html"),
        "part-8": path.resolve(__dirname, "part-8.html"),
      },
    },
  },
  server: {
    fs: {
      allow: [canonicalBlog, path.resolve(__dirname, "../../..")],
    },
  },
  resolve: {
    alias: {
      "@canonical": canonicalBlog,
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "lucide-react": path.resolve(__dirname, "node_modules/lucide-react"),
    },
    dedupe: ["react", "react-dom"],
  },
});
