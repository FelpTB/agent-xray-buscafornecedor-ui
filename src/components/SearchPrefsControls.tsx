import {
  asSearchFocus,
  asWeightPreset,
  PREFS_HINT,
  SEARCH_FOCUS_OPTIONS,
  type SearchPrefs,
  WEIGHT_PRESET_OPTIONS,
} from "../lib/searchPrefs";
import { ParamHint } from "./ParamHint";

type Props = {
  idPrefix: string;
  prefs: SearchPrefs;
  disabled?: boolean;
  compact?: boolean;
  onChange: (next: SearchPrefs) => void;
};

function optionHint<T extends { value: string; hint: string }>(options: T[], value: string): string {
  return options.find((o) => o.value === value)?.hint || "";
}

export function SearchPrefsControls({ idPrefix, prefs, disabled, compact, onChange }: Props) {
  const presetId = `${idPrefix}-preset`;
  const focusId = `${idPrefix}-focus`;
  const presetHint = optionHint(WEIGHT_PRESET_OPTIONS, prefs.weightPreset);
  const focusHint = optionHint(SEARCH_FOCUS_OPTIONS, prefs.searchFocus);

  return (
    <div className={compact ? "prefs-row" : "prefs-grid"}>
      <div className={compact ? "prefs-item" : "field"}>
        <div className="field-label-row">
          <label htmlFor={presetId}>Ênfase</label>
          {compact ? <ParamHint label="Ênfase da busca" hint={PREFS_HINT} /> : null}
        </div>
        <select
          id={presetId}
          value={prefs.weightPreset}
          disabled={disabled}
          title={presetHint}
          onChange={(e) => onChange({ ...prefs, weightPreset: asWeightPreset(e.target.value) })}
        >
          {WEIGHT_PRESET_OPTIONS.map((o) => (
            <option key={o.value || "auto"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {!compact && presetHint ? <p className="help prefs-help">{presetHint}</p> : null}
      </div>
      <div className={compact ? "prefs-item" : "field"}>
        <label htmlFor={focusId}>Você procura</label>
        <select
          id={focusId}
          value={prefs.searchFocus}
          disabled={disabled}
          title={focusHint}
          onChange={(e) => onChange({ ...prefs, searchFocus: asSearchFocus(e.target.value) })}
        >
          {SEARCH_FOCUS_OPTIONS.map((o) => (
            <option key={o.value || "auto"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {!compact && focusHint ? <p className="help prefs-help">{focusHint}</p> : null}
      </div>
    </div>
  );
}
