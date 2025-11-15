const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export type HealthResponse = {
  status: string
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`)
  if (!response.ok) {
    throw new Error('Unable to reach backend health endpoint')
  }
  return response.json() as Promise<HealthResponse>
}
