import { copyWithHtml } from '../../utils';

export const ClipboardFixture = ({ plainText, htmlText }) => (
	<div>
		<button onClick={ () => copyWithHtml(plainText, htmlText) }>Copy</button>
	</div>
);
