import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { api, ApiError } from '../api/client.js'
import { OnboardingProvider, useOnboarding, toApiPayload } from '../features/onboarding/OnboardingContext.jsx'
import CheckEmailStep from '../features/onboarding/steps/CheckEmailStep.jsx'
import WelcomeStep from '../features/onboarding/steps/WelcomeStep.jsx'
import IntentsStep from '../features/onboarding/steps/IntentsStep.jsx'
import CategoriesStep from '../features/onboarding/steps/CategoriesStep.jsx'
import BuildingStep from '../features/onboarding/steps/BuildingStep.jsx'
import SkillsStep from '../features/onboarding/steps/SkillsStep.jsx'
import PhotoStep from '../features/onboarding/steps/PhotoStep.jsx'
import CoverStep from '../features/onboarding/steps/CoverStep.jsx'
import LocationStep from '../features/onboarding/steps/LocationStep.jsx'
import BioStep from '../features/onboarding/steps/BioStep.jsx'
import WorkDetailsStep from '../features/onboarding/steps/WorkDetailsStep.jsx'
import LinksStep from '../features/onboarding/steps/LinksStep.jsx'
import UsernameStep from '../features/onboarding/steps/UsernameStep.jsx'
import InterestsStep from '../features/onboarding/steps/InterestsStep.jsx'
import FinishedStep from '../features/onboarding/steps/FinishedStep.jsx'

export default function Onboarding() {
  return (
    <OnboardingProvider>
      <OnboardingWizard />
    </OnboardingProvider>
  )
}

function OnboardingWizard() {
  const { data, update } = useOnboarding()
  const { user, accessToken } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [completionPct, setCompletionPct] = useState(0)
  const [verifiedOverride, setVerifiedOverride] = useState(false)
  const [accountType, setAccountType] = useState(null)

  // The signup form already collected a handle and a "Join as" choice, so
  // the wizard reads the profile row back and seeds itself instead of
  // asking the same two questions again (people were typing their handle
  // twice and being told it was taken — by their own account).
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    ;(async () => {
      try {
        const profile = await api.getMyProfile(accessToken)
        if (cancelled) return
        setAccountType(profile.account_type || null)
        if (profile.username) update({ username: profile.username })
      } catch {
        // Non-fatal: the wizard still works, it just starts empty.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  // require_verified on the backend blocks POST /api/onboarding entirely
  // until the user has clicked their emailed verification link — this
  // mirrors that on the frontend so people see a clear "check your
  // email" screen up front instead of clicking through the whole wizard
  // only to have the final submit fail with a 403.
  const isVerified = user?.is_verified || verifiedOverride

  if (!isVerified) {
    return <CheckEmailStep onVerified={() => setVerifiedOverride(true)} />
  }

  // WorkDetailsStep only makes sense if the person picked an intent it
  // covers — skipped entirely otherwise rather than shown empty.
  const needsWorkDetails =
    accountType === 'organization' ||
    data.intents.includes('find_work') ||
    data.intents.includes('hire')

  const steps = [
    'welcome',
    'intents',
    'categories',
    'building',
    'skills',
    'photo',
    'cover',
    'location',
    'bio',
    ...(needsWorkDetails ? ['workDetails'] : []),
    'links',
    'username',
    'interests',
    'finished',
  ]

  const currentKey = steps[step]
  // Progress excludes the welcome/finished bookends from the percentage
  // math so it reads 0% right after "let's go" and ~100% right before
  // the final submit, not stuck at odd fractions from padding steps in.
  const progressableSteps = steps.filter((s) => s !== 'welcome' && s !== 'finished')
  const progressIndex = progressableSteps.indexOf(currentKey)
  const progress = Math.round(((progressIndex + 1) / progressableSteps.length) * 100)

  function goNext() {
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function onFinalSubmit() {
    setSubmitError('')
    setSubmitting(true)
    try {
      const payload = toApiPayload(data)
      const profile = await api.submitOnboarding(payload, accessToken)
      setCompletionPct(profile.profile_completion_pct)
      goNext() // -> finished step
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const stepProps = { progress, onNext: goNext, onBack: goBack }

  return (
    <>
      {currentKey === 'welcome' && <WelcomeStep onNext={goNext} fullName={user?.full_name} />}
      {currentKey === 'intents' && <IntentsStep {...stepProps} />}
      {currentKey === 'categories' && <CategoriesStep {...stepProps} />}
      {currentKey === 'building' && <BuildingStep {...stepProps} />}
      {currentKey === 'skills' && <SkillsStep {...stepProps} />}
      {currentKey === 'photo' && <PhotoStep {...stepProps} />}
      {currentKey === 'cover' && <CoverStep {...stepProps} />}
      {currentKey === 'location' && <LocationStep {...stepProps} />}
      {currentKey === 'bio' && <BioStep {...stepProps} />}
      {currentKey === 'workDetails' && <WorkDetailsStep {...stepProps} />}
      {currentKey === 'links' && <LinksStep {...stepProps} />}
      {currentKey === 'username' && <UsernameStep {...stepProps} />}
      {currentKey === 'interests' && (
        <InterestsStep {...stepProps} onNext={onFinalSubmit} nextLoading={submitting} />
      )}
      {currentKey === 'finished' && (
        <FinishedStep completionPct={completionPct} onContinue={() => navigate('/home')} />
      )}

      {submitError && (
        <div className="submit-error-toast">
          {submitError}
          <style>{`
            .submit-error-toast {
              position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
              background: rgba(255,107,74,0.12);
              border: 1px solid var(--danger);
              color: var(--danger);
              padding: 12px 20px;
              border-radius: 10px;
              font-size: 13.5px;
              max-width: 90vw;
              text-align: center;
              z-index: 50;
            }
          `}</style>
        </div>
      )}
    </>
  )
}
