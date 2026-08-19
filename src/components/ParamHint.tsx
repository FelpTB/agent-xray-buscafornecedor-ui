import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  label: string;
  hint: string;
};

type PopPos = {
  top: number;
  left: number;
  width: number;
  placement: "left" | "bottom";
};

function placeNear(anchor: DOMRect): PopPos {
  const width = Math.min(280, Math.max(196, window.innerWidth - 16));
  const gap = 10;
  const leftRoom = anchor.left - 8;
  const top = Math.max(8, Math.min(anchor.top, window.innerHeight - 148));
  if (leftRoom >= Math.min(width, 220)) {
    return {
      top,
      left: Math.max(8, anchor.left - width - gap),
      width: Math.min(width, leftRoom - gap),
      placement: "left",
    };
  }
  return {
    top: Math.min(anchor.bottom + gap, window.innerHeight - 148),
    left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
    width,
    placement: "bottom",
  };
}

export function ParamHint({ label, hint }: Props) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopPos | null>(null);

  const update = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    setPos(placeNear(el.getBoundingClientRect()));
  }, []);

  const show = useCallback(() => {
    update();
    setOpen(true);
  }, [update]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span className="hint-wrap">
      <button
        ref={btnRef}
        type="button"
        className="hint-btn"
        aria-label={`Sobre ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        ?
      </button>
      {open && pos
        ? createPortal(
            <span
              className="hint-pop is-open"
              role="tooltip"
              id={id}
              data-placement={pos.placement}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {hint}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
