export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export const QUARTER_RANGES = {
  Q1: 'January – March',
  Q2: 'April – June',
  Q3: 'July – September',
  Q4: 'October – December',
}

export const quarterForDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  return QUARTERS[Math.floor(date.getMonth() / 3)]
}
