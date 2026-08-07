import { useOnboarding, INTENT_OPTIONS } from '../OnboardingContext.jsx'
import StepShell from '../components/StepShell.jsx'
import ChipPicker from '../components/ChipPicker.jsx'

export default function IntentsStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()

  function toggle(key) {
    const has = data.intents.includes(key)
    update({ intents: has ? data.intents.filter((k) => k !== key) : [...data.intents, key] })
  }

  return (
    <StepShell
      eyebrow="Step 1 of 9"
      title="What brings you to Elcoral?"
      subtitle="Pick as many as apply. This is what makes Elcoral different — we connect people by what they're trying to do, not their job title."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={data.intents.length === 0}
      showBack={false}
    >
      <ChipPicker options={INTENT_OPTIONS} selected={data.intents} onToggle={toggle} columns={2} />
    </StepShell>
  )
}
