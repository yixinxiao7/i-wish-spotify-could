import logging
import requests
from tenacity import (
    retry,
    retry_if_result,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

logger = logging.getLogger(__name__)


def _is_rate_limited(response: requests.Response) -> bool:
    return response.status_code == 429


@retry(
    retry=retry_if_result(_is_rate_limited),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=1, max=30),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def spotify_get(url: str, **kwargs) -> requests.Response:
    return requests.get(url, **kwargs)


@retry(
    retry=retry_if_result(_is_rate_limited),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=1, max=30),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def spotify_post(url: str, **kwargs) -> requests.Response:
    return requests.post(url, **kwargs)


__all__ = ["spotify_get", "spotify_post"]
