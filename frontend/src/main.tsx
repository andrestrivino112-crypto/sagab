import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./app/App.tsx";
import { ToastProvider } from "./app/components/Toast.tsx";
import "./styles/index.css";
import "./styles/toast.css";

// HashRouter (en vez de BrowserRouter): las rutas viven en el fragmento (#/dashboard) y el
// servidor solo necesita seguir sirviendo index.html en "/", sin configurar un rewrite de SPA
// en el hosting — evita 404 en despliegues donde no se controla esa configuración.
createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <ToastProvider>
      <App />
    </ToastProvider>
  </HashRouter>
);
