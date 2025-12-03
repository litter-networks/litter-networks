import React from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App/App";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import "./styles/base.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary name="Root">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
