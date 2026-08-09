/**
 * Job listings shown on the Jobs screen and, as a short "Jobs for you"
 * rail, on the home feed. One source so the two screens can never show
 * a different set of roles. When the jobs service goes live this module
 * is the single place that starts fetching instead of exporting arrays.
 */
export const FEATURED = [
  {
    id: 'f1',
    title: 'Backend Developer (Node.js)',
    company: 'Elcoral Official',
    verified: true,
    brand: true,
    tone: 'a',
    remote: 'Remote',
    type: 'Full-time',
    time: '1h ago',
    desc: 'Build and maintain scalable APIs and services that power the Elcoral platform.',
    tags: ['Node.js', 'Express.js', 'MongoDB', 'REST API'],
    extra: 2,
  },
  {
    id: 'f2',
    title: 'Senior Product Designer',
    company: 'DesignHub',
    verified: true,
    tone: 'b',
    remote: 'Remote',
    type: 'Full-time',
    time: '3h ago',
    desc: 'Craft end-to-end product experiences for a fast-growing design collaboration suite.',
    tags: ['Figma', 'Design systems', 'Prototyping'],
    extra: 3,
  },
  {
    id: 'f3',
    title: 'Growth Marketing Lead',
    company: 'PayBridge',
    tone: 'c',
    remote: 'Hybrid',
    type: 'Full-time',
    time: '5h ago',
    desc: 'Own acquisition, lifecycle and retention experiments across all growth channels.',
    tags: ['SEO', 'Paid ads', 'Lifecycle'],
    extra: 2,
  },
]

export const RECOMMENDED = [
  {
    id: 'r1', title: 'UI/UX Designer', company: 'DesignHub', verified: true,
    tone: 'b', badge: 'New', time: '2h ago', place: 'Remote', placeIcon: 'wifi', type: 'Full-time',
  },
  {
    id: 'r2', title: 'Frontend Developer (React)', company: 'GreenLeaf Labs', verified: true,
    tone: 'c', badge: 'New', time: '4h ago', place: 'Lagos, Nigeria', placeIcon: 'pin', type: 'Full-time',
  },
  {
    id: 'r3', title: 'Product Manager', company: 'PayBridge',
    tone: 'd', time: '6h ago', place: 'Remote', placeIcon: 'wifi', type: 'Full-time',
  },
  {
    id: 'r4', title: 'AI/ML Engineer', company: 'Innova AI', verified: true,
    tone: 'e', time: '8h ago', place: 'Remote', placeIcon: 'wifi', type: 'Full-time',
  },
  {
    id: 'r5', title: 'Content Writer', company: 'Blockwrite',
    tone: 'f', time: '1d ago', place: 'Remote', placeIcon: 'wifi', type: 'Part-time',
  },
]
