const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Print console logs
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  // Print page errors
  page.on('pageerror', err => {
    console.log('[Browser Error]', err.toString());
  });

  try {
    console.log('Navigating to https://mmorpg-game-4x3u.onrender.com/...');
    await page.goto('https://mmorpg-game-4x3u.onrender.com/', { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Page loaded. Checking for elements...');
    console.log('Body children:', await page.evaluate(() => Array.from(document.body.children).map(c => c.tagName + '.' + c.className)));

    // Clear local storage to make sure login screen is showing
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });

    // Click Admin Login
    const adminBtn = await page.$('.login-btn--admin');
    if (adminBtn) {
      console.log('Found Admin Login button. Clicking...');
      await adminBtn.click();
      await new Promise(r => setTimeout(r, 500));

      // Enter password
      console.log('Typing password...');
      await page.type('.admin-input', '2202');
      await new Promise(r => setTimeout(r, 500));

      // Submit password
      console.log('Submitting...');
      const submitBtn = await page.$('.admin-submit');
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log('Admin button not found!');
    }

    // Wait a bit for game to connect
    console.log('Waiting 5s for room connection and Phaser creation...');
    await new Promise(r => setTimeout(r, 5000));

    // Get children of root
    console.log('Root children:', await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? Array.from(root.children).map(c => c.tagName + '.' + c.className) : [];
    }));

    // Find "Haritayı Düzenle" button
    const editBtn = await page.$('.chip--edit');
    if (editBtn) {
      console.log('Found Edit Mode button. Clicking...');
      await editBtn.click();
      console.log('Clicked. Waiting 3s...');
      await new Promise(r => setTimeout(r, 3000));
      
      console.log('Root children after click:', await page.evaluate(() => {
        const root = document.getElementById('root');
        return root ? Array.from(root.children).map(c => c.tagName + '.' + c.className) : [];
      }));
    } else {
      console.log('Edit Mode button not found!');
    }

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await browser.close();
  }
})();
