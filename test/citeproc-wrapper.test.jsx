import { test, expect } from '@playwright/experimental-ct-react';

import { CiteprocWrapperFixture } from './fixtures/citeproc-wrapper-fixture';
import acmSigProceedingsStyle from './fixtures/acm-sig-proceedings.xml';
import droppedEntryStyle from './fixtures/dropped-entry-style.xml';

const book = (id, family, title, year) => ({
	id, type: 'book', title, author: [{ family, given: 'A' }], issued: { 'date-parts': [[year]] }
});

// with `droppedEntryStyle`, X sorts between A and Z, but citeproc-js leaves its entry out
const droppedEntryItems = [
	book('A', 'Aa', 'Alpha', 2000),
	{ id: 'X', type: 'book', issued: { 'date-parts': [[2015]] } },
	book('Z', 'Zz', 'Zulu', 2030),
];

const getEntries = async (component, count) => {
	const result = component.getByTestId('result');
	await expect(result).toHaveAttribute('data-count', String(count));
	return JSON.parse(await result.textContent());
};

// Mock bibliography output where entry_ids has an item but items array is empty.
// This simulates the citeproc-js behavior described in zotero/zoterobib#309 where
// items with no meaningful fields produce entry_ids but no corresponding items.
const mockMismatchedBibliography = [
	{
		entry_ids: [['AABBCCDD']],
		bibliography_errors: [],
		bibstart: '',
		bibend: '',
	},
	[] // empty items array -- length mismatch with entry_ids
];

test('skipErrorChecking: true -- mismatched entry_ids/items produces empty bibliography', async ({ mount }) => {
	const component = await mount(
		<CiteprocWrapperFixture
			skipErrorChecking={true}
			items={[{ id: 'AABBCCDD', type: 'book' }]}
			mockBibliography={mockMismatchedBibliography}
		/>
	);

	await expect(component.getByTestId('result')).toHaveAttribute('data-count', '0');
});

test('tagged bibliography that does not match the rendered entries throws', async ({ mount }) => {
	const taggedEntry = '  <div class="csl-entry">Alpha</div>\n<!--citeproc-wrapper-entry:AABBCCDD-->\n';
	const component = await mount(
		<CiteprocWrapperFixture
			items={[{ id: 'AABBCCDD', type: 'book' }]}
			mockBibliography={mockMismatchedBibliography}
			mockTaggedBibliography={[mockMismatchedBibliography[0], [taggedEntry]]}
		/>
	);

	await expect(component.getByTestId('error')).toContainText(
		'tagged bibliography has 1 entries, expected 0'
	);
});

test('entry left out by citeproc-js becomes an error entry in its own position', async ({ mount }) => {
	const component = await mount(
		<CiteprocWrapperFixture style={droppedEntryStyle} items={droppedEntryItems} />
	);

	const entries = await getEntries(component, 3);
	expect(entries.map(entry => entry.id)).toEqual(['A', 'X', 'Z']);
	expect(entries[0].value).toContain('Alpha');
	expect(entries[1].value).toBe('<span class="csl-error"><i>Untitled</i></span>');
	expect(entries[2].value).toContain('Zulu');
	expect(entries.map(entry => entry.value).join('')).not.toContain('citeproc-wrapper-entry');
});

test('error entry shows the title as plain text', async ({ mount }) => {
	const expectedTitles = {
		'<i>E. coli</i> in H<sub>2</sub>O': 'E. coli in H2O',
		'x<y and z>w': 'x&#60;y and z&#62;w',
		'a<b>c': 'a&#60;b&#62;c',
		'<span>text</span>': '&#60;span&#62;text&#60;/span&#62;',
		'<i><b>x</i></b>': '&#60;b&#62;x&#60;/b&#62;',
		'& <img src=x onerror="alert(1)">': '&#38; &#60;img src=x onerror=&#34;alert(1)&#34;&#62;',
	};
	const items = Object.keys(expectedTitles).map((title, index) => ({
		id: `X${index}`, type: 'webpage', title, issued: { 'date-parts': [[2001 + index]] }
	}));
	const component = await mount(
		<CiteprocWrapperFixture style={droppedEntryStyle} items={items} />
	);

	const entries = await getEntries(component, items.length);
	expect(entries).toEqual(Object.values(expectedTitles).map((value, index) => ({
		id: `X${index}`, value: `<span class="csl-error">${value}</span>`
	})));
});

test('batchedUpdates: entry left out by citeproc-js keeps its own id', async ({ mount }) => {
	const component = await mount(
		<CiteprocWrapperFixture style={droppedEntryStyle} items={droppedEntryItems} method="batchedUpdates" />
	);

	const entries = await getEntries(component, 3);
	expect(entries.map(entry => entry.id)).toEqual(['A', 'X', 'Z']);
	expect(entries[0].value).toContain('Alpha');
	expect(entries[1].value).toContain('csl-error');
	expect(entries[2].value).toContain('Zulu');
});

test('plain text format: entry left out by citeproc-js is resolved and other entries stay plain text', async ({ mount }) => {
	const component = await mount(
		<CiteprocWrapperFixture style={droppedEntryStyle} items={droppedEntryItems} format="plain" calls={2} />
	);

	const entries = await getEntries(component, 3);
	expect(entries.map(entry => entry.id)).toEqual(['A', 'X', 'Z']);
	expect(entries[0].value).toContain('Alpha');
	expect(entries[1].value).toContain('csl-error');
	expect(entries[2].value).toContain('Zulu');
	expect(entries[0].value + entries[2].value).not.toContain('<');
});

test('MLA: presentation with only a date becomes an error entry', async ({ mount }) => {
	const component = await mount(
		<CiteprocWrapperFixture
			items={[
				book('A', 'Aa', 'Alpha', 2000),
				{ id: 'X', type: 'speech', issued: { 'date-parts': [[2020, 1, 2]] } },
				book('Z', 'Zz', 'Zulu', 2001),
			]}
		/>
	);

	const entries = await getEntries(component, 3);
	const valueOf = id => entries.find(entry => entry.id === id).value;
	expect(valueOf('A')).toContain('Alpha');
	expect(valueOf('X')).toContain('csl-error');
	expect(valueOf('Z')).toContain('Zulu');
});

// ACM SIG Proceedings renders an empty item as its citation number alone
const emptyItemItems = [book('A', 'Aa', 'Alpha', 2000), { id: 'X', type: 'book' }];

for (const method of ['makeBibliography', 'batchedUpdates']) {
	test(`${method}: empty item becomes an error entry whatever the style renders for it`, async ({ mount }) => {
		const component = await mount(
			<CiteprocWrapperFixture style={acmSigProceedingsStyle} items={emptyItemItems} method={method} />
		);

		const entries = await getEntries(component, 2);
		expect(entries.map(entry => entry.id)).toEqual(['A', 'X']);
		expect(entries[0].value).toContain('Alpha');
		expect(entries[1].value).toBe('<span class="csl-error"><i>Untitled</i></span>');
	});
}

test('skipErrorChecking: true -- empty item keeps what the style renders for it', async ({ mount }) => {
	const component = await mount(
		<CiteprocWrapperFixture style={acmSigProceedingsStyle} items={emptyItemItems} skipErrorChecking={true} />
	);

	const entries = await getEntries(component, 2);
	expect(entries[1].value).toContain('[2]');
	expect(entries[1].value).not.toContain('csl-error');
});

test('makeBibliography produces entries for 2 items', async ({ mount }) => {
	const items = [
		{
			id: 'item1',
			type: 'book',
			title: 'The Great Gatsby',
			author: [{ family: 'Fitzgerald', given: 'F. Scott' }],
			issued: { 'date-parts': [[1925]] },
			publisher: 'Scribner',
		},
		{
			id: 'item2',
			type: 'book',
			title: 'To Kill a Mockingbird',
			author: [{ family: 'Lee', given: 'Harper' }],
			issued: { 'date-parts': [[1960]] },
			publisher: 'J. B. Lippincott & Co.',
		},
	];

	const component = await mount(
		<CiteprocWrapperFixture items={items} />
	);

	const result = component.getByTestId('result');
	await expect(result).toHaveAttribute('data-count', '2');
	await expect(result).toContainText('Fitzgerald');
	await expect(result).toContainText('The Great Gatsby');
	await expect(result).toContainText('Lee');
	await expect(result).toContainText('To Kill a Mockingbird');
});

test('numeric style (ACM SIG Proceedings) -- number-only entry does not crash', async ({ mount }) => {
	const component = await mount(
		<CiteprocWrapperFixture
			style={acmSigProceedingsStyle}
			skipErrorChecking={false}
			items={[{ id: 'a', type: 'webpage', author: [{ family: 'Doe', given: 'Jane' }] }]}
		/>
	);

	const result = component.getByTestId('result');
	await expect(result).toHaveAttribute('data-count', '1');
	await expect(result).toContainText('csl-error');
});
