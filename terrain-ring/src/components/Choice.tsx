import type { ReactNode } from "react";

export function Choice<T extends string>(props: {
  label: ReactNode;
  value: T;
  options: { value: T; label: string; note?: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  variant?: "plain" | "card";
}) {
  return (
    <div className="choice">
      <span className="choice-label">{props.label}</span>
      <div className={`choice-row ${props.variant ?? "plain"}`} role="radiogroup">
        {props.options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={props.value === o.value}
            className={props.value === o.value ? "on" : ""}
            onClick={() => props.onChange(o.value)}
          >
            {o.icon}
            <span>
              {o.label}
              {o.note && <small>{o.note}</small>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
