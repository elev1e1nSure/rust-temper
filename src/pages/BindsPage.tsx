import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Bind, CommandPreset } from "../types";
import {
  ChevronIcon,
  TrashIcon,
  SearchIcon,
  PlusIcon,
  CloseIcon,
  CommandIcon,
} from "../icons";
import { Keyboard } from "../components/Keyboard";
import { keyDisplayName } from "../keyboardLayout";

interface BindsPageProps {
  filteredBinds: Bind[];
  commandPresets: CommandPreset[];
  search: string;
  setSearch: (v: string) => void;
  addFromPreset: (command: string) => void;
  removeBind: (idx: number) => void;
  confirmRemoveBind: (idx: number) => void;
  newBindIndex: number | null;
  setNewBindIndex: (v: number | null) => void;
  exitingBindIndex: number | null;
  keyConflicts: Map<string, number>;
  selectedKeys: string[];
  setSelectedKeys: (v: string[]) => void;
  nameFor: (command: string) => string;
  updateBindCommand: (idx: number, cmd: string) => void;
  handleKeyboardKey: (rustKey: string) => void;
}

type CommandModalKind = CommandPreset["kind"];

interface CommandModalState {
  kind: CommandModalKind;
  target: number | "new";
}

export function BindsPage({
  filteredBinds,
  commandPresets,
  search,
  setSearch,
  addFromPreset,
  removeBind,
  confirmRemoveBind,
  newBindIndex,
  setNewBindIndex,
  exitingBindIndex,
  keyConflicts,
  selectedKeys,
  setSelectedKeys,
  nameFor,
  updateBindCommand,
  handleKeyboardKey,
}: BindsPageProps) {
  const [commandModal, setCommandModal] = useState<CommandModalState | null>(
    null,
  );
  const [manualModalClosing, setManualModalClosing] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualCustomMode, setManualCustomMode] = useState(false);
  const [manualCustomCommand, setManualCustomCommand] = useState("");

  const manualPresets = useMemo(() => {
    if (!commandModal) return [];
    const q = manualSearch.trim().toLowerCase();
    return commandPresets.filter(
      (preset) =>
        preset.kind === commandModal.kind &&
        (!q ||
          preset.name.toLowerCase().includes(q) ||
          preset.command.toLowerCase().includes(q) ||
          preset.description.toLowerCase().includes(q)),
    );
  }, [commandModal, commandPresets, manualSearch]);

  // Defers unmounting until the close animation finishes (see
  // handleManualModalAnimationEnd), instead of clearing the target instantly.
  const closeManualModal = () => {
    if (commandModal === null || manualModalClosing) return;
    setManualModalClosing(true);
  };

  const handleManualModalAnimationEnd = (
    e: React.AnimationEvent<HTMLDivElement>,
  ) => {
    if (e.target !== e.currentTarget || !manualModalClosing) return;
    setCommandModal(null);
    setManualModalClosing(false);
    setManualSearch("");
    setManualCustomMode(false);
    setManualCustomCommand("");
  };

  // Lock background scroll and allow Escape to close while the modal is open.
  useEffect(() => {
    if (commandModal === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeManualModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandModal]);

  const selectCommand = (command: string) => {
    if (commandModal?.target === "new") {
      addFromPreset(command);
    } else if (typeof commandModal?.target === "number") {
      updateBindCommand(commandModal.target, command);
    }
    closeManualModal();
  };

  const openCommandModal = (
    kind: CommandModalKind,
    target: CommandModalState["target"],
  ) => {
    setCommandModal({ kind, target });
  };

  const openBindCommandModal = (index: number, command: string) => {
    const kind =
      commandPresets.find((preset) => preset.command === command)?.kind ??
      "single";
    openCommandModal(kind, index);
  };

  const submitManualCustomCommand = () => {
    const command = manualCustomCommand.trim();
    if (!command) return;
    selectCommand(command);
  };

  return (
    <div className="page-container binds-page">
      <div className="header-row">
        <div className="search binds-search">
          <SearchIcon />
          {selectedKeys.map((k) => (
            <button
              key={k}
              type="button"
              className="key-filter-chip"
              onClick={() =>
                setSelectedKeys(selectedKeys.filter((x) => x !== k))
              }
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
            onClick={() => openCommandModal("single", "new")}
          >
            <PlusIcon />
            Создать вручную
          </button>
          <button
            className="btn-add"
            type="button"
            onClick={() => openCommandModal("combination", "new")}
          >
            Выбрать из списка
            <ChevronIcon />
          </button>
        </div>
      </div>

      <div className="keyboard-panel">
        <Keyboard selectedKeys={selectedKeys} onKeyClick={handleKeyboardKey} />
      </div>

      <div className="binds-list-wrap">
        {filteredBinds.map((bind, index) => {
          const hasConflict =
            bind.key !== "" && (keyConflicts.get(bind.key) ?? 0) > 1;
          return (
            <div
              className={`bind-row ${newBindIndex === index ? "bind-row-new" : ""} ${exitingBindIndex === index ? "exiting" : ""}`}
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
              <button
                className="action-cell"
                type="button"
                onClick={() => openBindCommandModal(index, bind.command)}
              >
                {bind.command ? nameFor(bind.command) : "Выберите действие"}
                <ChevronIcon />
              </button>

              <div
                className={`key-badge bind-key-slot ${hasConflict ? "conflict" : ""}`}
              >
                {bind.key ? keyDisplayName(bind.key) : "—"}
              </div>

              <div className="delete-btn" onClick={() => removeBind(index)}>
                <TrashIcon />
              </div>
            </div>
          );
        })}
      </div>

      {commandModal !== null &&
        createPortal(
          <div
            className={`manual-modal-backdrop ${manualModalClosing ? "closing" : ""}`}
            onClick={closeManualModal}
            onAnimationEnd={handleManualModalAnimationEnd}
          >
            <div className="manual-modal" onClick={(e) => e.stopPropagation()}>
              <div className="manual-modal-header">
                <h2>
                  {commandModal.kind === "single"
                    ? "Простые команды"
                    : "Составные команды"}
                </h2>
                <button
                  className="manual-modal-close"
                  type="button"
                  onClick={closeManualModal}
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="manual-modal-toolbar">
                <div className="dropdown-search manual-modal-search">
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder="Поиск по названию"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {commandModal.kind === "single" && (
                  <button
                    className={`manual-modal-plus ${manualCustomMode ? "active" : ""}`}
                    type="button"
                    title="Ввести команду вручную"
                    onClick={() => setManualCustomMode((v) => !v)}
                  >
                    <PlusIcon />
                  </button>
                )}
              </div>

              {commandModal.kind === "single" && manualCustomMode && (
                <div className="manual-modal-custom-row">
                  <input
                    type="text"
                    placeholder="Название команды, например audio.master"
                    value={manualCustomCommand}
                    onChange={(e) => setManualCustomCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitManualCustomCommand();
                    }}
                    autoFocus
                  />
                  <button
                    className="manual-modal-add-btn"
                    type="button"
                    disabled={!manualCustomCommand.trim()}
                    onClick={submitManualCustomCommand}
                  >
                    Добавить
                  </button>
                </div>
              )}

              <div className="manual-modal-list">
                {manualPresets.map((preset) => (
                  <div className="manual-modal-row" key={preset.command}>
                    <div className="manual-modal-row-icon">
                      <CommandIcon />
                    </div>
                    <div className="manual-modal-row-text">
                      <div className="manual-modal-row-name">{preset.name}</div>
                      <div className="manual-modal-row-id">
                        {preset.command}
                      </div>
                    </div>
                    <button
                      className="manual-modal-add-btn"
                      type="button"
                      onClick={() => selectCommand(preset.command)}
                    >
                      Добавить
                    </button>
                  </div>
                ))}
                {manualPresets.length === 0 && (
                  <div className="manual-modal-empty">Ничего не найдено</div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
