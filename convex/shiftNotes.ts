import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/auth";

// Add a shift note
export const addShiftNote = mutation({
  args: {
    routerId: v.id("routers"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUser(ctx);
    return await ctx.db.insert("shiftNotes", {
      routerId: args.routerId,
      authorId: userId,
      timestamp: Date.now(),
      note: args.note,
    });
  },
});

// List shift notes for a router
export const listShiftNotes = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return await ctx.db
      .query("shiftNotes")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .collect();
  },
});

// Delete a shift note
export const deleteShiftNote = mutation({
  args: { noteId: v.id("shiftNotes") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    await ctx.db.delete(args.noteId);
  },
});
