import type { ReactNode } from "react";

export function ErrorBanner({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  return <div className={`banner ${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
