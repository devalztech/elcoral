import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { api, ApiError } from '../lib/api.js'
import { OnboardingProvider, useOnboarding, toApiPayload } from '../onboarding/OnboardingContext.jsx'
import WelcomeStep from '../onboarding/steps/WelcomeStep.jsx'
import IntentsStep from '../onboarding/steps/IntentsStep.jsx'
import CategoriesStep from '../onboarding/steps/CategoriesStep.jsx'
import BuildingStep from '../onboarding/steps/BuildingStep.jsx'
import SkillsStep from '../onboarding/steps/SkillsStep.jsx'
import PhotoStep from '../onboarding/steps/PhotoStep.jsx'
import CoverStep from '../onboarding/steps/CoverStep.jsx'
import LocationStep from '../onboarding/steps/LocationStep.jsx'
import BioStep from '../onboarding/steps/BioStep.jsx'
import WorkDetailsStep from '../onboarding/steps/WorkDetailsStep.jsx'
import LinksStep from '../onboarding/steps/LinksStep.jsx'
import UsernameStep from '../onboarding/steps/UsernameStep.jsx'
import InterestsStep from '../onboarding/steps/InterestsStep.jsx'
import FinishedStep from '../onboarding/steps/FinishedStep.jsx'

export default function Onboarding() {
  return (
    <OnboardingProvider>
      <OnboardingWizard />
    </OnboardingProvider>
  )
}

function OnboardingWizard() {
  const { data } = useOnboarding()
  const { user, accessToken } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [completionPct, setCompletionPct] = useState(0)

  // WorkDetailsStep only makes sense if the person picked an intent it
  // covers — skipped entirely otherwise rather than shown empty.
  const needsWorkDetails = data.intents.includes('find_work') || data.intents.includes('hire')

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
