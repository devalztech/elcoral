import { createContext, useContext, useState } from 'react'

import {
  Briefcase, Users, Rocket, UsersRound, GraduationCap, Presentation,
  Sparkles, Network, MessageSquare, UserSearch,
  Code2, Palette, PenTool, Film, Camera, Wand2, Server, Shield,
  Cpu, BarChart3, Flag, ClipboardList, UserCheck, BadgeCheck,
  Megaphone, Video, School, User,
} from 'lucide-react'

// Mirrors app/models/profile.py's choice lists exactly — kept in sync
// manually since these are curated vocabularies, not user-generated data.
export const INTENT_OPTIONS = [
  { key: 'find_work', label: 'Find freelance work', icon: Briefcase },
  { key: 'hire', label: 'Hire professionals', icon: Users },
  { key: 'build_startup', label: 'Build a startup', icon: Rocket },
  { key: 'find_collaborators', label: 'Find collaborators', icon: UsersRound },
  { key: 'learn', label: 'Learn new skills', icon: GraduationCap },
  { key: 'mentor', label: 'Mentor others', icon: Presentation },
  { key: 'showcase_work', label: 'Showcase my work', icon: Sparkles },
  { key: 'network', label: 'Build my network', icon: Network },
  { key: 'share_ideas', label: 'Share ideas', icon: MessageSquare },
  { key: 'recruit', label: 'Recruit talent', icon: UserSearch },
]

export const CATEGORY_OPTIONS = [
  { key: 'developer', label: 'Developer', icon: Code2 },
  { key: 'designer', label: 'Designer', icon: Palette },
  { key: 'writer', label: 'Writer', icon: PenTool },
  { key: 'video_editor', label: 'Video Editor', icon: Film },
  { key: 'photographer', label: 'Photographer', icon: Camera },
  { key: 'animator', label: 'Animator', icon: Wand2 },
  { key: 'devops_engineer', label: 'DevOps Engineer', icon: Server },
  { key: 'cybersecurity_specialist', label: 'Cybersecurity Specialist', icon: Shield },
  { key: 'ai_engineer', label: 'AI Engineer', icon: Cpu },
  { key: 'data_analyst', label: 'Data Analyst', icon: BarChart3 },
  { key: 'founder', label: 'Founder', icon: Flag },
  { key: 'product_manager', label: 'Product Manager', icon: ClipboardList },
  { key: 'recruiter', label: 'Recruiter', icon: UserSearch },
  { key: 'hr', label: 'HR', icon: UserCheck },
  { key: 'marketer', label: 'Marketer', icon: Megaphone },
  { key: 'creator', label: 'Content Creator', icon: Video },
  { key: 'student', label: 'Student', icon: GraduationCap },
  { key: 'teacher', label: 'Teacher', icon: School },
  { key: 'mentor', label: 'Mentor', icon: Presentation },
  { key: 'other', label: 'Other', icon: User },
]

export const BUILDING_OPTIONS = [
  { key: 'mobile_apps', label: 'Mobile Apps', icon: Code2 },
  { key: 'saas', label: 'SaaS', icon: Server },
  { key: 'ai', label: 'AI', icon: Cpu },
  { key: 'open_source', label: 'Open Source', icon: Code2 },
  { key: 'business', label: 'Business', icon: Briefcase },
  { key: 'games', label: 'Games', icon: Sparkles },
  { key: 'content', label: 'Content', icon: Video },
  { key: 'other', label: 'Other', icon: BadgeCheck },
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

// Mirrors app/models/profile.py's AVAILABILITY_CHOICES.
export const AVAILABILITY_OPTIONS = [
  { key: 'open_to_work', label: 'Open to work' },
  { key: 'open_to_collab', label: 'Open to collaborate' },
  { key: 'not_available', label: 'Not available' },
]

const emptyData = {
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
  country_flag: '',
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
  twitter_url: '',
  dribbble_url: '',
  about: '',
  timezone: '',
  availability_status: '',
  availability_note: '',
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

// Converts an existing ProfileOut API response (see
// app/schemas/profile.py) back into the wizard's internal shape — the
// inverse of toApiPayload below. Used by the Profile edit page to
// pre-fill fields with whatever's already saved, since editing a profile
// is the same data as onboarding, just loaded from the server instead of
// starting blank.
function fromApiProfile(profile) {
  if (!profile) return emptyData
  return {
    ...emptyData,
    intents: profile.intents || [],
    categories: profile.categories || [],
    building: profile.building || [],
    skills: profile.skills || [],
    photo_ref: profile.photo_ref || null,
    photo_preview: profile.photo_url || null,
    cover_ref: profile.cover_ref || null,
    cover_preview: profile.cover_url || null,
    country_code: profile.country_code || '',
    country_label: profile.country_code || '', // display label refined once CountrySelect's list loads
    city: profile.city || '',
    is_remote: profile.is_remote || false,
    headline: profile.headline || '',
    bio: profile.bio || '',
    portfolio_links: profile.portfolio_links || [],
    work_experience: profile.work_experience || [],
    github_url: profile.github_url || '',
    linkedin_url: profile.linkedin_url || '',
    website_url: profile.website_url || '',
    telegram_handle: profile.telegram_handle || '',
    twitter_url: profile.twitter_url || '',
    dribbble_url: profile.dribbble_url || '',
    about: profile.about || '',
    timezone: profile.timezone || '',
    availability_status: profile.availability_status || '',
    availability_note: profile.availability_note || '',
    hourly_rate: profile.hourly_rate != null ? String(profile.hourly_rate) : '',
    company_name: profile.company_name || '',
    hiring_for: profile.hiring_for || '',
    company_size: profile.company_size || null,
    budget_min: profile.budget_min != null ? String(profile.budget_min) : '',
    budget_max: profile.budget_max != null ? String(profile.budget_max) : '',
    username: profile.username || '',
    interests: profile.interests || [],
  }
}

export function OnboardingProvider({ children, initialData }) {
  const [data, setData] = useState(() => (initialData ? fromApiProfile(initialData) : emptyData))
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
    twitter_url: data.twitter_url || null,
    dribbble_url: data.dribbble_url || null,
    about: data.about || null,
    timezone: data.timezone || null,
    availability_status: data.availability_status || null,
    availability_note: data.availability_note || null,
    hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : null,
    company_name: data.company_name || null,
    hiring_for: data.hiring_for || null,
    company_size: data.company_size || null,
    budget_min: data.budget_min ? Number(data.budget_min) : null,
    budget_max: data.budget_max ? Number(data.budget_max) : null,
  }
}
