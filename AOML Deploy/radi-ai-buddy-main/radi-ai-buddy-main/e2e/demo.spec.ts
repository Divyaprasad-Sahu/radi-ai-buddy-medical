import { test, expect } from "@playwright/test";
import { t, type Language } from "../src/lib/i18n";
for (const language of ['en','hi','mr'] as Language[]) {
 test(`${language}: fixture screening, contextual API chat, report and session history`,async({page})=>{
  // Explicit UI fixtures; never used by the production server or as accuracy evidence.
  await page.route('**/predict',route=>route.fulfill({json:{disease:'Pneumonia',confidence:.91,chat_response:'Fixture',model_version:'fixture-only',calibrated:true}}));
  await page.route('**/explain',route=>route.fulfill({json:{chat_response:'Fixture explanation'}}));
  let context:Record<string,unknown>|undefined;
  await page.route('**/chat',route=>{context=route.request().postDataJSON();return route.fulfill({json:{chat_response:'Context received'}});});
  await page.goto('/');await page.getByLabel('Language').selectOption(language);
  await page.getByRole('button',{name:t(language,'startDiagnosis'),exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await page.getByLabel(t(language,'symptoms')).fill('Synthetic cough');
  await page.getByRole('button',{name:t(language,'upload'),exact:true}).click();
  await expect(page.getByText(t(language,'pneumonia'),{exact:true})).toBeVisible();
  await page.getByRole('button',{name:t(language,'chat'),exact:true}).click();
  await expect(page.getByText(t(language,'contextAttached'))).toBeVisible();
  await page.getByRole('textbox').fill('Explain confidence');await page.getByRole('button',{name:t(language,'send'),exact:true}).click();
  await expect(page.getByText('Context received')).toBeVisible();
  expect(context).toMatchObject({disease:'Pneumonia',model_version:'fixture-only',confidence:.91,symptoms:'Synthetic cough',language});
  await page.getByRole('button',{name:t(language,'createReport'),exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel(t(language,'patientName')).fill('Synthetic example');
  await expect(page.getByText('Synthetic example',{exact:true})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:t(language,'downloadHtml'),exact:true}).click();
  expect((await download).suggestedFilename()).toMatch(/^RAD-.*\.html$/);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:t(language,'history'),exact:true}).click();
  await expect(page.getByText(t(language,'pneumonia'),{exact:true})).toBeVisible();
  await page.getByRole('button',{name:t(language,'clearHistory'),exact:true}).click();
  await expect(page.getByText(t(language,'noHistory'))).toBeVisible();
 });
}
