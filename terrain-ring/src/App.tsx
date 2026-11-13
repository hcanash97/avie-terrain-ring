import { lazy, Suspense, useEffect, useState } from "react";
import { Configurator } from "./components/Configurator";

// Internal prototype preview, loaded only when its address is opened.
const PendantPreview = lazy(() => import("./components/PendantPreview").then((m) => ({ default: m.PendantPreview })));

const PENDANT_HASH = "#pendant-preview";

export function App() {
  // Follow the address so a link can switch views without a full reload.
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  if (hash === PENDANT_HASH)
    return (
      <Suspense fallback={null}>
        <PendantPreview />
      </Suspense>
    );
  return <Configurator />;
}
