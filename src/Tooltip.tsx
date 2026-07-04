import {
  ReactElement,
  ReactNode,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./Tooltip.css";

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
}

const SHOW_DELAY = 350;
const HIDE_DURATION = 140;

// Wraps a single child via cloneElement instead of an extra DOM node, so it
// never disturbs the flex/grid layout of whatever it's attached to. Position
// is measured off the child's own rect and rendered through a portal so it
// escapes any clipping/stacking context (table-wrap, dropdowns, etc.).
export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, placement: "top" as "top" | "bottom" });
  const [shift, setShift] = useState(0);
  const anchorRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
  };

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 9;
    const placement: "top" | "bottom" = rect.top > 56 ? "top" : "bottom";
    setPos({
      top: placement === "top" ? rect.top - gap : rect.bottom + gap,
      left: rect.left + rect.width / 2,
      placement,
    });
  }, []);

  const show = () => {
    if (!content) return;
    clearTimers();
    showTimer.current = window.setTimeout(() => {
      updatePosition();
      setRendered(true);
    }, SHOW_DELAY);
  };

  const hide = () => {
    clearTimers();
    setVisible(false);
    hideTimer.current = window.setTimeout(() => setRendered(false), HIDE_DURATION);
  };

  useEffect(() => {
    if (!rendered) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onReposition = () => updatePosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [rendered, updatePosition]);

  // Keep the bubble on-screen horizontally near viewport edges.
  useLayoutEffect(() => {
    if (!rendered) {
      setShift(0);
      return;
    }
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    if (rect.left < margin) setShift(margin - rect.left);
    else if (rect.right > window.innerWidth - margin) setShift(window.innerWidth - margin - rect.right);
    else setShift(0);
  }, [rendered, pos]);

  useEffect(() => clearTimers, []);

  if (!isValidElement(children)) return children;

  const childProps = children.props as Record<string, any>;
  const originalRef = (children as any).ref;

  const cloned = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node;
      if (typeof originalRef === "function") originalRef(node);
      else if (originalRef && typeof originalRef === "object") originalRef.current = node;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      childProps.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      childProps.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      childProps.onFocus?.(e);
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      childProps.onBlur?.(e);
      hide();
    },
  } as any);

  return (
    <>
      {cloned}
      {rendered &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`custom-tooltip ${pos.placement} ${visible ? "visible" : ""}`}
            style={{ top: pos.top, left: pos.left + shift }}
            role="tooltip"
          >
            {content}
            <div className="custom-tooltip-arrow" />
          </div>,
          document.body,
        )}
    </>
  );
}
