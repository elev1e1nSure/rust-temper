import { useEffect, useMemo, useState } from "react";
import type { Bind, CommandPreset } from "../types";

export function useBindEditor(commandPresets: CommandPreset[]) {
  const [binds, setBinds] = useState<Bind[]>([]);
  const [search, setSearch] = useState("");
  // Keys picked on the on-screen keyboard, in press order. Together they form a
  // combination that filters the list below and seeds the key of new binds.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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
    const selectedSet = new Set(selectedKeys);
    return binds.filter((bind) => {
      if (selectedKeys.length > 0) {
        // Match the whole combination regardless of the order keys were pressed.
        // Rust stores combos as "[a+b]"; a single key has no brackets.
        const tokens = bind.key
          .replace(/^\[|\]$/g, "")
          .split("+")
          .filter(Boolean);
        if (
          tokens.length !== selectedSet.size ||
          !tokens.every((t) => selectedSet.has(t))
        ) {
          return false;
        }
      }
      if (!query) return true;
      return (
        bind.key.toLowerCase().includes(query) ||
        nameFor(bind.command).toLowerCase().includes(query) ||
        bind.command.toLowerCase().includes(query)
      );
    });
  }, [binds, search, selectedKeys, presetByCommand]);

  // Rust bind key: bare token for one key, bracketed "[a+b]" for a combination.
  const selectedKeyCombo =
    selectedKeys.length <= 1
      ? (selectedKeys[0] ?? "")
      : `[${selectedKeys.join("+")}]`;

  const scrollListToTop = () => {
    requestAnimationFrame(() => {
      document
        .querySelector(".binds-list-wrap")
        ?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  // "Создать вручную" — empty row, action picked via dropdown; key comes from
  // the currently selected keyboard combination (if any).
  const addBind = () => {
    setBinds((prev) => [{ key: selectedKeyCombo, command: "" }, ...prev]);
    setNewBindIndex(0);
    scrollListToTop();
  };

  // "Выбрать из списка" — row seeded with a known action, keyed like addBind.
  const addFromPreset = (command: string) => {
    setBinds((prev) => [{ key: selectedKeyCombo, command }, ...prev]);
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
  // key in the filter combination.
  const handleKeyboardKey = (rustKey: string) => {
    if (editingKeyIndex !== null) {
      assignKey(editingKeyIndex, rustKey);
      return;
    }
    setSelectedKeys((prev) =>
      prev.includes(rustKey)
        ? prev.filter((k) => k !== rustKey)
        : [...prev, rustKey],
    );
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
    selectedKeys,
    setSelectedKeys,
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
