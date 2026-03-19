import { MAX_LOG_LINES } from "../config.js";

/**
 * EventLogger 用于在页面和控制台同时输出学习日志。
 * 功能：保留固定行数的日志，帮助观察点击坐标、寻路结果和经过的格子序列。
 * 参数：无。
 * 返回值：无。
 * 注意事项：页面日志主要面向教学观察，因此会保留最近若干行；若你想看更完整的历史输出，可以同时打开浏览器控制台，因为 `log()` 会同步调用 `console.log()`。
 */
export class EventLogger {
  /**
   * constructor 创建日志器实例。
   * 功能：绑定日志显示节点，并初始化日志缓存和最大行数限制。
   * 参数：
   * - element：负责显示日志的 DOM 节点，通常是页面右侧的 `<pre>` 或可滚动文本容器。
   * - maxLines：日志最大保留行数，超过后会自动移除最旧的一条。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  constructor(element, maxLines = MAX_LOG_LINES) {
    /** element 指向页面上的日志显示节点，后续每次写日志都会更新它的文本内容。 */
    this.element = element;
    /** lines 保存当前页面上展示的日志行缓存，按时间顺序从旧到新排列。 */
    this.lines = [];
    /** maxLines 控制最多保留多少行日志，避免长时间调试时页面文本无限增长。 */
    this.maxLines = maxLines;
  }

  /**
   * log 写入一条日志。
   * 功能：生成带时间和分类前缀的日志行，同时同步到页面和浏览器控制台。
   * 参数：
   * - category：日志分类，例如“点击”“寻路”“行走”。
   * - message：日志正文。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  log(category, message) {
    // 生成一个适合中文环境阅读的 24 小时制时间字符串，作为每条日志的时间前缀。
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    // 把时间、分类和正文拼成最终显示的一整行文本。
    const line = `[${time}] [${category}] ${message}`;

    // 把新日志追加到缓存尾部，保持时间顺序正确。
    this.lines.push(line);
    // 如果日志条数超出上限，就删除最早的一条，保证页面只保留最近若干行。
    if (this.lines.length > this.maxLines) {
      this.lines.shift();
    }

    // 把缓存数组重新拼接成多行文本，更新到页面日志区域中。
    this.element.textContent = this.lines.join("\n");
    // 每次写入后自动滚动到底部，保证你能第一时间看到最新日志。
    this.element.scrollTop = this.element.scrollHeight;
    // 同时打印到浏览器控制台，方便在 DevTools 或 IDEA 调试控制台里查看历史记录。
    console.log(line);
  }

  /**
   * clear 清空所有日志。
   * 功能：重置日志缓存，并在页面上显示一条“已清空”的提示文本。
   * 参数：无。
   * 返回值：无。
   * 注意事项：清空页面日志不会清空浏览器控制台里的历史输出。
   */
  clear() {
    // 直接把缓存重置为空数组，丢弃之前保留的所有日志行。
    this.lines = [];
    // 页面上保留一条提示语，告诉用户日志区是空的，并且正在等待新的交互。
    this.element.textContent = "日志已清空，等待新的交互...";
  }
}
