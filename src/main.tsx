import React from "react";
import ReactDOM from "react-dom/client";
import "antd/dist/reset.css";
import { I18nProvider } from "./i18n";
import "./styles/global.css";
import { ThemeProvider } from "./theme";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>
);
