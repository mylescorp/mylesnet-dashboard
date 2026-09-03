"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export default function ShiftNotesPage() {
  const routers = useQuery(api.routers.listRouters, {});
  const [selectedRouter, setSelectedRouter] = useState<string | null>(null);
  const selectedRouterRecord = routers?.find((router) => router._id === selectedRouter);
  const shiftNotes = useQuery(
    api.shiftNotes.listShiftNotes,
    selectedRouterRecord ? { routerId: selectedRouterRecord._id } : "skip"
  );
  const addShiftNote = useMutation(api.shiftNotes.addShiftNote);
  const deleteShiftNote = useMutation(api.shiftNotes.deleteShiftNote);

  const [showAddModal, setShowAddModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRouterRecord) return;

    setLoading(true);

    try {
      await addShiftNote({
        routerId: selectedRouterRecord._id,
        note: noteText,
      });

      setShowAddModal(false);
      setNoteText("");
    } catch {
      setMessage("We could not save this handover note. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId: Id<"shiftNotes">) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      await deleteShiftNote({ noteId });
    } catch {
      setMessage("We could not delete this handover note. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shift Notes</h1>
            <p className="text-sm text-gray-600">Operator notes and handover information</p>
          </div>
        </div>
        {message ? <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="status">{message}</div> : null}

        {/* Router Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Router
          </label>
          <select
            value={selectedRouter || ""}
            onChange={(e) => setSelectedRouter(e.target.value || null)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Select a router</option>
            {routers?.map((router) => (
              <option key={router._id} value={router._id}>
                {router.name} ({router.location})
              </option>
            ))}
          </select>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md mb-6">
          <p className="text-sm">
            <strong>Important:</strong> Shift notes must never contain customer personal information,
            passwords, or payment details. This is for operational notes only.
          </p>
        </div>

        {/* Add Note Button */}
        {selectedRouter && (
          <div className="mb-6 flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
            >
              Add Shift Note
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!shiftNotes || shiftNotes.length === 0}
              className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 print:hidden"
            >
              Print handover
            </button>
          </div>
        )}

        {/* Notes List */}
        {selectedRouter && shiftNotes && (
          <div className="space-y-4">
            {shiftNotes.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
                No shift notes for this router
              </div>
            ) : (
              shiftNotes.map((note) => (
                <div key={note._id} className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-600">
                          {new Date(note.timestamp).toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-600">
                          by {note.authorId}
                        </span>
                      </div>
                      <p className="text-gray-900 whitespace-pre-wrap">{note.note}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(note._id)}
                      className="text-red-600 hover:text-red-900 ml-4"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!selectedRouter && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
            Select a router to view shift notes
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Shift Note</h2>

            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note
                </label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  required
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter your operational note..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Do not include customer PII, passwords, or payment information
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
