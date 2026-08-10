import { createRoot, type Root } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

export function mount(
  container: HTMLElement,
  runtime?: { initialPath?: string },
) {
  const root: Root = createRoot(container);
  root.render(<App initialPath={runtime?.initialPath} />);

  return {
    unmount() {
      root.unmount();

    },
  };
}
