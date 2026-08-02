const EXPORT_TIMEZONE = 'America/Bogota'

function exportDateIso(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EXPORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function buildExportFilename(content: string, date = new Date()): string {
  return `moveonapp-${content}-${exportDateIso(date)}.xlsx`
}
