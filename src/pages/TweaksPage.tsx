import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTweaks } from "../hooks/useTweaks";
import { ChevronIcon } from "../icons";
import { Tooltip } from "../Tooltip";
import type { AdvancedSlider, TweakDef, TweakSection } from "../types";

interface TweaksPageProps {
  configPath: string;
}

const SECTIONS: { key: TweakSection; title: string }[] = [
  { key: "qol", title: "Качество жизни" },
  { key: "graphics", title: "Графика" },
  { key: "interface", title: "Интерфейс" },
];

function formatSliderValue(slider: AdvancedSlider, value: number) {
  const formatted = slider.step < 1 ? value.toFixed(2) : String(value);
  return slider.valueFormat
    ? slider.valueFormat.replace("{value}", formatted)
    : formatted;
}

function TweakRow({
  tweak,
  checked,
  managed,
  disabled,
  sliderValue,
  onToggle,
  onSliderChange,
}: {
  tweak: TweakDef;
  checked: boolean;
  managed: boolean;
  disabled: boolean;
  sliderValue: number;
  onToggle: () => void;
  onSliderChange: (value: number) => void;
}) {
  return (
    <div
      className={`setting-row setting-row-clickable tweak-row${disabled ? " disabled" : ""}`}
      onClick={disabled ? undefined : onToggle}
    >
      <div>
        <Tooltip content={tweak.description}>
          <div className="setting-name tweak-name">
            {tweak.title}
            {tweak.badge === "recommended" && (
              <span className="tweak-badge">рекомендовано</span>
            )}
          </div>
        </Tooltip>
        {tweak.advancedSlider && checked && (
          <div
            className="tweak-slider-group"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="tweak-slider-label">
              {tweak.advancedSlider.label}:{" "}
              {formatSliderValue(tweak.advancedSlider, sliderValue)}
            </label>
            <input
              type="range"
              min={tweak.advancedSlider.min}
              max={tweak.advancedSlider.max}
              step={tweak.advancedSlider.step}
              value={sliderValue}
              disabled={!managed || disabled}
              onChange={(e) => onSliderChange(Number(e.target.value))}
              className="tweak-slider"
            />
          </div>
        )}
      </div>
      <button
        type="button"
        className={`toggle-switch${checked ? " on" : ""}`}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <span className="toggle-switch-knob" />
      </button>
    </div>
  );
}

function UnmanagedTweakModal({
  tweak,
  pending,
  onBack,
  onConfirm,
}: {
  tweak: TweakDef;
  pending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack, pending]);

  return createPortal(
    <div
      className="tweak-confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onBack();
      }}
    >
      <div
        className="tweak-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unmanaged-tweak-title"
      >
        <div className="tweak-confirm-kicker">Изменение client.cfg</div>
        <h2 id="unmanaged-tweak-title">Твик включён вручную</h2>
        <p>
          «{tweak.title}» уже активен, но программа не сохраняла исходные
          значения. При выключении параметры будут перезаписаны стандартными
          значениями из встроенного конфига.
        </p>
        <div className="tweak-confirm-actions">
          <button
            type="button"
            className="tweak-confirm-button secondary"
            disabled={pending}
            onClick={onBack}
          >
            Назад
          </button>
          <button
            type="button"
            className="tweak-confirm-button danger"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Выключение…" : "Всё равно выключить"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TweaksPage({ configPath }: TweaksPageProps) {
  const {
    tweaks,
    isOn,
    isManaged,
    isPending,
    sliderValue,
    toggleTweak,
    setSliderValue,
    error,
  } = useTweaks(configPath);
  const [unmanagedTweak, setUnmanagedTweak] = useState<TweakDef | null>(null);
  const [openSections, setOpenSections] = useState<Set<TweakSection>>(
    () => new Set<TweakSection>(["qol"]),
  );

  const toggleSection = (key: TweakSection) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const requestToggle = (tweak: TweakDef) => {
    if (isOn(tweak) && !isManaged(tweak)) {
      setUnmanagedTweak(tweak);
      return;
    }
    void toggleTweak(tweak);
  };

  const forceDisableUnmanagedTweak = async () => {
    if (!unmanagedTweak) return;
    const disabled = await toggleTweak(unmanagedTweak, true);
    if (disabled) setUnmanagedTweak(null);
  };

  return (
    <div className="tweaks-container page-container">
      {SECTIONS.map((section) => {
        const sectionTweaks = tweaks.filter((t) => t.section === section.key);
        if (sectionTweaks.length === 0) return null;
        const isExpanded = openSections.has(section.key);

        return (
          <div className="accordion-section" key={section.key}>
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection(section.key)}
              aria-expanded={isExpanded}
            >
              <span className="accordion-title">{section.title}</span>
              <span className={`accordion-arrow${isExpanded ? " open" : ""}`}>
                <ChevronIcon />
              </span>
            </button>
            <div className={`accordion-content${isExpanded ? " open" : ""}`}>
              <div className="accordion-content-inner">
                <div className="settings-card settings-card-compact">
                  {sectionTweaks.map((tweak) => (
                    <TweakRow
                      key={tweak.key}
                      tweak={tweak}
                      checked={isOn(tweak)}
                      managed={isManaged(tweak)}
                      disabled={isPending(tweak)}
                      sliderValue={sliderValue(tweak)}
                      onToggle={() => requestToggle(tweak)}
                      onSliderChange={(value) => setSliderValue(tweak, value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {error && <div className="status-message">{error}</div>}
      {unmanagedTweak && (
        <UnmanagedTweakModal
          tweak={unmanagedTweak}
          pending={isPending(unmanagedTweak)}
          onBack={() => setUnmanagedTweak(null)}
          onConfirm={() => void forceDisableUnmanagedTweak()}
        />
      )}
    </div>
  );
}
