"""
Single source of truth for username rules.

Previously RESERVED_USERNAMES lived only in app/routers/profile.py, while
app/routers/auth.py's signup referenced it (and `func`) without importing
either — every signup that supplied a username raised NameError and the
client showed a generic "Something went wrong". Keeping the rule here
means every surface (signup, onboarding, profile editor) agrees.
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
