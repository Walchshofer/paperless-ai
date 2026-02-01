import { test, expect } from '@playwright/test';

test.describe('Dashboard Reconciliation', () => {
  test('should update UI when API returns newer data than inline snapshot', async ({ page }) => {
    // 1. Navigate to dashboard to get initial state
    await page.goto('/dashboard');
    console.log('Current URL:', page.url());
    // Wait for chart to be visible
    await expect(page.locator('#documentChart')).toBeVisible();

    // Get initial values from window.dashboardData
    const initialData = await page.evaluate(() => window.dashboardData);
    console.log('Initial Data:', initialData);

    // 2. Prepare mock response with newer timestamp and different values
    const newTimestamp = new Date(new Date(initialData.lastUpdated).getTime() + 3600000).toISOString(); // +1 hour
    const newDocumentCount = (initialData.documentCount || 0) + 10;
    const newProcessedCount = (initialData.processedCount || 0) + 5;

    const mockApiResponse = {
      timestamp: newTimestamp,
      metrics: {
        documentCount: newDocumentCount,
        processedDocumentCount: newProcessedCount,
        tagCount: 10,
        correspondentCount: 5,
        tokenDistribution: [],
        documentTypes: []
      },
      health: {
        paperless: 'online',
        local_db: 'online'
      }
    };

    // 3. Intercept the API call that ChartManager makes
    // Note: ChartManager polls every 30s. We can force a poll or wait for the initial one if we catch it early enough.
    // Better: We can manually trigger the fetch or just wait for the poll if we speed it up?
    // Actually, ChartManager calls fetchMetrics() immediately after initializeDocumentChart() calls reconcileMetrics().
    // But since we already loaded the page, that might have happened.
    
    // We can evaluate code to trigger reconciliation manually to avoid waiting 30s
    await page.route('**/api/dashboard/metrics', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponse)
      });
    });

    // Trigger reconciliation manually in the browser context
    await page.evaluate(() => {
        // @ts-ignore
        if (window.chartManager) {
            // @ts-ignore
            window.chartManager.pollAndUpdate();
        }
    });

    // 4. Verify that window.dashboardData has been updated
    await expect.poll(async () => {
        return await page.evaluate(() => window.dashboardData.lastUpdated);
    }).toBe(newTimestamp);

    await expect.poll(async () => {
        return await page.evaluate(() => window.dashboardData.documentCount);
    }).toBe(newDocumentCount);

    // 5. Verify that the chart has been updated (optional, checking data is usually enough)
    // We can check if the chart instance data matches
    const chartData = await page.evaluate(() => {
        // @ts-ignore
        const chart = window.chartManager.chart;
        if (!chart) return null;
        return chart.data.datasets[0].data;
    });

    expect(chartData).toEqual([newProcessedCount, Math.max(0, newDocumentCount - newProcessedCount)]);
  });
});
