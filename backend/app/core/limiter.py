import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# IP-based rate limiting. Auth endpoints get tighter limits (set per-route)
# to blunt credential-stuffing and brute-force attempts.
#
# RATE_LIMIT_DISABLED=1 turns limiting off for automated end-to-end test runs
# only; it is enabled by default so production behaviour is unchanged.
limiter = Limiter(
    key_func=get_remote_address,
    enabled=os.getenv("RATE_LIMIT_DISABLED", "").strip() not in {"1", "true", "True"},
)
