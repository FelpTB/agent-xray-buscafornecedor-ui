import type { FormEvent } from "react";
import type { SearchPrefs } from "../lib/searchPrefs";
import { SearchPrefsControls } from "./SearchPrefsControls";

type Props = {
  value: string;
  disabled?: boolean;
  prefs: SearchPrefs;
  onChange: (value: string) => void;
  onPrefsChange: (next: SearchPrefs) => void;
  onSubmit: () => void;
};

export function Composer({ value, disabled, prefs, onChange, onPrefsChange, onSubmit }: Props) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit();
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-row">
        <label className="sr-only" htmlFor="message">
          Mensagem para o assistente
        </label>
        <textarea
          id="message"
          rows={2}
          value={value}
          disabled={disabled}
          placeholder="Descreva o que você precisa comprar — produto, região, tipo de empresa…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!value.trim() || disabled) return;
              onSubmit();
            }
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={disabled || !value.trim()}>
          Enviar
        </button>
      </div>
      <SearchPrefsControls
        idPrefix="composer"
        compact
        prefs={prefs}
        disabled={disabled}
        onChange={onPrefsChange}
      />
    </form>
  );
}
