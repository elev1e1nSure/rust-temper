import {
  FN_GROUPS,
  MAIN_ROWS,
  NAV_ROWS,
  NUMPAD_CELLS,
  type KeyDef,
} from "../keyboardLayout";

const KEY_UNIT = 30;
const KEY_GAP = 5;

function keyWidth(units = 1): number {
  return units * KEY_UNIT + (units - 1) * KEY_GAP;
}

interface KeyboardProps {
  /** rustKeys forming the current filter combination */
  selectedKeys: string[];
  /** a bind row is waiting for a key to be clicked (re-assign mode) */
  listening: boolean;
  onKeyClick: (rustKey: string) => void;
}

export function Keyboard({
  selectedKeys,
  listening,
  onKeyClick,
}: KeyboardProps) {
  const renderKey = (key: KeyDef, fill = false) => {
    const bindable = Boolean(key.rustKey);
    const selected = bindable && selectedKeys.includes(key.rustKey!);
    return (
      <button
        type="button"
        className={`kb-key${selected ? " selected" : ""}${bindable ? "" : " kb-key-static"}${fill ? " kb-key-fill" : ""}`}
        style={fill ? undefined : { width: keyWidth(key.w) }}
        disabled={!bindable}
        onClick={() => key.rustKey && onKeyClick(key.rustKey)}
        title={key.label}
      >
        {key.label}
      </button>
    );
  };

  return (
    <div className={`kb ${listening ? "kb-listening" : ""}`}>
      <div className="kb-fn-row">
        {FN_GROUPS.map((group, gi) => (
          <div className="kb-fn-group" key={gi}>
            {group.map((key, ki) => (
              <span key={ki}>{renderKey(key)}</span>
            ))}
          </div>
        ))}
      </div>

      <div className="kb-body">
        <div className="kb-main">
          {MAIN_ROWS.map((row, ri) => (
            <div className="kb-row" key={ri}>
              {row.map((key, ki) => (
                <span key={ki}>{renderKey(key)}</span>
              ))}
            </div>
          ))}
        </div>

        <div className="kb-nav">
          {NAV_ROWS.map((row, ri) => (
            <div className="kb-row" key={ri}>
              {row.map((key, ki) =>
                key ? (
                  <span key={ki}>{renderKey(key)}</span>
                ) : (
                  <span
                    key={ki}
                    className="kb-spacer"
                    style={{ width: keyWidth(1), height: KEY_UNIT }}
                  />
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
              style={{
                gridColumn: `${cell.c} / span ${cell.colSpan ?? 1}`,
                gridRow: `${cell.r} / span ${cell.rowSpan ?? 1}`,
              }}
            >
              {renderKey(cell, true)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
