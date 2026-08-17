import type { Locale } from './docs'

const dayInMilliseconds = 86_400_000

const localeTags: Record<Locale, string> = {
  en: 'en',
  'zh-cn': 'zh-CN',
}

const recentLabels: Record<Locale, string> = {
  en: 'Recently',
  'zh-cn': '最近',
}

const relativeUnits: {
  maximumDays: number
  unit: Intl.RelativeTimeFormatUnit
  unitDays: number
}[] = [
  { maximumDays: 60, unit: 'week', unitDays: 7 },
  { maximumDays: 365, unit: 'month', unitDays: 30 },
  { maximumDays: Infinity, unit: 'year', unitDays: 365 },
]

export const formatRelativeDate = (
  date: Date,
  locale: Locale,
  now = new Date(),
): string | null => {
  const elapsedDays = (now.valueOf() - date.valueOf()) / dayInMilliseconds
  if (!Number.isFinite(elapsedDays)) return null
  if (Math.abs(elapsedDays) <= 7) return recentLabels[locale]

  const relativeUnit = relativeUnits.find(
    ({ maximumDays }) => Math.abs(elapsedDays) <= maximumDays,
  )
  if (!relativeUnit) return recentLabels[locale]

  const formatter = new Intl.RelativeTimeFormat(localeTags[locale], {
    numeric: 'always',
  })

  return formatter.format(
    -Math.round(elapsedDays / relativeUnit.unitDays),
    relativeUnit.unit,
  )
}
