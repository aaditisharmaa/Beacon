import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Avatar from "./Avatar.jsx";
import SpriteTest from "./SpriteTest.jsx";

const hash = window.location.hash;
const isAvatar = hash === "#/avatar";
if (isAvatar) document.documentElement.classList.add("avatar-mode");

const page = isAvatar ? (
  <Avatar />
) : hash === "#/sprite-test" ? (
  <SpriteTest />
) : (
  <App />
);

createRoot(document.getElementById("root")).render(
  <StrictMode>{page}</StrictMode>
);