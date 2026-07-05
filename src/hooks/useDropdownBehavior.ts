import { useEffect, useMemo, useRef, useState } from "react";
import type { CommandPreset } from "../types";

export function useDropdownBehavior(commandPresets: CommandPreset[]) {
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [closingDropdownIndex, setClosingDropdownIndex] = useState<number | null>(null);
  const closingDropdownTimeoutRef = useRef<number | null>(null);
  const [commandSearch, setCommandSearch] = useState("");
  const [dropdownDir, setDropdownDir] = useState<"down" | "up">("down");

  const filteredCommandPresets = useMemo(() => {
    const query = commandSearch.trim().toLowerCase();
    if (!query) return commandPresets;
    return commandPresets.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.command.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query),
    );
  }, [commandPresets, commandSearch]);

  const changeOpenDropdown = (next: number | null) => {
    if (openDropdownIndex !== null && openDropdownIndex !== next) {
      const closingIndex = openDropdownIndex;
      setClosingDropdownIndex(closingIndex);
      if (closingDropdownTimeoutRef.current !== null) {
        window.clearTimeout(closingDropdownTimeoutRef.current);
      }
      closingDropdownTimeoutRef.current = window.setTimeout(() => {
        setClosingDropdownIndex((current) =>
          current === closingIndex ? null : current,
        );
      }, 220);
    }
    setOpenDropdownIndex(next);
    setCommandSearch("");
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (openDropdownIndex !== null && !target.closest(".action-cell-container")) {
        changeOpenDropdown(null);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [openDropdownIndex]);

  useEffect(() => {
    return () => {
      if (closingDropdownTimeoutRef.current !== null) {
        window.clearTimeout(closingDropdownTimeoutRef.current);
      }
    };
  }, []);

  return {
    openDropdownIndex,
    closingDropdownIndex,
    commandSearch,
    setCommandSearch,
    filteredCommandPresets,
    dropdownDir,
    setDropdownDir,
    changeOpenDropdown,
  };
}
