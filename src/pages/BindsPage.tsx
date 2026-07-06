import { useMemo, useState } from "react";
import type { Bind, CommandPreset } from "../types";
import { ChevronIcon, TrashIcon, SearchIcon, PlusIcon } from "../icons";
import { Keyboard } from "../components/Keyboard";
import { keyDisplayName } from "../keyboardLayout";

interface BindsPageProps {
  filteredBinds: Bind[];
  commandPresets: CommandPreset[];
  search: string;
  setSearch: (v: string) => void;
  addBind: () => void;
  addFromPreset: (command: string) => void;
  removeBind: (idx: number) => void;
  confirmRemoveBind: (idx: number) => void;
  editingKeyIndex: number | null;
  setEditingKeyIndex: (v: number | null) => void;
  newBindIndex: number | null;
  setNewBindIndex: (v: number | null) => void;
  exitingBindIndex: number | null;
  flashIndex: number | null;
  keyConflicts: Map<string, number>;
  usedKeys: Set<string>;
  nameFor: (command: string) => string;
  updateBindCommand: (idx: number, cmd: string) => void;
  handleKeyboardKey: (rustKey: string) => void;
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
  commandPresets,
  search,
  setSearch,
  addBind,
  addFromPreset,
  removeBind,
  confirmRemoveBind,
  editingKeyIndex,
  setEditingKeyIndex,
  newBindIndex,
  setNewBindIndex,
  exitingBindIndex,
  flashIndex,
  keyConflicts,
  usedKeys,
  nameFor,
  updateBindCommand,
  handleKeyboardKey,
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
  const isAnyDropdownOpen = openDropdownIndex !== null;

  // "Выбрать из списка" picker — independent from the per-row action dropdown.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerKind, setPickerKind] = useState<"single" | "combination">(
    "single",
  );

  const pickerPresets = useMemo(() => {
    const list = commandPresets.filter((p) => p.kind === pickerKind);
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.command.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [commandPresets, pickerKind, pickerSearch]);

  const closePicker = () => {
    setPickerOpen(false);
    setPickerSearch("");
  };

  return (
    <div className="page-container binds-page">
      <div className="header-row">
        <div className="search">
          <SearchIcon />
          <input
            type="text"
            placeholder="Поиск по названию"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="header-actions">
          <button className="btn-add" type="button" onClick={addBind}>
            <PlusIcon />
            Создать вручную
          </button>
          <div className="picker-container">
            <button
              className="btn-add"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPickerOpen((v) => !v);
              }}
            >
              Выбрать из списка
              <ChevronIcon />
            </button>
            {pickerOpen && (
              <>
                <div className="picker-backdrop" onClick={closePicker} />
                <div className="dropdown-base dropdown-menu open down picker-menu">
                  <div className="dropdown-kind-toggle">
                    <button
                      className={`kind-btn${pickerKind === "single" ? " active" : ""}`}
                      type="button"
                      onClick={() => setPickerKind("single")}
                    >
                      Обычные
                    </button>
                    <button
                      className={`kind-btn${pickerKind === "combination" ? " active" : ""}`}
                      type="button"
                      onClick={() => setPickerKind("combination")}
                    >
                      Комбинации
                    </button>
                  </div>
                  <div className="dropdown-search">
                    <SearchIcon />
                    <input
                      type="text"
                      placeholder="Поиск действия..."
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {pickerPresets.map((preset) => (
                    <button
                      key={preset.command}
                      className="dropdown-item"
                      type="button"
                      onClick={() => {
                        addFromPreset(preset.command);
                        closePicker();
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="keyboard-panel">
        <Keyboard
          usedKeys={usedKeys}
          listening={editingKeyIndex !== null}
          onKeyClick={handleKeyboardKey}
        />
      </div>

      <div
        className={`binds-list-wrap ${isAnyDropdownOpen ? "dropdown-open" : ""}`}
      >
        {filteredBinds.map((bind, index) => {
          const hasConflict =
            bind.key !== "" && (keyConflicts.get(bind.key) ?? 0) > 1;
          const isDropdownOpen = openDropdownIndex === index;
          const isDropdownClosing = closingDropdownIndex === index;
          return (
            <div
              className={`bind-row ${isDropdownOpen ? "has-open-dropdown" : ""} ${isDropdownClosing ? "dropdown-closing" : ""} ${newBindIndex === index ? "bind-row-new" : ""} ${exitingBindIndex === index ? "exiting" : ""} ${flashIndex === index ? "flash" : ""} ${editingKeyIndex === index ? "selected" : ""}`}
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
              <div className="action-cell-container">
                <button
                  className="action-cell"
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropdownDir(
                      window.innerHeight - rect.bottom < 230 ? "up" : "down",
                    );
                    changeOpenDropdown(
                      openDropdownIndex === index ? null : index,
                    );
                  }}
                >
                  {bind.command ? nameFor(bind.command) : "Выберите действие"}
                  <ChevronIcon />
                </button>
                <div
                  className={`dropdown-base dropdown-menu ${openDropdownIndex === index ? "open" : ""} ${dropdownDir}`}
                >
                  {(isDropdownOpen || isDropdownClosing) && (
                    <>
                      <div className="dropdown-kind-toggle">
                        <button
                          className={`kind-btn${filterKind === "single" ? " active" : ""}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterKind("single");
                          }}
                        >
                          Обычные
                        </button>
                        <button
                          className={`kind-btn${filterKind === "combination" ? " active" : ""}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterKind("combination");
                          }}
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
                          onChange={(e) => setCommandSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                    </>
                  )}
                  {(isDropdownOpen || isDropdownClosing) &&
                    filteredCommandPresets.map((preset) => (
                      <button
                        key={preset.command}
                        className="dropdown-item"
                        type="button"
                        onClick={() => updateBindCommand(index, preset.command)}
                      >
                        {preset.name}
                      </button>
                    ))}
                </div>
              </div>

              <div
                className={`key-badge bind-key-slot ${editingKeyIndex === index ? "editing" : ""} ${hasConflict ? "conflict" : ""}`}
                onClick={() =>
                  setEditingKeyIndex(editingKeyIndex === index ? null : index)
                }
              >
                {editingKeyIndex === index
                  ? "Выберите клавишу..."
                  : bind.key
                    ? keyDisplayName(bind.key)
                    : "—"}
              </div>

              <div className="delete-btn" onClick={() => removeBind(index)}>
                <TrashIcon />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
