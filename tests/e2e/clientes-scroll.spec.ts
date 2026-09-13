import { expect, test } from '@playwright/test'

const email = process.env['E2E_EMAIL']
const password = process.env['E2E_PASSWORD']

test('la tabla de clientes conserva su scroll sin crear scroll en el documento', async ({
  page,
}) => {
  test.skip(!email || !password, 'Requiere E2E_EMAIL y E2E_PASSWORD')

  await page.goto('/login')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Contrasena').fill(password!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/pos$/)

  await page.goto('/clientes')
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const dimensions = await page.evaluate(() => {
    const tableShell = document.querySelector('mo-table-shell')
    if (!tableShell) throw new Error('No se encontró la tabla de clientes')
    return {
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      tableClientHeight: tableShell.clientHeight,
      tableScrollHeight: tableShell.scrollHeight,
    }
  })

  expect(dimensions.tableScrollHeight).toBeGreaterThan(dimensions.tableClientHeight)
  expect(dimensions.documentScrollHeight).toBe(dimensions.documentClientHeight)
})
