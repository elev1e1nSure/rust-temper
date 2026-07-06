import { useEffect, useMemo, useState } from "react";
import type { Bind, CommandPreset } from "../types";
import { keyNameFromEvent } from "../keyMap";

export function useBindEditor(commandPresets: CommandPreset[]) {
  const [binds, setBinds] = useState<Bind[]>([]);
  const [search, setSearch] = useState("");
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
    if (!query) return binds;
    return binds.filter(
      (bind) =>
        bind.key.toLowerCase().includes(query) ||
        nameFor(bind.command).toLowerCase().includes(query) ||
        bind.command.toLowerCase().includes(query),
    );
  }, [binds, search, presetByCommand]);

  const addBind = () => {
    setBinds((prev) => [{ key: "", command: "" }, ...prev]);
    setNewBindIndex(0);
    setEditingKeyIndex(0);
    requestAnimationFrame(() => {
      document
        .querySelector(".table-wrap")
        ?.scrollTo({ top: 0, behavior: "smooth" });
    });
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

  useEffect(() => {
    if (editingKeyIndex === null) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") {
        setEditingKeyIndex(null);
        return;
      }
      const keyName = keyNameFromEvent(e);
      setBinds((prev) => {
        const next = [...prev];
        next[editingKeyIndex] = { ...next[editingKeyIndex], key: keyName };
        return next;
      });
      setEditingKeyIndex(null);
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [editingKeyIndex]);

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
    nameFor,
    keyConflicts,
    filteredBinds,
    addBind,
    removeBind,
    confirmRemoveBind,
    updateBindCommand,
  };
}
