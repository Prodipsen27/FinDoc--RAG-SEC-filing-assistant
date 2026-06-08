import { citationLabel, type CitationPayload } from '@/lib/citations'
import { cn } from '@/lib/utils'

type CitationChipProps = {
  citation: CitationPayload
  selected?: boolean
  onSelect: (citation: CitationPayload) => void
}

export function CitationChip({ citation, selected, onSelect }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(citation)}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-sm border py-1 pr-3 pl-1.5 text-left text-xs transition-all font-mono',
        selected
          ? 'border-ring bg-accent text-accent-foreground font-semibold shadow-[2px_2px_0px_0px_var(--color-ring)]'
          : 'border-border bg-background text-muted-foreground hover:border-ring hover:text-foreground',
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-primary text-[0.6rem] font-semibold text-primary-foreground tabular-nums">
        {citation.citationIndex}
      </span>
      <span className="truncate font-medium">{citationLabel(citation)}</span>
    </button>
  )
}
