import { test, expect } from '@playwright/test'

test('app shell renders navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Chatbot Web UI v2')).toBeVisible()
  await expect(page.getByRole('button', { name: /command palette/i })).toBeVisible()
})
