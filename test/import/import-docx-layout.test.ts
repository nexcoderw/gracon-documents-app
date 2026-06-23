import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    annotateImportedDocxHtml,
    collectImportedParagraphLayouts,
    createImportedParagraphLayout,
    extractFootnoteReferencesFromDocxXml,
    extractParagraphListStylesFromDocxXml,
    extractParagraphPageBreaksFromDocumentXml,
    extractParagraphTabStopsFromDocumentXml,
    mergeParagraphPageBreaksIntoLayouts,
    mergeParagraphTabStopsIntoLayouts,
    twipToPx,
} from '../../src/lib/import-docx-layout.ts';

describe('DOCX import layout conversion', () => {
    it('converts Word twips to CSS pixels', () => {
        assert.equal(twipToPx('720'), 48);
        assert.equal(twipToPx(360), 24);
        assert.equal(twipToPx('invalid'), 0);
    });

    it('maps paragraph indents into editor ruler attributes', () => {
        const layout = createImportedParagraphLayout({
            type: 'paragraph',
            indent: {
                start: '720',
                firstLine: '360',
            },
        });

        assert.deepEqual(layout, {
            leftIndent: 48,
            firstLineIndent: 24,
            tabStops: [],
            pageBreakBefore: false,
        });
    });

    it('maps hanging indents into negative first-line indentation', () => {
        const layout = createImportedParagraphLayout({
            type: 'paragraph',
            indent: {
                left: '1080',
                hanging: '360',
            },
        });

        assert.deepEqual(layout, {
            leftIndent: 72,
            firstLineIndent: -24,
            tabStops: [],
            pageBreakBefore: false,
        });
    });

    it('normalizes future Mammoth tab-stop metadata when present', () => {
        const layout = createImportedParagraphLayout({
            type: 'paragraph',
            indent: { start: '0' },
            tabStops: [
                { position: '720' },
                { position: '1430' },
                { position: '1440' },
                { position: '20000' },
            ],
        });

        assert.deepEqual(layout.tabStops, [
            { position: 48, align: 'left' },
            { position: 96, align: 'left' },
            { position: 602, align: 'left' },
        ]);
    });

    it('collects one layout entry for every Mammoth paragraph in document order', () => {
        const layouts = collectImportedParagraphLayouts({
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    indent: { start: '720' },
                    children: [{ type: 'run', children: [] }],
                },
                {
                    type: 'table',
                    children: [
                        {
                            type: 'tableRow',
                            children: [
                                {
                                    type: 'tableCell',
                                    children: [
                                        {
                                            type: 'paragraph',
                                            indent: { hanging: '360' },
                                            children: [],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        assert.deepEqual(layouts, [
            { leftIndent: 48, firstLineIndent: 0, tabStops: [], pageBreakBefore: false },
            { leftIndent: 0, firstLineIndent: -24, tabStops: [], pageBreakBefore: false },
        ]);
    });

    it('extracts exact paragraph tab stops from DOCX document XML', () => {
        const tabStops = extractParagraphTabStopsFromDocumentXml(`
            <w:document>
                <w:body>
                    <w:p>
                        <w:pPr>
                            <w:tabs>
                                <w:tab w:val="left" w:pos="720"/>
                                <w:tab w:val="left" w:pos="1440"/>
                            </w:tabs>
                        </w:pPr>
                        <w:r><w:t>First</w:t></w:r>
                    </w:p>
                    <w:p>
                        <w:pPr>
                            <w:tabs>
                                <w:tab w:val="center" w:pos="2160"/>
                                <w:tab w:val="right" w:pos="2880"/>
                                <w:tab w:val="decimal" w:pos="3600"/>
                            </w:tabs>
                        </w:pPr>
                    </w:p>
                    <w:p><w:r><w:t>No tabs</w:t></w:r></w:p>
                </w:body>
            </w:document>
        `);

        assert.deepEqual(tabStops, [
            [
                { position: 48, align: 'left' },
                { position: 96, align: 'left' },
            ],
            [
                { position: 144, align: 'center' },
                { position: 192, align: 'right' },
                { position: 240, align: 'decimal' },
            ],
            [],
        ]);
    });

    it('merges raw DOCX tab stops into Mammoth paragraph layouts by paragraph order', () => {
        const layouts = mergeParagraphTabStopsIntoLayouts(
            [
                { leftIndent: 48, firstLineIndent: 0, tabStops: [], pageBreakBefore: false },
                { leftIndent: 0, firstLineIndent: -24, tabStops: [], pageBreakBefore: false },
            ],
            [
                [
                    { position: 48, align: 'left' },
                    { position: 96, align: 'right' },
                ],
                [],
            ],
        );

        assert.deepEqual(layouts, [
            {
                leftIndent: 48,
                firstLineIndent: 0,
                tabStops: [
                    { position: 48, align: 'left' },
                    { position: 96, align: 'right' },
                ],
                pageBreakBefore: false,
            },
            { leftIndent: 0, firstLineIndent: -24, tabStops: [], pageBreakBefore: false },
        ]);
    });

    it('extracts and merges DOCX paragraph page breaks', () => {
        const pageBreaks = extractParagraphPageBreaksFromDocumentXml(`
            <w:document><w:body>
                <w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:t>First</w:t></w:r></w:p>
                <w:p><w:r><w:br w:type="page"/></w:r><w:r><w:t>Second</w:t></w:r></w:p>
                <w:p><w:r><w:t>Third</w:t></w:r></w:p>
            </w:body></w:document>
        `);

        assert.deepEqual(pageBreaks, [true, true, false]);
        assert.deepEqual(
            mergeParagraphPageBreaksIntoLayouts(
                [
                    { leftIndent: 0, firstLineIndent: 0, tabStops: [], pageBreakBefore: false },
                    { leftIndent: 24, firstLineIndent: 0, tabStops: [], pageBreakBefore: false },
                    { leftIndent: 0, firstLineIndent: 0, tabStops: [], pageBreakBefore: false },
                ],
                pageBreaks,
            ),
            [
                { leftIndent: 0, firstLineIndent: 0, tabStops: [], pageBreakBefore: true },
                { leftIndent: 24, firstLineIndent: 0, tabStops: [], pageBreakBefore: true },
                { leftIndent: 0, firstLineIndent: 0, tabStops: [], pageBreakBefore: false },
            ],
        );
    });

    it('extracts DOCX numbering formats for imported list styles', () => {
        const numberingXml = `
            <w:numbering>
                <w:abstractNum w:abstractNumId="1">
                    <w:lvl w:ilvl="0"><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%1."/></w:lvl>
                </w:abstractNum>
                <w:abstractNum w:abstractNumId="2">
                    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="▪"/></w:lvl>
                </w:abstractNum>
                <w:num w:numId="10"><w:abstractNumId w:val="1"/></w:num>
                <w:num w:numId="20"><w:abstractNumId w:val="2"/></w:num>
            </w:numbering>
        `;
        const documentXml = `
            <w:document><w:body>
                <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="10"/></w:numPr></w:pPr></w:p>
                <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="20"/></w:numPr></w:pPr></w:p>
                <w:p><w:r><w:t>Plain</w:t></w:r></w:p>
            </w:body></w:document>
        `;

        assert.deepEqual(extractParagraphListStylesFromDocxXml(documentXml, numberingXml), [
            { kind: 'orderedList', style: 'lower-alpha' },
            { kind: 'bulletList', style: 'square' },
            null,
        ]);
    });

    it('extracts referenced DOCX footnotes in document order', () => {
        const documentXml = `
            <w:document><w:body>
                <w:p>
                    <w:r><w:t>First</w:t></w:r>
                    <w:r><w:footnoteReference w:id="3"/></w:r>
                </w:p>
                <w:p>
                    <w:r><w:t>Second</w:t></w:r>
                    <w:r><w:footnoteReference w:id="8"/></w:r>
                </w:p>
            </w:body></w:document>
        `;
        const footnotesXml = `
            <w:footnotes>
                <w:footnote w:id="-1"><w:p><w:r><w:t>separator</w:t></w:r></w:p></w:footnote>
                <w:footnote w:id="8"><w:p><w:r><w:t>Second note &amp; detail</w:t></w:r></w:p></w:footnote>
                <w:footnote w:id="3"><w:p><w:r><w:t>First note</w:t></w:r></w:p></w:footnote>
            </w:footnotes>
        `;

        assert.deepEqual(extractFootnoteReferencesFromDocxXml(documentXml, footnotesXml), [
            { id: '3', note: 'First note' },
            { id: '8', note: 'Second note & detail' },
        ]);
    });

    it('annotates imported HTML lists with recovered DOCX list styles', () => {
        const originalDomParser = globalThis.DOMParser;

        try {
            class FakeElement {
                tagName: string;
                attrs = new Map<string, string>();

                constructor(tagName: string) {
                    this.tagName = tagName;
                }

                setAttribute(name: string, value: string) {
                    this.attrs.set(name, value);
                }

                getAttribute(name: string) {
                    return this.attrs.get(name) ?? null;
                }
            }

            const paragraph = new FakeElement('P');
            const orderedList = new FakeElement('OL');
            const bulletList = new FakeElement('UL');

            // @ts-expect-error Minimal DOMParser implementation for this pure helper test.
            globalThis.DOMParser = class {
                parseFromString() {
                    return {
                        body: {
                            querySelectorAll: (selector: string) => {
                                if (selector === 'p, h1, h2, h3, h4, h5, h6') return [paragraph];
                                if (selector === 'ul, ol') return [orderedList, bulletList];
                                return [];
                            },
                            get innerHTML() {
                                return [
                                    orderedList.getAttribute('data-list-style-type'),
                                    bulletList.getAttribute('data-list-style-type'),
                                ].join('|');
                            },
                        },
                    };
                }
            };

            const html = annotateImportedDocxHtml(
                '<ol><li>A</li></ol><ul><li>B</li></ul>',
                [{ leftIndent: 0, firstLineIndent: 0, tabStops: [], pageBreakBefore: false }],
                [
                    { kind: 'orderedList', style: 'upper-roman' },
                    { kind: 'bulletList', style: 'circle' },
                ],
            );

            assert.equal(html, 'upper-roman|circle');
        } finally {
            globalThis.DOMParser = originalDomParser;
        }
    });
});
