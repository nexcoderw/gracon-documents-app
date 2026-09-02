/**
 * Insert menu items for the document editor menu bar.
 *
 * Keep this file as the single insert-menu contract. The action dispatcher
 * imports the typed action IDs from here so menu labels and command handling
 * cannot drift silently.
 */
import type { MenuItem, MenuItemAction } from './types';

export const INSERT_ACTION_IDS = {
    image: 'insert:image',
    table: 'insert:table',
    signatureBlocks: 'insert:signature-blocks',
    horizontalRule: 'insert:hr',
    currentDate: 'insert:date',
    currentTime: 'insert:time',
    dateTime: 'insert:date-time',
    link: 'insert:link',
    comment: 'insert:comment',
    tableOfContents: 'insert:table-of-contents',
    emoji: 'insert:emoji',
    specialCharacters: 'insert:special',
    emDash: 'insert:special:em-dash',
    enDash: 'insert:special:en-dash',
    nonBreakingSpace: 'insert:special:nbsp',
    copyright: 'insert:special:copyright',
    trademark: 'insert:special:trademark',
    registered: 'insert:special:registered',
    checkmark: 'insert:special:checkmark',
    footnote: 'insert:footnote',
    headerFooter: 'insert:header-footer',
    pageBreakBefore: 'insert:page-break-before',
    pageBreakAtCursor: 'insert:page-break-at-cursor',
} as const;

export type InsertActionId = typeof INSERT_ACTION_IDS[keyof typeof INSERT_ACTION_IDS];

interface InsertActionDefinition {
    actionId: InsertActionId;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    /**
     * Current implementation status for planning and future enablement.
     * This is intentionally not rendered in the menu.
     */
    status: 'ready' | 'planned';
}

export const INSERT_ACTIONS = {
    image: {
        actionId: INSERT_ACTION_IDS.image,
        label: 'Image',
        status: 'ready',
    },
    table: {
        actionId: INSERT_ACTION_IDS.table,
        label: 'Table',
        status: 'ready',
    },
    signatureBlocks: {
        actionId: INSERT_ACTION_IDS.signatureBlocks,
        label: 'Signature blocks',
        status: 'ready',
    },
    horizontalRule: {
        actionId: INSERT_ACTION_IDS.horizontalRule,
        label: 'Horizontal line',
        status: 'ready',
    },
    currentDate: {
        actionId: INSERT_ACTION_IDS.currentDate,
        label: 'Date',
        status: 'ready',
    },
    currentTime: {
        actionId: INSERT_ACTION_IDS.currentTime,
        label: 'Time',
        status: 'ready',
    },
    dateTime: {
        actionId: INSERT_ACTION_IDS.dateTime,
        label: 'Date and time',
        status: 'ready',
    },
    link: {
        actionId: INSERT_ACTION_IDS.link,
        label: 'Link',
        shortcut: '⌘K',
        status: 'ready',
    },
    comment: {
        actionId: INSERT_ACTION_IDS.comment,
        label: 'Comment',
        status: 'ready',
    },
    tableOfContents: {
        actionId: INSERT_ACTION_IDS.tableOfContents,
        label: 'Table of contents',
        status: 'ready',
    },
    emoji: {
        actionId: INSERT_ACTION_IDS.emoji,
        label: 'Emoji',
        disabled: true,
        status: 'planned',
    },
    specialCharacters: {
        actionId: INSERT_ACTION_IDS.specialCharacters,
        label: 'Special characters',
        status: 'ready',
    },
    emDash: {
        actionId: INSERT_ACTION_IDS.emDash,
        label: 'Em dash —',
        status: 'ready',
    },
    enDash: {
        actionId: INSERT_ACTION_IDS.enDash,
        label: 'En dash –',
        status: 'ready',
    },
    nonBreakingSpace: {
        actionId: INSERT_ACTION_IDS.nonBreakingSpace,
        label: 'Non-breaking space',
        status: 'ready',
    },
    copyright: {
        actionId: INSERT_ACTION_IDS.copyright,
        label: 'Copyright ©',
        status: 'ready',
    },
    trademark: {
        actionId: INSERT_ACTION_IDS.trademark,
        label: 'Trademark ™',
        status: 'ready',
    },
    registered: {
        actionId: INSERT_ACTION_IDS.registered,
        label: 'Registered ®',
        status: 'ready',
    },
    checkmark: {
        actionId: INSERT_ACTION_IDS.checkmark,
        label: 'Check mark ✓',
        status: 'ready',
    },
    footnote: {
        actionId: INSERT_ACTION_IDS.footnote,
        label: 'Footnote',
        status: 'ready',
    },
    headerFooter: {
        actionId: INSERT_ACTION_IDS.headerFooter,
        label: 'Header & footer',
        status: 'ready',
    },
    pageBreakBefore: {
        actionId: INSERT_ACTION_IDS.pageBreakBefore,
        label: 'Page break before paragraph',
        status: 'ready',
    },
    pageBreakAtCursor: {
        actionId: INSERT_ACTION_IDS.pageBreakAtCursor,
        label: 'Page break',
        shortcut: 'Ctrl+Enter',
        status: 'ready',
    },
} satisfies Record<string, InsertActionDefinition>;

function createInsertAction(action: InsertActionDefinition): MenuItemAction {
    return {
        type: 'action',
        label: action.label,
        actionId: action.actionId,
        ...(action.shortcut ? { shortcut: action.shortcut } : {}),
        ...(action.disabled ? { disabled: true } : {}),
    };
}

export const INSERT_MENU_ITEMS: MenuItem[] = [
    createInsertAction(INSERT_ACTIONS.image),
    createInsertAction(INSERT_ACTIONS.table),
    createInsertAction(INSERT_ACTIONS.signatureBlocks),
    createInsertAction(INSERT_ACTIONS.horizontalRule),
    {
        type: 'submenu',
        label: 'Date and time',
        items: [
            createInsertAction(INSERT_ACTIONS.currentDate),
            createInsertAction(INSERT_ACTIONS.currentTime),
            createInsertAction(INSERT_ACTIONS.dateTime),
        ],
    },
    { type: 'divider' },
    createInsertAction(INSERT_ACTIONS.link),
    createInsertAction(INSERT_ACTIONS.comment),
    createInsertAction(INSERT_ACTIONS.tableOfContents),
    { type: 'divider' },
    createInsertAction(INSERT_ACTIONS.emoji),
    {
        type: 'submenu',
        label: INSERT_ACTIONS.specialCharacters.label,
        items: [
            createInsertAction(INSERT_ACTIONS.emDash),
            createInsertAction(INSERT_ACTIONS.enDash),
            createInsertAction(INSERT_ACTIONS.nonBreakingSpace),
            createInsertAction(INSERT_ACTIONS.copyright),
            createInsertAction(INSERT_ACTIONS.trademark),
            createInsertAction(INSERT_ACTIONS.registered),
            createInsertAction(INSERT_ACTIONS.checkmark),
        ],
    },
    { type: 'divider' },
    createInsertAction(INSERT_ACTIONS.footnote),
    createInsertAction(INSERT_ACTIONS.pageBreakAtCursor),
    createInsertAction(INSERT_ACTIONS.pageBreakBefore),
    createInsertAction(INSERT_ACTIONS.headerFooter),
];
