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

export function TweaksIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1.5V4" />
      <path d="M12 20v2.5" />
      <path d="M4.22 4.22l1.77 1.77" />
      <path d="M18.01 18.01l1.77 1.77" />
      <path d="M1.5 12H4" />
      <path d="M20 12h2.5" />
      <path d="M4.22 19.78l1.77-1.77" />
      <path d="M18.01 5.99l1.77-1.77" />
    </svg>
  );
}
