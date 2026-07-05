import { DownLine, Delete2Line, SearchLine } from "@mingcute/react";

export function ChevronIcon() {
  return <DownLine size={15} />;
}

export function TrashIcon() {
  return <Delete2Line size={15} />;
}

export function SearchIcon() {
  return <SearchLine size={15} />;
}

export function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function GearFillIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M19.14 12.94c.04-.3.06-.63.06-.94s-.02-.64-.06-.94l2.02-1.58c.19-.15.24-.42.12-.62l-1.92-3.32c-.12-.21-.37-.29-.59-.22l-2.38.96c-.5-.38-1.06-.69-1.66-.93l-.36-2.54c-.04-.23-.24-.41-.48-.41h-3.84c-.24 0-.43.18-.48.41l-.36 2.54c-.6.24-1.16.54-1.66.93l-2.38-.96c-.22-.07-.47.01-.59.22l-1.92 3.32c-.12.21-.08.48.12.62l2.02 1.58c-.04.3-.06.63-.06.94s.02.64.06.94l-2.02 1.58c-.19.15-.24.42-.12.62l1.92 3.32c.12.21.37.29.59.22l2.38-.96c.5.38 1.06.69 1.66.93l.36 2.54c.04.23.24.41.48.41h3.84c.24 0 .43-.18.48-.41l.36-2.54c.6-.24 1.16-.54 1.66-.93l2.38.96c.22.07.47-.01.59-.22l1.92-3.32c.12-.21.08-.48-.12-.62l-2.02-1.58ZM12 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3Z" />
    </svg>
  );
}
