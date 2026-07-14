/* =============================================
   DISPATCH LOGS MODAL
   Read-only history of field changes for a
   reservation (who changed what, and when).
============================================= */
export default function DispatchLogsModal({ logsViewer, onClose }) {
    if (!logsViewer) return null;

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded shadow w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
                <div className="font-semibold mb-2">Dispatch Logs</div>

                <div className="flex-1 overflow-auto border">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="text-left p-2">Date/Time</th>
                                <th className="text-left p-2">Field</th>
                                <th className="text-left p-2">Old</th>
                                <th className="text-left p-2">New</th>
                                <th className="text-left p-2">Changed By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logsViewer.logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-3 text-center text-gray-500">
                                        No logs available
                                    </td>
                                </tr>
                            ) : (
                                logsViewer.logs.map((log, i) => (
                                    <tr key={i} className="border-t">
                                        <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="p-2">{log.field}</td>
                                        <td className="p-2">{log.oldValue}</td>
                                        <td className="p-2">{log.newValue}</td>
                                        <td className="p-2">{log.changedBy}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end mt-3">
                    <button className="px-3 py-1 bg-gray-200" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
