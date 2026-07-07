import { useState } from "react";
import type { CommandPreset, DisplayBind, FilteredBind } from "../types";
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
  displayBinds: DisplayBind[];
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

interface CommandModalTarget {
  kind: CommandModalKind;
  target: number | "new";
}

export function BindsPage({
  filteredBinds,
  displayBinds,
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
        <Keyboard selectedKeys={selectedKeys} onKeyClick={handleKeyboardKey} />
      </div>

      {filteredBinds.length === 0 ? (
        <div className="binds-empty">
          <div className="binds-empty-icon">
            <KeyboardIcon size={32} />
          </div>
          <p>Биндов нет</p>
          <button
            className="btn-add"
            type="button"
            onClick={() => openCommandModal("single", "new")}
          >
            <PlusIcon />
            Создать бинд
          </button>
        </div>
      ) : (
        <div className="binds-list-wrap">
          {displayBinds.map(({ bind, sourceIndex, matched }) => {
            const hasConflict =
              bind.key !== "" && (keyConflicts.get(bind.key) ?? 0) > 1;
            return (
              // Grid 1fr->0fr collapses the row to its exact height with no
              // measurement, so the panel (sum of rows) resizes in sync with
              // the rows themselves instead of lagging behind them.
              <div
                className={`bind-row-collapse ${matched ? "" : "filtered-out"}`}
                key={`${bind.key}-${bind.command}-${sourceIndex}`}
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
              </div>
            );
          })}
        </div>
      )}

      {commandModalState !== null && (
        <CommandModal
          kind={commandModalState.kind}
          target={commandModalState.target}
          filteredBinds={filteredBinds}
          selectedKeys={selectedKeys}
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
