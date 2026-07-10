import {
  ArrowLeftFill,
  CheckFill,
  DownFill,
  Delete2Fill,
  DisplayFill,
  FolderOpenFill,
  ListCheck3Fill,
  Magic3Fill,
  Refresh1Fill,
  RestoreFill,
  SearchLine,
  Search2Fill,
  Settings6Fill,
  SaveFill,
  SafeShieldFill,
  CloseFill,
  CommandFill,
  KeyboardFill,
} from "@mingcute/react";

export function ChevronIcon() {
  return <DownFill size={15} />;
}

export function TrashIcon() {
  return <Delete2Fill size={15} />;
}

export function SearchIcon() {
  return <SearchLine size={15} />;
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  return <CloseFill size={size} />;
}

export function CommandIcon({ size = 16 }: { size?: number }) {
  return <CommandFill size={size} />;
}

export function KeyboardIcon({ size = 16 }: { size?: number }) {
  return <KeyboardFill size={size} />;
}

export function BackIcon({ size = 16 }: { size?: number }) {
  return <ArrowLeftFill size={size} />;
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return <CheckFill size={size} />;
}

export function AutoDetectIcon({ size = 16 }: { size?: number }) {
  return <Search2Fill size={size} />;
}

export function FolderOpenIcon({ size = 16 }: { size?: number }) {
  return <FolderOpenFill size={size} />;
}

export function RestoreBackupIcon({ size = 16 }: { size?: number }) {
  return <RestoreFill size={size} />;
}

export function ShieldIcon({ size = 16 }: { size?: number }) {
  return <SafeShieldFill size={size} />;
}

export function TweakIcon({ size = 16 }: { size?: number }) {
  return <Magic3Fill size={size} />;
}

export function GraphicsIcon({ size = 16 }: { size?: number }) {
  return <DisplayFill size={size} />;
}

export function ListCheckIcon({ size = 16 }: { size?: number }) {
  return <ListCheck3Fill size={size} />;
}

export function InterfaceIcon({ size = 16 }: { size?: number }) {
  return <Settings6Fill size={size} />;
}

export function RefreshIcon({ size = 16 }: { size?: number }) {
  return <Refresh1Fill size={size} />;
}

export function SaveIcon({ size = 16 }: { size?: number }) {
  return <SaveFill size={size} />;
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

export function DragIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor">
      <circle cx="4" cy="4" r="1.4" />
      <circle cx="10" cy="4" r="1.4" />
      <circle cx="4" cy="9" r="1.4" />
      <circle cx="10" cy="9" r="1.4" />
      <circle cx="4" cy="14" r="1.4" />
      <circle cx="10" cy="14" r="1.4" />
    </svg>
  );
}

export function GearFillIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M19.14 12.94c.04-.3.06-.63.06-.94s-.02-.64-.06-.94l2.02-1.58c.19-.15.24-.42.12-.62l-1.92-3.32c-.12-.21-.37-.29-.59-.22l-2.38.96c-.5-.38-1.06-.69-1.66-.93l-.36-2.54c-.04-.23-.24-.41-.48-.41h-3.84c-.24 0-.43.18-.48.41l-.36 2.54c-.6.24-1.16.54-1.66.93l-2.38-.96c-.22-.07-.47.01-.59.22l-1.92 3.32c-.12.21-.08.48.12.62l2.02 1.58c-.04.3-.06.63-.06.94s.02.64.06.94l-2.02 1.58c-.19.15-.24.42-.12.62l1.92 3.32c.12.21.37.29.59.22l2.38-.96c.5.38 1.06.69 1.66.93l.36 2.54c.04.23.24.41.48.41h3.84c.24 0 .43-.18.48-.41l.36-2.54c.6-.24 1.16-.54 1.66-.93l2.38.96c.22.07.47-.01.59-.22l1.92-3.32c.12-.21.08-.48-.12-.62l-2.02-1.58ZM12 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3Z" />
    </svg>
  );
}
