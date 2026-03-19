import { MapDemoViewerApp } from "./app/mapdemo-viewer-app.js";

/**
 * 当前文件是 mapdemo 查看器的浏览器入口。
 * 功能：等待 DOM 就绪后创建应用实例，并统一处理初始化失败场景。
 * 参数：无。
 * 返回值：无。
 * 注意事项：这里把错误展示也放到页面里，方便你在不打开控制台的情况下快速定位资源或参数问题。
 */
window.addEventListener("DOMContentLoaded", async () => {
  // 创建查看器主应用实例，后续所有资源加载和交互都由它统一管理。
  const app = new MapDemoViewerApp();

  try {
    // 启动异步初始化流程。
    await app.init();
  } catch (error) {
    // 把未知错误转换成人类可读字符串，避免页面直接显示对象结构。
    const message = error instanceof Error ? error.message : "未知错误";
    // 获取状态栏和信息面板节点，用于显示失败信息。
    const statusText = document.getElementById("appStatus");
    const infoPanel = document.getElementById("infoPanel");

    // 顶部状态栏显示初始化失败原因。
    if (statusText) {
      statusText.textContent = `初始化失败：${message}`;
    }

    // 信息面板补充一份更详细的排查提示。
    if (infoPanel) {
      infoPanel.textContent = [
        `初始化失败：${message}`,
        "排查建议：请确认当前页面是通过 HTTP 访问，而不是直接用 file:// 打开。",
        "若是通过 nginx 访问，请确认 sandbox/mapdemo 和 sandbox/wuliangshan-h5-demo 目录都能正常读取。"
      ].join("\n");
    }

    // 控制台保留原始异常，方便在 IDE 或浏览器调试器里看堆栈。
    console.error(error);
  }
});
