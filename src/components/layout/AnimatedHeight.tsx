import { ReactNode, useLayoutEffect, useRef, useState } from "react";

export function AnimatedHeight({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const updateHeight = () => setHeight(content.scrollHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`bind-config-animated-height ${className}`}
      style={height === undefined ? undefined : ({ "--anim-height": `${height}px` } as React.CSSProperties)}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
