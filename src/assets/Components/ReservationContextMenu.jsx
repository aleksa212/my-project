import { useEffect, useLayoutEffect, useRef } from "react";

export default function ReservationContextMenu({
    contextMenu,
    onClose,
    onEdit,
    onMap,
    onCopyTrip,
    onNotes,
    onLogs,
    onAutoDispatch
}) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current?.contains(e.target)) return;
            onClose();
        };
        window.addEventListener("mousedown", handleClick);
        return () => window.removeEventListener("mousedown", handleClick);
    }, [onClose]);

    // Flip the menu above the click point when it would otherwise overflow
    // past the bottom of the viewport. Mutates the DOM node directly
    // (rather than going through React state) so there's no extra render
    // and no visible flash at the wrong position.
    useLayoutEffect(() => {
        if (!contextMenu || !menuRef.current) return;
        const el = menuRef.current;
        const { height } = el.getBoundingClientRect();
        const fitsBelow = contextMenu.y + height <= window.innerHeight;
        el.style.top = `${fitsBelow ? contextMenu.y : Math.max(8, contextMenu.y - height)}px`;
    }, [contextMenu]);

    if (!contextMenu) return null;

    const isUnassigned = contextMenu.data?.Status === "Unassigned";

    return (
        <div
            ref={menuRef}
            className="absolute bg-white shadow-lg border rounded text-sm"
            style={{ top: contextMenu.y, left: contextMenu.x }}
        >
            <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => { onEdit(contextMenu.data); onClose(); }}>
                Edit Reservation
            </div>
            <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => { onMap(contextMenu.data); onClose(); }}>
                Mapping
            </div>
            <div className="p-2 hover:bg-red-100 text-red-600 cursor-pointer" onClick={async () => { await onCopyTrip(contextMenu.data); onClose(); }}>
                Copy trip
            </div>
            <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => { onNotes(contextMenu.data); onClose(); }}>
                Dispatch Notes
            </div>
            <div className="p-2 hover:bg-gray-100 cursor-pointer" onClick={async () => { await onLogs(contextMenu.data); onClose(); }}>
                Dispatch Logs
            </div>

            {isUnassigned && onAutoDispatch && (
                <div
                    className="p-2 hover:bg-indigo-100 text-indigo-700 cursor-pointer border-t"
                    onClick={() => { onAutoDispatch(contextMenu.data); onClose(); }}
                >
                    Auto Dispatch This Trip
                </div>
            )}
        </div>
    );
}