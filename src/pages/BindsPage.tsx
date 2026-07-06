import type { Bind, CommandPreset } from "../types";
import { Tooltip } from "../Tooltip";
import { ChevronIcon, TrashIcon, SearchIcon, PlusIcon } from "../icons";

interface BindsPageProps {
  binds: Bind[];
  filteredBinds: Bind[];
  search: string;
  setSearch: (v: string) => void;
  addBind: () => void;
  removeBind: (idx: number) => void;
  confirmRemoveBind: (idx: number) => void;
  editingKeyIndex: number | null;
  setEditingKeyIndex: (v: number | null) => void;
  newBindIndex: number | null;
  setNewBindIndex: (v: number | null) => void;
  exitingBindIndex: number | null;
  keyConflicts: Map<string, number>;
  nameFor: (command: string) => string;
  descriptionFor: (command: string) => string;
  updateBindCommand: (idx: number, cmd: string) => void;
  openDropdownIndex: number | null;
  closingDropdownIndex: number | null;
  changeOpenDropdown: (next: number | null) => void;
  commandSearch: string;
  setCommandSearch: (v: string) => void;
  filteredCommandPresets: CommandPreset[];
  dropdownDir: "down" | "up";
  setDropdownDir: (v: "down" | "up") => void;
  filterKind: "single" | "combination";
  setFilterKind: (v: "single" | "combination") => void;
}

export function BindsPage({
  filteredBinds,
  search,
  setSearch,
  addBind,
  removeBind,
  confirmRemoveBind,
  editingKeyIndex,
  setEditingKeyIndex,
  newBindIndex,
  setNewBindIndex,
  exitingBindIndex,
  keyConflicts,
  nameFor,
  descriptionFor,
  updateBindCommand,
  openDropdownIndex,
  closingDropdownIndex,
  changeOpenDropdown,
  commandSearch,
  setCommandSearch,
  filteredCommandPresets,
  dropdownDir,
  setDropdownDir,
  filterKind,
  setFilterKind,
}: BindsPageProps) {
  const isAnyDropdownOpen =
    openDropdownIndex !== null || closingDropdownIndex !== null;

  return (
    <div className="page-container binds-page">
      <div className="header-row">
        <div className="header-actions">
          <div className="search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Поиск бинда..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-add" type="button" onClick={addBind}>
            <PlusIcon />
            Добавить бинд
          </button>
        </div>
      </div>

      <div className={`table-wrap ${isAnyDropdownOpen ? "dropdown-open" : ""}`}>
        <div className="col-headers">
          <div className="col-key">Клавиша</div>
          <div className="col-action">Действие</div>
        </div>
        <div className="binds-body">
          {filteredBinds.map((bind, index) => {
            const hasConflict =
              bind.key !== "" && (keyConflicts.get(bind.key) ?? 0) > 1;
            const isDropdownOpen = openDropdownIndex === index;
            const isDropdownClosing = closingDropdownIndex === index;
            return (
              <div
                className={`bind-row ${isDropdownOpen ? "has-open-dropdown" : ""} ${isDropdownClosing ? "dropdown-closing" : ""} ${newBindIndex === index ? "bind-row-new" : ""} ${exitingBindIndex === index ? "exiting" : ""}`}
                key={`${bind.key}-${bind.command}-${index}`}
                onAnimationEnd={() => {
                  if (exitingBindIndex === index) {
                    confirmRemoveBind(index);
                  }
                  if (newBindIndex === index) {
                    setNewBindIndex(null);
                  }
                }}
              >
                <div className="key-cell">
                  <Tooltip
                    content={
                      hasConflict
                        ? "Эта клавиша уже используется другим биндом"
                        : null
                    }
                  >
                    <div
                      className={`key-badge ${editingKeyIndex === index ? "editing" : ""} ${hasConflict ? "conflict" : ""}`}
                      onClick={() => setEditingKeyIndex(index)}
                    >
                      {editingKeyIndex === index
                        ? "Нажмите клавишу..."
                        : bind.key || "—"}
                    </div>
                  </Tooltip>
                </div>
                <div className="action-cell-container">
                  <Tooltip content={descriptionFor(bind.command)}>
                    <button
                      className="action-cell"
                      type="button"
                      onClick={(e) => {
                        const rect =
                          e.currentTarget.getBoundingClientRect();
                        setDropdownDir(
                          window.innerHeight - rect.bottom < 230
                            ? "up"
                            : "down",
                        );
                        changeOpenDropdown(
                          openDropdownIndex === index ? null : index,
                        );
                      }}
                    >
                      {bind.command
                        ? nameFor(bind.command)
                        : "Выберите действие"}
                      <ChevronIcon />
                    </button>
                  </Tooltip>
                  <div
                    className={`dropdown-base dropdown-menu ${openDropdownIndex === index ? "open" : ""} ${dropdownDir}`}
                  >
                    {(isDropdownOpen || isDropdownClosing) && (
                      <>
                        <div className="dropdown-kind-toggle">
                          <button
                            className={`kind-btn${filterKind === "single" ? " active" : ""}`}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setFilterKind("single"); }}
                          >
                            Обычные
                          </button>
                          <button
                            className={`kind-btn${filterKind === "combination" ? " active" : ""}`}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setFilterKind("combination"); }}
                          >
                            Комбинации
                          </button>
                        </div>
                        <div className="dropdown-search">
                          <SearchIcon />
                          <input
                            type="text"
                            placeholder="Поиск действия..."
                            value={commandSearch}
                            onChange={(e) =>
                              setCommandSearch(e.target.value)
                            }
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                      </>
                    )}
                    {(isDropdownOpen || isDropdownClosing) &&
                      filteredCommandPresets.map((preset) => (
                        <Tooltip
                          key={preset.command}
                          content={preset.description}
                        >
                          <button
                            className="dropdown-item"
                            type="button"
                            onClick={() =>
                              updateBindCommand(index, preset.command)
                            }
                          >
                            {preset.name}
                          </button>
                        </Tooltip>
                      ))}
                  </div>
                </div>
                <div
                  className="delete-btn"
                  onClick={() => removeBind(index)}
                >
                  <TrashIcon />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
