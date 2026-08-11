import { icons, type LucideProps } from "lucide-react"

type IconPlaceholderProps = LucideProps & {
  lucide?: keyof typeof icons
  tabler?: string
  hugeicons?: string
  phosphor?: string
  remixicon?: string
}

// tabler/hugeicons/phosphor/remixicon are alternate-icon-library variants
// authored by shadcn block templates; this project only renders `lucide`.
function IconPlaceholder({
  lucide,
  tabler,
  hugeicons,
  phosphor,
  remixicon,
  ...props
}: IconPlaceholderProps) {
  if (lucide) {
    const Icon = icons[lucide]
    return <Icon {...props} />
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeDasharray="3 3"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
}

export { IconPlaceholder }
