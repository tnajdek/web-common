import { test, expect } from '@playwright/experimental-ct-react';

import { Spinner } from '../components';

const PRESETS = [
	{ name: 'small', element: <Spinner small />, size: 16, radius: 7, strokeWidth: 2 },
	{ name: 'default', element: <Spinner />, size: 24, radius: 11, strokeWidth: 2 },
	{ name: 'large', element: <Spinner large />, size: 32, radius: 14.5, strokeWidth: 3 },
	{ name: 'xlarge', element: <Spinner xlarge />, size: 52, radius: 24, strokeWidth: 4 },
];

const circumference = radius => 2 * Math.PI * radius;

// pin the resolution: the small preset renders hairline geometry on >=2x screens
// (see the dense-screens tests) and Desktop Safari is 2x by default
test.use({ deviceScaleFactor: 1 });

test('Renders an indeterminate progressbar', async ({ mount }) => {
	const component = await mount(
		<div>
			<Spinner />
		</div>
	);

	const spinner = component.getByRole('progressbar');
	await expect(spinner).toBeVisible();
	await expect(spinner).toHaveClass('spinner');
	// indeterminate: no value semantics
	await expect(spinner).not.toHaveAttribute('aria-valuenow');
});

test('Rotation runs as a CSS animation on the arc', async ({ mount }) => {
	const component = await mount(
		<div>
			<Spinner />
		</div>
	);

	const arc = component.locator('circle');
	const animationName = await arc.evaluate(el => getComputedStyle(el).animationName);
	expect(animationName).toBe('spinner-rotation');

	const angle = () => arc.evaluate(el => getComputedStyle(el).transform);
	const first = await angle();
	await expect.poll(angle).not.toBe(first);
});

test('Geometry is driven entirely by the stylesheet', async ({ mount }) => {
	const component = await mount(
		<div>
			<Spinner />
		</div>
	);

	const spinner = component.getByRole('progressbar');
	for (const attribute of ['width', 'height', 'viewBox']) {
		await expect(spinner).not.toHaveAttribute(attribute);
	}

	const arc = component.locator('circle');
	for (const attribute of ['cx', 'cy', 'r', 'stroke-width', 'stroke-dasharray']) {
		await expect(arc).not.toHaveAttribute(attribute);
	}
});

for (const { name, element, size, radius, strokeWidth } of PRESETS) {
	test(`The ${name} preset is a ${size}px spinner`, async ({ mount }) => {
		const component = await mount(<div>{ element }</div>);

		const spinner = component.getByRole('progressbar');
		const box = await spinner.boundingBox();
		expect(box.width).toBeCloseTo(size, 3);
		expect(box.height).toBeCloseTo(size, 3);

		// without a viewBox user units equal CSS pixels, so the fill box
		// reported by getBBox measures the ring directly
		const arc = component.locator('circle');
		const bbox = await arc.evaluate(el => {
			const { x, y, width, height } = el.getBBox();
			return { x, y, width, height };
		});
		expect(bbox.width / 2).toBeCloseTo(radius, 3);
		expect(bbox.height / 2).toBeCloseTo(radius, 3);
		// ring centred in the box
		expect(bbox.x + bbox.width / 2).toBeCloseTo(size / 2, 3);
		expect(bbox.y + bbox.height / 2).toBeCloseTo(size / 2, 3);

		const stroke = await arc.evaluate(el => getComputedStyle(el).strokeWidth);
		expect(parseFloat(stroke)).toBeCloseTo(strokeWidth, 3);

		// a 270-degree arc: a dash of three quarters of the circumference,
		// followed by a gap of the full circumference
		const dasharray = await arc.evaluate(el => getComputedStyle(el).strokeDasharray);
		const [dash, gap] = dasharray.match(/[\d.]+/g).map(Number);
		expect(dash).toBeCloseTo(circumference(radius) * 0.75, 1);
		expect(gap).toBeCloseTo(circumference(radius), 1);

		// every preset inscribes its ring exactly in its box
		expect(2 * radius + strokeWidth).toBe(size);
	});
}

test('Reduced motion swaps the rotating arc for a pulsating full circle', async ({ mount, page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const component = await mount(
		<div>
			<Spinner small />
		</div>
	);

	const arc = component.locator('circle');
	const { animationName, dasharray } = await arc.evaluate(el => {
		const style = getComputedStyle(el);
		return { animationName: style.animationName, dasharray: style.strokeDasharray };
	});
	expect(animationName).toBe('spinner-pulse');
	expect(dasharray).toBe('none');

	const opacity = () => arc.evaluate(el => getComputedStyle(el).opacity);
	const first = await opacity();
	await expect.poll(opacity).not.toBe(first);
});

test.describe('On dense (>=2x) screens', () => {
	test.use({ deviceScaleFactor: 2 });

	test('The small preset sharpens to a hairline ring', async ({ mount }) => {
		const component = await mount(
			<div>
				<Spinner small />
			</div>
		);

		const spinner = component.getByRole('progressbar');
		const box = await spinner.boundingBox();
		expect(box.width).toBeCloseTo(16, 3);
		expect(box.height).toBeCloseTo(16, 3);

		const arc = component.locator('circle');
		const bbox = await arc.evaluate(el => {
			const { x, y, width, height } = el.getBBox();
			return { x, y, width, height };
		});
		expect(bbox.width / 2).toBeCloseTo(7.5, 3);
		expect(bbox.x + bbox.width / 2).toBeCloseTo(8, 3);
		expect(bbox.y + bbox.height / 2).toBeCloseTo(8, 3);

		const stroke = await arc.evaluate(el => getComputedStyle(el).strokeWidth);
		expect(parseFloat(stroke)).toBeCloseTo(1, 3);

		const dasharray = await arc.evaluate(el => getComputedStyle(el).strokeDasharray);
		const [dash, gap] = dasharray.match(/[\d.]+/g).map(Number);
		expect(dash).toBeCloseTo(circumference(7.5) * 0.75, 1);
		expect(gap).toBeCloseTo(circumference(7.5), 1);
	});

	test('Other presets keep their geometry', async ({ mount }) => {
		const component = await mount(
			<div>
				<Spinner />
			</div>
		);

		const arc = component.locator('circle');
		const bbox = await arc.evaluate(el => {
			const { width } = el.getBBox();
			return { width };
		});
		expect(bbox.width / 2).toBeCloseTo(11, 3);

		const stroke = await arc.evaluate(el => getComputedStyle(el).strokeWidth);
		expect(parseFloat(stroke)).toBeCloseTo(2, 3);
	});

	test('Reduced motion is excluded and keeps the standard small geometry', async ({ mount, page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const component = await mount(
			<div>
				<Spinner small />
			</div>
		);

		const arc = component.locator('circle');
		const bbox = await arc.evaluate(el => {
			const { width } = el.getBBox();
			return { width };
		});
		expect(bbox.width / 2).toBeCloseTo(7, 3);

		const { dasharray, stroke } = await arc.evaluate(el => {
			const style = getComputedStyle(el);
			return { dasharray: style.strokeDasharray, stroke: style.strokeWidth };
		});
		expect(parseFloat(stroke)).toBeCloseTo(2, 3);
		expect(dasharray).toBe('none');
	});
});

test('The smallest requested preset wins when several are passed', async ({ mount }) => {
	const component = await mount(
		<div>
			<Spinner small xlarge />
		</div>
	);

	const box = await component.getByRole('progressbar').boundingBox();
	expect(box.width).toBeCloseTo(16, 3);
});

test('Preset props do not leak into the DOM', async ({ mount }) => {
	const component = await mount(
		<div>
			<Spinner small />
		</div>
	);

	const spinner = component.getByRole('progressbar');
	for (const preset of ['small', 'large', 'xlarge']) {
		await expect(spinner).not.toHaveAttribute(preset);
	}
});

test('Passes through data attributes', async ({ mount }) => {
	const component = await mount(
		<div>
			<Spinner data-foo="bar" />
		</div>
	);

	await expect(component.getByRole('progressbar')).toHaveAttribute('data-foo', 'bar');
});
