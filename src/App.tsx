import { MemoryRouter } from "react-router";
import TestMiniApp from "./components/MiniApp";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PlatformSDKProvider } from "./providers/SdkProvider"
import { toRoutePath } from "./routes"
import "./index.css";

function resolveInitialEntry(initialPath?: string): string {
  const hash = window.location.hash.replace(/^#/, "");
  const raw = hash || initialPath || "/";
  return toRoutePath(raw);
}

export default function App({ initialPath }: { initialPath?: string }) {
  return (
    <ErrorBoundary>
      <MemoryRouter initialEntries={[resolveInitialEntry(initialPath)]}>
        <PlatformSDKProvider>
          <TestMiniApp />
        </PlatformSDKProvider>
      </MemoryRouter>
    </ErrorBoundary>
  );
}
