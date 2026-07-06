import { useEffect, useMemo, useState } from "react";
import type { Bind, CommandPreset } from "../types";

export function useBindEditor(commandPresets: CommandPreset[]) {
  const [binds, setBinds] = useState<Bind[]>([]);
  const [search, setSearch] = useState("");
  // Key picked on the on-screen keyboard; acts as a filter for the list below
  // and seeds the key of any bind created while it is active.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Row whose key is being re-assigned via the next on-screen keyboard click.
  const [editingKeyIndex, setEditingKeyIndex] = useState<number | null>(null);
  const [newBindIndex, setNewBindIndex] = useState<number | null>(null);
  const [exitingBindIndex, setExitingBindIndex] = useState<number | null>(null);

  const presetByCommand = useMemo(
    () => new Map(commandPresets.map((p) => [p.command, p])),
    [commandPresets],
  );

  const nameFor = (command: string) =>
    presetByCommand.get(command)?.name ?? command;

  const keyConflicts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bind of binds) {
      if (!bind.key) continue;
      counts.set(bind.key, (counts.get(bind.key) ?? 0) + 1);
    }
    return counts;
  }, [binds]);

  const filteredBinds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return binds.filter((bind) => {
      if (selectedKey && bind.key !== selectedKey) return false;
      if (!query) return true;
      return (
        bind.key.toLowerCase().includes(query) ||
        nameFor(bind.command).toLowerCase().includes(query) ||
        bind.command.toLowerCase().includes(query)
      );
    });
  }, [binds, search, selectedKey, presetByCommand]);

  const scrollListToTop = () => {
    requestAnimationFrame(() => {
      document
        .querySelector(".binds-list-wrap")
        ?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  // "Создать вручную" — empty row, action picked via dropdown; key comes from
  // the currently selected keyboard key (if any).
  const addBind = () => {
    setBinds((prev) => [{ key: selectedKey ?? "", command: "" }, ...prev]);
    setNewBindIndex(0);
    scrollListToTop();
  };

  // "Выбрать из списка" — row seeded with a known action, keyed like addBind.
  const addFromPreset = (command: string) => {
    setBinds((prev) => [{ key: selectedKey ?? "", command }, ...prev]);
    setNewBindIndex(0);
    scrollListToTop();
  };

  const removeBind = (index: number) => {
    if (editingKeyIndex === index) setEditingKeyIndex(null);
    setExitingBindIndex(index);
  };

  const confirmRemoveBind = (index: number) => {
    setBinds((prev) => prev.filter((_, i) => i !== index));
    setExitingBindIndex(null);
  };

  const updateBindCommand = (index: number, newCommand: string) => {
    setBinds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], command: newCommand };
      return next;
    });
  };

  const assignKey = (index: number, rustKey: string) => {
    setBinds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], key: rustKey };
      return next;
    });
    setEditingKeyIndex(null);
  };

  // On-screen keyboard click: assign to a row being edited, otherwise toggle the
  // key filter (select / deselect).
  const handleKeyboardKey = (rustKey: string) => {
    if (editingKeyIndex !== null) {
      assignKey(editingKeyIndex, rustKey);
      return;
    }
    setSelectedKey((current) => (current === rustKey ? null : rustKey));
  };

  // Escape cancels an in-progress key edit.
  useEffect(() => {
    if (editingKeyIndex === null) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingKeyIndex(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [editingKeyIndex]);

  return {
    binds,
    setBinds,
    search,
    setSearch,
    selectedKey,
    setSelectedKey,
    editingKeyIndex,
    setEditingKeyIndex,
    newBindIndex,
    setNewBindIndex,
    exitingBindIndex,
    setExitingBindIndex,
    nameFor,
    keyConflicts,
    filteredBinds,
    addBind,
    addFromPreset,
    removeBind,
    confirmRemoveBind,
    updateBindCommand,
    assignKey,
    handleKeyboardKey,
  };
}
