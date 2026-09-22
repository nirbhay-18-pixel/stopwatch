/* ---------------------------------------------------------------------------
   Sync service — bidirectional sync between IndexedDB and Supabase.
   Handles conflict resolution using updated_at timestamps.
--------------------------------------------------------------------------- */
import { getSupabase } from "./supabase";
import { dbAll, dbPut, dbPutAll, dbDelete } from "./db";
import type { Session, Category, Lap, Segment } from "./core";
import type { DbSession, DbCategory, DbLap, DbSegment } from "./supabase";

export interface SyncStatus {
  lastSync: number | null;
  syncing: boolean;
  error: string | null;
  pendingChanges: number;
}

let syncStatus: SyncStatus = {
  lastSync: null,
  syncing: false,
  error: null,
  pendingChanges: 0,
};

let syncListeners: Array<(status: SyncStatus) => void> = [];

export function onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  syncListeners.forEach((l) => l({ ...syncStatus }));
}

function updateStatus(patch: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...patch };
  notifyListeners();
}

/* ---------------------------------------------------------------------------
   Convert between local and remote formats
--------------------------------------------------------------------------- */
function sessionToDb(session: Session, userId: string): DbSession {
  return {
    id: session.id,
    user_id: userId,
    mode: session.mode,
    category: session.category,
    topic: session.topic,
    task: session.task,
    timer_type: session.timerType,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration: session.duration,
    paused_ms: session.pausedMs,
    continues_session_id: null, // TODO: track this if needed
    created_at: new Date(session.createdAt).toISOString(),
    updated_at: new Date(session.createdAt).toISOString(), // Use createdAt as updated_at for now
  };
}

function dbToSession(db: DbSession): Session {
  return {
    id: db.id,
    mode: db.mode,
    category: db.category,
    topic: db.topic,
    task: db.task,
    timerType: db.timer_type,
    startedAt: db.started_at,
    endedAt: db.ended_at,
    duration: db.duration,
    pausedMs: db.paused_ms,
    createdAt: new Date(db.created_at).getTime(),
  };
}

function categoryToDb(category: Category, userId: string): DbCategory {
  return {
    id: category.id,
    user_id: userId,
    mode: category.mode,
    name: category.name,
    description: category.description || null,
    is_custom: category.isCustom,
    created_at: new Date(category.createdAt).toISOString(),
    updated_at: new Date(category.createdAt).toISOString(),
  };
}

function dbToCategory(db: DbCategory): Category {
  return {
    id: db.id,
    mode: db.mode,
    name: db.name,
    description: db.description || undefined,
    isCustom: db.is_custom,
    createdAt: new Date(db.created_at).getTime(),
  };
}

/* ---------------------------------------------------------------------------
   Sync operations
--------------------------------------------------------------------------- */
export async function syncSessions(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  updateStatus({ syncing: true, error: null });

  try {
    // Get local sessions
    const localSessions = await dbAll<Session>("sessions");
    const localMap = new Map(localSessions.map((s) => [s.id, s]));

    // Get remote sessions
    const { data: remoteSessions, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;

    const remoteMap = new Map((remoteSessions || []).map((s) => [s.id, s]));

    // Sync local -> remote (upload new/updated)
    const toUpload: Session[] = [];
    for (const local of localSessions) {
      const remote = remoteMap.get(local.id);
      if (!remote) {
        // New session, upload
        toUpload.push(local);
      } else {
        // Compare updated_at (using createdAt as proxy for now)
        const localTime = local.createdAt;
        const remoteTime = new Date(remote.updated_at).getTime();
        if (localTime > remoteTime) {
          toUpload.push(local);
        }
      }
    }

    if (toUpload.length > 0) {
      const dbSessions = toUpload.map((s) => sessionToDb(s, userId));
      const { error: uploadError } = await supabase.from("sessions").upsert(dbSessions);
      if (uploadError) throw uploadError;
    }

    // Sync remote -> local (download new/updated)
    const toDownload: Session[] = [];
    for (const remote of remoteSessions || []) {
      const local = localMap.get(remote.id);
      if (!local) {
        // New session, download
        toDownload.push(dbToSession(remote));
      } else {
        // Compare updated_at
        const localTime = local.createdAt;
        const remoteTime = new Date(remote.updated_at).getTime();
        if (remoteTime > localTime) {
          toDownload.push(dbToSession(remote));
        }
      }
    }

    if (toDownload.length > 0) {
      await dbPutAll("sessions", toDownload);
    }

    updateStatus({
      syncing: false,
      lastSync: Date.now(),
      pendingChanges: 0,
    });
  } catch (err) {
    updateStatus({
      syncing: false,
      error: err instanceof Error ? err.message : "Sync failed",
    });
  }
}

export async function syncCategories(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // Get local categories
    const localCategories = await dbAll<Category>("categories");
    const localMap = new Map(localCategories.map((c) => [c.id, c]));

    // Get remote categories
    const { data: remoteCategories, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;

    const remoteMap = new Map((remoteCategories || []).map((c) => [c.id, c]));

    // Upload new custom categories
    const toUpload: Category[] = [];
    for (const local of localCategories) {
      if (!local.isCustom) continue; // Don't sync default categories
      const remote = remoteMap.get(local.id);
      if (!remote) {
        toUpload.push(local);
      }
    }

    if (toUpload.length > 0) {
      const dbCategories = toUpload.map((c) => categoryToDb(c, userId));
      const { error: uploadError } = await supabase.from("categories").upsert(dbCategories);
      if (uploadError) throw uploadError;
    }

    // Download new categories
    const toDownload: Category[] = [];
    for (const remote of remoteCategories || []) {
      const local = localMap.get(remote.id);
      if (!local) {
        toDownload.push(dbToCategory(remote));
      }
    }

    if (toDownload.length > 0) {
      await dbPutAll("categories", toDownload);
    }
  } catch (err) {
    console.error("Category sync failed:", err);
  }
}

export async function uploadSession(session: Session, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const dbSession = sessionToDb(session, userId);
    const { error } = await supabase.from("sessions").upsert(dbSession);
    if (error) throw error;
  } catch (err) {
    console.error("Failed to upload session:", err);
    updateStatus({
      pendingChanges: syncStatus.pendingChanges + 1,
    });
  }
}

export async function deleteSessionRemote(sessionId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
    if (error) throw error;
  } catch (err) {
    console.error("Failed to delete session remotely:", err);
  }
}

export async function fullSync(userId: string): Promise<void> {
  await syncCategories(userId);
  await syncSessions(userId);
}

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}
