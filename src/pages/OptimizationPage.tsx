import { RocketFill } from "@mingcute/react";
import "./OptimizationPage.css";

// Static placeholder figures — this whole tab is a locked stub for now.
const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;
const RING_FILL = 0.62;

type ItemStatus = "applied" | "available" | "skipped";

const STATUS_LABEL: Record<ItemStatus, string> = {
  applied: "Применено",
  available: "Доступно",
  skipped: "Пропущено",
};

const ITEMS: { name: string; desc: string; status: ItemStatus }[] = [
  {
    name: "Кэш шейдеров",
    desc: "Очистка устаревших скомпилированных шейдеров",
    status: "applied",
  },
  {
    name: "Приоритет процесса",
    desc: "Высокий приоритет для rust.exe во время игры",
    status: "applied",
  },
  {
    name: "Параметры запуска",
    desc: "Оптимальные ключи в Steam launch options",
    status: "available",
  },
  {
    name: "Фоновые службы",
    desc: "Пауза лишних служб на время сессии",
    status: "available",
  },
  {
    name: "Резерв памяти",
    desc: "Выделение ОЗУ под игровой процесс",
    status: "skipped",
  },
];

export function OptimizationPage() {
  // The whole panel is a locked preview for now: rendered blurred and
  // non-interactive as a backdrop, with a single "В разработке" state on top.
  return (
    <div className="optimization-page page-container">
      <div className="opt-locked">
        <div className="opt-locked-content" aria-hidden="true">
          <Backdrop />
        </div>

        <div className="opt-lock-overlay">
          <div className="opt-lock-body">
            <div className="opt-lock-icon">
              <RocketFill size={44} />
            </div>
            <div className="opt-lock-title">В разработке</div>
            <div className="opt-lock-sub">
              Раздел оптимизации появится в одном из будущих обновлений
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Backdrop() {
  return (
    <div className="opt-dashboard">
      <div className="opt-card opt-hero">
        <Ring />
        <div className="opt-hero-info">
          <div className="opt-hero-title">Оптимизация системы</div>
          <div className="opt-hero-sub">
            Профиль «Баланс» · 12 активных настроек
          </div>
          <button type="button" className="opt-btn opt-btn-accent">
            Оптимизировать
          </button>
        </div>
      </div>

      <div className="opt-card opt-list">
        {ITEMS.map((item) => (
          <div key={item.name} className="opt-item">
            <div className="opt-item-text">
              <div className="opt-item-name">{item.name}</div>
              <div className="opt-item-desc">{item.desc}</div>
            </div>
            <span className={`opt-chip opt-chip-${item.status}`}>
              {STATUS_LABEL[item.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ring() {
  return (
    <div className="opt-ring">
      <svg viewBox="0 0 120 120" className="opt-ring-svg" aria-hidden="true">
        <circle
          className="opt-ring-track"
          cx="60"
          cy="60"
          r={RING_R}
          fill="none"
          strokeWidth="8"
        />
        <circle
          className="opt-ring-arc"
          cx="60"
          cy="60"
          r={RING_R}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${RING_C * RING_FILL} ${RING_C}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="opt-ring-center">
        <span className="opt-ring-value">+24%</span>
        <span className="opt-ring-unit">к FPS</span>
      </div>
    </div>
  );
}
