import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { App, LiveApp } from "./App";
import "./style.css";
const url = import.meta.env.VITE_GOOGLE_CLIENT_ID
  ? import.meta.env.VITE_CONVEX_URL
  : undefined;
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {url ? (
      <ConvexAuthProvider client={new ConvexReactClient(url)}>
        <LiveApp />
      </ConvexAuthProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
