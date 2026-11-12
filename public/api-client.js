const UNAVAILABLE = 'Daily Spark is taking a moment to respond. Please try again shortly.';
function failure(message, retryable = false, code) { return Object.assign(new Error(message), {retryable, code}); }
function validState(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && /^\d{4}-\d{2}-\d{2}$/.test(value.today)
    && Number.isFinite(Date.parse(value.serverNow)) && Number.isFinite(Date.parse(value.resetsAt))
    && ['points','level','toNextLevel','levelProgress','streak','completedDays'].every(k => Number.isInteger(value[k]) && value[k] >= 0)
    && Array.isArray(value.badges) && Array.isArray(value.history)
    && Array.isArray(value.challenge) && value.challenge.length === 3
    && value.challenge.every(q => typeof q?.word === 'string' && Array.isArray(q.choices) && q.choices.length === 3 && q.choices.every(c => typeof c === 'string'))
    && (value.completion === null || value.completion && Array.isArray(value.completion.answers) && Array.isArray(value.completion.review));
}

// Only safe reads retry automatically. A failed write stays on screen for an explicit retry.
export async function requestApi(path, options = {}, {fetcher = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 15000} = {}) {
  const read = (options.method || 'GET').toUpperCase() === 'GET';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetcher(path, {...options, credentials: 'same-origin', cache: 'no-store', signal: controller.signal});
        if (!/application\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('Content-Type') || '')) throw failure(UNAVAILABLE, true);
        let result;
        try { result = await response.json(); } catch (error) { if (error.name === 'AbortError') throw error; throw failure(UNAVAILABLE, true); }
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw failure(UNAVAILABLE, true);
        if (!response.ok) throw failure(typeof result.error === 'string' ? result.error : UNAVAILABLE, [408,429].includes(response.status) || response.status >= 500, result.code);
        if (['/api/state','/api/complete'].includes(path) && !validState(result)) throw failure(UNAVAILABLE, true);
        return result;
      } catch (error) {
        if (controller.signal.aborted || error.name === 'AbortError') throw failure('The connection is taking a while. Please try again.');
        const network = error instanceof TypeError;
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (read && attempt < 2 && !offline && (network || error.retryable)) { await pause(attempt === 0 ? 250 : 750); continue; }
        if (network) throw failure('We could not reach Daily Spark. Check your connection and try again.');
        throw error;
      }
    }
  } finally { clearTimeout(timer); }
}
