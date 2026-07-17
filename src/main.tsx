import "./index.css";
import App from "./App.tsx";

// Make the component available for the shell to load via window
declare global {
  interface Window {
    __MINIAPP_APP__?: typeof App;
  }
}
window.__MINIAPP_APP__ = App;

export { App };
