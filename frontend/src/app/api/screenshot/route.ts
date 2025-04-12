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
  } else {
    logger.info('Reusing existing browser instance...');
  }
  return browserInstance;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  let page = null;

  if (!url) {
    logger.warn('No URL provided in query parameters');
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  logger.info(`Starting screenshot for URL: ${url}`);

  try {
    // Get browser instance
    const browser = await getBrowser();
    logger.info('Browser instance acquired');

    // Create a new page
    page = await browser.newPage();
    logger.info('New page created');

    // Set viewport
    await page.setViewport({ width: 1600, height: 900 });
    logger.info('Viewport set to 1600x900');

      // Navigate to URL with increased timeout and more reliable wait condition
      await page.goto(url, {
        waitUntil: 'networkidle2', // 更改为等待网络空闲状态，确保页面完全加载
        timeout: 90000, // 增加超时时间到90秒
      });

      // 等待额外的时间让页面完全渲染
      await page.waitForTimeout(8000); // 增加等待时间到8秒

      // 尝试等待页面上的内容加载，如果失败也继续处理
      try {
        // 等待页面上可能存在的主要内容元素
        await Promise.race([
          page.waitForSelector('main', { timeout: 5000 }),
          page.waitForSelector('#root', { timeout: 5000 }),
          page.waitForSelector('.app', { timeout: 5000 }),
          page.waitForSelector('h1', { timeout: 5000 }),
          page.waitForSelector('div', { timeout: 5000 }), // 添加更通用的选择器
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
    logger.info('Screenshot captured');

    // Clean up
    if (page) await page.close();
    logger.info('Page closed');

    return new Response(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 's-maxage=3600',
      },
    });
  } catch (error: any) {
    logger.error('Screenshot error:', error);

    if (page) {
      try {
        await page.close();
        logger.info('Closed page after error');
      } catch (closeError) {
        logger.error('Error closing page:', closeError);
      }
    }

    if (
      error.message?.includes('Target closed') ||
      error.message?.includes('Protocol error') ||
      error.message?.includes('Target.createTarget')
    ) {
      try {
        if (browserInstance) {
          await browserInstance.close();
          logger.warn('Browser instance was closed due to protocol error');
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

// Gracefully close the browser when the process exits
process.on('SIGINT', async () => {
  if (browserInstance) {
    logger.info('SIGINT received. Closing browser instance...');
    await browserInstance.close();
    browserInstance = null;
  }
  process.exit(0);
});
