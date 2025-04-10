import { logger } from '@/app/log/logger';
import { NextResponse } from 'next/server';
import puppeteer, { Browser } from 'puppeteer';

// Global browser instance that will be reused across requests
let browserInstance: Browser | null = null;

// Function to get browser instance
async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    logger.info('Creating new browser instance...');
    browserInstance = await puppeteer.launch({
      headless: true,
      protocolTimeout: 240000,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  let page = null;

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Get browser instance
    const browser = await getBrowser();

    // Create a new page
    page = await browser.newPage();

    // Set viewport to a reasonable size
    await page.setViewport({
      width: 1600,
      height: 900,
    });

    // Navigate to URL with increased timeout and more reliable wait condition
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // Less strict than networkidle0
      timeout: 60000, // Increased timeout to 60 seconds
    });

    // 等待额外的时间让页面完全渲染
    await page.waitForTimeout(3000);

    // 尝试等待页面上的内容加载，如果失败也继续处理
    try {
      // 等待页面上可能存在的主要内容元素
      await Promise.race([
        page.waitForSelector('main', { timeout: 2000 }),
        page.waitForSelector('#root', { timeout: 2000 }),
        page.waitForSelector('.app', { timeout: 2000 }),
        page.waitForSelector('h1', { timeout: 2000 }),
      ]);
    } catch (waitError) {
      // 忽略等待选择器的错误，继续截图
      logger.info('Unable to find common page elements, continuing with screenshot');
    }

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
    });

    // Always close the page when done
    if (page) {
      await page.close();
    }

    // Return the screenshot as a PNG image
    return new Response(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 's-maxage=3600',
      },
    });
  } catch (error: any) {
    logger.error('Screenshot error:', error);

    // Ensure page is closed even if an error occurs
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        logger.error('Error closing page:', closeError);
      }
    }

    // If browser seems to be in a bad state, recreate it
    if (
      error.message.includes('Target closed') ||
      error.message.includes('Protocol error') ||
      error.message.includes('Target.createTarget')
    ) {
      try {
        if (browserInstance) {
          await browserInstance.close();
          browserInstance = null;
        }
      } catch (closeBrowserError) {
        logger.error('Error closing browser:', closeBrowserError);
      }
    }

    return NextResponse.json(
      { error: error.message || 'Failed to capture screenshot' },
      { status: 500 }
    );
  }
}

// Handle process termination to close browser
process.on('SIGINT', async () => {
  if (browserInstance) {
    logger.info('Closing browser instance...');
    await browserInstance.close();
    browserInstance = null;
  }
  process.exit(0);
});
