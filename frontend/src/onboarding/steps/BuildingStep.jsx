import { useOnboarding, BUILDING_OPTIONS } from '../OnboardingContext.jsx'
import StepShell from '../StepShell.jsx'
import ChipPicker from '../ChipPicker.jsx'

export default function BuildingStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()

  function toggle(key) {
    const has = data.building.includes(key)
    update({ building: has ? data.building.filter((k) => k !== key) : [...data.building, key] })
  }

  return (
    <StepShell
      eyebrow="Step 3 of 9"
      title="What do you want to build?"
      subtitle="Optional — this helps Elcoral suggest collaborators working toward the same thing."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
    >
      <ChipPicker options={BUILDING_OPTIONS} selected={data.building} onToggle={toggle} columns={2} />
    </StepShell>
  )
}
