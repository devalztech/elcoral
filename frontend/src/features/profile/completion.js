/**
 * Profile completion, mirrored from the backend.
 *
 * The percentage is computed server-side (_compute_completion in
 * backend/app/schemas/profile.py) and arrives as
 * `profile.profile_completion_pct`. That number is always the source of
 * truth — home and the profile page both read it here so they can never
 * disagree, which is exactly what used to happen when Home counted nine
 * equal fields and the profile page used a different weighted list.
 *
 * The weights below are duplicated only to build the *checklist* ("Add
 * skills — worth 15%"), so the items and their worth match the number
 * the server sent. Keep this table in sync with _COMPLETION_WEIGHTS.
 */

export const COMPLETION_WEIGHTS = {
  photo: 15,
  bio: 15,
  skills: 15,
  headline: 10,
  city: 10,
  work_experience: 10,
  socials: 10,
  github: 5,
  linkedin: 5,
}

export function hasSocials(profile) {
  return Boolean(
    profile?.github_url || profile?.linkedin_url || profile?.website_url
    || profile?.twitter_url || profile?.dribbble_url || profile?.portfolio_links?.length,
  )
}

/**
 * The actionable checklist. Every item maps to a real weighted field, so
 * ticking them all reaches 100% — no item that the server doesn't score.
 * The profile payload exposes the photo as a URL to viewers and as a ref
 * to the owner, so both spellings are accepted. Cover images were removed
 * from profiles, so they are no longer part of the checklist.
 */
export function completionChecklist(profile) {
  if (!profile) return []
  return [
    { key: 'photo', label: 'Add a profile photo', worth: COMPLETION_WEIGHTS.photo, done: Boolean(profile.photo_url || profile.photo_ref) },
    { key: 'bio', label: 'Write your bio', worth: COMPLETION_WEIGHTS.bio, done: Boolean(profile.bio) },
    { key: 'skills', label: 'Add your skills', worth: COMPLETION_WEIGHTS.skills, done: Boolean(profile.skills?.length) },
    { key: 'headline', label: 'Add a headline', worth: COMPLETION_WEIGHTS.headline, done: Boolean(profile.headline) },
    { key: 'city', label: 'Add your location', worth: COMPLETION_WEIGHTS.city, done: Boolean(profile.city) },
    { key: 'work_experience', label: 'Add work experience', worth: COMPLETION_WEIGHTS.work_experience, done: Boolean(profile.work_experience?.length) },
    { key: 'socials', label: 'Add your links', worth: COMPLETION_WEIGHTS.socials, done: hasSocials(profile) },
  ]
}

/**
 * The number to show. Prefers the server's value; the local sum is only
 * a fallback for the brief window before the profile has loaded from an
 * endpoint that includes it.
 */
export function completionPct(profile) {
  if (!profile) return null
  if (typeof profile.profile_completion_pct === 'number') {
    return Math.max(0, Math.min(100, Math.round(profile.profile_completion_pct)))
  }
  const local = completionChecklist(profile).reduce((sum, item) => (item.done ? sum + item.worth : sum), 0)
  // github/linkedin score on their own on the server, on top of "socials".
  const extra = (profile.github_url ? COMPLETION_WEIGHTS.github : 0)
    + (profile.linkedin_url ? COMPLETION_WEIGHTS.linkedin : 0)
  return Math.min(100, local + extra)
}
