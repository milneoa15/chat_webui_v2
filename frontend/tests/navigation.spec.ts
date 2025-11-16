import { expect, test } from '@playwright/test'
import { mockApi } from './support/mockApi'

test('primary navigation flows between pages', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByRole('link', { name: 'Models' }).click()
  await expect(page.getByText('Ollama Endpoint')).toBeVisible()

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByText('Theme Presets')).toBeVisible()

  await page.getByRole('link', { name: 'Chat' }).click()
  await expect(page.getByText('Session diagnostics')).toBeVisible()
})
