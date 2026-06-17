import { createRoot } from "react-dom/client";
import { installApiBase } from "./app/api-base";
import App from "./app/App.tsx";
import "./styles/index.css";

// Перенаправляем API на прод-домен, если запущены как упакованное приложение (Tauri).
installApiBase();

createRoot(document.getElementById("root")!).render(<App />);
