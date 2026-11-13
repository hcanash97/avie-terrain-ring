import { lazy, Suspense } from "react";
import { Configurator } from "./components/Configurator";

// Internal prototype preview, loaded only when its address is opened.
const PendantPreview = lazy(() => import("./components/PendantPreview").then((m) => ({ default: m.PendantPreview })));

export function App() {
  if (location.hash === "#pendant-preview")
    return (
      <Suspense fallback={null}>
        <PendantPreview />
      </Suspense>
    );
  return <Configurator />;
}
