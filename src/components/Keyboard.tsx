import {
  FN_GROUPS,
  MAIN_ROWS,
  NAV_ROWS,
  NUMPAD_CELLS,
  type KeyDef,
} from "../keyboardLayout";

interface KeyboardProps {
  /** rustKeys forming the current key combination */
  selectedKeys: string[];
  exitingKeys?: Set<string>;
  onKeyClick: (rustKey: string) => void;
}

export function Keyboard({
  selectedKeys,
  exitingKeys,
  onKeyClick,
}: KeyboardProps) {
  const renderKey = (key: KeyDef, fill = false) => {
    const bindable = Boolean(key.rustKey);
    const selected = bindable && selectedKeys.includes(key.rustKey!);
    const exiting = bindable && exitingKeys?.has(key.rustKey!);
    return (
      <button
        type="button"
        className={`kb-key${selected ? " selected" : ""}${exiting ? " exiting" : ""}${bindable ? "" : " kb-key-static"}${fill ? " kb-key-fill" : ""}`}
        disabled={!bindable}
        onClick={() => key.rustKey && onKeyClick(key.rustKey)}
      >
        {key.label}
      </button>
    );
  };

  return (
    <div className="kb">
      <div className="kb-fn-row">
        {FN_GROUPS.map((group, gi) => (
          <div
            className="kb-fn-group"
            key={gi}
            style={{ "--group-flex": group.length } as React.CSSProperties}
          >
            {group.map((key, ki) => (
              <span
                key={ki}
                className="kb-flex-cell"
                style={{ "--key-w": key.w ?? 1 } as React.CSSProperties}
              >
                {renderKey(key)}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="kb-body">
        <div className="kb-main">
          {MAIN_ROWS.map((row, ri) => (
            <div className="kb-row" key={ri}>
              {row.map((key, ki) => (
                <span
                  key={ki}
                  className="kb-flex-cell"
                  style={{ "--key-w": key.w ?? 1 } as React.CSSProperties}
                >
                  {renderKey(key)}
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="kb-nav">
          {NAV_ROWS.map((row, ri) => (
            <div className="kb-row" key={ri}>
              {row.map((key, ki) =>
                key ? (
                  <span
                    key={ki}
                    className="kb-flex-cell kb-flex-fill"
                    style={{ "--key-w": 1 } as React.CSSProperties}
                  >
                    {renderKey(key)}
                  </span>
                ) : (
                  <span key={ki} className="kb-spacer" />
                ),
              )}
            </div>
          ))}
        </div>

        <div className="kb-numpad">
          {NUMPAD_CELLS.map((cell, i) => (
            <div
              key={i}
              className="kb-numpad-cell"
              style={
                {
                  "--numpad-col": cell.c,
                  "--numpad-col-span": cell.colSpan ?? 1,
                  "--numpad-row": cell.r,
                  "--numpad-row-span": cell.rowSpan ?? 1,
                } as React.CSSProperties
              }
            >
              {renderKey(cell, true)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
