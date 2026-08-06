import { createContext, useContext, useState } from 'react'

// Mirrors app/models/profile.py's choice lists exactly — kept in sync
// manually since these are curated vocabularies, not user-generated data.
export const INTENT_OPTIONS = [
  { key: 'find_work', label: 'Find freelance work' },
  { key: 'hire', label: 'Hire professionals' },
  { key: 'build_startup', label: 'Build a startup' },
  { key: 'find_collaborators', label: 'Find collaborators' },
  { key: 'learn', label: 'Learn new skills' },
  { key: 'mentor', label: 'Mentor others' },
  { key: 'showcase_work', label: 'Showcase my work' },
  { key: 'network', label: 'Build my network' },
  { key: 'share_ideas', label: 'Share ideas' },
  { key: 'recruit', label: 'Recruit talent' },
]

export const CATEGORY_OPTIONS = [
  { key: 'developer', label: 'Developer' },
  { key: 'designer', label: 'Designer' },
  { key: 'writer', label: 'Writer' },
  { key: 'video_editor', label: 'Video Editor' },
  { key: 'photographer', label: 'Photographer' },
  { key: 'animator', label: 'Animator' },
  { key: 'devops_engineer', label: 'DevOps Engineer' },
  { key: 'cybersecurity_specialist', label: 'Cybersecurity Specialist' },
  { key: 'ai_engineer', label: 'AI Engineer' },
  { key: 'data_analyst', label: 'Data Analyst' },
  { key: 'founder', label: 'Founder' },
  { key: 'product_manager', label: 'Product Manager' },
  { key: 'recruiter', label: 'Recruiter' },
  { key: 'hr', label: 'HR' },
  { key: 'marketer', label: 'Marketer' },
  { key: 'creator', label: 'Content Creator' },
  { key: 'student', label: 'Student' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'mentor', label: 'Mentor' },
  { key: 'other', label: 'Other' },
]

export const BUILDING_OPTIONS = [
  { key: 'mobile_apps', label: 'Mobile Apps' },
  { key: 'saas', label: 'SaaS' },
  { key: 'ai', label: 'AI' },
  { key: 'open_source', label: 'Open Source' },
  { key: 'business', label: 'Business' },
  { key: 'games', label: 'Games' },
  { key: 'content', label: 'Content' },
  { key: 'other', label: 'Other' },
]

export const SUGGESTED_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'React', 'Node.js', 'FastAPI', 'Django',
  'Vue', 'Next.js', 'PostgreSQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes',
  'UI Design', 'UX Research', 'Figma', 'Motion Design', 'Branding',
  'Video Editing', 'Photography', 'Copywriting', 'SEO', 'Content Strategy',
  'Product Management', 'Growth Marketing', 'Data Analysis', 'Machine Learning',
  'Solidity', 'Swift', 'Kotlin', 'Go', 'Rust',
]

export const SUGGESTED_INTERESTS = [
  'AI', 'Programming', 'Design', 'Startups', 'Gaming', 'Music', 'Photography',
  'Marketing', 'Web3', 'Open Source', 'Product', 'Writing', 'Fitness', 'Travel',
]

const initialData = {
  intents: [],
  categories: [],
  building: [],
  skills: [],
  photo_ref: null,
  photo_preview: null,
  cover_ref: null,
  cover_preview: null,
  country_code: '',
  country_label: '',
  city: '',
  is_remote: false,
  headline: '',
  bio: '',
  portfolio_links: [],
  work_experience: [],
  github_url: '',
  linkedin_url: '',
  website_url: '',
  telegram_handle: '',
  hourly_rate: '',
  company_name: '',
  hiring_for: '',
  company_size: null,
  budget_min: '',
  budget_max: '',
  username: '',
  interests: [],
}

const OnboardingContext = createContext(null)

export function OnboardingProvider({ children }) {
  const [data, setData] = useState(initialData)
  const [step, setStep] = useState(0)

  function update(patch) {
    setData((d) => ({ ...d, ...patch }))
  }

  return (
    <OnboardingContext.Provider value={{ data, update, step, setStep }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}

// Converts wizard state into the exact shape app/schemas/profile.py's
// OnboardingRequest expects — the one place this mapping happens, so the
// step components themselves don't need to know backend field quirks
// (e.g. numeric strings needing to become numbers or null).
export function toApiPayload(data) {
  return {
    username: data.username,
    intents: data.intents,
    categories: data.categories,
    building: data.building,
    interests: data.interests,
    headline: data.headline || null,
    bio: data.bio || null,
    skills: data.skills,
    photo_ref: data.photo_ref || null,
    cover_ref: data.cover_ref || null,
    country_code: data.country_code,
    city: data.city || null,
    is_remote: data.is_remote,
    portfolio_links: data.portfolio_links,
    work_experience: data.work_experience,
    github_url: data.github_url || null,
    linkedin_url: data.linkedin_url || null,
    website_url: data.website_url || null,
    telegram_handle: data.telegram_handle || null,
    hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : null,
    company_name: data.company_name || null,
    hiring_for: data.hiring_for || null,
    company_size: data.company_size || null,
    budget_min: data.budget_min ? Number(data.budget_min) : null,
    budget_max: data.budget_max ? Number(data.budget_max) : null,
  }
}
