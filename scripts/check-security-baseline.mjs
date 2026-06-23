/**
 * Security baseline checks for the Gracon documents frontend.
 *
 * These checks keep production sessions server-owned, redirect returns local,
 * and document-sensitive browser storage out of persistent stores.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const errors = [];

const requiredEnvExampleKeys = [
    'NEXT_PUBLIC_DOCS_URL',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_DOCUMENTS_USE_MAIN_APP_LOGIN',
    'NEXT_PUBLIC_ALLOW_DEV_READABLE_AUTH_COOKIES',
    'DOCUMENTS_USE_MAIN_APP_LOGIN',
    'ALLOW_DEV_READABLE_AUTH_COOKIES',
    'AUTH_COOKIE_DOMAIN',
    'AUTH_COOKIE_SECURE',
    'AUTH_COOKIE_SAME_SITE',
    'NEXT_PUBLIC_AUTH_API_URL',
    'NEXT_PUBLIC_DOCS_API_URL',
    'NEXT_PUBLIC_SIGNATURE_API_URL',
];

const requiredGitignoreEntries = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
    'env',
    'env.local',
    'env.production',
    'env.production.local',
];

const allowedCookieFiles = new Set([
    'src/lib/auth/session-cookie-policy.ts',
    'src/lib/session.ts',
]);

function parseEnv(source) {
    const values = new Map();
    for (const line of source.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const index = trimmed.indexOf('=');
        values.set(trimmed.slice(0, index), trimmed.slice(index + 1));
    }
    return values;
}

function walk(directory, files = []) {
    if (!existsSync(directory)) return files;

    for (const entry of readdirSync(directory)) {
        const absolute = join(directory, entry);
        const stats = statSync(absolute);
        if (stats.isDirectory()) {
            if (!['node_modules', '.next', 'out', 'coverage'].includes(entry)) {
                walk(absolute, files);
            }
            continue;
        }

        if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) files.push(absolute);
    }

    return files;
}

function checkEnvExample() {
    const envPath = join(projectRoot, '.env.example');
    if (!existsSync(envPath)) {
        errors.push('.env.example is required.');
        return;
    }

    const env = parseEnv(readFileSync(envPath, 'utf8'));
    for (const key of requiredEnvExampleKeys) {
        if (!env.has(key)) errors.push(`.env.example must document ${key}.`);
    }

    for (const key of env.keys()) {
        if (/^NEXT_PUBLIC_/.test(key) && /(SECRET|PASSWORD|PRIVATE|API_SECRET|CLIENT_SECRET)$/.test(key)) {
            errors.push(`.env.example must not expose sensitive key ${key} with NEXT_PUBLIC_.`);
        }
    }
}

function checkDeployEnv() {
    if (process.env.CHECK_DEPLOY_ENV !== 'true') return;

    const requiredTrue = [
        'AUTH_COOKIE_SECURE',
        'DOCUMENTS_USE_MAIN_APP_LOGIN',
        'NEXT_PUBLIC_DOCUMENTS_USE_MAIN_APP_LOGIN',
    ];
    const requiredFalse = [
        'ALLOW_DEV_READABLE_AUTH_COOKIES',
        'NEXT_PUBLIC_ALLOW_DEV_READABLE_AUTH_COOKIES',
    ];

    for (const key of requiredTrue) {
        if (process.env[key] !== 'true') errors.push(`${key} must be true in production.`);
    }

    for (const key of requiredFalse) {
        if (process.env[key] && process.env[key] !== 'false') {
            errors.push(`${key} must be false in production.`);
        }
    }

    const cookieDomain = process.env.AUTH_COOKIE_DOMAIN ?? process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    if (!cookieDomain || !cookieDomain.startsWith('.')) {
        errors.push('AUTH_COOKIE_DOMAIN must be a parent domain in production, for example .gracon360.com.');
    }

    for (const key of ['NEXT_PUBLIC_DOCS_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_DOCS_API_URL']) {
        const value = process.env[key];
        if (!value) {
            errors.push(`${key} is required for production validation.`);
        } else if (!value.startsWith('https://')) {
            errors.push(`${key} must use HTTPS in production.`);
        }
    }
}

function checkGitignore() {
    const gitignorePath = join(projectRoot, '.gitignore');
    if (!existsSync(gitignorePath)) {
        errors.push('.gitignore is required.');
        return;
    }

    const entries = new Set(
        readFileSync(gitignorePath, 'utf8')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#')),
    );

    for (const entry of requiredGitignoreEntries) {
        if (!entries.has(entry)) errors.push(`.gitignore must ignore ${entry}.`);
    }
}

function checkSourceBoundary() {
    const sensitiveStorage = /\b(localStorage|sessionStorage)\b.*(token|jwt|secret|password|private|nid|pid|passport|recording|invite)/i;
    for (const file of walk(join(projectRoot, 'src'))) {
        const relativePath = relative(projectRoot, file);
        const lines = readFileSync(file, 'utf8').split(/\r?\n/);

        lines.forEach((line, index) => {
            if (line.trim().startsWith('//')) return;

            if (sensitiveStorage.test(line)) {
                errors.push(`${relativePath}:${index + 1} must not persist sensitive data in browser storage.`);
            }

            if (line.includes('document.cookie') && !allowedCookieFiles.has(relativePath)) {
                errors.push(`${relativePath}:${index + 1} must not access auth cookies outside approved helpers.`);
            }

            if (/NEXT_PUBLIC_.*(S3|AWS|SECRET|PRIVATE|PASSWORD)/.test(line)) {
                errors.push(`${relativePath}:${index + 1} must not expose storage or secret values to the browser.`);
            }
        });
    }
}

function checkRedirectSafety() {
    const sessionPath = join(projectRoot, 'src/lib/session.ts');
    const session = readFileSync(sessionPath, 'utf8');
    if (!session.includes('BLOCKED_NEXT_PATHS')) {
        errors.push('src/lib/session.ts must block session-ending next destinations.');
    }
    if (!session.includes('url.origin === docsOrigin')) {
        errors.push('src/lib/session.ts must use exact-origin checks for absolute return URLs.');
    }
}

checkEnvExample();
checkDeployEnv();
checkGitignore();
checkSourceBoundary();
checkRedirectSafety();

if (errors.length > 0) {
    console.error('Documents app security baseline failed:\n');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
}

console.log('Documents app security baseline passed.');
