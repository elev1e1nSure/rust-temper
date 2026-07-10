import { invoke } from "@tauri-apps/api/core";
import { CloseFill, RocketFill } from "@mingcute/react";
import { useState } from "react";
import "./OptimizationPage.css";

type StepStatus = "available" | "applied" | "skipped";

type OptimizationStep = {
  id: string;
  title: string;
  summary: string;
  details: string;
  command: string;
};

const STEPS: OptimizationStep[] = [
  {
    id: "pcie-lpm",
    title: "Отключить PCIe LPM",
    summary: "Снижает задержки и повышает общую производительность системы",
    details:
      "PCIe Link Power Management управляет энергосбережением устройств PCI Express. Отключение убирает задержки при выходе устройств из режима экономии энергии.",
    command: "disable_pcie_lpm",
  },
  {
    id: "hvci",
    title: "Отключить HVCI",
    summary: "Снижает нагрузку на CPU и может повысить стабильность FPS",
    details:
      "Hypervisor-protected Code Integrity защищает ядро Windows от вредоносного кода. Отключение снижает защиту системы, зато высвобождает ресурсы CPU. Для применения нужна перезагрузка.",
    command: "disable_hvci",
  },
  {
    id: "xbox-game-bar",
    title: "Отключить Xbox Game Bar",
    summary: "Убирает фоновую нагрузку на CPU и RAM, снижает задержки",
    details:
      "Xbox Game Bar и Game DVR собирают данные об игре и производительности, используют память и могут конфликтовать с драйверами или оверлеями.",
    command: "disable_xbox_game_bar",
  },
  {
    id: "gc-buffer",
    title: "Автоопределение GC Buffer",
    summary: "Уменьшает длительные фризы и частоту очистки GC Buffer",
    details:
      "Garbage Collection Buffer хранит неиспользуемые объекты Rust. Мастер определит подходящий размер по объёму ОЗУ и добавит параметр в Steam, не затрагивая остальные launch options.",
    command: "apply_recommended_gc_buffer",
  },
];

const STATUS_LABEL: Record<StepStatus, string> = {
  available: "Доступно",
  applied: "Применено",
  skipped: "Пропущено",
};

export function OptimizationPage() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gcBuffer, setGcBuffer] = useState<number | null>(null);
  const completed = stepIndex >= STEPS.length;
  const step = STEPS[stepIndex];
  const appliedCount = Object.values(statuses).filter(
    (status) => status === "applied",
  ).length;

  const openWizard = () => {
    setStepIndex(0);
    setStatuses({});
    setError(null);
    setGcBuffer(null);
    setOpen(true);
  };

  const advance = (status: StepStatus) => {
    if (!step) return;
    setStatuses((current) => ({ ...current, [step.id]: status }));
    setError(null);
    setStepIndex((current) => current + 1);
  };

  const applyStep = async () => {
    if (!step) return;
    setApplying(true);
    setError(null);
    try {
      const result = await invoke<number | null>(step.command);
      if (step.id === "gc-buffer" && typeof result === "number") {
        setGcBuffer(result);
      }
      advance("applied");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="optimization-page page-container">
      <div className="opt-dashboard">
        <section className="opt-card opt-hero">
          <div className="opt-hero-icon" aria-hidden="true">
            <RocketFill size={36} />
          </div>
          <div className="opt-hero-info">
            <h1>Оптимизация системы</h1>
            <p>Четыре настройки Windows и Rust для более стабильной игры.</p>
            <button
              type="button"
              className="opt-btn opt-btn-accent"
              onClick={openWizard}
            >
              Запустить оптимизацию
            </button>
          </div>
        </section>

        <section className="opt-card opt-list" aria-label="Шаги оптимизации">
          {STEPS.map((item) => {
            const status = statuses[item.id] ?? "available";
            return (
              <div key={item.id} className="opt-item">
                <div className="opt-item-text">
                  <div className="opt-item-name">{item.title}</div>
                  <div className="opt-item-desc">{item.summary}</div>
                </div>
                <span className={`opt-chip opt-chip-${status}`}>
                  {STATUS_LABEL[status]}
                </span>
              </div>
            );
          })}
        </section>
      </div>

      {open && (
        <div className="opt-wizard-backdrop" role="presentation">
          <section
            className="opt-wizard"
            role="dialog"
            aria-modal="true"
            aria-label="Мастер оптимизации"
          >
            <button
              type="button"
              className="opt-wizard-close"
              onClick={() => setOpen(false)}
              disabled={applying}
              aria-label="Закрыть мастер"
            >
              <CloseFill size={18} />
            </button>

            {completed ? (
              <div className="opt-wizard-complete">
                <div className="opt-wizard-kicker">Готово</div>
                <h2>Оптимизация завершена</h2>
                <p>
                  Применено настроек: {appliedCount} из {STEPS.length}.
                  {gcBuffer ? ` GC Buffer: ${gcBuffer} МБ.` : ""}
                </p>
                <button
                  type="button"
                  className="opt-btn opt-btn-accent"
                  onClick={() => setOpen(false)}
                >
                  Закрыть
                </button>
              </div>
            ) : (
              <>
                <header className="opt-wizard-header">
                  <h2>{step?.title}</h2>
                  <p>{step?.summary}</p>
                </header>
                <div className="opt-wizard-details">
                  <h3>Подробнее</h3>
                  <p>{step?.details}</p>
                </div>
                <footer className="opt-wizard-footer">
                  <div className="opt-progress">
                    <div className="opt-progress-label">
                      <span>Применено</span>
                      <span>
                        {stepIndex + 1} из {STEPS.length}
                      </span>
                    </div>
                    <div className="opt-progress-track" aria-hidden="true">
                      <span
                        style={{
                          width: `${((stepIndex + 1) / STEPS.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  {error && <p className="opt-wizard-error">{error}</p>}
                  <div className="opt-wizard-actions">
                    <button
                      type="button"
                      className="opt-btn opt-btn-muted"
                      onClick={() => advance("skipped")}
                      disabled={applying}
                    >
                      Пропустить
                    </button>
                    <button
                      type="button"
                      className="opt-btn opt-btn-accent"
                      onClick={applyStep}
                      disabled={applying}
                    >
                      {applying ? "Применение..." : "Применить"}
                    </button>
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
