import { DEFAULT_TIMEZONE, storeDateIso } from '@/shared/lib/day-range'

export function buildExportFilename(content: string, date = new Date()): string {
  return `moveonapp-${content}-${storeDateIso(date, DEFAULT_TIMEZONE)}.xlsx`
}
