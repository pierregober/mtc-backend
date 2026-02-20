export const sanitizeObject = (obj: Record<string, any>) => {
  const result: Record<string, any> = {}
  for (const key in obj) {
    if (obj[key] !== null && obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}