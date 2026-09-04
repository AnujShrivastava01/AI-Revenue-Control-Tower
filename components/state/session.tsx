"use client";

import * as React from "react";
import type { ActionResult, ActionStatus, AuditEvent, VerificationReport } from "@/lib/types";

/**
 * Session state.
 *
 * The server is the source of truth for *what the system knows* — the ledger,
 * the anomalies, the policy, the executor. This holds only what the operator
 * has done during the session: which actions were approved, executed, rejected,
 * and the audit events those produced.
 *
 * Keeping it client-side means the demo survives a serverless cold start and
 * resets cleanly, and it keeps the read path a pure function of the seed.
 *
 * Implemented as an external store rather than component state so that reads
 * are consistent across every subscriber and hydration is handled by React.
 */

const STORAGE_KEY = "fct.session.v2";

export interface ActionSessionState {
  status: ActionStatus;
  result?: ActionResult;
  verification?: VerificationReport;
  completedAt?: string;
}

export interface SessionState {
  actions: Record<string, ActionSessionState>;
  events: AuditEvent[];
  incidentTriggered: boolean;
}

const EMPTY: SessionState = Object.freeze({
  actions: {},
  events: [],
  incidentTriggered: false,
});

/* ------------------------------------------------------------------ store */

const listeners = new Set<() => void>();
let cache: SessionState | null = null;

function parse(): SessionState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return {
      actions: parsed.actions ?? {},
      events: parsed.events ?? [],
      incidentTriggered: parsed.incidentTriggered ?? false,
    };
  } catch {
    return EMPTY;
  }
}

/** Cached so repeated reads return an identical object between writes. */
function getSnapshot(): SessionState {
  if (cache === null) cache = parse();
  return cache;
}

function getServerSnapshot(): SessionState {
  return EMPTY;
}

function emit() {
  for (const l of listeners) l();
}

function write(next: SessionState) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode). The session still works in memory.
  }
  emit();
}

function invalidate() {
  cache = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", invalidate);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", invalidate);
  };
}

/* ------------------------------------------------------------------ hooks */

interface SessionContextValue {
  state: SessionState;
  hydrated: boolean;
  setAction: (id: string, next: ActionSessionState) => void;
  appendEvents: (events: AuditEvent[]) => void;
  reset: () => void;
  triggerIncident: () => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

const actions = {
  setAction(id: string, next: ActionSessionState) {
    const current = getSnapshot();
    write({ ...current, actions: { ...current.actions, [id]: next } });
  },
  appendEvents(events: AuditEvent[]) {
    const current = getSnapshot();
    const seen = new Set(current.events.map((e) => e.id));
    const added = events.filter((e) => !seen.has(e.id));
    if (added.length === 0) return;
    write({ ...current, events: [...current.events, ...added] });
  },
  reset() {
    write(EMPTY);
  },
  triggerIncident() {
    write({ ...getSnapshot(), incidentTriggered: true });
  },
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const state = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // False during server render and hydration, true once the client store is live.
  const hydrated = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const value = React.useMemo<SessionContextValue>(
    () => ({ state, hydrated, ...actions }),
    [state, hydrated],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
