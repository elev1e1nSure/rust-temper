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
  addBind: (key: string, command: string) => void;
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
  step: "select" | "configure";
}

export function BindsPage({
  filteredBinds,
  commandPresets,
  search,
  setSearch,
  addBind,
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
  const [draftActions, setDraftActions] = useState<string[]>([]);
  const [draftKeys, setDraftKeys] = useState<string[]>([]);

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
    setDraftActions([]);
    setDraftKeys([]);
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
      setDraftActions((actions) => [...actions, command]);
      setCommandModal((modal) =>
        modal ? { ...modal, step: "configure" } : null,
      );
      setManualSearch("");
      setManualCustomMode(false);
      setManualCustomCommand("");
      return;
    } else if (typeof commandModal?.target === "number") {
      updateBindCommand(commandModal.target, command);
    }
    closeManualModal();
  };

  const openCommandModal = (
    kind: CommandModalKind,
    target: CommandModalState["target"],
  ) => {
    setCommandModal({ kind, target, step: "select" });
    setDraftKeys(selectedKeys);
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

  const toggleDraftKey = (rustKey: string) => {
    setDraftKeys((keys) =>
      keys.includes(rustKey)
        ? keys.filter((key) => key !== rustKey)
        : [...keys, rustKey],
    );
  };

  const removeDraftAction = (index: number) => {
    setDraftActions((actions) =>
      actions.filter((_, actionIndex) => actionIndex !== index),
    );
  };

  const configureAnotherAction = () => {
    setManualSearch("");
    setCommandModal((modal) => (modal ? { ...modal, step: "select" } : null));
  };

  const submitBind = () => {
    if (draftKeys.length === 0 || draftActions.length === 0) return;
    const key =
      draftKeys.length === 1 ? draftKeys[0] : `[${draftKeys.join("+")}]`;
    addBind(key, draftActions.join(";"));
    closeManualModal();
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
            <div
              className={`manual-modal ${commandModal.step === "configure" ? "bind-config-modal" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="manual-modal-header">
                <h2>
                  {commandModal.step === "configure"
                    ? "Настройка бинда"
                    : commandModal.kind === "single"
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

              {commandModal.step === "select" ? (
                <>
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
                          <div className="manual-modal-row-name">
                            {preset.name}
                          </div>
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
                      <div className="manual-modal-empty">
                        Ничего не найдено
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bind-config-content">
                  <div className="bind-config-section">
                    <div className="bind-config-label">
                      Клавиша или сочетание
                    </div>
                    <div className="bind-config-value">
                      {draftKeys.length > 0
                        ? draftKeys.map(keyDisplayName).join(" + ")
                        : "Выберите клавишу на клавиатуре"}
                    </div>
                    <div className="bind-config-keyboard">
                      <Keyboard
                        selectedKeys={draftKeys}
                        onKeyClick={toggleDraftKey}
                      />
                    </div>
                  </div>

                  <div className="bind-config-section">
                    <div className="bind-config-label">Действия</div>
                    <div className="bind-config-actions">
                      {draftActions.map((action, index) => (
                        <div
                          className="bind-config-action"
                          key={`${action}-${index}`}
                        >
                          <div>
                            <div className="manual-modal-row-name">
                              {nameFor(action)}
                            </div>
                            <div className="manual-modal-row-id">{action}</div>
                          </div>
                          {commandModal.kind === "single" &&
                            draftActions.length > 1 && (
                              <button
                                className="bind-config-remove"
                                type="button"
                                onClick={() => removeDraftAction(index)}
                              >
                                Убрать
                              </button>
                            )}
                        </div>
                      ))}
                    </div>
                    {commandModal.kind === "single" && (
                      <button
                        className="bind-config-add-action"
                        type="button"
                        onClick={configureAnotherAction}
                      >
                        <PlusIcon />
                        Добавить ещё действие
                      </button>
                    )}
                  </div>

                  <div className="bind-config-footer">
                    <button
                      className="bind-config-cancel"
                      type="button"
                      onClick={closeManualModal}
                    >
                      Отмена
                    </button>
                    <button
                      className="bind-config-submit"
                      type="button"
                      disabled={
                        draftKeys.length === 0 || draftActions.length === 0
                      }
                      onClick={submitBind}
                    >
                      Добавить
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
