import { IsoMath } from "./iso-math.js";

/**
 * GridMap 表示从 `config.xml` 解析出的地图数据。
 * 功能：保存地图尺寸、Floor 网格、传送点，以及和寻路/渲染相关的辅助方法。
 * 参数：无。
 * 返回值：无。
 * 注意事项：这里保存的是“教学 demo 运行时需要的最小地图模型”，并没有把原版 XML 的所有节点都完整复刻进来，只保留了主场景、寻路和可视化需要的部分。
 */
export class GridMap {
  /**
   * constructor 创建地图模型实例。
   * 功能：把解析好的地图配置挂到实例字段上，供渲染、寻路和坐标换算重复使用。
   * 参数：
   * - config：已经完成解析的地图配置对象，内部应包含地图尺寸、Floor 信息、二维网格数据和传送点列表。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  constructor(config) {
    /** mapName 是地图名称，例如“无量山”，主要用于调试面板展示。 */
    this.mapName = config.mapName;
    /** mapWidth 是整张地图在世界坐标中的像素宽度，单位为像素。 */
    this.mapWidth = config.mapWidth;
    /** mapHeight 是整张地图在世界坐标中的像素高度，单位为像素。 */
    this.mapHeight = config.mapHeight;
    /** scale 是原版小地图使用的缩放比例，后续绘制 M 大地图时会用到。 */
    this.scale = config.scale;
    /** offsetX 是地图整体偏移 X，当前教学版主要保留为原始配置字段。 */
    this.offsetX = config.offsetX;
    /** offsetY 是地图整体偏移 Y，当前教学版主要保留为原始配置字段。 */
    this.offsetY = config.offsetY;
    /** floor 保存菱形逻辑网格的关键信息，例如行列数、格子尺寸和偏移量。 */
    this.floor = config.floor;
    /** data 是二维网格数组，`1` 代表硬阻挡，其余值目前都视作可通行。 */
    this.data = config.data;
    /** transfers 保存地图中的传送点配置，教学版当前主要拿第一个传送点附近当出生点。 */
    this.transfers = config.transfers;
  }

  /**
   * fromXml 从原版 `config.xml` 文本构造地图对象。
   * 功能：解析 XML 文本，提取地图尺寸、Floor 网格、传送点等信息，再封装成 `GridMap` 实例。
   * 参数：
   * - xmlText：配置文件完整文本，既兼容纯 XML，也兼容前缀带有 `var config:XML =` 的写法。
   * 返回值：
   * - `GridMap`：解析完成后的地图实例。
   * 注意事项：若 XML 结构损坏、缺少关键节点或 Floor 数据长度异常，会直接抛出错误，方便上层在初始化阶段尽早发现问题。
   */
  static fromXml(xmlText) {
    // 原版有些配置文件会带 `var config:XML =` 前缀，这里先剥掉，保证 DOMParser 能正常解析。
    const normalizedXml = xmlText.replace(/^\s*var\s+config:XML\s*=\s*/, "").trim();
    // 创建浏览器原生 XML 解析器，把字符串转换成 DOM 结构。
    const parser = new DOMParser();
    // 按 XML 类型解析，方便后续用 querySelector 抓节点和属性。
    const xml = parser.parseFromString(normalizedXml, "text/xml");

    // 如果解析器生成了 parsererror 节点，说明输入文本不是合法 XML，直接抛错终止初始化。
    if (xml.querySelector("parsererror")) {
      throw new Error("地图配置解析失败：XML 结构不合法。");
    }

    // 读取顶层 Map 节点，它保存地图名称、尺寸、缩放等总体信息。
    const mapNode = xml.querySelector("Map");
    // 读取 Floor 节点，它保存菱形逻辑网格的尺寸和完整格子数据。
    const floorNode = xml.querySelector("Floor");

    // Map 或 Floor 任意缺失都无法继续运行，因为主场景和寻路都会依赖它们。
    if (!mapNode || !floorNode) {
      throw new Error("地图配置解析失败：缺少 Map 或 Floor 节点。");
    }

    // Row 表示逻辑网格的 X 方向数量，也就是二维数组第一维长度。
    const row = Number(floorNode.getAttribute("Row") || 0);
    // Col 表示逻辑网格的 Y 方向数量，也就是二维数组第二维长度。
    const col = Number(floorNode.getAttribute("Col") || 0);
    // 读取 Floor 节点里的逗号分隔文本，并把每一项都转成数字。
    const flatData = (floorNode.textContent || "")
      .trim()
      .split(",")
      .map((item) => Number(item.trim()));

    // 校验一维网格长度是否和 Row * Col 一致，避免后面索引越界或地图错位。
    if (flatData.length !== row * col) {
      throw new Error(`地图配置解析失败：Floor 网格数据长度异常，期望 ${row * col}，实际 ${flatData.length}。`);
    }

    // 把一维数组重组为二维数组，方便后续按 `data[x][y]` 读取某个逻辑格的配置值。
    const data = Array.from({ length: row }, (_, x) => {
      // 先创建当前 X 列对应的一整列数组。
      const column = new Array(col);
      for (let y = 0; y < col; y += 1) {
        // 把一维数组里属于当前 `(x, y)` 的值填回二维结构。
        column[y] = flatData[x * col + y];
      }
      return column;
    });

    // 读取所有传送点节点，并把常用字段提取出来，后续可用于出生点和教学展示。
    const transfers = Array.from(xml.querySelectorAll("Transfer")).map((node) => ({
      // id 是传送点自身编号。
      id: Number(node.getAttribute("Id") || 0),
      // x 是传送点对应的逻辑格 X。
      x: Number(node.getAttribute("X") || 0),
      // y 是传送点对应的逻辑格 Y。
      y: Number(node.getAttribute("Y") || 0),
      // name 是传送点名称，便于后续扩展 UI 标注。
      name: node.getAttribute("Name") || "",
      // nextMapId 表示这个传送点通向哪张地图。
      nextMapId: Number(node.getAttribute("NextMapId") || 0),
      // remark 保留原备注信息，便于后续继续研究原版数据。
      remark: node.getAttribute("Remark") || ""
    }));

    // 最后把解析结果统一封装成 GridMap 实例返回给上层。
    return new GridMap({
      // 读取地图名称，缺失时给一个兜底值，避免调试面板为空。
      mapName: mapNode.getAttribute("Name") || "未命名地图",
      // 读取地图世界宽度，单位像素。
      mapWidth: Number(mapNode.getAttribute("MapWidth") || 0),
      // 读取地图世界高度，单位像素。
      mapHeight: Number(mapNode.getAttribute("MapHeight") || 0),
      // 读取原版配置里的小地图缩放比例。
      scale: Number(mapNode.getAttribute("Scale") || 1),
      // 读取地图整体偏移 X。
      offsetX: Number(mapNode.getAttribute("OffsetX") || 0),
      // 读取地图整体偏移 Y。
      offsetY: Number(mapNode.getAttribute("OffsetY") || 0),
      floor: {
        // row 表示逻辑网格横向数量。
        row,
        // col 表示逻辑网格纵向数量。
        col,
        // tileWidth 是一个菱形格在逻辑公式中的完整宽度。
        tileWidth: Number(floorNode.getAttribute("TileWidth") || 0),
        // tileHeight 是一个菱形格在逻辑公式中的完整高度。
        tileHeight: Number(floorNode.getAttribute("TileHeight") || 0),
        // halfWidth 是半格宽，坐标换算时使用频率最高。
        halfWidth: Number(floorNode.getAttribute("TileWidth") || 0) / 2,
        // halfHeight 是半格高，对应菱形公式中的另一个核心参数。
        halfHeight: Number(floorNode.getAttribute("TileHeight") || 0) / 2,
        // floor 自身也带有偏移量，逻辑格与像素坐标互转时会用到。
        offsetX: Number(floorNode.getAttribute("OffsetX") || 0),
        // Y 方向偏移同理。
        offsetY: Number(floorNode.getAttribute("OffsetY") || 0)
      },
      // 挂上刚刚重建好的二维格子数组。
      data,
      // 挂上传送点列表。
      transfers
    });
  }

  /**
   * isInside 判断逻辑格是否位于地图范围内。
   * 功能：统一处理边界判断，避免多个方法重复写行列范围校验。
   * 参数：
   * - tileX：逻辑格 X。
   * - tileY：逻辑格 Y。
   * 返回值：
   * - `true/false`：是否处在合法网格区域内。
   * 注意事项：无特殊注意事项。
   */
  isInside(tileX, tileY) {
    // X 必须大于等于 0 且小于总行数，Y 必须大于等于 0 且小于总列数。
    return tileX >= 0 && tileX < this.floor.row && tileY >= 0 && tileY < this.floor.col;
  }

  /**
   * getCell 获取某个逻辑格的原始配置值。
   * 功能：读取 Floor 数据里的真实格子值，供阻挡判断和教学展示使用。
   * 参数：
   * - tileX：逻辑格 X。
   * - tileY：逻辑格 Y。
   * 返回值：
   * - 数字：原版 Floor 值；越界时按障碍处理并返回 1。
   * 注意事项：把越界统一视为阻挡，可以简化寻路和渲染逻辑，避免频繁额外写边界分支。
   */
  getCell(tileX, tileY) {
    // 只要超出地图边界，就按“硬阻挡”处理，避免后续逻辑访问非法数组索引。
    if (!this.isInside(tileX, tileY)) {
      return 1;
    }

    // 合法范围内时，直接读取二维网格里的原始值。
    return this.data[tileX][tileY];
  }

  /**
   * isPassable 判断某个逻辑格是否可通行。
   * 功能：把原始格子值转换成更直接的“能不能走”布尔结论。
   * 参数：
   * - tileX：逻辑格 X。
   * - tileY：逻辑格 Y。
   * 返回值：
   * - `true/false`：仅值为 1 的格子视为硬阻挡。
   * 注意事项：这里沿用了反编译客户端的判断习惯，即 `1` 才算硬阻挡，`2/3` 之类的值当前教学版仍按可通行处理。
   */
  isPassable(tileX, tileY) {
    // 只有在地图边界内且原始格值不等于 1 时，才算可通行。
    return this.isInside(tileX, tileY) && this.getCell(tileX, tileY) !== 1;
  }

  /**
   * getStagePoint 把逻辑格转换为世界像素坐标。
   * 功能：作为地图模型对外暴露的便捷封装，内部直接复用 `IsoMath.tileToStage`。
   * 参数：
   * - tile：包含 `x` 和 `y` 的逻辑格对象。
   * 返回值：
   * - `{ x, y }`：逻辑格中心点对应的世界坐标。
   * 注意事项：无特殊注意事项。
   */
  getStagePoint(tile) {
    // 直接调用统一的坐标换算工具，避免在业务层重复传 floor 参数和写公式。
    return IsoMath.tileToStage(tile.x, tile.y, this.floor);
  }

  /**
   * findNearestPassable 在目标格附近搜索最近的可通行格。
   * 功能：当点击落到障碍格上时，从近到远寻找一个最近的替代目标，让角色尽量贴近点击位置行走。
   * 参数：
   * - tileX：起始逻辑格 X。
   * - tileY：起始逻辑格 Y。
   * - maxRadius：最大搜索半径，单位为逻辑格。
   * 返回值：
   * - `{ x, y } | null`：找到的可通行格；若未找到则返回 null。
   * 注意事项：这里按半径逐圈搜索，并使用曼哈顿距离挑选同一圈里更接近中心的候选格，教学上比一次性暴力扫更容易理解。
   */
  findNearestPassable(tileX, tileY, maxRadius = 24) {
    // 如果原始目标格本身就能走，直接返回它，避免做多余搜索。
    if (this.isPassable(tileX, tileY)) {
      return { x: tileX, y: tileY };
    }

    // 从半径 1 开始一圈圈向外扩散，直到达到最大搜索半径。
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      // best 用来记录当前半径里找到的最佳候选格。
      let best = null;
      // bestScore 用来记录当前最佳候选与中心点的距离分数，越小越优。
      let bestScore = Number.POSITIVE_INFINITY;

      // 枚举当前半径覆盖的所有 dx 偏移。
      for (let dx = -radius; dx <= radius; dx += 1) {
        // 枚举当前半径覆盖的所有 dy 偏移。
        for (let dy = -radius; dy <= radius; dy += 1) {
          // 根据偏移量算出候选格的 X。
          const x = tileX + dx;
          // 根据偏移量算出候选格的 Y。
          const y = tileY + dy;

          // 不可走的格子直接略过，不参与比较。
          if (!this.isPassable(x, y)) {
            continue;
          }

          // 使用曼哈顿距离作为简单评分，越靠近原始目标的格子分数越低。
          const score = Math.abs(dx) + Math.abs(dy);
          // 如果当前候选更近，就替换为新的最佳候选。
          if (score < bestScore) {
            bestScore = score;
            best = { x, y };
          }
        }
      }

      // 只要这一圈已经找到合法候选，就可以提前返回，不必继续向更远处搜索。
      if (best) {
        return best;
      }
    }

    // 所有半径都找不到可走格时，返回 null 让上层决定如何提示用户。
    return null;
  }

  /**
   * forEachTile 遍历全部逻辑格。
   * 功能：为网格绘制、阻挡着色和调试渲染提供统一遍历入口。
   * 参数：
   * - callback：每个格子都会调用一次，参数依次为格对象和原始格值。
   * 返回值：无。
   * 注意事项：回调会被大量调用，若在其中做重计算，可能影响大地图和网格渲染性能。
   */
  forEachTile(callback) {
    // 逐行遍历所有逻辑格的 X 坐标。
    for (let x = 0; x < this.floor.row; x += 1) {
      // 在当前 X 下，再逐列遍历所有 Y 坐标。
      for (let y = 0; y < this.floor.col; y += 1) {
        // 把当前位置的格坐标对象和原始格值一起交给外部回调处理。
        callback({ x, y }, this.data[x][y]);
      }
    }
  }
}
