import { useRef, useState } from 'react';

import { requestTranslation } from '../../utils';

export const TranslationFixture = ({ url, body }) => {
	const [outcome, setOutcome] = useState(null);
	const abortController = useRef(null);

	const handleRequest = async () => {
		abortController.current = new AbortController();
		setOutcome(await requestTranslation(url, body, { signal: abortController.current.signal }));
	};

	return (
		<div>
			<button onClick={ handleRequest }>Request</button>
			<button onClick={ () => abortController.current?.abort() }>Abort</button>
			{ outcome !== null && (
				<div
					data-testid="result"
					data-result={ outcome.result }
					data-reason={ outcome.reason ?? '' }
					data-status={ outcome.response?.status ?? '' }
					data-count={ outcome.items?.length ?? '' }
					data-error-name={ outcome.error?.name ?? '' }
				>
					{ outcome.serverMessage ?? '' }
				</div>
			) }
		</div>
	);
};
