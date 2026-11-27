import { useEffect, useState } from 'react';
import CSL from 'citeproc';

import { CiteprocWrapper } from '../../cite/citeproc-wrapper';
import mlaStyle from './mla.xml';
import localeEnUS from './locales-en-us.xml';

window.CSL = CSL;

// Pre-seed locale cache so citeproc-js doesn't need sync XHR
// (sync XHR interception via page.route() is unreliable in WebKit)
CiteprocWrapper.setLocaleCache('en-US', localeEnUS);

const getBibliography = (wrapper, method) => {
	if (method === 'batchedUpdates') {
		const { entryIds, updatedEntries } = wrapper.batchedUpdates().bibliography;
		return entryIds.map(entryId => ({
			id: Array.isArray(entryId) ? entryId[0] : entryId,
			value: updatedEntries[entryId]
		}));
	}
	return wrapper.makeBibliography();
};

export const CiteprocWrapperFixture = ({ style = mlaStyle, format = 'html', skipErrorChecking = false,
	items = [], mockBibliography = null, mockTaggedBibliography = null, method = 'makeBibliography',
	calls = 1 }) => {
	const [result, setResult] = useState(null);
	const [error, setError] = useState(null);

	useEffect(() => {
		(async () => {
			try {
				const wrapper = await CiteprocWrapper.new(style, {
					DriverORCSL: CSL,
					skipErrorChecking,
					useCiteprocJS: true,
					format,
					localesPath: '/locales/',
				});
				wrapper.insertReferences(items);
				if (mockBibliography) {
					wrapper.driver.makeBibliography = () => wrapper.driver.sys.embedBibliographyEntry ?
						(mockTaggedBibliography ?? mockBibliography) : mockBibliography;
				}
				let bib;
				for (let i = 0; i < calls; i++) {
					bib = getBibliography(wrapper, method);
				}
				setResult(bib);
			} catch (e) {
				setError(e.message);
			}
		})();
	}, [calls, format, items, method, mockBibliography, mockTaggedBibliography, skipErrorChecking, style]);

	return (
		<div>
			{error !== null && <div data-testid="error">{error}</div>}
			{result !== null && <div data-testid="result" data-count={result.length}>{JSON.stringify(result)}</div>}
			{error === null && result === null && <div data-testid="loading">Loading...</div>}
		</div>
	);
};
