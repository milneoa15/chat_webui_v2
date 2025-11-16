import { test, expect } from '@playwright/test'
import { mockApi } from './support/mockApi'

test('app shell renders navigation', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await expect(page.getByText('Chatbot Web UI v2')).toBeVisible()
  await expect(page.getByRole('button', { name: /command palette/i })).toBeVisible()
})
