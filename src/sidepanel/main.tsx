import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../styles/global.css";
import "../styles/warm-utility.css";
import "../styles/warm-utility-finish.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
