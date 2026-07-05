import { useTweaks } from "../hooks/useTweaks";

interface TweaksPageProps {
  configPath: string;
}

export function TweaksPage({ configPath }: TweaksPageProps) {
  const { tweaks, valueFor, toggleTweak, error } = useTweaks(configPath);

  return (
    <div className="tweaks-container page-container">
      <div className="settings-card">
        {tweaks.map((tweak, index) => {
          const isOn = valueFor(tweak) === tweak.valueType.on;
          return (
            <div
              className="setting-row"
              key={tweak.key}
              style={
                index === 0 ? { borderTop: "none", paddingTop: 0 } : undefined
              }
            >
              <div>
                <div className="setting-name">{tweak.title}</div>
                <div className="setting-desc">{tweak.description}</div>
              </div>
              <button
                type="button"
                className={`toggle-switch${isOn ? " on" : ""}`}
                role="switch"
                aria-checked={isOn}
                onClick={() => toggleTweak(tweak)}
              >
                <span className="toggle-switch-knob" />
              </button>
            </div>
          );
        })}
      </div>
      {error && <div className="status-message">{error}</div>}
    </div>
  );
}
