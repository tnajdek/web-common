import { memo, forwardRef } from 'react';
import cx from 'classnames';
import { pick } from '../utils';

// Inline SVG rotated via a CSS animation. All geometry is driven by
// _spinner.scss. Each preset class sizes the box and the circle's radius,
// stroke and dash pattern, with the circle centred via `cx`/`cy`. The
// smallest requested preset wins when several are passed.
const Spinner = memo(forwardRef((props, ref) => {
	const { className, small, large, xlarge, style, ...rest } = props;

	const preset = (small && 'small') || (large && 'large') || (xlarge && 'xlarge');

	return (
		<svg
			ref={ ref }
			className={ cx('spinner', preset, className) }
			style={ style }
			{ ...pick(rest, p => p.startsWith('data-') || p.startsWith('aria-')) }
			role="progressbar"
		>
			<circle />
		</svg>
	);
}));

Spinner.displayName = 'Spinner';

export { Spinner };
