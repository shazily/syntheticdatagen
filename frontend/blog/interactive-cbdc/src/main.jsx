import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@canonical/AgenticInteractiveBlog.jsx";
import { BlogShareComments, BlogSiteFooter } from "./BlogFooter.jsx";
import "./index.css";
/* After Tailwind base: site tokens + .footer (blog.css does not define footer) */
import "../../../style.css";
import "../../blog.css";

const raw =
  document.documentElement.dataset.initialTab ??
  new URLSearchParams(window.location.search).get("tab");
const parsed = parseInt(String(raw), 10);
const initialTab =
  Number.isFinite(parsed) && parsed >= 1 && parsed <= 8 ? parsed : 1;

document.body.classList.add("blog-body");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App
      initialTab={initialTab}
      endOfMain={<BlogShareComments />}
      belowShell={<BlogSiteFooter />}
    />
  </StrictMode>
);
