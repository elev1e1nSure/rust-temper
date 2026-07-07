import { useMemo, useState } from "react";
import type { Bind, CommandPreset } from "../types";
import { parseCombo } from "../utils/bindKey";

export function useBindEditor(commandPresets: CommandPreset[]) {
  const [binds, setBinds] = useState<Bind[]>([]);
  const [search, setSearch] = useState("");
  // Keys picked on the on-screen keyboard, in press order. Together they form a
  // combination that filters the list below and seeds the key of new binds.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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

  // All binds tagged with whether the current filter matches them. Rows stay
  // mounted so filtering can animate (collapse) rather than snap; the list
  // renders from this and hides non-matches.
  const displayBinds = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedSet = new Set(selectedKeys);
    return binds.map((bind, sourceIndex) => {
      let matched = true;
      if (selectedKeys.length > 0) {
        // Match the whole combination regardless of the order keys were pressed.
        // Rust stores combos as "[a+b]"; a single key has no brackets.
        const tokens = parseCombo(bind.key);
        matched =
          tokens.length === selectedSet.size &&
          tokens.every((t) => selectedSet.has(t));
      }
      if (matched && query) {
        matched =
          bind.key.toLowerCase().includes(query) ||
          nameFor(bind.command).toLowerCase().includes(query) ||
          bind.command.toLowerCase().includes(query);
      }
      return { bind, sourceIndex, matched };
    });
  }, [binds, search, selectedKeys, presetByCommand]);

  const filteredBinds = useMemo(
    () =>
      displayBinds
        .filter((d) => d.matched)
        .map(({ bind, sourceIndex }) => ({ bind, sourceIndex })),
    [displayBinds],
  );

  const scrollListToTop = () => {
    requestAnimationFrame(() => {
      document
        .querySelector(".binds-list-wrap")
        ?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const addBind = (key: string, command: string) => {
    setBinds((prev) => [{ key, command }, ...prev]);
    setNewBindIndex(0);
    scrollListToTop();
  };

  const removeBind = (index: number) => {
    setExitingBindIndex(index);
  };

  const confirmRemoveBind = (index: number) => {
    setBinds((prev) => prev.filter((_, i) => i !== index));
    setExitingBindIndex(null);
  };

  const updateBind = (index: number, newKey: string, newCommand: string) => {
    setBinds((prev) => {
      const next = [...prev];
      next[index] = { key: newKey, command: newCommand };
      return next;
    });
  };

  // On-screen keyboard click: toggle the key in the filter combination.
  const handleKeyboardKey = (rustKey: string) => {
    setSelectedKeys((prev) =>
      prev.includes(rustKey)
        ? prev.filter((k) => k !== rustKey)
        : [...prev, rustKey],
    );
  };

  return {
    binds,
    setBinds,
    search,
    setSearch,
    selectedKeys,
    keyConflicts,
    filteredBinds,
    displayBinds,
    nameFor,
    newBindIndex,
    setNewBindIndex,
    exitingBindIndex,
    setExitingBindIndex,
    addBind,
    removeBind,
    confirmRemoveBind,
    updateBind,
    handleKeyboardKey,
  };
}
