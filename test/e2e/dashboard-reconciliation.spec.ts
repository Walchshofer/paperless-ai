import { test, expect, type Route } from '@playwright/test';

interface DashboardData {
  lastUpdated: string;
  documentCount: number;
  processedCount: number;
  tokenDistribution: Array<{ range: string; count: number }>;
  documentTypes: Array<{ type: string; count: number }>;
}

interface DashboardMetricsResponse {
  timestamp: string;
  metrics: {
    documentCount: number;
    processedDocumentCount: number;
    tokenDistribution: Array<{ range: string; count: number }>;
    documentTypes: Array<{ type: string; count: number }>;
  };
  processingStatus: {
    isProcessing: boolean;
    processedToday: number;
  };
}

declare global {
  interface Window {
    dashboardData?: DashboardData;
  }
}

test.describe('Dashboard Reconciliation', () => {
  test(
    'should update UI when API returns newer data than inline snapshot',
    async ({ page }) => {
      await page.addInitScript(() => {
        (window as Window & { __DISABLE_GITHUB_FETCH__?: boolean })
          .__DISABLE_GITHUB_FETCH__ = true;
      });

      let mockedMetrics: DashboardMetricsResponse | null = null;
      let mockedRequestCount = 0;
      await page.route('**/api/dashboard/metrics', async (route: Route) => {
        if (!mockedMetrics) {
          await route.continue();
          return;
        }

        mockedRequestCount += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockedMetrics)
        });
      });

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

      const initialData = await page.evaluate(() => window.dashboardData || null);
      if (!initialData) {
        test.skip(true, 'Dashboard data not available');
        return;
      }

      const newTimestamp = new Date(
        new Date(initialData.lastUpdated).getTime() + 3600000
      ).toISOString();
      const newDocumentCount = (initialData.documentCount || 0) + 10;
      const newProcessedCount = Math.min(
        newDocumentCount,
        (initialData.processedCount || 0) + 5
      );
      const pendingCount = Math.max(0, newDocumentCount - newProcessedCount);

      mockedMetrics = {
        timestamp: newTimestamp,
        metrics: {
          documentCount: newDocumentCount,
          processedDocumentCount: newProcessedCount,
          tokenDistribution: [
            { range: '0-500', count: Math.max(1, Math.floor(newProcessedCount / 2)) },
            { range: '501-1000', count: Math.max(1, newProcessedCount) }
          ],
          documentTypes: [
            { type: 'invoice', count: Math.max(1, Math.floor(newProcessedCount / 2)) },
            { type: 'other', count: Math.max(1, newDocumentCount - Math.floor(newProcessedCount / 2)) }
          ]
        },
        processingStatus: {
          isProcessing: false,
          processedToday: Math.max(1, Math.floor(newProcessedCount / 2))
        }
      };

      // Dashboard charts island polls every 5s when runtime is mounted.
      // Wait long enough for one poll cycle.
      await page.waitForTimeout(6500);

      const chartsIslandAnchor = page.locator(
        '[data-island="dashboard-charts-island"][data-testid="dashboard-charts-island"]'
      );
      await expect(chartsIslandAnchor).toHaveCount(1);

      await expect.poll(async () => {
        return await chartsIslandAnchor.evaluate((el) => {
          return el.getAttribute('data-mounted') === 'true';
        });
      }, { timeout: 10000 }).toBe(true);

      await expect(page.locator('canvas#tokenDistributionChart')).toBeVisible();
      await expect(page.locator('canvas#documentTypesChart')).toBeVisible();

      const taskRunnerCard = page
        .locator('.material-card')
        .filter({ hasText: 'Task Runner Status' })
        .first();

      await expect.poll(async () => {
        const text = (await taskRunnerCard.textContent()) || '';
        return text.includes(`(${newProcessedCount} / ${newDocumentCount})`);
      }, { timeout: 20000 }).toBe(true);

      await expect(taskRunnerCard).toContainText(String(pendingCount));
      expect(mockedRequestCount).toBeGreaterThan(0);
    }
  );
});
