/**
 * UserAvatar
 *
 * Renders authenticated user avatars through the app/documents same-origin
 * image route and falls back to initials without exposing broken image states.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import styles from './UserAvatar.module.css';

export interface UserAvatarProfile {
    userId: string;
    email: string;
    imageUrl: string | null;
    postNames: string;
    surName: string;
}

interface UserAvatarProps {
    user: UserAvatarProfile;
    size?: 'sm' | 'md';
    className?: string;
}

function getDisplayName(user: UserAvatarProfile) {
    const name = `${user.postNames} ${user.surName}`.trim();
    return name || user.email || 'User';
}

function getInitials(user: UserAvatarProfile) {
    const fromName = `${user.postNames?.[0] ?? ''}${user.surName?.[0] ?? ''}`
        .toUpperCase();

    if (fromName) return fromName;
    return user.email?.[0]?.toUpperCase() ?? 'U';
}

function getProfileImageSource(user: UserAvatarProfile) {
    if (!user.imageUrl) return null;
    const userParam = encodeURIComponent(user.userId);
    return `/api/profile-image?user=${userParam}`;
}

/**
 * Displays a robust user avatar with a loading state and initials fallback.
 */
export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const displayName = useMemo(() => getDisplayName(user), [user]);
    const initials = useMemo(() => getInitials(user), [user]);
    const source = !failed ? getProfileImageSource(user) : null;

    useEffect(() => {
        // A different image source starts a fresh loading/fallback lifecycle.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFailed(false);
        setLoaded(false);
    }, [user.userId, user.imageUrl]);

    return (
        <span
            className={`${styles.avatar} ${styles[size]} ${className ?? ''}`}
            aria-label={displayName}
        >
            {source && !loaded ? <span className={styles.loading} aria-hidden="true" /> : null}
            {source ? (
                <Image
                    src={source}
                    alt={`${displayName} profile photo`}
                    className={`${styles.image} ${loaded ? styles.imageLoaded : ''}`}
                    fill
                    sizes={size === 'sm' ? '32px' : '38px'}
                    unoptimized
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onLoad={() => setLoaded(true)}
                    onError={() => {
                        setFailed(true);
                        setLoaded(false);
                    }}
                />
            ) : (
                <span className={styles.initials}>{initials}</span>
            )}
        </span>
    );
}
