import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./theme/tokens.css";
import "combobulate/styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
