/* =============================================
   DISPATCH NOTES MODAL
   Small self-contained editor for a reservation's
   DISPnotes field.
============================================= */
export default function DispatchNotesModal({ notesEditor, setNotesEditor, onSave }) {
    if (!notesEditor) return null;

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded shadow w-[400px]">
                <div className="font-semibold mb-2">Edit Dispatch Notes</div>

                <textarea
                    className="w-full border p-2 text-sm h-40"
                    value={notesEditor.value}
                    onChange={(e) =>
                        setNotesEditor(prev => ({ ...prev, value: e.target.value }))
                    }
                />

                <div className="flex justify-end gap-2 mt-3">
                    <button
                        className="px-3 py-1 bg-gray-200"
                        onClick={() => setNotesEditor(null)}
                    >
                        Cancel
                    </button>

                    <button
                        className="px-3 py-1 bg-blue-500 text-white"
                        onClick={async () => {
                            await onSave(notesEditor.data, notesEditor.value);
                            setNotesEditor(null);
                        }}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
