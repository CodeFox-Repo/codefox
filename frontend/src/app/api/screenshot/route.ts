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
  const MAX_RETRIES = 3;

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      logger.info(`Screenshot attempt ${attempt + 1} for ${url}`);
      
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
      logger.error(`Screenshot error on attempt ${attempt + 1}:`, error);

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

      // 如果这不是最后一次尝试，则继续
      if (attempt < MAX_RETRIES - 1) {
        // 等待一会儿再重试
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      // 最后一次尝试失败
      return NextResponse.json(
        { error: error.message || 'Failed to capture screenshot after multiple attempts' },
        { status: 500 }
      );
    }
  }

  // 如果重试都失败
  return NextResponse.json(
    { error: 'Failed to capture screenshot after exhausting all retries' },
    { status: 500 }
  );
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
