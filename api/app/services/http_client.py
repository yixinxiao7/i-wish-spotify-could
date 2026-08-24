import logging
import requests
from requests.adapters import HTTPAdapter
from tenacity import (
    RetryError,
    retry,
    retry_if_result,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

logger = logging.getLogger(__name__)

# Shared concurrency ceiling for the uncategorized-songs index build. Every
# thread pool involved in a build is sized from this constant so they cannot
# drift apart, and the shared session's connection pool is sized to match.
CONCURRENCY_CEILING = 8

_session = requests.Session()
_adapter = HTTPAdapter(pool_connections=CONCURRENCY_CEILING, pool_maxsize=CONCURRENCY_CEILING)
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)


# Longest Retry-After this client will actually wait out. Spotify's
# Development Mode quota can answer a 429 with a Retry-After measured in
# hours; honoring that verbatim parks the calling thread for that entire
# time, so the request never returns and the user's page spins forever with
# no error. Past this bound we stop retrying and surface the 429 to the
# caller instead, which turns a silent multi-hour hang into a fast failure
# the UI can report and the user can retry later.
MAX_RETRY_AFTER_SECONDS = 60


class SpotifyRateLimitedError(Exception):
    '''
    Raised when Spotify answers 429 and the retry budget could not clear it.
    Distinct from an ordinary request failure so routers can report "rate
    limited, try again later" rather than a generic error — which matters
    because Spotify rate limits per endpoint, so a single limited endpoint
    (`/me/playlists`, typically) makes unrelated features look broken.
    '''

    def __init__(self, retry_after: float = None):
        self.retry_after = retry_after
        detail = f" Retry-After: {retry_after:.0f}s." if retry_after is not None else ""
        super().__init__(f"Spotify rate limit exceeded.{detail}")


def _parse_retry_after(response: requests.Response):
    '''
    Read Spotify's Retry-After header as a non-negative number of seconds,
    or None when it is absent or unparseable.
    '''
    retry_after = getattr(response, "headers", {}).get("Retry-After")
    if retry_after is None:
        return None
    try:
        return max(float(retry_after), 0)
    except (TypeError, ValueError):
        return None


def _is_rate_limited(response: requests.Response) -> bool:
    if response.status_code != 429:
        return False
    retry_after = _parse_retry_after(response)
    if retry_after is not None and retry_after > MAX_RETRY_AFTER_SECONDS:
        logger.warning(
            "Rate limited with Retry-After of %.0fs, beyond the %ds this client will wait — "
            "failing fast instead of blocking the request thread.",
            retry_after,
            MAX_RETRY_AFTER_SECONDS,
        )
        return False
    return True


def _wait_for_rate_limit(retry_state):
    '''
    Wait according to Spotify's Retry-After header when the previous attempt
    was rate limited; fall back to exponential backoff when the header is
    absent or unparseable. Waits longer than MAX_RETRY_AFTER_SECONDS never
    reach here — `_is_rate_limited` stops retrying first.
    '''
    outcome = retry_state.outcome
    if outcome is not None and not outcome.failed:
        retry_after = _parse_retry_after(outcome.result())
        if retry_after is not None:
            return retry_after
    return wait_exponential(multiplier=1, min=1, max=30)(retry_state)


def _call(retried_fn, url: str, **kwargs) -> requests.Response:
    '''
    Run a retry-wrapped request and normalize every "still rate limited"
    outcome into SpotifyRateLimitedError, so callers have exactly one thing
    to catch.

    There are two such outcomes, and before this they looked completely
    different to a caller: a 429 we chose not to retry (Retry-After beyond
    the cap) came back as a plain response, while a 429 that exhausted the
    retry budget surfaced as tenacity's opaque RetryError.
    '''
    try:
        response = retried_fn(url, **kwargs)
    except RetryError as e:
        last = e.last_attempt
        if not last.failed and getattr(last.result(), "status_code", None) == 429:
            raise SpotifyRateLimitedError(_parse_retry_after(last.result())) from None
        raise
    if response.status_code == 429:
        raise SpotifyRateLimitedError(_parse_retry_after(response))
    return response


@retry(
    retry=retry_if_result(_is_rate_limited),
    stop=stop_after_attempt(4),
    wait=_wait_for_rate_limit,
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def _get(url: str, **kwargs) -> requests.Response:
    return _session.get(url, **kwargs)


def spotify_get(url: str, **kwargs) -> requests.Response:
    return _call(_get, url, **kwargs)


@retry(
    retry=retry_if_result(_is_rate_limited),
    stop=stop_after_attempt(4),
    wait=_wait_for_rate_limit,
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def _post(url: str, **kwargs) -> requests.Response:
    return _session.post(url, **kwargs)


def spotify_post(url: str, **kwargs) -> requests.Response:
    return _call(_post, url, **kwargs)


@retry(
    retry=retry_if_result(_is_rate_limited),
    stop=stop_after_attempt(4),
    wait=_wait_for_rate_limit,
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def _delete(url: str, **kwargs) -> requests.Response:
    return _session.delete(url, **kwargs)


def spotify_delete(url: str, **kwargs) -> requests.Response:
    return _call(_delete, url, **kwargs)


__all__ = [
    "spotify_get",
    "spotify_post",
    "spotify_delete",
    "SpotifyRateLimitedError",
    "MAX_RETRY_AFTER_SECONDS",
    "CONCURRENCY_CEILING",
]
