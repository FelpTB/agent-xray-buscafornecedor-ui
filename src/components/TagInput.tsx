import { useState, type KeyboardEvent } from "react";

type Props = {
  id: string;
  values: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (next: string[]) => void;
};

function normalizeTag(raw: string): string {
  return raw.replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
}

export function TagInput({ id, values, disabled, placeholder, onChange }: Props) {
  const [draft, setDraft] = useState("");

  function addFromText(raw: string) {
    const parts = raw
      .split(/[,;]/)
      .map(normalizeTag)
      .filter(Boolean);
    if (!parts.length) return;
    const seen = new Set(values.map((v) => v.toLowerCase()));
    const next = [...values];
    for (const p of parts) {
      if (seen.has(p.toLowerCase())) continue;
      seen.add(p.toLowerCase());
      next.push(p);
    }
    onChange(next);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addFromText(draft);
      return;
    }
    if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className={`tag-input${disabled ? " is-disabled" : ""}`}>
      {values.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
          <button
            type="button"
            className="tag-remove"
            aria-label={`Remover ${tag}`}
            disabled={disabled}
            onClick={() => onChange(values.filter((t) => t !== tag))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        disabled={disabled}
        placeholder={values.length ? "" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim()) addFromText(draft);
        }}
      />
    </div>
  );
}
