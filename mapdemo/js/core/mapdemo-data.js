/**
 * parseWuliangshanConfig 解析无量山 XML 配置中的地图参数。
 * 功能：提取 mapdemo 查看器绘制菱形地图所需的尺寸、缩放和 Floor 参数。
 * 参数：
 * - xmlText：无量山 `config.xml` 原始文本。
 * 返回值：
 * - 对象：包含 `mapWidth`、`mapHeight`、`scale`、`mapName` 和 `floor` 等字段。
 * 注意事项：当前查看器只提取绘制和对齐底图所需字段，不会完整保留原 XML 的所有信息。
 */
export function parseWuliangshanConfig(xmlText) {
  // 有些 XML 文件前面可能带脚本式前缀，这里先清理掉，确保 DOMParser 能正常处理。
  const normalizedXml = xmlText.replace(/^\s*var\s+config:XML\s*=\s*/, "").trim();
  // 创建浏览器原生 XML 解析器。
  const parser = new DOMParser();
  // 把字符串解析成可查询的 XML DOM。
  const xml = parser.parseFromString(normalizedXml, "text/xml");

  // 如果出现 parsererror 节点，说明 XML 已经损坏或格式不合法。
  if (xml.querySelector("parsererror")) {
    throw new Error("无量山配置解析失败：XML 结构不合法。");
  }

  // 顶层 Map 节点负责提供整体地图尺寸和缩放参数。
  const mapNode = xml.querySelector("Map");
  // Floor 节点负责提供逻辑网格尺寸、格子大小和偏移量。
  const floorNode = xml.querySelector("Floor");

  // 两个核心节点任意缺失都会导致查看器无法定位网格与底图之间的关系。
  if (!mapNode || !floorNode) {
    throw new Error("无量山配置解析失败：缺少 Map 或 Floor 节点。");
  }

  // 返回一个已经整理好的轻量配置对象，供绘制层直接使用。
  return {
    // 地图名称主要用于页面信息展示。
    mapName: mapNode.getAttribute("Name") || "未命名地图",
    // 整张世界地图的像素宽度。
    mapWidth: Number(mapNode.getAttribute("MapWidth") || 0),
    // 整张世界地图的像素高度。
    mapHeight: Number(mapNode.getAttribute("MapHeight") || 0),
    // 原版小地图缩放比例，当前页面主要用于信息展示。
    scale: Number(mapNode.getAttribute("Scale") || 1),
    floor: {
      // Row 是逻辑网格横向数量。
      row: Number(floorNode.getAttribute("Row") || 0),
      // Col 是逻辑网格纵向数量。
      col: Number(floorNode.getAttribute("Col") || 0),
      // TileWidth 是单个菱形格逻辑宽度。
      tileWidth: Number(floorNode.getAttribute("TileWidth") || 0),
      // TileHeight 是单个菱形格逻辑高度。
      tileHeight: Number(floorNode.getAttribute("TileHeight") || 0),
      // halfWidth 是格子半宽，绘制时最常用。
      halfWidth: Number(floorNode.getAttribute("TileWidth") || 0) / 2,
      // halfHeight 是格子半高。
      halfHeight: Number(floorNode.getAttribute("TileHeight") || 0) / 2,
      // OffsetX 是逻辑网格 X 偏移。
      offsetX: Number(floorNode.getAttribute("OffsetX") || 0),
      // OffsetY 是逻辑网格 Y 偏移。
      offsetY: Number(floorNode.getAttribute("OffsetY") || 0)
    }
  };
}

/**
 * parseMapText 把 mapdemo 的文本网格解析成二维数组。
 * 功能：把每一行由 `0/1/2` 组成的字符串转换成数字矩阵，并统计不同值的数量。
 * 参数：
 * - text：`map1.txt` 原始文本。
 * 返回值：
 * - 对象：包含 `rowCount`、`colCount`、`grid`、`stats` 字段。
 * 注意事项：当前解析器假设每一行长度一致；如果行宽不一致，会直接抛错帮助定位数据问题。
 */
export function parseMapText(text) {
  // 先按换行拆分，并过滤掉可能存在的空白行。
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // 至少要有一行有效数据，否则无法构成地图。
  if (lines.length === 0) {
    throw new Error("mapdemo 地图解析失败：文件中没有有效行。");
  }

  // 用第一行长度作为全图列数基准。
  const colCount = lines[0].length;
  // 创建统计对象，用来记录 0、1、2 各自出现次数。
  const stats = { 0: 0, 1: 0, 2: 0 };

  // 把每一行字符转换成数字数组，形成二维矩阵。
  const grid = lines.map((line, rowIndex) => {
    // 若某一行长度和第一行不一致，说明文件格式有问题，直接中断。
    if (line.length !== colCount) {
      throw new Error(`mapdemo 地图解析失败：第 ${rowIndex + 1} 行长度异常。`);
    }

    return Array.from(line, (char, colIndex) => {
      // 把当前字符转成数字值。
      const value = Number(char);
      // 只允许 0、1、2 三种值，其他值都视为非法输入。
      if (!Number.isInteger(value) || value < 0 || value > 2) {
        throw new Error(`mapdemo 地图解析失败：第 ${rowIndex + 1} 行第 ${colIndex + 1} 列出现非法字符 ${char}。`);
      }
      // 累加统计计数，方便页面显示不同值的数量。
      stats[value] += 1;
      return value;
    });
  });

  return {
    // 行数等于有效文本行数量。
    rowCount: lines.length,
    // 列数等于每行字符数。
    colCount,
    // grid 是解析完成后的二维数字矩阵。
    grid,
    // stats 保存不同格值的出现次数。
    stats
  };
}
