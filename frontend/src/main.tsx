
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { ToastProvider } from "./app/components/Toast.tsx";
  import "./styles/index.css";
  import "./styles/toast.css";

  createRoot(document.getElementById("root")!).render(
    <ToastProvider>
      <App />
    </ToastProvider>
  );
