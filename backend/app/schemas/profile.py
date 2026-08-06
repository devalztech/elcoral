import uuid

from pydantic import BaseModel, Field, field_validator

from app.core.media_url import media_ref_to_url
from app.models.profile import (
    BUILDING_CHOICES,
    CATEGORY_CHOICES,
    INTENT_CHOICES,
    CompanySize,
)


def _validate_choices(values: list[str], allowed: list[str], field_name: str) -> list[str]:
    cleaned = [v.strip() for v in values if v.strip()]
    unknown = [v for v in cleaned if v not in allowed]
    if unknown:
        raise ValueError(f"Unknown {field_name}: {', '.join(unknown)}")
    return cleaned


class WorkExperienceItem(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    company: str = Field(min_length=1, max_length=120)
    years: str = Field(min_length=1, max_length=40)  # free text, e.g. "2021-2023" or "3 years"


class OnboardingRequest(BaseModel):
    """
    Single unified onboarding submission — collected across the wizard's
    steps on the frontend, submitted once at the end (no per-step save).
    There's deliberately no role split: a person can hold several intents
    and categories at once, so which fields matter is driven by what they
    picked in intents/categories, not by a fixed account type.
    """

    # Identity
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    intents: list[str] = Field(min_length=1, max_length=len(INTENT_CHOICES))
    categories: list[str] = Field(min_length=1, max_length=len(CATEGORY_CHOICES))
    building: list[str] = Field(default_factory=list, max_length=len(BUILDING_CHOICES))
    interests: list[str] = Field(default_factory=list, max_length=30)

    # Skills / bio
    headline: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=2000)
    skills: list[str] = Field(default_factory=list, max_length=30)

    # Media
    photo_ref: str | None = None
    cover_ref: str | None = None

    # Location
    country_code: str = Field(min_length=2, max_length=2)
    city: str | None = Field(default=None, max_length=120)
    is_remote: bool = False

    # Links
    portfolio_links: list[str] = Field(default_factory=list, max_length=10)
    work_experience: list[WorkExperienceItem] = Field(default_factory=list, max_length=20)
    github_url: str | None = Field(default=None, max_length=255)
    linkedin_url: str | None = Field(default=None, max_length=255)
    website_url: str | None = Field(default=None, max_length=255)
    telegram_handle: str | None = Field(default=None, max_length=64)

    # Conditional on "find_work" being in intents
    hourly_rate: float | None = Field(default=None, gt=0, le=100000)

    # Conditional on "hire" being in intents
    company_name: str | None = Field(default=None, max_length=120)
    hiring_for: str | None = Field(default=None, max_length=120)
    company_size: CompanySize | None = None
    budget_min: float | None = Field(default=None, ge=0, le=1_000_000)
    budget_max: float | None = Field(default=None, ge=0, le=1_000_000)

    @field_validator("intents")
    @classmethod
    def check_intents(cls, v: list[str]) -> list[str]:
        return _validate_choices(v, INTENT_CHOICES, "intent")

    @field_validator("categories")
    @classmethod
    def check_categories(cls, v: list[str]) -> list[str]:
        return _validate_choices(v, CATEGORY_CHOICES, "category")

    @field_validator("building")
    @classmethod
    def check_building(cls, v: list[str]) -> list[str]:
        return _validate_choices(v, BUILDING_CHOICES, "building")

    @field_validator("skills", "portfolio_links", "interests")
    @classmethod
    def clean_string_list(cls, v: list[str]) -> list[str]:
        return [s.strip() for s in v if s.strip()]

    @field_validator("country_code")
    @classmethod
    def upper_country(cls, v: str) -> str:
        return v.upper()

    @field_validator("budget_max")
    @classmethod
    def max_at_least_min(cls, v: float | None, info) -> float | None:
        budget_min = info.data.get("budget_min")
        if v is not None and budget_min is not None and v < budget_min:
            raise ValueError("budget_max must be greater than or equal to budget_min")
        return v


class ProfileOut(BaseModel):
    id: uuid.UUID
    onboarding_complete: bool
    username: str | None = None
    photo_url: str | None = None
    cover_url: str | None = None

    intents: list[str] | None = None
    categories: list[str] | None = None
    building: list[str] | None = None
    interests: list[str] | None = None

    headline: str | None = None
    bio: str | None = None
    skills: list[str] | None = None
    country_code: str | None = None
    city: str | None = None
    is_remote: bool = False

    portfolio_links: list[str] | None = None
    work_experience: list[dict] | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    website_url: str | None = None
    telegram_handle: str | None = None

    hourly_rate: float | None = None

    company_name: str | None = None
    hiring_for: str | None = None
    company_size: CompanySize | None = None
    budget_min: float | None = None
    budget_max: float | None = None

    profile_completion_pct: int = 0

    model_config = {"from_attributes": True}

    @staticmethod
    def from_model(profile) -> "ProfileOut":
        """Resolves photo_ref/cover_ref to real callable URLs and computes
        profile_completion_pct, rather than leaking raw storage refs or
        requiring the frontend to recompute completion itself."""
        data = ProfileOut.model_validate(profile).model_dump()
        data["photo_url"] = media_ref_to_url(profile.photo_ref)
        data["cover_url"] = media_ref_to_url(profile.cover_ref)
        data["profile_completion_pct"] = _compute_completion(profile)
        return ProfileOut(**data)


# Weighted like the "Profile Completion" progress bar idea — each filled
# section contributes a chunk, capped at 100. Deliberately simple (no ML,
# no per-field fine-tuning) since this is a motivational UI number, not a
# scored ranking signal.
_COMPLETION_WEIGHTS = [
    ("photo_ref", 15),
    ("bio", 15),
    ("skills", 15),
    ("headline", 10),
    ("city", 10),
    ("portfolio_links", 10),
    ("work_experience", 10),
    ("cover_ref", 5),
    ("github_url", 5),
    ("linkedin_url", 5),
]


def _compute_completion(profile) -> int:
    total = 0
    for field_name, weight in _COMPLETION_WEIGHTS:
        value = getattr(profile, field_name, None)
        if value:
            total += weight
    return min(total, 100)
