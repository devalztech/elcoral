import { useOnboarding, CATEGORY_OPTIONS } from '../OnboardingContext.jsx'
import StepShell from '../components/StepShell.jsx'
import ChipPicker from '../components/ChipPicker.jsx'

export default function CategoriesStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()

  function toggle(key) {
    const has = data.categories.includes(key)
    update({ categories: has ? data.categories.filter((k) => k !== key) : [...data.categories, key] })
  }

  return (
    <StepShell
      eyebrow="Step 2 of 9"
      title="Which of these describes you?"
      subtitle="Select all that fit — many people are more than one thing."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={data.categories.length === 0}
    >
      <ChipPicker options={CATEGORY_OPTIONS} selected={data.categories} onToggle={toggle} columns={2} />
    </StepShell>
  )
}
