/**
 * DocsHeader
 *
 * Google Docs-style sticky header with a debounced live search input.
 * Typing triggers a search after 350 ms of inactivity — the query is written
 * to the URL so the documents page reacts via its existing searchParams hook.
 * A clear button and loading indicator are shown inside the input.
 */
'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Search01Icon,
    Cancel01Icon,
    Logout01Icon,
    Profile02Icon,
    Settings02Icon,
} from '@hugeicons/core-free-icons';
import type { SessionUser } from '@/app/(protected)/layout';
import {
    getMainAppProfileUrl,
    getMainAppSettingsUrl,
    logoutFromDocuments,
} from '@/lib/session';
import { DOCS_NAV_ITEMS } from '@/constants';
import { UserAvatar } from '@/components/shared/UserAvatar';

/** Debounce delay in ms before the search query is pushed to the URL. */
const SEARCH_DEBOUNCE_MS = 350;

export function DocsHeader({ user }: { user: SessionUser }) {
    const router        = useRouter();
    const pathname      = usePathname();
    const searchParams  = useSearchParams();

    const [query,            setQuery]            = useState(searchParams.get('search') ?? '');
    const [searching,        setSearching]        = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [avatarMenuOpen,   setAvatarMenuOpen]   = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const avatarMenuRef = useRef<HTMLDivElement>(null);

    // Keep local query in sync when URL params change externally (e.g. nav away and back).
    useEffect(() => {
        setQuery(searchParams.get('search') ?? '');
    }, [searchParams]);

    // Clean up any pending debounce on unmount.
    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    // Close the account menu when focus moves outside the avatar dropdown.
    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (!avatarMenuRef.current?.contains(event.target as Node)) {
                setAvatarMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /** Handles every keystroke: updates UI instantly, debounces the URL push. */
    function handleSearchChange(value: string) {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            pushSearch(value);
        }, SEARCH_DEBOUNCE_MS);
    }

    /** Pushes a search value to the URL, only if it actually differs. */
    function pushSearch(value: string) {
        const params = new URLSearchParams(searchParams.toString());
        const trimmed = value.trim();
        const before = params.toString();

        if (trimmed) params.set('search', trimmed);
        else params.delete('search');

        if (params.toString() === before) return; // nothing changed

        setSearching(true);
        const target = pathname !== '/documents' ? '/documents' : pathname;
        router.push(`${target}${params.toString() ? `?${params.toString()}` : ''}`);
        // Brief visual feedback — the page will re-render once data loads.
        setTimeout(() => setSearching(false), 600);
    }

    /** Clears the search input and URL param immediately. */
    function clearSearch() {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setQuery('');
        pushSearch('');
    }

    /** Allows pressing Enter to push immediately without waiting for the debounce. */
    function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        pushSearch(query);
        setMobileSearchOpen(false);
    }

    function logout() {
        void logoutFromDocuments();
    }

    const status   = searchParams.get('status');
    const fullName = `${user.postNames} ${user.surName}`.trim() || user.email;
    const profileUrl = getMainAppProfileUrl();
    const settingsUrl = getMainAppSettingsUrl();

    return (
        <header className="docs-header">
            {/* ── Main bar ── */}
            <div className="docs-header__bar">
                {/* Logo */}
                <Link href="/documents" className="docs-header__logo" aria-label="Gracon Docs home">
                    <div className="docs-header__logo-mark">G</div>
                    <div className="docs-header__logo-text">
                        <span className="docs-header__logo-eyebrow">Gracon 360</span>
                        <span className="docs-header__logo-name">Documents</span>
                    </div>
                </Link>

                {/* Search */}
                <form
                    onSubmit={handleFormSubmit}
                    className="docs-header__search"
                    role="search"
                    aria-label="Search documents"
                >
                    <span className="docs-header__search-icon" aria-hidden="true">
                        <HugeiconsIcon
                            icon={Search01Icon}
                            size={16}
                            color="currentColor"
                            className={searching ? 'docs-search-icon--searching' : ''}
                        />
                    </span>
                    <input
                        type="search"
                        placeholder="Search documents…"
                        className="input-glass"
                        value={query}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        aria-label="Search documents"
                        autoComplete="off"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={clearSearch}
                            className="docs-header__search-clear"
                            aria-label="Clear search"
                        >
                            <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" />
                        </button>
                    )}
                </form>

                {/* Right-side actions */}
                <div className="docs-header__actions">
                    {/* Mobile search toggle */}
                    <button
                        className="btn-icon docs-header__mobile-search-btn"
                        onClick={() => setMobileSearchOpen((v) => !v)}
                        aria-label="Search"
                    >
                        <HugeiconsIcon icon={Search01Icon} size={17} color="currentColor" />
                    </button>

                    <Link
                        href="/documents/new?type=RICH_TEXT"
                        className="btn-primary"
                        style={{ textDecoration: 'none', padding: '10px 20px', fontSize: 13 }}
                    >
                        + New
                    </Link>

                    <Link
                        href="/verify"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost docs-header__verify"
                        style={{ textDecoration: 'none', padding: '9px 16px', fontSize: 13 }}
                    >
                        Verify
                    </Link>

                    <div ref={avatarMenuRef} className="docs-header__account">
                        <button
                            type="button"
                            onClick={() => setAvatarMenuOpen((open) => !open)}
                            className="docs-header__avatar"
                            title={fullName}
                            aria-label="Open account menu"
                            aria-expanded={avatarMenuOpen}
                            aria-haspopup="menu"
                        >
                            <UserAvatar user={user} size="md" />
                        </button>

                        {avatarMenuOpen && (
                            <div className="docs-header__account-menu" role="menu">
                                <div className="docs-header__account-profile">
                                    <UserAvatar user={user} size="sm" />
                                    <div className="docs-header__account-copy">
                                        <p className="docs-header__account-name">{fullName}</p>
                                        <p className="docs-header__account-email">{user.email}</p>
                                    </div>
                                </div>
                                <a
                                    className="docs-header__account-item"
                                    href={profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    role="menuitem"
                                    onClick={() => setAvatarMenuOpen(false)}
                                >
                                    <HugeiconsIcon icon={Profile02Icon} size={15} />
                                    <span>Profile</span>
                                </a>
                                <a
                                    className="docs-header__account-item"
                                    href={settingsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    role="menuitem"
                                    onClick={() => setAvatarMenuOpen(false)}
                                >
                                    <HugeiconsIcon icon={Settings02Icon} size={15} />
                                    <span>Settings</span>
                                </a>
                                <div className="docs-header__account-divider" />
                                <button
                                    type="button"
                                    className="docs-header__account-item docs-header__account-item--danger"
                                    onClick={logout}
                                    role="menuitem"
                                >
                                    <HugeiconsIcon icon={Logout01Icon} size={15} />
                                    <span>Sign out</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Mobile search overlay ── */}
            {mobileSearchOpen && (
                <div className="docs-header__mobile-search">
                    <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', pointerEvents: 'none' }}>
                                <HugeiconsIcon icon={Search01Icon} size={16} color="currentColor" />
                            </span>
                            <input
                                type="search"
                                placeholder="Search documents…"
                                className="input-glass"
                                value={query}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                autoFocus
                                autoComplete="off"
                                style={{ paddingLeft: 40, height: 44, borderRadius: 9999, fontSize: 14 }}
                            />
                        </div>
                        {query && (
                            <button
                                type="button"
                                onClick={() => { clearSearch(); setMobileSearchOpen(false); }}
                                className="btn-ghost"
                                style={{ padding: '9px 14px', fontSize: 12, flexShrink: 0 }}
                            >
                                Clear
                            </button>
                        )}
                    </form>
                </div>
            )}

            {/* ── Nav strip ── */}
            <nav className="docs-header__nav" aria-label="Document sections">
                {DOCS_NAV_ITEMS.map((item) => {
                    const active = item.isActive(pathname, status);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.description}
                            className={`docs-header__nav-item${active ? ' docs-header__nav-item--active' : ''}`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
}
