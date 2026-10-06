import { expect, test } from '@playwright/test';
test.beforeEach(async ({page}) => {
  // Prevent contact with live services, including external images.
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1' && url.port==='4173') return route.continue();
    if(url.hostname==='127.0.0.1' && url.port==='54321') return route.fulfill({
      status:route.request().method()==='OPTIONS' ? 204 : 400,
      headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'},
      body:route.request().method()==='OPTIONS' ? '' : JSON.stringify({message:'Fictional service failure'}),
    });
    return route.abort();
  });
});
test('renders the three public landing routes without a runtime crash',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const path of ['/','/skilllink','/jobbridge']){
    await page.goto(path);await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('alert').filter({hasText:'Something went wrong'})).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test('shows a jobs loading failure with a usable retry control',async({page})=>{
  await page.goto('/jobs');await expect(page.getByRole('alert')).toContainText("couldn't load jobs");
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText("couldn't load jobs");
});
test('redirects an unauthenticated employer away from private workspace',async({page})=>{
  await page.goto('/employer/dashboard');await expect(page).not.toHaveURL(/\/employer\/dashboard/);
  await expect(page.locator('h1').first()).toBeVisible();
});
