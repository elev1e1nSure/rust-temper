import { type ReactElement } from "react";
import "./OptimizationPage.css";

type OptTabId = "dashboard" | "leaderboard" | "history" | "benchmark";

const TABS: { id: OptTabId; label: string; icon: () => ReactElement }[] = [
  { id: "dashboard", label: "Дешборд", icon: DashboardIcon },
  { id: "leaderboard", label: "Таблица лидеров", icon: LeaderboardIcon },
  { id: "history", label: "История тестов", icon: HistoryIcon },
  { id: "benchmark", label: "Бенчмарк", icon: BenchmarkIcon },
];

// Static placeholder figures — this whole tab is a stub, no real data yet.
const OPTIMIZATION_PCT = 94;
const GAUGE_TOTAL = 26;
const GAUGE_ACTIVE = Math.round((OPTIMIZATION_PCT / 100) * GAUGE_TOTAL);

// Bars ramp from "good" (success) on the left to "hot" (accent) on the right;
// the tail past the current value sits inactive.
function gaugeBarColor(i: number): string {
  if (i >= GAUGE_ACTIVE) return "var(--key-bg)";
  const t = GAUGE_ACTIVE > 1 ? i / (GAUGE_ACTIVE - 1) : 0;
  return `color-mix(in srgb, var(--accent) ${Math.round(t * 100)}%, var(--success))`;
}

export function OptimizationPage() {
  // The whole dashboard is a locked preview for now: rendered blurred and
  // non-interactive as a backdrop, with a single live CTA on top.
  return (
    <div className="optimization-page page-container">
      <div className="opt-locked">
        <div className="opt-locked-content" aria-hidden="true">
          <nav className="opt-tabs">
            {TABS.map((tab, i) => {
              const Icon = tab.icon;
              return (
                <span
                  key={tab.id}
                  className={`opt-tab${i === 0 ? " active" : ""}`}
                >
                  <span className="action-icon opt-tab-icon">
                    <Icon />
                  </span>
                  {tab.label}
                </span>
              );
            })}
          </nav>
          <DashboardTab />
        </div>

        <div className="opt-lock-overlay">
          <button type="button" className="opt-btn opt-btn-accent opt-lock-btn">
            Запустить проверку
            <PlayIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardTab() {
  return (
    <div className="opt-dashboard">
      <div className="opt-stats">
        <div className="opt-card opt-card-rating">
          <div className="opt-stat-value">0</div>
          <div className="opt-stat-label">Ваш рейтинг</div>
          <Sparkline />
        </div>

        <StatCard className="opt-card-gpu" value="0" label="Видеокарта" />
        <StatCard className="opt-card-cpu" value="0" label="Процессор" />
        <StatCard className="opt-card-mem" value="0" label="Память" />
        <StatCard
          className="opt-card-check"
          value="N/D"
          label="Последняя проверка"
        />

        <div className="opt-card opt-card-gauge">
          <div className="opt-gauge-info">
            <div className="opt-stat-value">{OPTIMIZATION_PCT}%</div>
            <div className="opt-stat-label">Оптимизация</div>
          </div>
          <div className="opt-gauge-bars" aria-hidden="true">
            {Array.from({ length: GAUGE_TOTAL }, (_, i) => (
              <span
                key={i}
                className="opt-gauge-bar"
                style={{ background: gaugeBarColor(i) }}
              />
            ))}
          </div>
        </div>

        <div className="opt-card opt-card-mode">
          <div className="opt-mode-info">
            <div className="opt-mode-title">Режим оптимизации</div>
            <div className="opt-mode-sub">Поэтапное применение</div>
          </div>
          <button type="button" className="opt-btn opt-btn-secondary">
            Начать
            <PlayIcon />
          </button>
        </div>
      </div>

      <div className="opt-card opt-cta">
        <div className="opt-cta-text">
          <div className="opt-cta-title">
            Требуется проверка производительности
          </div>
          <div className="opt-cta-sub">Это займёт несколько минут</div>
        </div>
        <button type="button" className="opt-btn opt-btn-accent">
          Запустить проверку
          <PlayIcon />
        </button>
      </div>

      <div className="opt-card opt-skeleton">
        <div className="opt-sk-header">
          <span className="opt-sk-line" style={{ width: 90 }} />
          <span className="opt-sk-line" style={{ width: 260 }} />
        </div>
        <div className="opt-sk-cols">
          {[0, 1, 2].map((col) => (
            <div key={col} className="opt-sk-col">
              <span
                className="opt-sk-line opt-sk-line-strong"
                style={{ width: 80 }}
              />
              <span className="opt-sk-line" style={{ width: "100%" }} />
              <span className="opt-sk-line" style={{ width: "88%" }} />
              <span className="opt-sk-line" style={{ width: "72%" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  className,
  value,
  label,
}: {
  className: string;
  value: string;
  label: string;
}) {
  return (
    <div className={`opt-card opt-stat ${className}`}>
      <div className="opt-stat-value">{value}</div>
      <div className="opt-stat-label">{label}</div>
    </div>
  );
}

function Sparkline() {
  return (
    <svg
      className="opt-sparkline"
      viewBox="0 0 260 70"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 70 L0 58 C 45 55 72 50 98 32 C 118 18 142 22 168 36 C 198 54 228 58 260 55 L260 70 Z"
        fill="var(--row-active)"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      className="opt-play"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm10 0a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5Zm0 8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6ZM3 15a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4Z" />
    </svg>
  );
}

function LeaderboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 13a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h1Zm7-8a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1Zm7 4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BenchmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21a9 9 0 1 1 9-9M12 12l4-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}
