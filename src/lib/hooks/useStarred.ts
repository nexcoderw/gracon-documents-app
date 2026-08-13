/**
 * useStarred
 *
 * Persists starred document IDs to localStorage so the user's favourites
 * survive page refreshes without requiring a backend endpoint.
 * All mutations are synchronous against the Set then serialised to storage.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'gracon_docs_starred';

/** Reads starred IDs from localStorage, returning an empty Set on any failure. */
function readStarred(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set<string>();
        return new Set<string>(JSON.parse(raw) as string[]);
    } catch {
        return new Set<string>();
    }
}

/** Writes the starred Set back to localStorage, silently ignoring write errors. */
function writeStarred(set: Set<string>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {
        // localStorage unavailable in some SSR or private-browsing contexts
    }
}

export interface UseStarredResult {
    starredIds: Set<string>;
    isStarred: (id: string) => boolean;
    toggleStar: (id: string) => void;
}

/**
 * Manages starred document IDs stored in localStorage.
 * Hydrates on mount so the initial render is always empty (SSR-safe).
 */
export function useStarred(): UseStarredResult {
    const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

    // Hydrate from localStorage after mount to avoid SSR mismatch.
    useEffect(() => {
        // Browser storage is an external source and cannot be read during SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStarredIds(readStarred());
    }, []);

    const toggleStar = useCallback((id: string) => {
        setStarredIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            writeStarred(next);
            return next;
        });
    }, []);

    const isStarred = useCallback(
        (id: string) => starredIds.has(id),
        [starredIds],
    );

    return { starredIds, isStarred, toggleStar };
}
