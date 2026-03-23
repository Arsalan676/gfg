import time
import threading
from collections import defaultdict

_lock = threading.Lock()
_request_log: dict[str, list[float]] = defaultdict(list)

RATE_LIMIT = 10   # max requests
WINDOW = 60       # seconds


def check_rate_limit(ip: str) -> bool:
    """Return True if the request is allowed, False if rate-limited."""
    now = time.time()
    with _lock:
        _request_log[ip] = [t for t in _request_log[ip] if now - t < WINDOW]
        if len(_request_log[ip]) >= RATE_LIMIT:
            return False
        _request_log[ip].append(now)
        return True


def get_client_ip(request) -> str:
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')
