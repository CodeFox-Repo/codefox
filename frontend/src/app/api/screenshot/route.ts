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

  logger.info(`[SCREENSHOT] Starting screenshot for URL: ${url}`);

  try {
    // Get browser instance
    logger.info(`[SCREENSHOT] Attempting to get browser instance`);
    const browser = await getBrowser();
    logger.info(`[SCREENSHOT] Browser instance acquired successfully`);

    // Create a new page
    logger.info(`[SCREENSHOT] Creating new page`);
    page = await browser.newPage();
    logger.info(`[SCREENSHOT] New page created successfully`);

    // Set viewport
    logger.info(`[SCREENSHOT] Setting viewport`);
    await page.setViewport({ width: 1600, height: 900 });
    logger.info(`[SCREENSHOT] Viewport set successfully`);

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
    logger.info(`[SCREENSHOT] Taking screenshot`);
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
    });
    logger.info(`[SCREENSHOT] Screenshot captured successfully, size: ${screenshot.length} bytes`);

    // Clean up
    if (page) {
      logger.info(`[SCREENSHOT] Closing page`);
      await page.close();
      logger.info(`[SCREENSHOT] Page closed successfully`);
    }

    logger.info(`[SCREENSHOT] Returning screenshot response`);
    return new Response(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
  } catch (error: any) {
    logger.error(`[SCREENSHOT] Error capturing screenshot: ${error.message}`, error);
    logger.error(`[SCREENSHOT] Error stack: ${error.stack}`);

    if (page) {
      try {
        logger.info(`[SCREENSHOT] Attempting to close page after error`);
        await page.close();
        logger.info(`[SCREENSHOT] Successfully closed page after error`);
      } catch (closeError) {
        logger.error(`[SCREENSHOT] Error closing page: ${closeError.message}`);
      }
    }

    if (
      error.message?.includes('Target closed') ||
      error.message?.includes('Protocol error') ||
      error.message?.includes('Target.createTarget')
    ) {
      try {
        if (browserInstance) {
          logger.warn(`[SCREENSHOT] Resetting browser instance due to protocol error`);
          await browserInstance.close();
          browserInstance = null;
          logger.warn(`[SCREENSHOT] Browser instance reset successfully`);
        }
      } catch (closeBrowserError) {
        logger.error(`[SCREENSHOT] Error closing browser: ${closeBrowserError.message}`);
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
