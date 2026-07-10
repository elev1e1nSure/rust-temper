import { useLayoutEffect, useRef, useState } from "react";
import type { CommandPreset, FilteredBind } from "../types";
import { ChevronIcon, KeyboardIcon, PlusIcon, TrashIcon } from "../icons";
import { Keyboard } from "../components/Keyboard";
import { keyDisplayName } from "../keyboardLayout";
import { BindsHeader } from "../components/BindsHeader";
import {
  CommandModal,
  type CommandModalKind,
} from "../components/CommandModal";

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
  occupiedKeys: ReadonlySet<string>;
  isLoading: boolean;
  nameFor: (command: string) => string;
  updateBind: (idx: number, key: string, cmd: string) => void;
  handleKeyboardKey: (rustKey: string) => void;
}

interface CommandModalTarget {
  kind: CommandModalKind;
  target: number | "new";
}

interface BindFilterLayout {
  surfaceHeight: number;
  wasEmpty: boolean;
  rowTops: Map<string, number>;
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
  occupiedKeys,
  isLoading,
  nameFor,
  updateBind,
  handleKeyboardKey,
}: BindsPageProps) {
  const [commandModalState, setCommandModalState] =
    useState<CommandModalTarget | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFilterLayout = useRef<BindFilterLayout | null>(null);
  const filterAnimations = useRef<Animation[]>([]);
  const selectedKeysSignature = selectedKeys.join("+");

  useLayoutEffect(() => {
    const previous = pendingFilterLayout.current;
    const list = listRef.current;
    const empty = emptyRef.current;
    pendingFilterLayout.current = null;

    if (!previous || (!list && !empty)) return;

    const options: KeyframeAnimationOptions = {
      duration: 260,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    };
    const animations: Animation[] = [];

    if (list) {
      const nextListHeight = list.getBoundingClientRect().height;
      const rows = [...rowRefs.current];
      const hasNewRows = rows.some(([id]) => !previous.rowTops.has(id));

      if (Math.abs(previous.surfaceHeight - nextListHeight) > 0.5) {
        animations.push(
          list.animate(
            [
              { height: `${previous.surfaceHeight}px` },
              { height: `${nextListHeight}px` },
            ],
            options,
          ),
        );
      }

      if (hasNewRows) {
        animations.push(
          list.animate(
            [
              {
                clipPath: "inset(0 0 100% 0)",
                transform: "translateY(-6px)",
              },
              { clipPath: "inset(0)", transform: "none" },
            ],
            options,
          ),
        );
      } else {
        for (const [id, row] of rows) {
          const previousTop = previous.rowTops.get(id);
          if (previousTop === undefined) continue;

          const offset = previousTop - row.getBoundingClientRect().top;
          if (Math.abs(offset) < 0.5) continue;

          animations.push(
            row.animate(
              [{ transform: `translateY(${offset}px)` }, { transform: "none" }],
              options,
            ),
          );
        }
      }
    } else if (empty && !previous.wasEmpty) {
      animations.push(
        empty.animate(
          [
            {
              clipPath: "inset(0 0 100% 0)",
              transform: "translateY(-8px)",
            },
            {
              clipPath: "inset(0)",
              transform: "none",
            },
          ],
          options,
        ),
      );
    }

    filterAnimations.current = animations;
  }, [filteredBinds, selectedKeysSignature]);

  const handleAnimatedKeyboardKey = (rustKey: string) => {
    const list = listRef.current;
    const empty = emptyRef.current;
    const surface = list ?? empty;

    if (surface) {
      pendingFilterLayout.current = {
        surfaceHeight: surface.getBoundingClientRect().height,
        wasEmpty: empty !== null,
        rowTops: new Map(
          [...rowRefs.current].map(([id, row]) => [
            id,
            row.getBoundingClientRect().top,
          ]),
        ),
      };
    }

    for (const animation of filterAnimations.current) animation.cancel();
    filterAnimations.current = [];
    handleKeyboardKey(rustKey);
  };

  const openCommandModal = (kind: CommandModalKind, target: number | "new") => {
    setCommandModalState({ kind, target });
  };

  const closeCommandModal = () => {
    setCommandModalState(null);
  };

  const openBindCommandModal = (index: number, command: string) => {
    const kind =
      commandPresets.find((preset) => preset.command === command)?.kind ??
      "single";
    openCommandModal(kind, index);
  };

  const showEmptyState = !isLoading && filteredBinds.length === 0;
  const showList = !isLoading && filteredBinds.length > 0;

  return (
    <div className="page-container binds-page">
      <BindsHeader
        selectedKeys={selectedKeys}
        search={search}
        setSearch={setSearch}
        onToggleSelectedKey={handleAnimatedKeyboardKey}
        onOpenCommandModal={openCommandModal}
      />

      <div className="keyboard-panel">
        {isLoading ? (
          <div className="kb-skeleton" aria-hidden="true">
            <div className="kb-skeleton-row">
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-gap" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
            </div>
            <div className="kb-skeleton-row">
              <span className="kb-skeleton-key w-10" />
              <span className="kb-skeleton-key w-7" />
              <span className="kb-skeleton-key w-7" />
              <span className="kb-skeleton-key w-7" />
              <span className="kb-skeleton-key w-7" />
              <span className="kb-skeleton-key w-12" />
            </div>
            <div className="kb-skeleton-row">
              <span className="kb-skeleton-key w-12" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-14" />
            </div>
            <div className="kb-skeleton-row">
              <span className="kb-skeleton-key w-14" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-8" />
              <span className="kb-skeleton-key w-16" />
            </div>
          </div>
        ) : (
          <Keyboard
            selectedKeys={selectedKeys}
            occupiedKeys={occupiedKeys}
            onKeyClick={handleAnimatedKeyboardKey}
          />
        )}
      </div>

      {isLoading ? (
        <div className="binds-skeleton" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="binds-skeleton-row" key={index}>
              <div className="binds-skeleton-action" />
              <div className="binds-skeleton-key" />
              <div className="binds-skeleton-delete" />
            </div>
          ))}
        </div>
      ) : showEmptyState ? (
        <div className="binds-empty" ref={emptyRef}>
          <div className="binds-empty-icon binds-empty-icon-soft">
            <KeyboardIcon size={32} />
          </div>
          <p>Здесь пока пусто</p>
          <span className="binds-empty-copy">
            Выбери команду из списка или создай свой бинд вручную.
          </span>
          <button
            className="btn-add"
            type="button"
            onClick={() => openCommandModal("single", "new")}
          >
            <span className="action-icon" aria-hidden="true">
              <PlusIcon />
            </span>
            Создать бинд
          </button>
        </div>
      ) : showList ? (
        <div className="binds-list-wrap" ref={listRef}>
          {filteredBinds.map(({ bind, sourceIndex }) => {
            const hasConflict =
              bind.key !== "" && (keyConflicts.get(bind.key) ?? 0) > 1;
            const id = `${sourceIndex}:${bind.key}:${bind.command}`;
            return (
              <div
                className={`bind-row ${newBindIndex === sourceIndex ? "bind-row-new" : ""} ${exitingBindIndex === sourceIndex ? "exiting" : ""}`}
                key={id}
                ref={(element) => {
                  if (element) rowRefs.current.set(id, element);
                  else rowRefs.current.delete(id);
                }}
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
                  onClick={() =>
                    openBindCommandModal(sourceIndex, bind.command)
                  }
                >
                  {bind.command ? nameFor(bind.command) : "Выберите действие"}
                  <span className="action-icon" aria-hidden="true">
                    <ChevronIcon />
                  </span>
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
                  <span className="action-icon" aria-hidden="true">
                    <TrashIcon />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {commandModalState !== null && (
        <CommandModal
          kind={commandModalState.kind}
          target={commandModalState.target}
          filteredBinds={filteredBinds}
          selectedKeys={selectedKeys}
          occupiedKeys={occupiedKeys}
          commandPresets={commandPresets}
          nameFor={nameFor}
          addBind={addBind}
          updateBind={updateBind}
          onClose={closeCommandModal}
        />
      )}
    </div>
  );
}
