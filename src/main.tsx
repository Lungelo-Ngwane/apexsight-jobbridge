// src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";           // adjust path if needed
import "./styles/index.css";
import { AuthProvider } from "./app/context/AuthContext.tsx";
import React from "react";
import { BrowserRouter } from "react-router-dom";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);