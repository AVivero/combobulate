import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "combobulate/styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
