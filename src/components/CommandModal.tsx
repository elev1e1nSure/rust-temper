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
  BackIcon,
  CheckIcon,
  SearchIcon,
  PlusIcon,
  CloseIcon,
  CommandIcon,
  DragIcon,
  TrashIcon,
} from "../icons";
import { Keyboard } from "./Keyboard";
import { keyDisplayName } from "../keyboardLayout";
import { parseCombo, formatCombo } from "../utils/bindKey";
import { AnimatedHeight } from "./layout/AnimatedHeight";

export type CommandModalKind = CommandPreset["kind"];

interface CommandModalState {
  kind: CommandModalKind;
  target: number | "new";
  step: "select" | "configure";
}

type ActionMode = "toggle" | "hold";
const KEY_EXIT_MS = 120;
const MODAL_KIND_ORDER: CommandModalKind[] = ["single", "combination"];

interface DraftAction {
  id: number;
  command: string;
  mode: ActionMode;
}

interface CommandModalProps {
  kind: CommandModalKind;
  target: number | "new";
  filteredBinds: FilteredBind[];
  selectedKeys: string[];
  occupiedKeys: ReadonlySet<string>;
  commandPresets: CommandPreset[];
  nameFor: (command: string) => string;
  addBind: (key: string, command: string) => void;
  updateBind: (idx: number, key: string, cmd: string) => void;
  onClose: () => void;
}

function commandWithoutMode(command: string): string {
  return command.replace(/^[+~]/, "");
}

function commandDisplay(command: string): string {
  return command.split(";").map(commandWithoutMode).join(";");
}

function modePrefixedCommand(action: DraftAction): string {
  const prefix = action.mode === "toggle" ? "~" : "+";
  return `${prefix}${commandWithoutMode(action.command)}`;
}

function modeFromCommand(command: string): ActionMode {
  return command.startsWith("~") ? "toggle" : "hold";
}

function presetListKey(preset: CommandPreset): string {
  return [preset.kind, preset.command, preset.defaultMode, preset.name].join(
    ":",
  );
}

function getCssZoomFactor(): number {
  const zoom = parseFloat(getComputedStyle(document.documentElement).zoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

export function CommandModal({
  kind,
  target,
  filteredBinds,
  selectedKeys,
  occupiedKeys,
  commandPresets,
  nameFor,
  addBind,
  updateBind,
  onClose,
}: CommandModalProps) {
  const [commandModal, setCommandModal] = useState<CommandModalState>({
    kind,
    target,
    step: "select",
  });
  const [manualModalClosing, setManualModalClosing] = useState(false);
  const [kindSlide, setKindSlide] = useState<{
    kind: CommandModalKind;
    direction: "left" | "right";
  } | null>(null);
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
  const initializedRef = useRef(false);

  const manualPresets = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    return commandPresets.filter(
      (preset) =>
        preset.kind === commandModal.kind &&
        (!q ||
          preset.name.toLowerCase().includes(q) ||
          preset.command.toLowerCase().includes(q)),
    );
  }, [commandModal, commandPresets, manualSearch]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (typeof target === "number") {
      const existingBind = filteredBinds.find(
        (fb) => fb.sourceIndex === target,
      )?.bind;
      const keys = existingBind?.key ? parseCombo(existingBind.key) : [];
      setDraftKeys(keys);
      if (existingBind?.command) {
        const actions = existingBind.command.split(";").map((part) => {
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
          return {
            id: ++nextDraftActionId.current,
            command: cmd,
            mode,
          };
        });
        setDraftActions(actions);
      }
    } else {
      setDraftKeys(selectedKeys);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeManualModal = useCallback(() => {
    if (manualModalClosing) return;
    setManualModalClosing(true);
  }, [manualModalClosing]);

  const setModalKind = useCallback((nextKind: CommandModalKind) => {
    setCommandModal((modal) => {
      if (modal.kind === nextKind) return modal;
      setKindSlide({
        kind: nextKind,
        direction:
          MODAL_KIND_ORDER.indexOf(nextKind) >
          MODAL_KIND_ORDER.indexOf(modal.kind)
            ? "right"
            : "left",
      });
      return { ...modal, kind: nextKind };
    });
    setManualSearch("");
    setManualCustomMode(false);
    setManualCustomCommand("");
  }, []);

  const handleManualModalAnimationEnd = (
    e: React.AnimationEvent<HTMLDivElement>,
  ) => {
    if (e.target !== e.currentTarget || !manualModalClosing) return;
    setCommandModal({ kind, target, step: "select" });
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
    onClose();
  };

  useEffect(() => {
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
  }, [closeManualModal]);

  useEffect(
    () => () => {
      for (const timer of draftKeyRemovalTimers.current.values()) {
        window.clearTimeout(timer);
      }
    },
    [],
  );

  const selectCommand = (
    command: string,
    defaultMode: ActionMode = modeFromCommand(command),
  ) => {
    setDraftActions((actions) => [
      ...actions,
      {
        id: ++nextDraftActionId.current,
        command:
          commandModal.kind === "single"
            ? commandWithoutMode(command)
            : command,
        mode: defaultMode,
      },
    ]);
    setCommandModal((modal) => ({ ...modal, step: "configure" }));
    setManualSearch("");
    setManualCustomMode(false);
    setManualCustomCommand("");
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
    setCommandModal((modal) => ({ ...modal, step: "select" }));
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

    if (typeof commandModal?.target === "number") {
      updateBind(commandModal.target, key, command);
    } else {
      addBind(key, command);
    }
    closeManualModal();
  };

  const draggedAction =
    draggedActionId !== null
      ? draftActions.find((action) => action.id === draggedActionId)
      : undefined;
  const isSingleKind = commandModal.kind === "single";

  return createPortal(
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
          <div className="manual-modal-header-main">
            <h2>
              {commandModal.step === "configure"
                ? "Настройка бинда"
                : commandModal.kind === "single"
                  ? "Простые команды"
                  : "Составные команды"}
            </h2>
          </div>
          <button
            className="manual-modal-close"
            type="button"
            onClick={closeManualModal}
          >
            <span className="action-icon" aria-hidden="true">
              <CloseIcon />
            </span>
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
              <button
                className={`manual-modal-plus ${manualCustomMode ? "active" : ""} ${isSingleKind ? "" : "hidden"}`}
                type="button"
                title={isSingleKind ? "Ввести команду вручную" : undefined}
                aria-hidden={!isSingleKind}
                tabIndex={isSingleKind ? 0 : -1}
                disabled={!isSingleKind}
                onClick={() => {
                  if (isSingleKind) setManualCustomMode((v) => !v);
                }}
              >
                <span className="action-icon" aria-hidden="true">
                  <PlusIcon />
                </span>
              </button>
            </div>

            <div
              className={`manual-modal-kind-switch is-${commandModal.kind}`}
              aria-label="Тип команд"
              role="tablist"
            >
              <button
                className={commandModal.kind === "single" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={commandModal.kind === "single"}
                onClick={() => setModalKind("single")}
              >
                Простые
              </button>
              <button
                className={commandModal.kind === "combination" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={commandModal.kind === "combination"}
                onClick={() => setModalKind("combination")}
              >
                Составные
              </button>
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
                  <span className="action-icon" aria-hidden="true">
                    <PlusIcon />
                  </span>
                  Добавить
                </button>
              </div>
            )}

            <div
              className={`manual-modal-list-wrap ${
                kindSlide?.kind === commandModal.kind
                  ? `slide-${kindSlide.direction}`
                  : ""
              }`}
              key={commandModal.kind}
            >
              <div className="manual-modal-list">
                {manualPresets.map((preset) => (
                  <div className="manual-modal-row" key={presetListKey(preset)}>
                    <div className="manual-modal-row-icon">
                      <CommandIcon />
                    </div>
                    <div className="manual-modal-row-text">
                      <div className="manual-modal-row-name">{preset.name}</div>
                      <div className="manual-modal-row-id">
                        {commandDisplay(preset.command)}
                      </div>
                    </div>
                    <button
                      className="manual-modal-add-btn"
                      type="button"
                      onClick={() =>
                        selectCommand(preset.command, preset.defaultMode)
                      }
                    >
                      <span className="action-icon" aria-hidden="true">
                        <PlusIcon />
                      </span>
                      Добавить
                    </button>
                  </div>
                ))}
                {manualPresets.length === 0 && (
                  <div className="manual-modal-empty">Ничего не найдено</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bind-config-content">
            <div className="bind-config-section">
              <div className="bind-config-label">Клавиша или сочетание</div>
              <AnimatedHeight className="bind-config-key-height">
                <div
                  className={`bind-config-value ${draftKeys.length > 0 ? "has-keys" : ""}`}
                >
                  {draftKeys.length > 0 ? (
                    draftKeys.map((key, index) => (
                      <span
                        className={`bind-config-key-group ${exitingDraftKeys.has(key) ? "exiting" : ""}`}
                        key={key}
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
                  occupiedKeys={occupiedKeys}
                  exitingKeys={exitingDraftKeys}
                  onKeyClick={toggleDraftKey}
                />
              </div>
            </div>

            <div className="bind-config-section">
              <div className="bind-config-label">Действия</div>
              <AnimatedHeight className="bind-config-actions-height">
                <div className="bind-config-actions">
                  {draftActions.map((action) => (
                    <div
                      ref={(el) => {
                        if (el) actionRowRefs.current.set(action.id, el);
                        else actionRowRefs.current.delete(action.id);
                      }}
                      className={`bind-config-action ${draggedActionId === action.id ? "dragging" : ""}`}
                      key={action.id}
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
                          {nameFor(
                            commandModal.kind === "single"
                              ? modePrefixedCommand(action)
                              : action.command,
                          )}
                        </div>
                        <div className="manual-modal-row-id">
                          {commandModal.kind === "single"
                            ? commandWithoutMode(action.command)
                            : commandDisplay(action.command)}
                        </div>
                      </div>
                      {commandModal.kind === "single" && (
                        <div className="bind-config-mode-switch">
                          <button
                            className={action.mode === "toggle" ? "active" : ""}
                            type="button"
                            onClick={() =>
                              setDraftActionMode(action.id, "toggle")
                            }
                          >
                            Переключатель
                          </button>
                          <button
                            className={action.mode === "hold" ? "active" : ""}
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
                            <span className="action-icon" aria-hidden="true">
                              <TrashIcon />
                            </span>
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
                  <span className="action-icon" aria-hidden="true">
                    <PlusIcon />
                  </span>
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
                <span className="action-icon" aria-hidden="true">
                  <BackIcon />
                </span>
                Отмена
              </button>
              <button
                className="bind-config-submit"
                type="button"
                disabled={draftKeys.length === 0 || draftActions.length === 0}
                onClick={submitBind}
              >
                <span className="action-icon" aria-hidden="true">
                  <CheckIcon />
                </span>
                {target === "new" ? "Добавить" : "Сохранить"}
              </button>
            </div>
          </div>
        )}
      </div>
      {dragOverlay && draggedAction && (
        <div
          className="bind-config-action-overlay"
          style={
            {
              "--overlay-x": `${dragOverlay.x / getCssZoomFactor()}px`,
              "--overlay-y": `${dragOverlay.y / getCssZoomFactor()}px`,
              "--overlay-w": `${dragOverlay.width / getCssZoomFactor()}px`,
              "--overlay-h": `${dragOverlay.height / getCssZoomFactor()}px`,
            } as React.CSSProperties
          }
        >
          <div className="bind-config-drag-handle">
            <DragIcon />
          </div>
          <div className="bind-config-action-copy">
            <div className="manual-modal-row-name">
              {nameFor(
                commandModal?.kind === "single"
                  ? modePrefixedCommand(draggedAction)
                  : draggedAction.command,
              )}
            </div>
            <div className="manual-modal-row-id">
              {commandModal?.kind === "single"
                ? commandWithoutMode(draggedAction.command)
                : commandDisplay(draggedAction.command)}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
