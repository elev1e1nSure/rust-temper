import type { PageId } from "../navigation";
import { NAV_ITEMS } from "../navigation";
import "./Sidebar.css";

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  sidebarWidth: number;
  onStartResizing: (e: React.MouseEvent) => void;
}

export function Sidebar({
  activePage,
  onNavigate,
  sidebarWidth,
  onStartResizing,
}: SidebarProps) {
  const activeIndex = NAV_ITEMS.findIndex((item) => item.id === activePage);

  return (
    <div
      className="sidebar"
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <div className="nav">
        <div
          className="nav-indicator"
          style={{ "--nav-y": `${activeIndex * 42}px` } as React.CSSProperties}
        />
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item${activePage === id ? " active" : ""}`}
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
      <div className="sidebar-resizer" onMouseDown={onStartResizing} />
    </div>
  );
}
