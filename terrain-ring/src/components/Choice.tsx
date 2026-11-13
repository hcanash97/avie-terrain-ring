import { useId, type ReactNode } from "react";

/** Native radios retain browser arrow-key behaviour and a single tab stop per group. */
export function Choice<T extends string>(props: {
  label: ReactNode;
  value: T;
  options: { value: T; label: string; note?: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  variant?: "plain" | "card";
}) {
  const name = useId();
  return (
    <fieldset className="choice">
      <legend className="choice-label">{props.label}</legend>
      <div className={`choice-row ${props.variant ?? "plain"}`}>
        {props.options.map((o) => {
          const id = `${name}-${o.value}`;
          return <label key={o.value} className={`choice-option ${props.value === o.value ? "on" : ""}`}>
            <input type="radio" aria-label={o.label} name={name} value={o.value} checked={props.value === o.value}
              aria-describedby={o.note ? `${id}-note` : undefined} onChange={() => props.onChange(o.value)} />
            {o.icon && <span className="choice-visual" aria-hidden="true">{o.icon}</span>}
            <span className="choice-title">{o.label}</span>
            {o.note && <small id={`${id}-note`}>{o.note}</small>}
          </label>;
        })}
      </div>
    </fieldset>
  );
}
