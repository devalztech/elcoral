"""
Rate limiting.

IMPORTANT — this limiter is **process-local**. slowapi's default backend
keeps its counters in this worker's memory, so limits are enforced per
uvicorn process, not across a cluster: running N workers effectively
multiplies every limit by N, and a restart resets all counters.

That is deliberate and correct for the current deployment, which runs a
single worker on a single container. No external dependency (Redis or
otherwise) is introduced for this, because the architecture does not have
one today and adding one would be a new operational failure mode.

If this app is ever scaled to multiple workers or replicas, this is the
one place to change: slowapi accepts a shared `storage_uri` (e.g.
"redis://...") and everything else here keeps working unchanged. Until
then, treat these limits as best-effort abuse blunting, not as a hard
quota, and note that authentication remains the primary control on the
endpoints that proxy third-party services.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# IP-based rate limiting. Auth endpoints get tighter limits (set per-route)
# to blunt credential-stuffing and brute-force attempts.
limiter = Limiter(key_func=get_remote_address)
