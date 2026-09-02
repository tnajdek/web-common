import { test, expect } from '@playwright/experimental-ct-react';

import { TranslationFixture } from './fixtures/translation-fixture';
import { EMPTY, ERROR, MULTIPLE, NOT_FOUND, UNREACHABLE } from '../utils/translation';

// Same origin as the test page, so no CORS preflight is involved and response headers stay readable
const TRANSLATE_URL = '/translate/web';
const ROUTE = `**${TRANSLATE_URL}`;
const INPUT = 'https://example.com/article';

const translatedItems = [
	{ itemType: 'book', title: 'The Great Gatsby' },
	{ itemType: 'book', title: 'To Kill a Mockingbird' },
];

test('resolves MULTIPLE with the translated items for a 200 JSON response', async ({ mount, page }) => {
	let request;
	await page.route(ROUTE, route => {
		request = route.request();
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(translatedItems) });
	});

	const component = await mount(<TranslationFixture url={ TRANSLATE_URL } body={ INPUT } />);
	await component.getByRole('button', { name: 'Request' }).click();

	const result = component.getByTestId('result');
	await expect(result).toHaveAttribute('data-result', MULTIPLE);
	await expect(result).toHaveAttribute('data-count', '2');
	await expect(result).toHaveAttribute('data-status', '200');
	expect(request.method()).toBe('POST');
	expect(request.headers()['content-type']).toBe('text/plain');
	expect(request.postData()).toBe(INPUT);
});

test('resolves EMPTY / NOT_FOUND when the server answers 501', async ({ mount, page }) => {
	await page.route(ROUTE, route => route.fulfill({
		status: 501, contentType: 'text/plain', body: 'No items returned from any translator'
	}));

	const component = await mount(<TranslationFixture url={ TRANSLATE_URL } body={ INPUT } />);
	await component.getByRole('button', { name: 'Request' }).click();

	const result = component.getByTestId('result');
	await expect(result).toHaveAttribute('data-result', EMPTY);
	await expect(result).toHaveAttribute('data-reason', NOT_FOUND);
	await expect(result).toHaveAttribute('data-status', '501');
	await expect(result).toHaveText('No items returned from any translator');
});

test('resolves EMPTY / NOT_FOUND when the server answers 200 with no items', async ({ mount, page }) => {
	await page.route(ROUTE, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

	const component = await mount(<TranslationFixture url={ TRANSLATE_URL } body={ INPUT } />);
	await component.getByRole('button', { name: 'Request' }).click();

	const result = component.getByTestId('result');
	await expect(result).toHaveAttribute('data-result', EMPTY);
	await expect(result).toHaveAttribute('data-reason', NOT_FOUND);
	await expect(result).toHaveAttribute('data-status', '200');
	await expect(result).toHaveAttribute('data-count', '');
});

test('resolves ERROR / UNREACHABLE when the request is aborted before a response arrives', async ({ mount, page }) => {
	// Held open indefinitely so the fixture can abort it while still in flight
	await page.route(ROUTE, () => new Promise(() => {}));

	const component = await mount(<TranslationFixture url={ TRANSLATE_URL } body={ INPUT } />);
	const requestSent = page.waitForRequest(ROUTE);
	await component.getByRole('button', { name: 'Request' }).click();
	await requestSent;
	await component.getByRole('button', { name: 'Abort' }).click();

	const result = component.getByTestId('result');
	await expect(result).toHaveAttribute('data-result', ERROR);
	await expect(result).toHaveAttribute('data-reason', UNREACHABLE);
	await expect(result).toHaveAttribute('data-error-name', 'AbortError');
	await expect(result).toHaveAttribute('data-status', '');
});
