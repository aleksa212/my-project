import { useState, useRef } from "react";
import { createPortal } from "react-dom";

/* =============================================
   LOCATION CELL RENDERER
   Renders truncated text in the cell.
   On hover shows a portal tooltip with the full
   address + Copy button. Tooltip stays open as
   long as the cursor is over the cell OR the
   tooltip itself, and closes the moment it leaves
   both.
============================================= */
export function LocationCellRenderer({ valueFormatted, value }) {
    const displayText = valueFormatted || value || "";

    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const [copied, setCopied] = useState(false);

    const cellRef = useRef(null);
    const inCell = useRef(false);
    const inTooltip = useRef(false);
    const closeTimer = useRef(null);

    const scheduleClose = () => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => {
            if (!inCell.current && !inTooltip.current) {
                setOpen(false);
            }
        }, 80);
    };

    const handleCellEnter = () => {
        inCell.current = true;
        clearTimeout(closeTimer.current);
        if (cellRef.current) {
            const r = cellRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 1, left: r.left });
        }
        setOpen(true);
    };

    const handleCellLeave = () => {
        inCell.current = false;
        scheduleClose();
    };

    const handleTooltipEnter = () => {
        inTooltip.current = true;
        clearTimeout(closeTimer.current);
    };

    const handleTooltipLeave = () => {
        inTooltip.current = false;
        scheduleClose();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(displayText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    if (!displayText) return null;

    return (
        <>
            <div
                ref={cellRef}
                onMouseEnter={handleCellEnter}
                onMouseLeave={handleCellLeave}
                style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: "default",
                    height: "100%",
                    display: "flex",
                    alignItems: "center"
                }}
            >
                {displayText}
            </div>

            {open && createPortal(
                <div
                    onMouseEnter={handleTooltipEnter}
                    onMouseLeave={handleTooltipLeave}
                    style={{
                        position: "fixed",
                        top: pos.top,
                        left: pos.left,
                        zIndex: 99999,
                        background: "#fff",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.13)",
                        maxWidth: "340px",
                        fontFamily: "inherit",
                        pointerEvents: "auto"
                    }}
                >
                    {/* Header */}
                    <div style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#111827",
                        marginBottom: "6px"
                    }}>
                        Full Address:
                    </div>

                    {/* Address + Copy */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{
                            fontSize: "12px",
                            color: "#374151",
                            lineHeight: "1.5",
                            flex: 1,
                            userSelect: "text"
                        }}>
                            {displayText}
                        </span>

                        <button
                            onClick={handleCopy}
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "2px 0",
                                fontSize: "12px",
                                fontWeight: "500",
                                color: copied ? "#16a34a" : "#6b7280"
                            }}
                        >
                            {copied ? (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Copied
                                </>
                            ) : (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    Copy
                                </>
                            )}
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

export default LocationCellRenderer;
