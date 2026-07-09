import { RocketFill } from "@mingcute/react";
import "./OptimizationPage.css";

export function OptimizationPage() {
  return (
    <div className="optimization-page page-container">
      <div className="optimization-placeholder">
        <div className="optimization-placeholder-icon-wrap">
          <RocketFill size={40} className="optimization-placeholder-icon" />
        </div>
        <span className="optimization-placeholder-badge">В разработке</span>
        <h1>Оптимизация уже готовится к взлёту</h1>
        <p>
          Здесь появятся автотюнинг производительности и умные пресеты под вашу
          систему.
        </p>
      </div>
    </div>
  );
}
