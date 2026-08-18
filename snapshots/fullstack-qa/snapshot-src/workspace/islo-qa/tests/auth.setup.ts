import { test as setup, expect } from '@playwright/test';
import { AUTH_DIR, ISLO_QA_EMAIL, ISLO_QA_OTP, STORAGE_STATE, ensureAuthDir } from './support/env';

setup('authenticate with fixed OTP', async ({ page }) => {
  ensureAuthDir();
  await page.goto('/');

  await page.getByRole('button', { name: /continue with email/i }).click({ timeout: 60_000 });
  await page.locator('input[type="email"], input[name="email"]').first().fill(ISLO_QA_EMAIL);
  await page.getByRole('button', { name: /continue|submit/i }).click();

  const otp = ISLO_QA_OTP;
  const digitInputs = page.locator('input[inputmode="numeric"], input[type="tel"]');
  const count = await digitInputs.count();
  if (count >= 6) {
    for (let i = 0; i < 6; i += 1) {
      await digitInputs.nth(i).fill(otp[i] ?? '');
    }
  } else {
    await page.locator('input').first().fill(otp);
  }

  await page.waitForURL(/\/(dashboard|sandboxes|home|factory)/i, { timeout: 90_000 });
  await expect(page).not.toHaveURL(/login/i);
  await page.context().storageState({ path: STORAGE_STATE });
});
