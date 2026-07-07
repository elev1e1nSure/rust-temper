import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { CommandPreset, FilteredBind } from "../types";
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
import { parseCombo, formatCombo } from "../utils/bindKey";
import { AnimatedHeight } from "../components/layout/AnimatedHeight";

interface BindsPageProps {
  filteredBinds: FilteredBind[];
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
  updateBind: (idx: number, key: string, cmd: string) => void;
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

// `html { zoom }` (App.css) scales layout, so getBoundingClientRect()/clientX/Y
// report real viewport pixels while inline style px values are pre-zoom and
// get re-multiplied by this factor on render — divide by it before applying.
function getCssZoomFactor(): number {
  const zoom = parseFloat(getComputedStyle(document.documentElement).zoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
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
  updateBind,
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

  const [draggedActionId, setDraggedActionId] = useState<number | null>(null);
  const [dragOverlay, setDragOverlay] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const nextDraftActionId = useRef(0);
  const draggedActionIdRef = useRef<number | null>(null);
  const actionRowRefs = useRef(new Map<number, HTMLDivElement>());
  const dragPointerOffsetRef = useRef({ x: 0, y: 0 });
  const prevActionRectsRef = useRef<Map<number, DOMRect> | null>(null);
  const draftKeyRemovalTimers = useRef(new Map<string, number>());

  const manualPresets = useMemo(() => {
    if (!commandModal) return [];
    const q = manualSearch.trim().toLowerCase();
    return commandPresets.filter(
      (preset) =>
        preset.kind === commandModal.kind &&
        (!q ||
          preset.name.toLowerCase().includes(q) ||
          preset.command.toLowerCase().includes(q)),
    );
  }, [commandModal, commandPresets, manualSearch]);

  // Defers unmounting until the close animation finishes (see
  // handleManualModalAnimationEnd), instead of clearing the target instantly.
  const closeManualModal = useCallback(() => {
    if (commandModal === null || manualModalClosing) return;
    setManualModalClosing(true);
  }, [commandModal, manualModalClosing]);

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
  }, [commandModal, closeManualModal]);

  const selectCommand = (command: string) => {
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
  };

  const parseCommandToActions = (
    command: string,
    kind: CommandModalKind,
  ): DraftAction[] => {
    return command.split(";").map((part) => {
      let mode: ActionMode = "hold";
      let cmd = part;
      if (kind === "single") {
        if (part.startsWith("~")) {
          mode = "toggle";
          cmd = part.slice(1);
        } else if (part.startsWith("+")) {
          cmd = part.slice(1);
        }
      }
      return { id: ++nextDraftActionId.current, command: cmd, mode };
    });
  };

  const openCommandModal = (
    kind: CommandModalKind,
    target: CommandModalState["target"],
  ) => {
    setCommandModal({ kind, target, step: "select" });
    if (typeof target === "number") {
      const existingBind = filteredBinds.find(
        (fb) => fb.sourceIndex === target,
      )?.bind;
      const keys = existingBind?.key ? parseCombo(existingBind.key) : [];
      setDraftKeys(keys);
      setDraftActions(
        existingBind?.command
          ? parseCommandToActions(existingBind.command, kind)
          : [],
      );
    } else {
      setDraftKeys(selectedKeys);
      setDraftActions([]);
    }
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
    handleKeyboardKey(rustKey);
  };

  useEffect(
    () => () => {
      for (const timer of draftKeyRemovalTimers.current.values()) {
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

  // Custom pointer-based reordering: native HTML5 drag-and-drop shows a
  // permanent "not-allowed" OS cursor in the WebView2 runtime regardless of
  // dropEffect/preventDefault, so dragging is implemented by hand instead.
  const startActionDrag = (event: React.MouseEvent, id: number) => {
    event.preventDefault();
    const startEl = actionRowRefs.current.get(id);
    if (!startEl) return;
    const startRect = startEl.getBoundingClientRect();
    dragPointerOffsetRef.current = {
      x: event.clientX - startRect.left,
      y: event.clientY - startRect.top,
    };
    draggedActionIdRef.current = id;
    setDraggedActionId(id);
    setDragOverlay({
      x: startRect.left,
      y: startRect.top,
      width: startRect.width,
      height: startRect.height,
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const draggedId = draggedActionIdRef.current;
      if (draggedId === null) return;
      const { x: offsetX, y: offsetY } = dragPointerOffsetRef.current;
      setDragOverlay({
        x: moveEvent.clientX - offsetX,
        y: moveEvent.clientY - offsetY,
        width: startRect.width,
        height: startRect.height,
      });

      const mouseY = moveEvent.clientY;
      setDraftActions((actions) => {
        const dragged = actions.find((action) => action.id === draggedId);
        if (!dragged) return actions;
        const others = actions.filter((action) => action.id !== draggedId);

        let targetIndex = 0;
        for (const other of others) {
          const el = actionRowRefs.current.get(other.id);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (mouseY > rect.top + rect.height / 2) targetIndex++;
        }

        const reordered = [...others];
        reordered.splice(targetIndex, 0, dragged);
        const unchanged = reordered.every(
          (action, index) => action.id === actions[index]!.id,
        );
        if (unchanged) return actions;

        // Snapshot pre-reorder row positions so the FLIP effect below can
        // animate the shift instead of letting the flex layout snap instantly.
        const rects = new Map<number, DOMRect>();
        for (const [rowId, rowEl] of actionRowRefs.current) {
          if (rowId !== draggedId) {
            rects.set(rowId, rowEl.getBoundingClientRect());
          }
        }
        prevActionRectsRef.current = rects;
        return reordered;
      });
    };

    const handleMouseUp = () => {
      draggedActionIdRef.current = null;
      setDraggedActionId(null);
      setDragOverlay(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // FLIP: rows displaced by a reorder are nudged back to their previous
  // screen position with no transition, then released into an animated
  // transition to their new resting spot, instead of snapping instantly.
  useLayoutEffect(() => {
    const prevRects = prevActionRectsRef.current;
    if (!prevRects) return;
    prevActionRectsRef.current = null;

    for (const [rowId, rowEl] of actionRowRefs.current) {
      const prevRect = prevRects.get(rowId);
      if (!prevRect) continue;
      const newRect = rowEl.getBoundingClientRect();
      const deltaY = prevRect.top - newRect.top;
      if (!deltaY) continue;
      rowEl.style.transition = "none";
      rowEl.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        rowEl.style.transition =
          "transform 0.22s cubic-bezier(0.2, 0.85, 0.25, 1)";
        rowEl.style.transform = "";
      });
    }
  }, [draftActions]);

  const configureAnotherAction = () => {
    setManualSearch("");
    setCommandModal((modal) => (modal ? { ...modal, step: "select" } : null));
  };

  const submitBind = () => {
    if (draftKeys.length === 0 || draftActions.length === 0) return;
    const key = formatCombo(draftKeys);
    const command = draftActions
      .map((action) => {
        if (commandModal?.kind !== "single") return action.command;
        const prefix = action.mode === "toggle" ? "~" : "+";
        return `${prefix}${commandWithoutMode(action.command)}`;
      })
      .join(";");
    if (commandModal?.target === "new") {
      addBind(key, command);
    } else if (typeof commandModal?.target === "number") {
      updateBind(commandModal.target, key, command);
    }
    closeManualModal();
  };

  const draggedAction =
    draggedActionId !== null
      ? draftActions.find((action) => action.id === draggedActionId)
      : undefined;

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
        <Keyboard selectedKeys={selectedKeys} onKeyClick={toggleSelectedKey} />
      </div>

      <div className="binds-list-wrap">
        {filteredBinds.map(({ bind, sourceIndex }) => {
          const hasConflict =
            bind.key !== "" && (keyConflicts.get(bind.key) ?? 0) > 1;
          return (
            <div
              className={`bind-row ${newBindIndex === sourceIndex ? "bind-row-new" : ""} ${exitingBindIndex === sourceIndex ? "exiting" : ""}`}
              key={`${bind.key}-${bind.command}-${sourceIndex}`}
              onAnimationEnd={() => {
                if (exitingBindIndex === sourceIndex) {
                  confirmRemoveBind(sourceIndex);
                }
                if (newBindIndex === sourceIndex) {
                  setNewBindIndex(null);
                }
              }}
            >
              <button
                className="action-cell"
                type="button"
                onClick={() => openBindCommandModal(sourceIndex, bind.command)}
              >
                {bind.command ? nameFor(bind.command) : "Выберите действие"}
                <ChevronIcon />
              </button>

              <div
                className={`key-badge bind-key-slot ${hasConflict ? "conflict" : ""}`}
              >
                {bind.key ? keyDisplayName(bind.key) : "—"}
              </div>

              <div
                className="delete-btn"
                onClick={() => removeBind(sourceIndex)}
              >
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
                              style={{ "--anim-delay": `${index * 35}ms` } as React.CSSProperties}
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
                            ref={(el) => {
                              if (el) actionRowRefs.current.set(action.id, el);
                              else actionRowRefs.current.delete(action.id);
                            }}
                            className={`bind-config-action ${draggedActionId === action.id ? "dragging" : ""}`}
                            key={action.id}
                            style={{ "--anim-delay": `${index * 40}ms` } as React.CSSProperties}
                          >
                            {commandModal.kind === "single" &&
                              draftActions.length > 1 && (
                                <div
                                  className="bind-config-drag-handle"
                                  onMouseDown={(event) =>
                                    startActionDrag(event, action.id)
                                  }
                                >
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
                      {commandModal?.target === "new"
                        ? "Добавить"
                        : "Сохранить"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {dragOverlay && draggedAction && (
              <div
                className="bind-config-action-overlay"
                style={{
                  "--overlay-x": `${dragOverlay.x / getCssZoomFactor()}px`,
                  "--overlay-y": `${dragOverlay.y / getCssZoomFactor()}px`,
                  "--overlay-w": `${dragOverlay.width / getCssZoomFactor()}px`,
                  "--overlay-h": `${dragOverlay.height / getCssZoomFactor()}px`,
                } as React.CSSProperties}
              >
                <div className="bind-config-drag-handle">
                  <DragIcon />
                </div>
                <div className="bind-config-action-copy">
                  <div className="manual-modal-row-name">
                    {nameFor(draggedAction.command)}
                  </div>
                  <div className="manual-modal-row-id">
                    {commandModal?.kind === "single"
                      ? `${draggedAction.mode === "toggle" ? "~" : "+"}${commandWithoutMode(draggedAction.command)}`
                      : draggedAction.command}
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
