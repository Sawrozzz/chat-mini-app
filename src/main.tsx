import {createRoot} from "react-dom/client"
import "./index.css";
import App from "./App.tsx";

export function mount(container: HTMLElement){
  const root = createRoot(container);
  root.render(<App />);
  (container as any).__root = root;
}

export function unmount(container: HTMLElement) {
  (container as any).__root?.unmount()
}
