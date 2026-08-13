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
import { Button, Input } from '@/components/ui';
import styles from './DocsHeader.module.css';

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
        // This effect intentionally reconciles controlled input state with browser navigation.
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <header className={styles.header}>
            {/* ── Main bar ── */}
            <div className={styles.bar}>
                {/* Logo */}
                <Link href="/documents" className={styles.logo} aria-label="Gracon Docs home">
                    <div className={styles.logoMark}>G</div>
                    <div className={styles.logoText}>
                        <span className={styles.logoEyebrow}>Gracon 360</span>
                        <span className={styles.logoName}>Documents</span>
                    </div>
                </Link>

                {/* Search */}
                <form
                    onSubmit={handleFormSubmit}
                    className={styles.search}
                    role="search"
                    aria-label="Search documents"
                >
                    <Input
                        type="search"
                        placeholder="Search documents…"
                        className={styles.searchInput}
                        leftIcon={<HugeiconsIcon icon={Search01Icon} size={16} className={searching ? styles.searching : ''} />}
                        value={query}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        aria-label="Search documents"
                        autoComplete="off"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={clearSearch}
                            className={styles.searchClear}
                            aria-label="Clear search"
                        >
                            <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" />
                        </button>
                    )}
                </form>

                {/* Right-side actions */}
                <div className={styles.actions}>
                    {/* Mobile search toggle */}
                    <Button
                        variant="ghost"
                        iconOnly
                        className={styles.mobileSearchButton}
                        onClick={() => setMobileSearchOpen((v) => !v)}
                        aria-label="Search"
                    >
                        <HugeiconsIcon icon={Search01Icon} size={17} color="currentColor" />
                    </Button>

                    <Link
                        href="/documents/new?type=RICH_TEXT"
                        className={`${styles.actionLink} ${styles.newLink}`}
                    >
                        + New
                    </Link>

                    <Link
                        href="/verify"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${styles.actionLink} ${styles.verifyLink}`}
                    >
                        Verify
                    </Link>

                    <div ref={avatarMenuRef} className={styles.account}>
                        <button
                            type="button"
                            onClick={() => setAvatarMenuOpen((open) => !open)}
                            className={styles.avatar}
                            title={fullName}
                            aria-label="Open account menu"
                            aria-expanded={avatarMenuOpen}
                            aria-haspopup="menu"
                        >
                            <UserAvatar user={user} size="md" />
                        </button>

                        {avatarMenuOpen && (
                            <div className={styles.accountMenu} role="menu">
                                <div className={styles.accountProfile}>
                                    <UserAvatar user={user} size="sm" />
                                    <div className={styles.accountCopy}>
                                        <p className={styles.accountName}>{fullName}</p>
                                        <p className={styles.accountEmail}>{user.email}</p>
                                    </div>
                                </div>
                                <a
                                    className={styles.accountItem}
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
                                    className={styles.accountItem}
                                    href={settingsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    role="menuitem"
                                    onClick={() => setAvatarMenuOpen(false)}
                                >
                                    <HugeiconsIcon icon={Settings02Icon} size={15} />
                                    <span>Settings</span>
                                </a>
                                <div className={styles.divider} />
                                <button
                                    type="button"
                                    className={`${styles.accountItem} ${styles.danger}`}
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
                <div className={styles.mobileSearch}>
                    <form onSubmit={handleFormSubmit} className={styles.mobileSearchForm}>
                        <div className={styles.mobileSearchField}>
                            <Input
                                type="search"
                                placeholder="Search documents…"
                                className={styles.searchInput}
                                leftIcon={<HugeiconsIcon icon={Search01Icon} size={16} />}
                                value={query}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                autoFocus
                                autoComplete="off"
                            />
                        </div>
                        {query && (
                            <Button
                                type="button"
                                onClick={() => { clearSearch(); setMobileSearchOpen(false); }}
                                variant="ghost"
                                size="sm"
                            >
                                Clear
                            </Button>
                        )}
                    </form>
                </div>
            )}

            {/* ── Nav strip ── */}
            <nav className={styles.nav} aria-label="Document sections">
                {DOCS_NAV_ITEMS.map((item) => {
                    const active = item.isActive(pathname, status);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.description}
                            className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
}
