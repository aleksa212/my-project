import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useDriversContext } from "./DriversContext";

/* =============================================
   DRIVER CELL RENDERER
   Shows driver name in cell. On hover shows a
   portal card with phone (copyable) and email.
   The popup only ever appears when the row has
   a driver that's actually recognized — never
   for an empty/unassigned Driver cell.
============================================= */
export function DriverCellRenderer({ value }) {
    const { drivers } = useDriversContext();
    const driver = drivers.find(d => d.displayName === value);
    const hasDriver = Boolean(driver);

    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const [copiedPhone, setCopiedPhone] = useState(false);
    const [copiedEmail, setCopiedEmail] = useState(false);

    const cellRef = useRef(null);
    const inCell = useRef(false);
    const inTooltip = useRef(false);
    const closeTimer = useRef(null);

    // Defensive: if the resolved driver ever becomes empty/unknown
    // (row data changed under an already-open tooltip, cell reused
    // for a different row, etc.), force the popup closed immediately
    // rather than risk rendering it with no driver to read from.
    useEffect(() => {
        if (!hasDriver) setOpen(false);
    }, [hasDriver]);

    const scheduleClose = () => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => {
            if (!inCell.current && !inTooltip.current) setOpen(false);
        }, 80);
    };

    const handleCellEnter = () => {
        // Only ever open the popup when a driver is actually assigned.
        if (!hasDriver) return;
        inCell.current = true;
        clearTimeout(closeTimer.current);
        if (cellRef.current) {
            const r = cellRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 1, left: r.left });
        }
        setOpen(true);
    };

    const handleCellLeave = () => { inCell.current = false; scheduleClose(); };
    const handleTipEnter = () => { inTooltip.current = true; clearTimeout(closeTimer.current); };
    const handleTipLeave = () => { inTooltip.current = false; scheduleClose(); };

    const copyPhone = () => {
        if (!driver) return;
        navigator.clipboard.writeText(driver.phone);
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 1800);
    };

    const copyEmail = () => {
        if (!driver) return;
        navigator.clipboard.writeText(driver.email);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 1800);
    };

    if (!value) return null;

    // Driver not found in options list — just show the name, no popup
    if (!hasDriver) {
        return (
            <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
                {value}
            </div>
        );
    }

    return (
        <>
            <div
                ref={cellRef}
                onMouseEnter={handleCellEnter}
                onMouseLeave={handleCellLeave}
                style={{ height: "100%", display: "flex", alignItems: "center", cursor: "default" }}
            >
                {value}
            </div>

            {open && hasDriver && createPortal(
                <div
                    onMouseEnter={handleTipEnter}
                    onMouseLeave={handleTipLeave}
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
                        minWidth: "240px",
                        fontFamily: "inherit",
                        pointerEvents: "auto"
                    }}
                >
                    {/* Header */}
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#111827", marginBottom: "8px" }}>
                        Contact Information:
                    </div>

                    {/* Phone */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", color: "#374151", minWidth: "60px" }}>Cellular:</span>
                        <span style={{ fontSize: "12px", color: "#374151", flex: 1 }}>{driver?.phone}</span>
                        <button
                            onClick={copyPhone}
                            style={{
                                display: "flex", alignItems: "center", gap: "3px",
                                background: "none", border: "none", cursor: "pointer",
                                fontSize: "12px", fontWeight: "500",
                                color: copiedPhone ? "#16a34a" : "#6b7280",
                                padding: "2px 0"
                            }}
                        >
                            {copiedPhone ? (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                    Copied
                                </>
                            ) : (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                    Copy
                                </>
                            )}
                        </button>
                    </div>

                    {/* Email */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#374151", minWidth: "60px" }}>Email:</span>
                        <span style={{ fontSize: "12px", color: "#374151", flex: 1 }}>{driver?.email}</span>
                        <button
                            onClick={copyEmail}
                            style={{
                                display: "flex", alignItems: "center", gap: "3px",
                                background: "none", border: "none", cursor: "pointer",
                                fontSize: "12px", fontWeight: "500",
                                color: copiedEmail ? "#16a34a" : "#6b7280",
                                padding: "2px 0"
                            }}
                        >
                            {copiedEmail ? (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                    Copied
                                </>
                            ) : (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
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

export default DriverCellRenderer;
