export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

const dateOnly = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso))
}

// The year only appears for an entry from another year: in the sidebar and the entry title it is otherwise noise.
const sameYear = (date: Date, now: Date) => date.getFullYear() === now.getFullYear()

const day = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' })
const dayWithYear = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export function formatDay(iso: string, now = new Date()): string {
  const date = new Date(iso)
  return (sameYear(date, now) ? day : dayWithYear).format(date)
}

const time = new Intl.DateTimeFormat('en', { timeStyle: 'short' })

export function formatTime(iso: string): string {
  return time.format(new Date(iso))
}

const shortDateTime = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function formatShortDateTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  return sameYear(date, now) ? shortDateTime.format(date) : dateTime.format(date)
}
