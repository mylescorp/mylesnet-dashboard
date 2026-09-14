"use client";

import { useQuery, useMutation } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

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
    <div className="min-h-screen bg-[var(--surface-muted)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-strong)]">Shift Notes</h1>
            <p className="text-sm text-[var(--muted)]">Operator notes and handover information</p>
          </div>
        </div>
        {message ? <div className="mb-6 rounded-md border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]" role="status">{message}</div> : null}

        {/* Router Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text)] mb-2">
            Select Router
          </label>
          <select
            value={selectedRouter || ""}
            onChange={(e) => setSelectedRouter(e.target.value || null)}
            className="w-full max-w-md px-3 py-2 border border-[var(--line)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
        <div className="bg-[var(--warning-bg)] border border-[var(--warning-bg)] text-[var(--warning)] px-4 py-3 rounded-md mb-6">
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
              className="bg-[var(--primary-action)] text-[var(--primary-action-foreground)] px-4 py-2 rounded-md hover:bg-[var(--primary-action-hover)]"
            >
              Add Shift Note
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!shiftNotes || shiftNotes.length === 0}
              className="rounded-md border border-[var(--line)] px-4 py-2 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50 print:hidden"
            >
              Print handover
            </button>
          </div>
        )}

        {/* Notes List */}
        {selectedRouter && shiftNotes && (
          <div className="space-y-4">
            {shiftNotes.length === 0 ? (
              <div className="bg-[var(--surface)] rounded-lg shadow p-6 text-center text-[var(--muted)]">
                No shift notes for this router
              </div>
            ) : (
              shiftNotes.map((note) => (
                <div key={note._id} className="bg-[var(--surface)] rounded-lg shadow p-6 border-l-4 border-[var(--primary)]">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-[var(--muted)]">
                          {new Date(note.timestamp).toLocaleString()}
                        </span>
                        <span className="text-sm text-[var(--muted)]">
                          by {note.authorId}
                        </span>
                      </div>
                      <p className="text-[var(--text-strong)] whitespace-pre-wrap">{note.note}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(note._id)}
                      className="text-[var(--danger)] hover:text-[var(--danger)] ml-4"
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
          <div className="bg-[var(--surface)] rounded-lg shadow p-6 text-center text-[var(--muted)]">
            Select a router to view shift notes
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ backgroundColor: "color-mix(in srgb, var(--mn-navy-900) 50%, transparent)" }}>
          <div className="bg-[var(--surface)] rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-[var(--text-strong)] mb-4">Add Shift Note</h2>

            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">
                  Note
                </label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  required
                  rows={5}
                  className="w-full px-3 py-2 border border-[var(--line)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="Enter your operational note..."
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Do not include customer PII, passwords, or payment information
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[var(--line)] rounded-md text-[var(--text)] hover:bg-[var(--surface-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[var(--primary-action)] text-[var(--primary-action-foreground)] rounded-md hover:bg-[var(--primary-action-hover)] disabled:opacity-50"
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