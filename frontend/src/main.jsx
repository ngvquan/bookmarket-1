// Điểm khởi động React; bọc router và ErrorBoundary cho toàn bộ giao diện.
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles/styles.css";
import "./styles/marketplace.css";
import "./styles/commerce.css";
import "./styles/seller-layout.css";
import "./styles/chat.css";
import "./styles/shop-registration.css";
import "./styles/mobile-app.css";
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </BrowserRouter>,
);
