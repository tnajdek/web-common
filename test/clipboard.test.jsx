import { test, expect } from '@playwright/experimental-ct-react';

import { ClipboardFixture } from './fixtures/clipboard-fixture';

test('writes both flavors as a ClipboardItem where navigator.clipboard is available', async ({ mount, page }) => {
	const component = await mount(<ClipboardFixture plainText="plain flavor" htmlText="<b>html</b> flavor" />);

	// Replaces `navigator.clipboard.write` with a stub that captures ClipboardItems instead of
	// writing to the real clipboard. Assertions read the captured item directly, so the test
	// needs no clipboard permissions (grantable only on Chromium), no document focus, and leaves
	// the host clipboard untouched
	await page.evaluate(() => {
		window.clipboardItemsWritten = [];
		navigator.clipboard.write = async items => { window.clipboardItemsWritten.push(...items); };
	});

	await component.getByRole('button', { name: 'Copy' }).click();

	await page.waitForFunction(() => window.clipboardItemsWritten.length > 0);
	const { types, plain, html } = await page.evaluate(async () => {
		const item = window.clipboardItemsWritten[0];
		return {
			types: [...item.types],
			plain: await (await item.getType('text/plain')).text(),
			html: await (await item.getType('text/html')).text(),
		};
	});

	expect(types).toContain('text/plain');
	expect(types).toContain('text/html');
	expect(plain).toBe('plain flavor');
	expect(html).toBe('<b>html</b> flavor');
});

test('injects both flavors into the DataTransfer in the execCommand fallback', async ({ mount, page }) => {
	const component = await mount(<ClipboardFixture plainText="plain flavor" htmlText="<b>html</b> flavor" />);

	// Makes `navigator.clipboard.write` fail (as it would without clipboard-write permission) so
	// `copy` takes the execCommand fallback, then replaces `document.execCommand` with a stub
	// that, like the real one, dispatches a "copy" event at the selection -- but with an
	// inspectable DataTransfer, capturing what the fallback would have put on the clipboard
	await page.evaluate(() => {
		navigator.clipboard.write = async () => { throw new Error('simulated permission denial'); };
		document.execCommand = command => {
			if (command !== 'copy') {
				return false;
			}
			const ev = new ClipboardEvent('copy', {
				clipboardData: new DataTransfer(), bubbles: true, cancelable: true
			});
			document.getSelection().anchorNode.dispatchEvent(ev);
			window.clipboardDataWritten = {
				plain: ev.clipboardData.getData('text/plain'),
				html: ev.clipboardData.getData('text/html'),
				defaultPrevented: ev.defaultPrevented,
			};
			return true;
		};
	});

	await component.getByRole('button', { name: 'Copy' }).click();

	await page.waitForFunction(() => !!window.clipboardDataWritten);
	const { plain, html, defaultPrevented } = await page.evaluate(() => window.clipboardDataWritten);

	expect(plain).toBe('plain flavor');
	expect(html).toBe('<b>html</b> flavor');
	// without preventDefault the default copy action would overwrite the injected data
	expect(defaultPrevented).toBe(true);
});
