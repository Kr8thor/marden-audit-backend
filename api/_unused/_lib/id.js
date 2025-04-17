// Generate unique IDs for jobs
export function generateId() {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
