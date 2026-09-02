export const EMPTY = 'EMPTY'; // server answered definitively with no translation found
export const ERROR = 'ERROR'; // request failed or the response was unexpected
export const CHOICE = 'CHOICE'; // multiple matches, each needs to be translated
export const CHOICE_EXHAUSTED = 'CHOICE_EXHAUSTED'; // above but no more results
export const MULTIPLE = 'MULTIPLE'; // result contains multiple translated items

// Reason codes accompanying EMPTY and ERROR results
export const NOT_FOUND = 'NOT_FOUND'; // no identifiers or no translation for the input
export const TOO_LARGE = 'TOO_LARGE'; // request body exceeded the server limit
export const SESSION_REJECTED = 'SESSION_REJECTED'; // server refused a session follow-up request
export const UNREACHABLE = 'UNREACHABLE'; // fetch failed or was aborted before a response arrived
export const SERVER_ERROR = 'SERVER_ERROR'; // server reported an internal error
export const UNEXPECTED_RESPONSE = 'UNEXPECTED_RESPONSE'; // status or body the client does not understand

// Posts `body` to a translation server endpoint. A session follow-up object (`{ url, session, items }`)
// is sent as JSON, anything else as text.
// Never rejects; resolves with `{ result, response }` (no `response` if fetch itself failed) plus:
// - `items` for MULTIPLE, together with `session` and `next` for CHOICE and CHOICE_EXHAUSTED.
//   `next` is a server-relative raw path from the Link header
// - `reason` for EMPTY (nothing found, definitive) and ERROR (request failed, retrying may help),
//   UNREACHABLE being the ERROR reason for a network failure or an aborted request
export const requestTranslation = async (url, body, fetchOptions = {}) => {
	const isSessionRequest = typeof body === 'object' && body !== null && 'session' in body;
	let response;

	try {
		response = await fetch(url, {
			method: 'post',
			mode: 'cors',
			headers: { 'content-type': isSessionRequest ? 'application/json' : 'text/plain' },
			body: isSessionRequest ? JSON.stringify(body) : body,
			...fetchOptions
		});
	} catch (error) {
		return { result: ERROR, reason: UNREACHABLE, error };
	}

	// status 0 never comes from a server; some environments resolve a network failure this way instead of rejecting
	if (response.type === 'error' || response.status === 0) {
		return { result: ERROR, reason: UNREACHABLE, response };
	}

	const contentType = response.headers.get('content-type') ?? '';

	try {
		const serverMessage = contentType.startsWith('text/plain') ? await response.text() : undefined;

		if (isSessionRequest && response.status >= 400 && response.status < 500) {
			return { result: EMPTY, reason: SESSION_REJECTED, serverMessage, response };
		}

		if (response.status === 501 || response.status === 400) {
			return { result: EMPTY, reason: NOT_FOUND, serverMessage, response };
		}

		if (response.status === 413) {
			return { result: EMPTY, reason: TOO_LARGE, serverMessage, response };
		}

		if (response.status === 300) {
			const data = await response.json();
			const items = 'items' in data && 'session' in data ? data.items : data;
			const next = response.headers.get('link')?.match(/<(.*?)>;\s+rel="next"/i)?.[1] ?? null;
			return { result: next ? CHOICE : CHOICE_EXHAUSTED, items, session: data.session, next, response };
		}

		if (response.status === 500) {
			return { result: ERROR, reason: SERVER_ERROR, serverMessage, response };
		}

		if (response.status !== 200 || !contentType.startsWith('application/json')) {
			return { result: ERROR, reason: UNEXPECTED_RESPONSE, serverMessage, response };
		}

		const items = await response.json();

		if (!items.length) {
			return { result: EMPTY, reason: NOT_FOUND, response };
		}

		return { result: MULTIPLE, items, response };
	} catch (error) {
		return { result: ERROR, reason: UNEXPECTED_RESPONSE, response, error };
	}
};
