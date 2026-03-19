import { WuliangshanApp } from "./app/wuliangshan-app.js";

/**
 * 本文件是独立教学 demo 的浏览器入口。
 * 功能：等待页面 DOM 结构准备完成后，再创建应用实例并启动初始化流程。
 * 参数：无。
 * 返回值：无。
 * 注意事项：这里不直接在顶层调用 `init()`，而是等到 `DOMContentLoaded` 触发，确保 HTML 中的按钮、Canvas、状态栏等节点都已经可以被 `document.getElementById` 正常获取。
 */
window.addEventListener("DOMContentLoaded", async () => {
  // 创建主应用实例，后续所有地图、寻路、相机、日志逻辑都由这个实例统一管理。
  const app = new WuliangshanApp();

  try {
    // 进入异步初始化流程：读取 XML、创建网格、拼背景、绑定事件、启动动画循环。
    await app.init();
  } catch (error) {
    // 把未知异常统一转换成人类可读的字符串，避免直接把对象显示到页面上。
    const message = error instanceof Error ? error.message : "未知错误";
    // 获取页面上负责显示初始化状态和排查信息的节点。
    const statusText = document.getElementById("statusText");
    const debugText = document.getElementById("debugText");
    const logText = document.getElementById("logText");

    // 顶部状态栏显示失败原因，并使用暖色强调这是一个需要关注的状态。
    if (statusText) {
      statusText.textContent = `初始化失败：${message}`;
      statusText.style.color = "#ffd7a0";
    }

    // 右侧调试面板给出更详细的排查提示，方便你在 IDE 或浏览器里第一时间看到问题方向。
    if (debugText) {
      debugText.textContent = [
        "场景初始化失败。",
        `错误：${message}`,
        "排查建议：请确认是通过 HTTP 服务访问页面，而不是直接双击 file:// 打开。"
      ].join("\n");
    }

    // 日志区同步记录一份失败信息，便于从页面上回溯初始化阶段是否已经抛错。
    if (logText) {
      logText.textContent = `初始化失败：${message}`;
    }

    // 控制台保留原始异常对象，方便你在浏览器开发者工具或 IDEA 调试器里查看堆栈。
    console.error(error);
  }
});
