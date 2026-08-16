"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** Shown when no option matches `value`. */
  placeholder?: string;
  /** Accessible name for screen readers. */
  ariaLabel?: string;
  /** Optional id for the trigger (when used inside a <label htmlFor>). */
  id?: string;
  /** Replace the trigger button styling. Default = pill-style filter button. */
  triggerClassName?: string;
  /** Used in form contexts where the trigger should fill its container. */
  fullWidth?: boolean;
};

const DEFAULT_TRIGGER =
  "tappable inline-flex items-center justify-between gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:border-brand-orange/40 hover:bg-white/10 focus:border-brand-orange/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40";

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  ariaLabel,
  id,
  triggerClassName,
  fullWidth = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  const displayLabel = selected?.label ?? placeholder;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Keyboard: Escape to close, Tab closes (let focus continue naturally)
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (!open || highlighted < 0) return;
    const el = listRef.current?.querySelectorAll<HTMLLIElement>("li")[
      highlighted
    ];
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  // Reset highlight when opening
  useEffect(() => {
    if (open) setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  function selectIndex(idx: number) {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  function moveHighlight(delta: number) {
    if (options.length === 0) return;
    let next = highlighted < 0 ? 0 : highlighted + delta;
    const total = options.length;
    // Skip disabled options
    for (let i = 0; i < total; i++) {
      const idx = ((next % total) + total) % total;
      if (!options[idx].disabled) {
        setHighlighted(idx);
        return;
      }
      next += delta;
    }
  }

  function handleTriggerKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function handleListKey(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlighted(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlighted(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlighted >= 0) selectIndex(highlighted);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative ${fullWidth ? "w-full" : "inline-block"}`}
    >
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        className={`${triggerClassName ?? DEFAULT_TRIGGER} ${
          fullWidth ? "w-full" : ""
        }`}
      >
        <span className={selected ? "" : "text-brand-gray-400"}>
          {displayLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-brand-orange transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKey}
          aria-activedescendant={
            highlighted >= 0 ? `${listboxId}-opt-${highlighted}` : undefined
          }
          autoFocus
          // origin-top anchors the pop-in growth to the trigger directly
          // above it, so the list reads as coming out of the control that
          // opened it rather than appearing on its own.
          className="animate-pop-in absolute left-0 right-0 z-50 mt-2 max-h-72 origin-top overflow-y-auto rounded-xl border border-white/15 bg-brand-gray-900 py-1.5 shadow-xl shadow-black/60 ring-1 ring-black/40 focus:outline-none"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isHighlighted = i === highlighted;
            return (
              <li
                key={opt.value || `__opt_${i}`}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                onMouseEnter={() => !opt.disabled && setHighlighted(i)}
                onMouseDown={(e) => {
                  // mousedown so the trigger button's onBlur doesn't fire first
                  e.preventDefault();
                  if (!opt.disabled) selectIndex(i);
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition ${
                  opt.disabled
                    ? "cursor-not-allowed text-brand-gray-400"
                    : isSelected
                      ? "bg-brand-orange/20 text-brand-orange"
                      : isHighlighted
                        ? "bg-white/10 text-white"
                        : "text-brand-gray-200"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected ? (
                  <Check
                    className="h-3.5 w-3.5 flex-shrink-0 text-brand-orange"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
