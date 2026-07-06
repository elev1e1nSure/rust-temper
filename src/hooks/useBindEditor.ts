import { useEffect, useMemo, useRef, useState } from "react";
import type { Bind, CommandPreset } from "../types";

export function useBindEditor(commandPresets: CommandPreset[]) {
  const [binds, setBinds] = useState<Bind[]>([]);
  const [search, setSearch] = useState("");
  // Index of the selected row; its key is assigned by clicking the on-screen keyboard.
  const [editingKeyIndex, setEditingKeyIndex] = useState<number | null>(null);
  const [newBindIndex, setNewBindIndex] = useState<number | null>(null);
  const [exitingBindIndex, setExitingBindIndex] = useState<number | null>(null);
  // Row briefly highlighted after clicking its key on the virtual keyboard.
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);

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

  const usedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const bind of binds) {
      if (bind.key) set.add(bind.key);
    }
    return set;
  }, [binds]);

  const filteredBinds = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return binds;
    return binds.filter(
      (bind) =>
        bind.key.toLowerCase().includes(query) ||
        nameFor(bind.command).toLowerCase().includes(query) ||
        bind.command.toLowerCase().includes(query),
    );
  }, [binds, search, presetByCommand]);

  const scrollListToTop = () => {
    requestAnimationFrame(() => {
      document
        .querySelector(".binds-list-wrap")
        ?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  // "Создать вручную" — empty row, action picked via dropdown, listening for a key.
  const addBind = () => {
    setBinds((prev) => [{ key: "", command: "" }, ...prev]);
    setNewBindIndex(0);
    setEditingKeyIndex(0);
    scrollListToTop();
  };

  // "Выбрать из списка" — row seeded with a known action, listening for a key.
  const addFromPreset = (command: string) => {
    setBinds((prev) => [{ key: "", command }, ...prev]);
    setNewBindIndex(0);
    setEditingKeyIndex(0);
    scrollListToTop();
  };

  const removeBind = (index: number) => {
    if (editingKeyIndex === index) {
      setEditingKeyIndex(null);
    }
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

  const flashRow = (index: number) => {
    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    setFlashIndex(index);
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashIndex((current) => (current === index ? null : current));
    }, 900);
  };

  // Virtual-keyboard click: assign to the selected row, or reveal the row that
  // already owns the clicked key.
  const handleKeyboardKey = (rustKey: string) => {
    if (editingKeyIndex !== null) {
      assignKey(editingKeyIndex, rustKey);
      return;
    }
    const owner = binds.findIndex((b) => b.key === rustKey);
    if (owner !== -1) flashRow(owner);
  };

  // Escape cancels the current selection; assignment itself is keyboard-click only.
  useEffect(() => {
    if (editingKeyIndex === null) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingKeyIndex(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [editingKeyIndex]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  return {
    binds,
    setBinds,
    search,
    setSearch,
    editingKeyIndex,
    setEditingKeyIndex,
    newBindIndex,
    setNewBindIndex,
    exitingBindIndex,
    setExitingBindIndex,
    flashIndex,
    nameFor,
    keyConflicts,
    usedKeys,
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
