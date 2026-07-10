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

type BindFilterPhase = "entering" | "exiting" | "steady";

interface TransitionedBind extends FilteredBind {
  phase: BindFilterPhase;
}

function bindId({ bind, sourceIndex }: FilteredBind): string {
  return `${sourceIndex}:${bind.key}:${bind.command}`;
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
  const [renderedBinds, setRenderedBinds] = useState<TransitionedBind[]>(() =>
    filteredBinds.map<TransitionedBind>((item) => ({
      ...item,
      phase: "steady",
    })),
  );
  const selectedKeysSignature = selectedKeys.join("+");
  const previousSelectedKeysSignature = useRef(selectedKeysSignature);

  useLayoutEffect(() => {
    const isKeyboardFilterChange =
      previousSelectedKeysSignature.current !== selectedKeysSignature;
    previousSelectedKeysSignature.current = selectedKeysSignature;

    setRenderedBinds((previous) => {
      if (!isKeyboardFilterChange) {
        return filteredBinds.map<TransitionedBind>((item) => ({
          ...item,
          phase: "steady",
        }));
      }

      const nextById = new Map(
        filteredBinds.map((item) => [bindId(item), item]),
      );
      const previousById = new Map(
        previous.map((item) => [bindId(item), item]),
      );
      const ids = new Set([...previousById.keys(), ...nextById.keys()]);

      return [...ids]
        .map((id): TransitionedBind => {
          const next = nextById.get(id);
          const current = previousById.get(id);

          if (!next && current) return { ...current, phase: "exiting" };
          if (next && !current) return { ...next, phase: "entering" };
          return {
            ...next!,
            phase: current!.phase === "exiting" ? "steady" : current!.phase,
          };
        })
        .sort((a, b) => a.sourceIndex - b.sourceIndex);
    });
  }, [filteredBinds, selectedKeysSignature]);

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

  const showEmptyState =
    !isLoading && filteredBinds.length === 0 && renderedBinds.length === 0;
  const showList =
    !isLoading && (filteredBinds.length > 0 || renderedBinds.length > 0);

  const settleBindFilterTransition = (id: string) => {
    setRenderedBinds((previous) =>
      previous
        .filter((item) => !(bindId(item) === id && item.phase === "exiting"))
        .map((item) =>
          bindId(item) === id && item.phase === "entering"
            ? { ...item, phase: "steady" }
            : item,
        ),
    );
  };

  return (
    <div className="page-container binds-page">
      <BindsHeader
        selectedKeys={selectedKeys}
        search={search}
        setSearch={setSearch}
        onToggleSelectedKey={handleKeyboardKey}
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
            onKeyClick={handleKeyboardKey}
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
        <div className="binds-empty">
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
        <div className="binds-list-wrap">
          {renderedBinds.map(({ bind, sourceIndex, phase }) => {
            const hasConflict =
              bind.key !== "" && (keyConflicts.get(bind.key) ?? 0) > 1;
            const id = `${sourceIndex}:${bind.key}:${bind.command}`;
            return (
              <div
                className={`bind-list-item bind-list-item-${phase}`}
                key={id}
                onAnimationEnd={(event) => {
                  if (event.currentTarget === event.target) {
                    settleBindFilterTransition(id);
                  }
                }}
              >
                <div
                  className={`bind-row ${newBindIndex === sourceIndex ? "bind-row-new" : ""} ${exitingBindIndex === sourceIndex ? "exiting" : ""}`}
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
