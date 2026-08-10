"""
Single source of truth for handle rules.

Signup, onboarding and profile editing all claim or validate the same
`profiles.username` column, so the regex, the reserved list and the
rejection messages live here instead of being re-declared (and drifting)
in three routers.
"""
import re

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,30}$")

# Reserved so nobody can claim a handle that collides with an existing or
# planned app route (/u/settings, /u/login, ...).
RESERVED_USERNAMES = {
    "admin", "api", "elcoral", "settings", "login", "signup", "logout",
    "home", "onboarding", "profile", "u", "me", "support", "help", "about",
    "terms", "privacy", "jobs", "community", "create", "messages", "search",
}


def username_rejection(username: str) -> str | None:
    """Return a user-facing reason the handle is unusable, or None if fine."""
    value = (username or "").strip()
    if not USERNAME_RE.match(value):
        return "Only letters, numbers, and underscores allowed"
    if value.lower() in RESERVED_USERNAMES:
        return "That username is reserved"
    return None
