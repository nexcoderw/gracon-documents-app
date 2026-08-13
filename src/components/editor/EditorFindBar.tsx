/**
 * EditorFindBar
 *
 * Find bar that appears below the formatting toolbar when the Edit → Find
 * action is dispatched. Manages its own query and match-navigation state.
 * Uses collectMatches to locate text positions in the ProseMirror document,
 * then selects each hit so the editor scrolls to it.
 */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { collectMatches } from '@/lib/find-in-document';

interface EditorFindBarProps {
    /** The active TipTap editor instance. */
    editor: Editor;
    /** Called when the bar should be dismissed (Escape or ✕ button). */
    onClose: () => void;
}

/** Inline find bar with live match count and previous / next navigation. */
export function EditorFindBar({ editor, onClose }: EditorFindBarProps) {
    const [query, setQuery] = useState('');
    const [matchIndex, setMatchIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount; Escape key closes the bar
    useEffect(() => {
        inputRef.current?.focus();
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Jump to the first match whenever the query changes
    useEffect(() => {
        if (!query.trim()) return;
        const matches = collectMatches(editor, query);
        if (!matches.length) return;
        // Query changes reset navigation before synchronizing the editor selection.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMatchIndex(0);
        const match = matches[0];
        editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run();
    }, [editor, query]);

    /** Navigates forward or backward through matches, wrapping around the document. */
    const navigate = useCallback((direction: 'next' | 'prev') => {
        if (!query.trim()) return;
        const matches = collectMatches(editor, query);
        if (!matches.length) return;
        const next = direction === 'next'
            ? (matchIndex + 1) % matches.length
            : (matchIndex - 1 + matches.length) % matches.length;
        setMatchIndex(next);
        const match = matches[next];
        editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run();
    }, [editor, matchIndex, query]);

    const matchCount = query.trim() ? collectMatches(editor, query).length : 0;

    const navBtnStyle: React.CSSProperties = {
        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid var(--color-border)',
        color: 'var(--color-text-secondary)', fontSize: 13,
        cursor: query.trim() ? 'pointer' : 'not-allowed',
        opacity: query.trim() ? 1 : 0.4,
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--glass-bg)',
        }}>
            <span style={{
                fontSize: 12, color: 'var(--color-text-secondary)',
                fontWeight: 500, flexShrink: 0,
            }}>
                Find
            </span>
            <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); navigate('next'); }
                    if (e.key === 'Escape') onClose();
                }}
                placeholder="Search in document…"
                style={{
                    flex: 1, maxWidth: 260, height: 28, padding: '0 10px',
                    borderRadius: 6, border: '1px solid var(--color-border)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--color-text-primary)', fontSize: 13, outline: 'none',
                }}
            />
            {query.trim() && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {matchCount} found
                </span>
            )}
            {(['prev', 'next'] as const).map((dir) => (
                <button
                    key={dir}
                    onClick={() => navigate(dir)}
                    disabled={!query.trim()}
                    title={dir === 'prev' ? 'Previous match' : 'Next match'}
                    style={navBtnStyle}
                >
                    {dir === 'prev' ? '↑' : '↓'}
                </button>
            ))}
            <button
                onClick={onClose}
                title="Close (Esc)"
                style={{ ...navBtnStyle, opacity: 1, cursor: 'pointer' }}
            >
                ✕
            </button>
        </div>
    );
}
