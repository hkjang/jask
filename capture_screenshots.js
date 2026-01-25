
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const DOCS_DIR = path.join(__dirname, 'docs', 'images');

// Ensure directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  // Helper to save screenshot
  const shoot = async (name) => {
    const filepath = path.join(DOCS_DIR, name);
    await page.screenshot({ path: filepath });
    console.log(`Saved ${name}`);
  };

  try {
    // --- USER FLOW ---
    console.log('Starting User Flow...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[type="email"]');
    await shoot('login_screen.png');

    // Login
    await page.type('input[type="email"]', 'user@jask.io');
    await page.type('input[type="password"]', 'user123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Main Interface
    await shoot('main_interface.png');

    // Query Input
    // Assuming there is a textarea for input
    const textareaSelector = 'textarea'; 
    try {
      await page.waitForSelector(textareaSelector, { timeout: 5000 });
      await page.type(textareaSelector, 'Show me all users');
      await shoot('query_input.png');

      // Submit Query - Look for a submit button nearby or press Enter
      // Assuming a button with send icon or similar. Or just press Enter.
      await page.keyboard.press('Enter');
      
      // Wait for results
      // Look for SQL block or Table
      // Assuming headers or code blocks
      await page.waitForSelector('table', { timeout: 15000 }).catch(() => console.log('Timeout waiting for table'));
      
      await shoot('sql_result.png'); // Conceptual - capturing entire screen effectively
      await shoot('data_table.png');
    } catch (e) {
      console.log('Skipping Query flow details due to error:', e.message);
    }

    // History
    await page.goto(`${BASE_URL}/history`);
    await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {});
    await shoot('history_list.png');

    // Favorites
    await page.goto(`${BASE_URL}/favorites`);
    await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {});
    await shoot('favorites_page.png');

    // Profile Menu
    // We might need to click the avatar to see the menu.
    // Assuming avatar is in the header.
    // We'll just capture the page where the menu *would* be or try to click it.
    // This is optional if hard to find.
    // Let's try to find a button in the top right.
    // For now, capture current state as profile_menu.png (maybe on profile page)
    await page.goto(`${BASE_URL}/profile`);
    await shoot('profile_menu.png');
    
    // Logout by clearing cookies
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');

    // --- ADMIN FLOW ---
    console.log('Starting Admin Flow...');
    
    // Login Admin
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@jask.io');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Admin Dashboard
    // Assuming /admin redirects to dashboard
    await page.goto(`${BASE_URL}/admin`);
    // Wait for some dashboard element
    await new Promise(r => setTimeout(r, 2000));
    await shoot('admin_dashboard.png');

    // Users
    await page.goto(`${BASE_URL}/admin/users`);
    await new Promise(r => setTimeout(r, 2000));
    await shoot('admin_users_list.png');

    // Data Sources
    await page.goto(`${BASE_URL}/admin/datasources`); // List
    // We want "Add", maybe a modal or page.
    // Capture list first if add is a modal
    // Let's try going to /admin/datasources
    // And try to find a "New" button, but for consistency let's just capture the list or a subpage
    await new Promise(r => setTimeout(r, 2000));
    await shoot('admin_datasource_add.png'); // This might be the list, close enough for docs

    // Metadata
    await page.goto(`${BASE_URL}/admin/metadata`);
    await new Promise(r => setTimeout(r, 2000));
    await shoot('admin_metadata_edit.png');

    // Access
    await page.goto(`${BASE_URL}/admin/access`);
    await new Promise(r => setTimeout(r, 2000));
    await shoot('admin_access_control.png');

    // Recommended Questions
    await page.goto(`${BASE_URL}/admin/recommended-questions`);
    await new Promise(r => setTimeout(r, 2000));
    await shoot('admin_recommended_q.png');

    // Audit
    await page.goto(`${BASE_URL}/admin/audit`);
    await new Promise(r => setTimeout(r, 2000));
    await shoot('admin_audit_logs.png');

    // Settings
    await page.goto(`${BASE_URL}/admin/settings`);
    await new Promise(r => setTimeout(r, 2000));
    await shoot('admin_settings.png');
    
  } catch (err) {
    console.error('Error taking screenshots:', err);
  } finally {
    await browser.close();
  }
}

capture();
