import logging
import requests
from requests.adapters import HTTPAdapter
from tenacity import (
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


def _is_rate_limited(response: requests.Response) -> bool:
    return response.status_code == 429


def _wait_for_rate_limit(retry_state):
    '''
    Wait according to Spotify's Retry-After header when the previous attempt
    was rate limited; fall back to exponential backoff when the header is
    absent or unparseable.
    '''
    outcome = retry_state.outcome
    if outcome is not None and not outcome.failed:
        response = outcome.result()
        retry_after = getattr(response, "headers", {}).get("Retry-After")
        if retry_after is not None:
            try:
                return max(float(retry_after), 0)
            except (TypeError, ValueError):
                pass
    return wait_exponential(multiplier=1, min=1, max=30)(retry_state)


@retry(
    retry=retry_if_result(_is_rate_limited),
    stop=stop_after_attempt(4),
    wait=_wait_for_rate_limit,
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def spotify_get(url: str, **kwargs) -> requests.Response:
    return _session.get(url, **kwargs)


@retry(
    retry=retry_if_result(_is_rate_limited),
    stop=stop_after_attempt(4),
    wait=_wait_for_rate_limit,
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def spotify_post(url: str, **kwargs) -> requests.Response:
    return _session.post(url, **kwargs)


__all__ = ["spotify_get", "spotify_post", "CONCURRENCY_CEILING"]
