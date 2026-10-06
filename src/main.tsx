// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { AppErrorBoundary } from "./app/components/AppErrorBoundary";
import { AuthProvider } from "./app/context/AuthContext";
import { ThemeProvider } from "./app/context/ThemeContext";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AppErrorBoundary><AuthProvider>
          <App />
        </AuthProvider></AppErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
