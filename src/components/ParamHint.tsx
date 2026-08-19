import { useId } from "react";

type Props = {
  label: string;
  hint: string;
};

export function ParamHint({ label, hint }: Props) {
  const id = useId();
  return (
    <span className="hint-wrap">
      <button type="button" className="hint-btn" aria-label={`Sobre ${label}`} aria-describedby={id}>
        ?
      </button>
      <span className="hint-pop" role="tooltip" id={id}>
        {hint}
      </span>
    </span>
  );
}
