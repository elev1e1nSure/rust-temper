import { invoke } from "@tauri-apps/api/core";
import { CloseFill } from "@mingcute/react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./OptimizationPage.css";

type StepStatus = "available" | "applied";

type OptimizationStatus = {
  pcieLpm: boolean;
  hvci: boolean;
  xboxGameBar: boolean;
  gameMode: boolean;
  gcBuffer: boolean;
};

type OptimizationStep = {
  id: string;
  title: string;
  summary: string;
  details: string;
  command: string;
  revertCommand: string;
};

const STEPS: OptimizationStep[] = [
  {
    id: "pcie-lpm",
    title: "Отключить PCIe LPM",
    summary: "Устраняет микрофризы от энергосбережения PCI Express",
    details:
      "PCIe Link Power Management переводит видеокарту, SSD и другие устройства PCI Express в режим пониженного энергопотребления в простое. Выход из этого режима занимает время и может ощущаться как кратковременный фриз. Отключение убирает эту задержку ценой чуть большего энергопотребления в простое.",
    command: "disable_pcie_lpm",
    revertCommand: "enable_pcie_lpm",
  },
  {
    id: "hvci",
    title: "Отключить HVCI",
    summary: "Снижает нагрузку на CPU от виртуализации ядра Windows",
    details:
      "Hypervisor-protected Code Integrity (Memory Integrity) — часть Virtualization-based Security, которая проверяет код ядра через гипервизор и создаёт постоянную нагрузку на CPU. Отключение освобождает ресурсы процессора, но ослабляет защиту от вредоносного кода уровня ядра. Изменения вступают в силу после перезагрузки.",
    command: "disable_hvci",
    revertCommand: "enable_hvci",
  },
  {
    id: "xbox-game-bar",
    title: "Отключить Xbox Game Bar",
    summary: "Отключает фоновую запись Game DVR и оверлей Xbox Game Bar",
    details:
      "Game DVR постоянно готов записывать геймплей в фоне, а оверлей Game Bar перехватывает системные хоткеи и может конфликтовать со сторонним софтом (RGB-утилиты, оверлеи Discord и т.п.). Отключение убирает эту фоновую активность, хотя влияние на FPS обычно небольшое.",
    command: "disable_xbox_game_bar",
    revertCommand: "enable_xbox_game_bar",
  },
  {
    id: "game-mode",
    title: "Включить игровой режим Windows",
    summary: "Приоритизирует ресурсы системы для запущенной игры",
    details:
      "Игровой режим снижает приоритет фоновых задач во время игры, чтобы Windows стабильнее выделяла процессорное время и системные ресурсы Rust. Настройка безопасна, обратима и не отключает защиту Windows.",
    command: "enable_game_mode",
    revertCommand: "disable_game_mode",
  },
  {
    id: "gc-buffer",
    title: "Автоопределение GC Buffer",
    summary:
      "Увеличивает буфер сборщика мусора Unity, чтобы он реже запускался",
    details:
      "Rust на движке Unity периодически запускает сборщик мусора, который на короткое время останавливает игру — это ощущается как статтеры. Больший буфер даёт сборщику запас памяти впрок, поэтому он срабатывает реже. Мастер подберёт значение по объёму ОЗУ (не выше 4096 МБ — движок не учитывает более высокие значения) и добавит параметр в Steam, не трогая остальные launch options.",
    command: "apply_recommended_gc_buffer",
    revertCommand: "clear_rust_gc_buffer",
  },
];

const STATUS_LABEL: Record<StepStatus, string> = {
  available: "Выключено",
  applied: "Применено",
};

export function OptimizationPage() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [skipTransition, setSkipTransition] = useState(0);
  const [wizardSteps, setWizardSteps] = useState<OptimizationStep[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({});
  const [statusLoading, setStatusLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gcBuffer, setGcBuffer] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const pendingSteps = STEPS.filter((item) => statuses[item.id] !== "applied");
  const completed = stepIndex >= wizardSteps.length;
  const step = wizardSteps[stepIndex];
  const appliedCount = Object.values(statuses).filter(
    (status) => status === "applied",
  ).length;

  const refreshStatuses = useCallback(async () => {
    try {
      const status = await invoke<OptimizationStatus>(
        "get_optimization_status",
      );
      setStatuses({
        "pcie-lpm": status.pcieLpm ? "applied" : "available",
        hvci: status.hvci ? "applied" : "available",
        "xbox-game-bar": status.xboxGameBar ? "applied" : "available",
        "game-mode": status.gameMode ? "applied" : "available",
        "gc-buffer": status.gcBuffer ? "applied" : "available",
      });
    } catch (reason) {
      console.error("Не удалось прочитать состояние оптимизаций:", reason);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatuses();
  }, [refreshStatuses]);

  const openWizard = () => {
    if (!pendingSteps.length) return;
    setClosing(false);
    setStepIndex(0);
    setSkipTransition(0);
    setWizardSteps(pendingSteps);
    setError(null);
    setGcBuffer(null);
    setOpen(true);
  };

  const closeWizard = useCallback(() => {
    if (applying || closing) return;
    setClosing(true);
  }, [applying, closing]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWizard();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeWizard, open]);

  const advance = () => {
    if (!step) return;
    setError(null);
    setStepIndex((current) => current + 1);
  };

  const skipStep = () => {
    if (!step) return;
    setError(null);
    setSkipTransition((current) => current + 1);
    setStepIndex((current) => current + 1);
  };

  const toggleItem = useCallback(
    async (item: OptimizationStep) => {
      if (togglingId) return;
      const status = statuses[item.id] ?? "available";
      setTogglingId(item.id);
      setListError(null);
      try {
        if (status === "applied") {
          await invoke(item.revertCommand);
          if (item.id === "gc-buffer") setGcBuffer(null);
        } else {
          const result = await invoke<number | null>(item.command);
          if (item.id === "gc-buffer" && typeof result === "number") {
            setGcBuffer(result);
          }
        }
        await refreshStatuses();
      } catch (reason) {
        setListError(String(reason));
      } finally {
        setTogglingId(null);
      }
    },
    [togglingId, statuses, refreshStatuses],
  );

  const applyStep = async () => {
    if (!step) return;
    setApplying(true);
    setError(null);
    try {
      const result = await invoke<number | null>(step.command);
      if (step.id === "gc-buffer" && typeof result === "number") {
        setGcBuffer(result);
      }
      await refreshStatuses();
      advance();
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
          <div className="opt-hero-info">
            <h1>Оптимизация ПК</h1>
            <p>Параметры ПК и Rust, которые могут поднять производительность</p>
            <button
              type="button"
              className="opt-btn opt-btn-accent"
              onClick={openWizard}
              disabled={statusLoading || !pendingSteps.length}
            >
              Начать оптимизацию
            </button>
          </div>
        </section>

        <section className="opt-card opt-list" aria-label="Шаги оптимизации">
          {STEPS.map((item) => {
            const status = statuses[item.id] ?? "available";
            const isToggling = togglingId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="opt-item"
                onClick={() => toggleItem(item)}
                disabled={statusLoading || togglingId !== null}
                aria-pressed={status === "applied"}
              >
                <div className="opt-item-text">
                  <div className="opt-item-name">{item.title}</div>
                  <div className="opt-item-desc">{item.summary}</div>
                </div>
                <span className={`opt-chip opt-chip-${status}`}>
                  {isToggling ? "..." : STATUS_LABEL[status]}
                </span>
              </button>
            );
          })}
          {listError && (
            <p className="opt-wizard-error opt-list-error">{listError}</p>
          )}
        </section>
      </div>

      {open &&
        createPortal(
          <div
            className={`opt-wizard-backdrop${closing ? " closing" : ""}`}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeWizard();
            }}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && closing) {
                setOpen(false);
                setClosing(false);
              }
            }}
          >
            <section
              className="opt-wizard"
              role="dialog"
              aria-modal="true"
              aria-label="Мастер оптимизации"
            >
              <button
                type="button"
                className="opt-wizard-close"
                onClick={closeWizard}
                disabled={applying}
                aria-label="Закрыть мастер"
              >
                <CloseFill size={22} />
              </button>

              {completed ? (
                <div className="opt-wizard-complete">
                  <h2>Оптимизация завершена</h2>
                  <p>
                    Применено настроек: {appliedCount} из {STEPS.length}.
                    {gcBuffer ? ` GC Buffer: ${gcBuffer} МБ.` : ""}
                  </p>
                  <button
                    type="button"
                    className="opt-btn opt-btn-accent"
                    onClick={closeWizard}
                  >
                    Закрыть
                  </button>
                </div>
              ) : (
                <div
                  key={skipTransition}
                  className={`opt-wizard-step${skipTransition ? " is-skip-transition" : ""}`}
                >
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
                          {stepIndex + 1} из {wizardSteps.length}
                        </span>
                      </div>
                      <div className="opt-progress-track" aria-hidden="true">
                        <span
                          style={{
                            width: `${((stepIndex + 1) / wizardSteps.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    {error && <p className="opt-wizard-error">{error}</p>}
                    <div className="opt-wizard-actions">
                      <button
                        type="button"
                        className="opt-btn opt-btn-muted"
                        onClick={skipStep}
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
                </div>
              )}
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}
