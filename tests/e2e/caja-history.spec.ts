import { expect, test } from '@playwright/test'

const email = process.env['E2E_EMAIL']
const password = process.env['E2E_PASSWORD']

test('muestra el historial de cajas cuando no existe un turno abierto', async ({ page }) => {
  test.skip(!email || !password, 'Requiere E2E_EMAIL y E2E_PASSWORD')

  await page.goto('/login')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Contrasena').fill(password!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/pos$/)

  await page.goto('/caja')
  await expect(page.getByRole('heading', { name: 'Caja', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Abrir caja' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Turnos anteriores' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Historial de cajas', exact: true }).click()
  await expect(page).toHaveURL(/\/caja\/historial$/)
  await expect(page.getByRole('heading', { name: 'Historial de caja', exact: true })).toBeVisible()
})
