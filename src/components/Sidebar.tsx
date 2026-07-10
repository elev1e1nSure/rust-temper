import type { PageId } from "../navigation";
import { NAV_ITEMS } from "../navigation";
import "./Sidebar.css";

const NAV_ITEM_HEIGHT = 46;
const NAV_ITEM_GAP = 6;

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
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
          "--nav-item-height": `${NAV_ITEM_HEIGHT}px`,
          "--nav-gap": `${NAV_ITEM_GAP}px`,
          "--nav-y": `${activeIndex * (NAV_ITEM_HEIGHT + NAV_ITEM_GAP)}px`,
        } as React.CSSProperties
      }
    >
      <div className="nav">
        <div className="nav-indicator" />
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item${activePage === id ? " active" : ""}`}
            onClick={() => onNavigate(id)}
          >
            <span className="nav-icon" aria-hidden="true">
              <Icon size={22} />
            </span>
            {label}
          </button>
        ))}
      </div>
      <div className="sidebar-resizer" onMouseDown={onStartResizing} />
    </div>
  );
}
