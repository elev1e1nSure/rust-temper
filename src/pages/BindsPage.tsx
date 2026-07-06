import {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Bind, CommandPreset } from "../types";
import {
  ChevronIcon,
  TrashIcon,
  SearchIcon,
  PlusIcon,
  CloseIcon,
  CommandIcon,
  DragIcon,
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

type ActionMode = "toggle" | "hold";
const KEY_EXIT_MS = 120;

interface DraftAction {
  id: number;
  command: string;
  mode: ActionMode;
}

function commandWithoutMode(command: string): string {
  return command.replace(/^[+~]/, "");
}

function AnimatedHeight({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const updateHeight = () => setHeight(content.scrollHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`bind-config-animated-height ${className}`}
      style={height === undefined ? undefined : { height }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
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
  const [draftActions, setDraftActions] = useState<DraftAction[]>([]);
  const [draftKeys, setDraftKeys] = useState<string[]>([]);
  const [exitingDraftKeys, setExitingDraftKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [exitingSelectedKeys, setExitingSelectedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [draggedActionId, setDraggedActionId] = useState<number | null>(null);
  const [dragOverActionId, setDragOverActionId] = useState<number | null>(null);
  const nextDraftActionId = useRef(0);
  const draggedActionIdRef = useRef<number | null>(null);
  const draftKeyRemovalTimers = useRef(new Map<string, number>());
  const selectedKeyRemovalTimers = useRef(new Map<string, number>());

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
    setExitingDraftKeys(new Set());
    for (const timer of draftKeyRemovalTimers.current.values()) {
      window.clearTimeout(timer);
    }
    draftKeyRemovalTimers.current.clear();
    setDraggedActionId(null);
    setDragOverActionId(null);
    draggedActionIdRef.current = null;
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
      setDraftActions((actions) => [
        ...actions,
        {
          id: ++nextDraftActionId.current,
          command,
          mode: command.startsWith("~") ? "toggle" : "hold",
        },
      ]);
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
    const pendingRemoval = draftKeyRemovalTimers.current.get(rustKey);
    if (pendingRemoval !== undefined) {
      window.clearTimeout(pendingRemoval);
      draftKeyRemovalTimers.current.delete(rustKey);
      setExitingDraftKeys((keys) => {
        const next = new Set(keys);
        next.delete(rustKey);
        return next;
      });
      return;
    }

    if (!draftKeys.includes(rustKey)) {
      setDraftKeys((keys) => [...keys, rustKey]);
      return;
    }

    setExitingDraftKeys((keys) => new Set(keys).add(rustKey));
    const timer = window.setTimeout(() => {
      setDraftKeys((keys) => keys.filter((key) => key !== rustKey));
      setExitingDraftKeys((keys) => {
        const next = new Set(keys);
        next.delete(rustKey);
        return next;
      });
      draftKeyRemovalTimers.current.delete(rustKey);
    }, KEY_EXIT_MS);
    draftKeyRemovalTimers.current.set(rustKey, timer);
  };

  const toggleSelectedKey = (rustKey: string) => {
    const pendingRemoval = selectedKeyRemovalTimers.current.get(rustKey);
    if (pendingRemoval !== undefined) {
      window.clearTimeout(pendingRemoval);
      selectedKeyRemovalTimers.current.delete(rustKey);
      setExitingSelectedKeys((keys) => {
        const next = new Set(keys);
        next.delete(rustKey);
        return next;
      });
      return;
    }

    if (!selectedKeys.includes(rustKey)) {
      handleKeyboardKey(rustKey);
      return;
    }

    setExitingSelectedKeys((keys) => new Set(keys).add(rustKey));
    const timer = window.setTimeout(() => {
      handleKeyboardKey(rustKey);
      setExitingSelectedKeys((keys) => {
        const next = new Set(keys);
        next.delete(rustKey);
        return next;
      });
      selectedKeyRemovalTimers.current.delete(rustKey);
    }, KEY_EXIT_MS);
    selectedKeyRemovalTimers.current.set(rustKey, timer);
  };

  useEffect(
    () => () => {
      for (const timer of draftKeyRemovalTimers.current.values()) {
        window.clearTimeout(timer);
      }
      for (const timer of selectedKeyRemovalTimers.current.values()) {
        window.clearTimeout(timer);
      }
    },
    [],
  );

  const removeDraftAction = (id: number) => {
    setDraftActions((actions) => actions.filter((action) => action.id !== id));
  };

  const setDraftActionMode = (id: number, mode: ActionMode) => {
    setDraftActions((actions) =>
      actions.map((action) =>
        action.id === id ? { ...action, mode } : action,
      ),
    );
  };

  const moveDraftAction = (targetId: number) => {
    const draggedId = draggedActionIdRef.current;
    if (draggedId === null || draggedId === targetId) return;
    setDraftActions((actions) => {
      const fromIndex = actions.findIndex((action) => action.id === draggedId);
      const targetIndex = actions.findIndex((action) => action.id === targetId);
      if (fromIndex === -1 || targetIndex === -1) return actions;
      const reordered = [...actions];
      const [draggedAction] = reordered.splice(fromIndex, 1);
      reordered.splice(targetIndex, 0, draggedAction);
      return reordered;
    });
  };

  const configureAnotherAction = () => {
    setManualSearch("");
    setCommandModal((modal) => (modal ? { ...modal, step: "select" } : null));
  };

  const submitBind = () => {
    if (draftKeys.length === 0 || draftActions.length === 0) return;
    const key =
      draftKeys.length === 1 ? draftKeys[0] : `[${draftKeys.join("+")}]`;
    const command = draftActions
      .map((action) => {
        if (commandModal?.kind !== "single") return action.command;
        const prefix = action.mode === "toggle" ? "~" : "+";
        return `${prefix}${commandWithoutMode(action.command)}`;
      })
      .join(";");
    addBind(key, command);
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
              className={`key-filter-chip ${exitingSelectedKeys.has(k) ? "exiting" : ""}`}
              onClick={() => toggleSelectedKey(k)}
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
        <Keyboard
          selectedKeys={selectedKeys}
          exitingKeys={exitingSelectedKeys}
          onKeyClick={toggleSelectedKey}
        />
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
                    <AnimatedHeight className="bind-config-key-height">
                      <div
                        className={`bind-config-value ${draftKeys.length > 0 ? "has-keys" : ""}`}
                      >
                        {draftKeys.length > 0 ? (
                          draftKeys.map((key, index) => (
                            <span
                              className={`bind-config-key-group ${exitingDraftKeys.has(key) ? "exiting" : ""}`}
                              key={key}
                              style={{ animationDelay: `${index * 35}ms` }}
                            >
                              <span className="bind-config-key-card">
                                {keyDisplayName(key)}
                              </span>
                              {index < draftKeys.length - 1 && (
                                <span className="bind-config-key-plus">+</span>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="bind-config-key-placeholder">
                            Выберите клавишу на клавиатуре
                          </span>
                        )}
                      </div>
                    </AnimatedHeight>
                    <div className="bind-config-keyboard">
                      <Keyboard
                        selectedKeys={draftKeys}
                        exitingKeys={exitingDraftKeys}
                        onKeyClick={toggleDraftKey}
                      />
                    </div>
                  </div>

                  <div className="bind-config-section">
                    <div className="bind-config-label">Действия</div>
                    <AnimatedHeight className="bind-config-actions-height">
                      <div className="bind-config-actions">
                        {draftActions.map((action, index) => (
                          <div
                            className={`bind-config-action ${draggedActionId === action.id ? "dragging" : ""} ${dragOverActionId === action.id && draggedActionId !== action.id ? "drag-over" : ""}`}
                            key={action.id}
                            style={{ animationDelay: `${index * 40}ms` }}
                            draggable={
                              commandModal.kind === "single" &&
                              draftActions.length > 1
                            }
                            onDragStart={(event) => {
                              draggedActionIdRef.current = action.id;
                              setDraggedActionId(action.id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData(
                                "text/plain",
                                String(action.id),
                              );
                            }}
                            onDragEnter={() => setDragOverActionId(action.id)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              moveDraftAction(action.id);
                              setDragOverActionId(null);
                            }}
                            onDragEnd={() => {
                              draggedActionIdRef.current = null;
                              setDraggedActionId(null);
                              setDragOverActionId(null);
                            }}
                          >
                            {commandModal.kind === "single" &&
                              draftActions.length > 1 && (
                                <div className="bind-config-drag-handle">
                                  <DragIcon />
                                </div>
                              )}
                            <div className="bind-config-action-copy">
                              <div className="manual-modal-row-name">
                                {nameFor(action.command)}
                              </div>
                              <div className="manual-modal-row-id">
                                {commandModal.kind === "single"
                                  ? `${action.mode === "toggle" ? "~" : "+"}${commandWithoutMode(action.command)}`
                                  : action.command}
                              </div>
                            </div>
                            {commandModal.kind === "single" && (
                              <div className="bind-config-mode-switch">
                                <button
                                  className={
                                    action.mode === "toggle" ? "active" : ""
                                  }
                                  type="button"
                                  onClick={() =>
                                    setDraftActionMode(action.id, "toggle")
                                  }
                                >
                                  Переключатель
                                </button>
                                <button
                                  className={
                                    action.mode === "hold" ? "active" : ""
                                  }
                                  type="button"
                                  onClick={() =>
                                    setDraftActionMode(action.id, "hold")
                                  }
                                >
                                  Удержание
                                </button>
                              </div>
                            )}
                            {commandModal.kind === "single" &&
                              draftActions.length > 1 && (
                                <button
                                  className="bind-config-remove"
                                  type="button"
                                  onClick={() => removeDraftAction(action.id)}
                                >
                                  Убрать
                                </button>
                              )}
                          </div>
                        ))}
                      </div>
                    </AnimatedHeight>
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
