import { expect, test } from '@playwright/test'

const healthPayload = {
  status: 'ok',
  db_status: 'ok',
  ollama_status: 'ok',
  scheduler_status: 'running',
  cached_model_count: 0,
  uptime_seconds: 10,
  timestamp: new Date().toISOString(),
  version: '0.1.0',
}

test('primary navigation flows between pages', async ({ page }) => {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(healthPayload),
    })
  })

  await page.goto('/')
  await page.getByRole('link', { name: 'Models' }).click()
  await expect(page.getByText('Ollama Endpoint')).toBeVisible()

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByText('Theme Presets')).toBeVisible()

  await page.getByRole('link', { name: 'Chat' }).click()
  await expect(page.getByText('Session diagnostics')).toBeVisible()
})
