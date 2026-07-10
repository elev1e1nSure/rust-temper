import {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTweaks } from "../hooks/useTweaks";
import {
  BackIcon,
  ChevronIcon,
  GraphicsIcon,
  InterfaceIcon,
  ListCheckIcon,
  TrashIcon,
} from "../icons";
import type { AdvancedSlider, TweakDef, TweakSection } from "../types";
import "./TweaksPage.css";

interface TweaksPageProps {
  gamePath: string;
}

const SECTIONS: {
  key: TweakSection;
  title: string;
  icon: (props: { size?: number }) => ReactNode;
}[] = [
  { key: "qol", title: "Качество жизни", icon: ListCheckIcon },
  { key: "graphics", title: "Графика", icon: GraphicsIcon },
  { key: "interface", title: "Интерфейс", icon: InterfaceIcon },
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
  onPreview,
}: {
  tweak: TweakDef;
  checked: boolean;
  managed: boolean;
  disabled: boolean;
  sliderValue: number;
  onToggle: () => void;
  onSliderChange: (value: number) => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={`setting-row setting-row-clickable tweak-row${disabled ? " disabled" : ""}`}
      onClick={disabled ? undefined : onToggle}
      onMouseEnter={onPreview}
      onFocus={onPreview}
    >
      <div>
        <div className="setting-name tweak-name">
          {tweak.title}
          {tweak.badge === "recommended" && (
            <span className="tweak-badge">рекомендовано</span>
          )}
        </div>
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
            <span className="action-icon" aria-hidden="true">
              <BackIcon />
            </span>
            Назад
          </button>
          <button
            type="button"
            className="tweak-confirm-button danger"
            disabled={pending}
            onClick={onConfirm}
          >
            <span className="action-icon" aria-hidden="true">
              <TrashIcon />
            </span>
            {pending ? "Выключение…" : "Всё равно выключить"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AccordionSection({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: (props: { size?: number }) => ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setHeight(isExpanded ? el.scrollHeight : 0);
    if (!isExpanded) return;
    const observer = new ResizeObserver(() => {
      setHeight(el.scrollHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isExpanded]);

  return (
    <div className="accordion-section">
      <button
        type="button"
        className="accordion-header"
        onClick={() => {
          setShouldAnimate(true);
          onToggle();
        }}
        aria-expanded={isExpanded}
      >
        <span className="accordion-title">
          <span className="action-icon accordion-title-icon" aria-hidden="true">
            <Icon />
          </span>
          {title}
        </span>
        <span className={`accordion-arrow${isExpanded ? " open" : ""}`}>
          <ChevronIcon />
        </span>
      </button>
      <div
        className="accordion-content"
        style={{ height, transition: shouldAnimate ? undefined : "none" }}
      >
        <div className="accordion-content-inner" ref={innerRef}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function TweaksPage({ gamePath }: TweaksPageProps) {
  const {
    tweaks,
    isOn,
    isManaged,
    isPending,
    sliderValue,
    toggleTweak,
    setSliderValue,
    error,
  } = useTweaks(gamePath);
  const [unmanagedTweak, setUnmanagedTweak] = useState<TweakDef | null>(null);
  const [openSections, setOpenSections] = useState<Set<TweakSection>>(
    () => new Set<TweakSection>(["qol"]),
  );
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const previewTweak = useMemo(
    () => tweaks.find((t) => t.key === previewKey) ?? tweaks[0] ?? null,
    [tweaks, previewKey],
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
    // Legacy "enabled manually" confirmation gate disabled: always force so
    // toggling an unmanaged-but-matching tweak just works instead of warning.
    void toggleTweak(tweak, true);
  };

  const forceDisableUnmanagedTweak = async () => {
    if (!unmanagedTweak) return;
    const disabled = await toggleTweak(unmanagedTweak, true);
    if (disabled) setUnmanagedTweak(null);
  };

  return (
    <div className="tweaks-container page-container">
      <div className="tweaks-main">
        {SECTIONS.map((section) => {
          const sectionTweaks = tweaks.filter((t) => t.section === section.key);
          if (sectionTweaks.length === 0) return null;
          const isExpanded = openSections.has(section.key);

          return (
            <AccordionSection
              key={section.key}
              title={section.title}
              icon={section.icon}
              isExpanded={isExpanded}
              onToggle={() => toggleSection(section.key)}
            >
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
                    onPreview={() => setPreviewKey(tweak.key)}
                  />
                ))}
              </div>
            </AccordionSection>
          );
        })}
        {error && <div className="status-message">{error}</div>}
      </div>

      <div className="settings-card graphics-preview tweaks-preview">
        {previewTweak && (
          <div className="tweaks-preview-body">
            <div className="graphics-preview-title">{previewTweak.title}</div>
            <p className="graphics-preview-desc">{previewTweak.description}</p>
          </div>
        )}
      </div>

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
