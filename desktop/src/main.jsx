import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Avatar from "./Avatar.jsx";

const isAvatar = window.location.hash === "#/avatar";
if (isAvatar) document.documentElement.classList.add("avatar-mode");

createRoot(document.getElementById("root")).render(
  <StrictMode>{isAvatar ? <Avatar /> : <App />}</StrictMode>
);