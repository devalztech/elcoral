from slowapi import Limiter
from slowapi.util import get_remote_address

# IP-based rate limiting. Auth endpoints get tighter limits (set per-route)
# to blunt credential-stuffing and brute-force attempts.
limiter = Limiter(key_func=get_remote_address)
