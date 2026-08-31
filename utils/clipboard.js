import copy from 'copy-to-clipboard';

// Copies both a plain-text and an HTML flavor to the clipboard. `copy` uses `navigator.clipboard`
// where available, falling back to `execCommand` otherwise. The object passed to `onCopy` differs
// between these scenarios: a replaceable ClipboardItem in the former, a mutable DataTransfer in the
// latter. `format` must be set for the fallback to call `preventDefault`, without which data set on
// the DataTransfer would be overwritten by the default copy action.
const copyWithHtml = (plainText, htmlText) => copy(plainText, {
	format: 'text/html',
	onCopy: clipboardDataOrItem => {
		if (clipboardDataOrItem instanceof DataTransfer) {
			clipboardDataOrItem.setData('text/plain', plainText);
			clipboardDataOrItem.setData('text/html', htmlText);
		} else {
			return new ClipboardItem({
				'text/plain': new Blob([plainText], { type: 'text/plain' }),
				'text/html': new Blob([htmlText], { type: 'text/html' }),
			});
		}
	}
});

export { copyWithHtml };
