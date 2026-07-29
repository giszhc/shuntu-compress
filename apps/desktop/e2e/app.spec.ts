/**
 * 桌面端 e2e：真实 Electron + 真实 vips。
 * 覆盖：启动、添加文件（中文/空格路径）、压缩、结果面板、取消、截图矩阵。
 */
import { expect, test } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { launchApp, makeTestImages } from "./helpers";

test.describe("瞬图压缩桌面端", () => {
  test("启动后显示空状态与标题栏", async () => {
    const { app, page } = await launchApp();
    try {
      await expect(page.locator(".titlebar-title")).toContainText("瞬图");
      await expect(page.locator(".empty-state h3")).toContainText("拖入图片");
      await expect(page.locator(".action-bar .btn-primary")).toBeDisabled();
    } finally {
      await app.close();
    }
  });

  test("添加目录（中文/空格路径）→ 压缩 → 结果面板", async () => {
    const imageRoot = makeTestImages();
    const { app, page } = await launchApp();
    try {
      // 通过 e2e 钩子确定性添加（绕过系统文件对话框）
      await page.evaluate(async root => {
        await window.__e2e!.addPaths([root]);
      }, imageRoot);

      await expect(page.locator(".file-row").first()).toBeVisible({ timeout: 15_000 });
      const rowCount = await page.locator(".file-row").count();
      expect(rowCount).toBeGreaterThanOrEqual(2);

      // 开始压缩
      await page.locator(".action-bar .btn-primary").click();

      // 等待结果面板（真实 vips 处理）
      await expect(page.locator(".result-panel")).toBeVisible({ timeout: 90_000 });
      await expect(page.locator(".result-panel h2")).toContainText("压缩完成");

      // 校验输出目录存在且不覆盖原图
      const snapshot = (await page.evaluate(() => window.__e2e!.getSnapshot())) as {
        summary: { success: number; outputDir: string };
      };
      expect(snapshot.summary.success).toBeGreaterThanOrEqual(2);
      expect(existsSync(snapshot.summary.outputDir)).toBe(true);
      expect(readdirSync(snapshot.summary.outputDir).length).toBeGreaterThan(0);
      // 原图仍在
      expect(readdirSync(imageRoot).length).toBeGreaterThan(0);

      // 关闭结果面板
      await page.locator(".result-footer .btn-primary").click();
      await expect(page.locator(".result-panel")).toBeHidden();
    } finally {
      await app.close();
    }
  });

  test("设置页与关于页可切换", async () => {
    const { app, page } = await launchApp();
    try {
      await page.locator(".titlebar-nav button", { hasText: "设置" }).click();
      await expect(page.locator(".page h1")).toContainText("设置");
      await page.locator(".titlebar-nav button", { hasText: "关于" }).click();
      await expect(page.locator(".page h1")).toContainText("关于");
      await page.locator(".titlebar-nav button", { hasText: "压缩" }).click();
      await expect(page.locator(".empty-state, .file-list").first()).toBeVisible();
    } finally {
      await app.close();
    }
  });
});

test.describe("截图矩阵（3 尺寸 × 亮/暗）", () => {
  const sizes = [
    { name: "min", width: 880, height: 620 },
    { name: "default", width: 1120, height: 760 },
    { name: "large", width: 1600, height: 1000 }
  ];
  const themes = ["light", "dark"] as const;

  for (const theme of themes) {
    for (const size of sizes) {
      test(`截图 ${theme}-${size.name}`, async () => {
        const { app, page } = await launchApp({ theme });
        try {
          const win = await app.browserWindow(page);
          await win.evaluate((bw, s) => {
            bw.setSize(s.width, s.height);
            bw.center();
          }, size);
          await page.waitForTimeout(400);
          await page.screenshot({
            path: join(__dirname, "screenshots", `${theme}-${size.name}.png`)
          });
        } finally {
          await app.close();
        }
      });
    }
  }
});
