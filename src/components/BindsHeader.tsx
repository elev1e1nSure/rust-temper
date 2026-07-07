import { SearchIcon, PlusIcon, ChevronIcon } from "../icons";
import { keyDisplayName } from "../keyboardLayout";
import type { CommandModalKind } from "./CommandModal";

interface BindsHeaderProps {
  selectedKeys: string[];
  search: string;
  setSearch: (v: string) => void;
  onToggleSelectedKey: (key: string) => void;
  onOpenCommandModal: (kind: CommandModalKind, target: "new") => void;
}

export function BindsHeader({
  selectedKeys,
  search,
  setSearch,
  onToggleSelectedKey,
  onOpenCommandModal,
}: BindsHeaderProps) {
  return (
    <div className="header-row">
      <div className="search binds-search">
        <SearchIcon />
        {selectedKeys.map((k) => (
          <button
            key={k}
            type="button"
            className="key-filter-chip"
            onClick={() => onToggleSelectedKey(k)}
            title="Убрать клавишу из комбинации"
          >
            {keyDisplayName(k)}
            <span className="key-filter-chip-x">×</span>
          </button>
        ))}
        <input
          type="text"
          placeholder="Поиск по названию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="header-actions">
        <button
          className="btn-add"
          type="button"
          onClick={() => onOpenCommandModal("single", "new")}
        >
          <PlusIcon />
          Создать вручную
        </button>
        <button
          className="btn-add"
          type="button"
          onClick={() => onOpenCommandModal("combination", "new")}
        >
          Выбрать из списка
          <ChevronIcon />
        </button>
      </div>
    </div>
  );
}
