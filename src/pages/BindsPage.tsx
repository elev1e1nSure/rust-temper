import { useState } from "react";
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
            <PlusIcon />
            Создать бинд
          </button>
        </div>
      ) : showList ? (
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
                  onClick={() =>
                    openBindCommandModal(sourceIndex, bind.command)
                  }
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
