import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InstallError } from "../errors.js";
import {
  installWindowsVips,
  installMacOSVips,
  sha256File,
  verifySha256
} from "../installer.js";

let root: string;

beforeAll(async () => {
  root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vt-install-"));
});

afterAll(async () => {
  await fs.promises.rm(root, { recursive: true, force: true });
});

describe("sha256File / verifySha256", () => {
  it("计算结果与 crypto 一致", async () => {
    const file = path.join(root, "hash.bin");
    const content = Buffer.from("vips-thumbnail 哈希测试");
    await fs.promises.writeFile(file, content);
    const expected = crypto.createHash("sha256").update(content).digest("hex");
    expect(await sha256File(file)).toBe(expected);
    expect(await verifySha256(file, expected)).toBe(true);
    expect(await verifySha256(file, expected.toUpperCase())).toBe(true);
    expect(await verifySha256(file, "0".repeat(64))).toBe(false);
  });
});

describe("installWindowsVips（注入 downloader/unzipper）", () => {
  it("SHA-256 校验失败时抛错且不执行解压", async () => {
    const cacheRoot = path.join(root, "cache-badhash");
    let unzipCalled = false;
    await expect(
      installWindowsVips({
        cacheRoot,
        url: "https://example.invalid/vips.zip",
        sha256: "0".repeat(64),
        skipArchCheck: true,
        downloader: async (_url, dest) => {
          await fs.promises.writeFile(dest, "恶意内容");
        },
        unzipper: async () => {
          unzipCalled = true;
        }
      })
    ).rejects.toThrow(InstallError);
    expect(unzipCalled).toBe(false);
    // 临时压缩包已清理
    const leftovers = (await fs.promises.readdir(cacheRoot)).filter(n =>
      n.endsWith(".zip")
    );
    expect(leftovers).toHaveLength(0);
  });

  it("解压后缺少 vips.exe 时报 extract 阶段错误", async () => {
    const cacheRoot = path.join(root, "cache-noexe");
    const payload = Buffer.from("fake zip");
    const hash = crypto.createHash("sha256").update(payload).digest("hex");
    await expect(
      installWindowsVips({
        cacheRoot,
        url: "https://example.invalid/vips.zip",
        sha256: hash,
        skipArchCheck: true,
        downloader: async (_url, dest) => {
          await fs.promises.writeFile(dest, payload);
        },
        unzipper: async (_src, dest) => {
          await fs.promises.mkdir(dest, { recursive: true });
        }
      })
    ).rejects.toThrow("压缩引擎安装包中未找到可执行文件");
  });

  it("取消信号在下载前生效", async () => {
    const controller = new AbortController();
    controller.abort();
    let downloadCalled = false;
    await expect(
      installWindowsVips({
        cacheRoot: path.join(root, "cache-abort"),
        sha256: "0".repeat(64),
        skipArchCheck: true,
        signal: controller.signal,
        downloader: async () => {
          downloadCalled = true;
        },
        unzipper: async () => {}
      })
    ).rejects.toThrow("任务已取消");
    expect(downloadCalled).toBe(false);
  });

  it("进度回调按阶段推进", async () => {
    const cacheRoot = path.join(root, "cache-progress");
    const payload = Buffer.from("fake zip 2");
    const hash = crypto.createHash("sha256").update(payload).digest("hex");
    const phases: string[] = [];
    await installWindowsVips({
      cacheRoot,
      sha256: hash,
      skipArchCheck: true,
      onProgress: p => {
        if (!phases.includes(p.phase)) phases.push(p.phase);
      },
      downloader: async (_url, dest, cb) => {
        cb?.onProgress?.(50, 100);
        await fs.promises.writeFile(dest, payload);
      },
      unzipper: async (_src, dest) => {
        // 构造合法目录结构 + 可执行文件（.bat 模拟 vips.exe 不可行，直接放 node 也复杂）
        // 这里放一个真实可运行的 cmd 壳：直接复制 node.exe 代价太大，改为期望 finalize 失败即可
        const bin = path.join(dest, "vips-dev-8.18", "bin");
        await fs.promises.mkdir(bin, { recursive: true });
        await fs.promises.writeFile(path.join(bin, "vips.exe"), "not a real exe");
      }
    }).catch(() => {
      /* finalize 阶段失败是预期的（假 exe 无法运行） */
    });
    expect(phases).toEqual(["download", "verify", "extract", "finalize"]);
  });
});

describe("installMacOSVips（经 Homebrew，伪造 brew 注入）", () => {
  /** 写一个假的 vips 可执行脚本：--version 打印版本即视为可运行 */
  async function writeFakeVips(prefix: string): Promise<string> {
    const bin = path.join(prefix, "bin");
    await fs.promises.mkdir(bin, { recursive: true });
    const vips = path.join(bin, "vips");
    await fs.promises.writeFile(
      vips,
      '#!/bin/sh\necho "vips-8.18.0"\n',
      { mode: 0o755 }
    );
    return vips;
  }

  /** 写假的 brew 脚本；install 分支可指定行为（创建 vips / 报错） */
  async function writeFakeBrew(
    prefix: string,
    onInstall: "create" | "fail"
  ): Promise<string> {
    const brew = path.join(root, `brew-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const script = `#!/bin/sh
if [ "$1" = "--prefix" ]; then
  echo "${prefix}"
  exit 0
fi
if [ "$1" = "install" ]; then
  if [ "${onInstall}" = "create" ]; then
    mkdir -p "${prefix}/bin"
    printf '#!/bin/sh\\necho "vips-8.18.0"\\n' > "${prefix}/bin/vips"
    chmod +x "${prefix}/bin/vips"
    exit 0
  else
    echo "UNEXPECTED install" >&2
    exit 1
  fi
fi
exit 0
`;
    await fs.promises.writeFile(brew, script, { mode: 0o755 });
    return brew;
  }

  it("未找到 brew 时抛 InstallError 并提示 Homebrew", async () => {
    await expect(
      installMacOSVips({ brew: path.join(root, "no-such-brew") })
    ).rejects.toThrow(InstallError);
    await expect(
      installMacOSVips({ brew: path.join(root, "no-such-brew") })
    ).rejects.toThrow(/Homebrew/);
  });

  it("已安装时直接复用，不触发 brew install", async () => {
    const prefix = path.join(root, "mac-ready");
    const vips = await writeFakeVips(prefix);
    const brew = await writeFakeBrew(prefix, "fail");
    const result = await installMacOSVips({ brew });
    expect(result).toBe(vips);
  });

  it("未安装时经 brew install 完成安装并返回 vips 路径", async () => {
    const prefix = path.join(root, "mac-install");
    // 仅创建前缀目录，但不放 vips，模拟未安装状态
    await fs.promises.mkdir(prefix, { recursive: true });
    const brew = await writeFakeBrew(prefix, "create");
    const result = await installMacOSVips({ brew });
    expect(result).toBe(path.join(prefix, "bin", "vips"));
    expect(fs.existsSync(result)).toBe(true);
  });

  it("取消信号在 brew --prefix 前生效", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      installMacOSVips({
        brew: await writeFakeBrew(path.join(root, "mac-abort"), "fail"),
        signal: controller.signal
      })
    ).rejects.toThrow("任务已取消");
  });
});
