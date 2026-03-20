import {
  AXIS_STROKE_STYLE,
  BACKGROUND_BOUNDS_STROKE_STYLE,
  BACKGROUND_TILE_SIZE,
  DEFAULT_BACKGROUND_OPACITY,
  DEFAULT_OVERLAY_OPACITY,
  DEFAULT_ZOOM_PADDING,
  EMPTY_TILE_FILL_STYLE,
  EMPTY_TILE_STROKE_STYLE,
  GRID_BOUNDS_STROKE_STYLE,
  GRID_FILL_STYLE,
  GRID_STROKE_STYLE,
  HOVER_CENTER_FILL_STYLE,
  HOVER_CENTER_RADIUS,
  HOVER_LABEL_FILL_STYLE,
  HOVER_LABEL_FONT,
  HOVER_LABEL_STROKE_STYLE,
  HOVER_TILE_FILL_STYLE,
  HOVER_TILE_STROKE_STYLE,
  MAP_TEXT_URL,
  MAX_SCALE,
  MIN_SCALE,
  SPECIAL_FILL_STYLE,
  SPECIAL_STROKE_STYLE,
  TILE_LABEL_FILL_STYLE,
  TILE_LABEL_FONT,
  TILE_LABEL_MIN_SCALE,
  TILE_LABEL_STROKE_STYLE,
  WULIANGSHAN_CONFIG_URL,
  WULIANGSHAN_RESOURCE_ROOT
} from "../config.js";
import { IsoMath } from "../core/iso-math.js";
import { parseMapText, parseWuliangshanConfig } from "../core/mapdemo-data.js";

/**
 * MapDemoViewerApp 负责驱动 mapdemo 的 45 度地图查看器。
 * 功能：加载无量山参数和 map1.txt 网格，绘制完整 211x211 菱形地图，叠加无量山底图，并提供缩放、拖拽、格子悬停与坐标观察能力。
 * 参数：无。
 * 返回值：无。
 * 注意事项：这个类是纯查看器，不负责寻路和角色移动；它的重点是让你观察“完整逻辑网格、底图矩形、世界原点、悬停格中心点”四者之间如何对应。
 */
export class MapDemoViewerApp {
  /**
   * constructor 绑定页面节点并初始化运行时状态。
   * 功能：收集 DOM 引用，准备静态绘制层和动态交互层的上下文，等待 `init()` 统一启动。
   * 参数：无。
   * 返回值：无。
   * 注意事项：构造函数不做异步请求，真正加载地图和底图的工作放在 `init()` 中进行。
   */
  constructor() {
    /** viewport 是主查看窗口，缩放、拖拽和悬停命中都以它为交互容器。 */
    this.viewport = document.getElementById("viewport");
    /** world 是整张地图的世界层容器，内部会挂背景层、静态覆盖层、动态交互层和原点标记。 */
    this.world = document.getElementById("world");
    /** backgroundLayer 是无量山底图切片层，专门用于对照偏移。 */
    this.backgroundLayer = document.getElementById("backgroundLayer");
    /** overlayCanvas 是静态网格绘制层，负责一次性画出完整 mapdemo 网格、原点参考轴和边界框。 */
    this.overlayCanvas = document.getElementById("overlayCanvas");
    /** overlayContext 是静态网格层对应的 2D 上下文。 */
    this.overlayContext = this.overlayCanvas.getContext("2d");
    /** interactionCanvas 是动态交互层，专门负责悬停高亮、中心点标记和放大后的格子坐标。 */
    this.interactionCanvas = document.getElementById("interactionCanvas");
    /** interactionContext 是动态交互层对应的 2D 上下文。 */
    this.interactionContext = this.interactionCanvas.getContext("2d");
    /** originMarker 是世界原点提示点，帮助观察 `(0, 0)` 在底图和完整网格中的位置。 */
    this.originMarker = document.getElementById("originMarker");
    /** statusText 是顶部状态栏。 */
    this.statusText = document.getElementById("appStatus");
    /** infoPanel 是右侧参数信息面板，用来展示底图范围、网格范围和当前视图参数。 */
    this.infoPanel = document.getElementById("infoPanel");
    /** hoverInfoPanel 是右侧悬停信息面板，用来展示当前选中格的详细坐标。 */
    this.hoverInfoPanel = document.getElementById("hoverInfoPanel");
    /** overlayOpacityInput 是覆盖层透明度滑块。 */
    this.overlayOpacityInput = document.getElementById("overlayOpacityInput");
    /** overlayOpacityValue 是覆盖层透明度数值显示。 */
    this.overlayOpacityValue = document.getElementById("overlayOpacityValue");
    /** backgroundOpacityInput 是底图透明度滑块。 */
    this.backgroundOpacityInput = document.getElementById("backgroundOpacityInput");
    /** backgroundOpacityValue 是底图透明度数值显示。 */
    this.backgroundOpacityValue = document.getElementById("backgroundOpacityValue");
    /** showBackgroundCheckbox 控制是否显示无量山底图。 */
    this.showBackgroundCheckbox = document.getElementById("showBackgroundCheckbox");
    /** showOverlayCheckbox 控制是否显示 mapdemo 静态网格层和动态交互层。 */
    this.showOverlayCheckbox = document.getElementById("showOverlayCheckbox");
    /** resetViewButton 用于恢复默认视图。 */
    this.resetViewButton = document.getElementById("resetViewButton");

    /** floorConfig 保存无量山解析后的地图与 Floor 参数。 */
    this.floorConfig = null;
    /** mapData 保存 map1.txt 解析后的二维数字网格。 */
    this.mapData = null;
    /** backgroundBounds 保存无量山底图在世界坐标中的矩形范围。 */
    this.backgroundBounds = null;
    /** gridBounds 保存完整 211x211 菱形网格投影后的外包范围。 */
    this.gridBounds = null;
    /** worldBounds 保存“底图范围”和“完整网格范围”的并集外包矩形。 */
    this.worldBounds = null;
    /** stageOffset 保存把世界坐标整体平移到可见正坐标区域所需的偏移量。 */
    this.stageOffset = { x: 0, y: 0 };
    /** overlayOpacity 保存当前覆盖层透明度，范围 0~1。 */
    this.overlayOpacity = DEFAULT_OVERLAY_OPACITY;
    /** backgroundOpacity 保存当前底图透明度，范围 0~1。 */
    this.backgroundOpacity = DEFAULT_BACKGROUND_OPACITY;
    /** scale 保存当前世界层缩放倍率。 */
    this.scale = 1;
    /** panX 保存世界层相对视口左上角的平移量。 */
    this.panX = 0;
    /** panY 保存世界层相对视口上边的平移量。 */
    this.panY = 0;
    /** dragState 保存当前拖拽过程中的起点数据；未拖拽时为 null。 */
    this.dragState = null;
    /** hoveredTile 保存当前鼠标命中的逻辑格坐标；未命中时为 null。 */
    this.hoveredTile = null;
  }

  /**
   * init 初始化查看器。
   * 功能：加载参数和网格、计算完整投影范围、构建底图层、绘制完整菱形地图、绑定交互事件，并设置初始视图。
   * 参数：无。
   * 返回值：`Promise<void>`。
   * 注意事项：如果网格尺寸和无量山 Floor 行列不一致，会直接抛错，因为这会导致对照偏移失去意义。
   */
  async init() {
    // 先同步透明度控件的初始数值，让界面一进来就和内部状态一致。
    this.syncOpacityControls();
    // 同步悬停信息面板的默认提示，避免刷新时显示旧内容。
    this.updateHoverInfoPanel();
    // 顶部先提示当前正在加载资源，避免用户误以为页面卡住。
    this.setStatus("正在读取 mapdemo 网格和无量山参数...");

    // 并行读取无量山配置 XML 和 map1.txt 文本网格，缩短初始化等待时间。
    const [configResponse, mapTextResponse] = await Promise.all([
      fetch(WULIANGSHAN_CONFIG_URL),
      fetch(MAP_TEXT_URL)
    ]);

    // 无量山配置请求失败时直接中断，因为后续世界尺寸和菱形参数都依赖它。
    if (!configResponse.ok) {
      throw new Error(`无量山配置加载失败，HTTP 状态码 ${configResponse.status}`);
    }
    // map1.txt 请求失败时也直接中断，因为当前查看器的主体轮廓就来自它。
    if (!mapTextResponse.ok) {
      throw new Error(`map1.txt 加载失败，HTTP 状态码 ${mapTextResponse.status}`);
    }

    // 把响应体分别读成纯文本，后面会交给各自的解析器处理。
    const [configText, mapText] = await Promise.all([configResponse.text(), mapTextResponse.text()]);
    // 解析无量山地图尺寸、格子大小和偏移量。
    this.floorConfig = parseWuliangshanConfig(configText);
    // 解析 map1.txt 的 0/1/2 二维矩阵。
    this.mapData = parseMapText(mapText);

    // 如果 map1.txt 的行列和无量山 Floor 不一致，就不再继续，因为无法按同一套参数比较偏移。
    if (
      this.mapData.rowCount !== this.floorConfig.floor.row ||
      this.mapData.colCount !== this.floorConfig.floor.col
    ) {
      throw new Error(
        `网格尺寸不匹配：map1.txt 为 ${this.mapData.rowCount}x${this.mapData.colCount}，无量山 Floor 为 ${this.floorConfig.floor.row}x${this.floorConfig.floor.col}。`
      );
    }

    // 先计算完整 211x211 网格投影后的边界，以及它和底图矩形的并集范围。
    this.computeWorldBounds();
    // 根据并集范围初始化世界层、底图层、静态覆盖层和动态交互层的尺寸与偏移。
    this.setupWorldSize();
    // 构建无量山底图切片层，让你能直接观察底图在完整网格中的相对位置。
    await this.buildBackgroundLayer();
    // 按无量山参数把 map1.txt 的全部格子绘制成完整的菱形 45 度网格静态层。
    this.drawOverlayMap();
    // 根据当前勾选状态和透明度设置应用可见性。
    this.applyLayerVisualState();
    // 绑定拖拽、缩放、复位、透明度调节和悬停命中事件。
    this.bindEvents();
    // 更新右侧信息面板，展示当前地图和参数摘要。
    this.updateInfoPanel();
    // 初始渲染一次交互层，保证第一次进入页面时状态是干净的。
    this.renderInteractionLayer();
    // 等浏览器完成一次布局后，再根据视口大小重置视图到合适位置。
    requestAnimationFrame(() => this.resetView());
    // 通知用户当前页面已经准备完成，并强调“全部格子都会画出来、放大后会显示坐标”。
    this.setStatus("完整 211x211 菱形网格已绘制。按住 Ctrl + 滚轮缩放，放大后会显示格子坐标；鼠标悬停格子可查看中心点屏幕坐标。");
  }

  /**
   * computeWorldBounds 计算完整网格和底图的世界范围。
   * 功能：把所有逻辑格投影到世界坐标后，算出完整菱形网格外包框，再与底图矩形取并集，得到最终世界容器范围。
   * 参数：无。
   * 返回值：无。
   * 注意事项：这是查看器的关键步骤，因为只有把世界扩成并集范围，才能看到“超出底图”的完整格子。
   */
  computeWorldBounds() {
    const { floor, mapWidth, mapHeight } = this.floorConfig;
    let minGridX = Number.POSITIVE_INFINITY;
    let minGridY = Number.POSITIVE_INFINITY;
    let maxGridX = Number.NEGATIVE_INFINITY;
    let maxGridY = Number.NEGATIVE_INFINITY;

    for (let tileX = 0; tileX < this.mapData.rowCount; tileX += 1) {
      for (let tileY = 0; tileY < this.mapData.colCount; tileY += 1) {
        const center = IsoMath.tileToStage(tileX, tileY, floor);
        const left = center.x - floor.halfWidth;
        const right = center.x + floor.halfWidth;
        const top = center.y - floor.halfHeight;
        const bottom = center.y + floor.halfHeight;

        minGridX = Math.min(minGridX, left);
        minGridY = Math.min(minGridY, top);
        maxGridX = Math.max(maxGridX, right);
        maxGridY = Math.max(maxGridY, bottom);
      }
    }

    this.backgroundBounds = {
      minX: 0,
      minY: 0,
      maxX: mapWidth,
      maxY: mapHeight,
      width: mapWidth,
      height: mapHeight
    };

    this.gridBounds = {
      minX: minGridX,
      minY: minGridY,
      maxX: maxGridX,
      maxY: maxGridY,
      width: maxGridX - minGridX,
      height: maxGridY - minGridY
    };

    const worldMinX = Math.min(this.backgroundBounds.minX, this.gridBounds.minX);
    const worldMinY = Math.min(this.backgroundBounds.minY, this.gridBounds.minY);
    const worldMaxX = Math.max(this.backgroundBounds.maxX, this.gridBounds.maxX);
    const worldMaxY = Math.max(this.backgroundBounds.maxY, this.gridBounds.maxY);

    this.worldBounds = {
      minX: worldMinX,
      minY: worldMinY,
      maxX: worldMaxX,
      maxY: worldMaxY,
      width: worldMaxX - worldMinX,
      height: worldMaxY - worldMinY
    };

    this.stageOffset = {
      x: -this.worldBounds.minX,
      y: -this.worldBounds.minY
    };
  }
  /**
   * setupWorldSize 设置世界层、底图层、静态覆盖层和动态交互层尺寸。
   * 功能：让 DOM 世界层和 Canvas 使用“并集范围”作为画布，同时把底图层偏移到它在完整世界中的真实位置。
   * 参数：无。
   * 返回值：无。
   * 注意事项：该方法依赖 `computeWorldBounds()` 已经先算好并集范围和偏移量。
   */
  setupWorldSize() {
    const { width: worldWidth, height: worldHeight } = this.worldBounds;
    this.world.style.width = `${worldWidth}px`;
    this.world.style.height = `${worldHeight}px`;

    this.backgroundLayer.style.width = `${this.backgroundBounds.width}px`;
    this.backgroundLayer.style.height = `${this.backgroundBounds.height}px`;
    this.backgroundLayer.style.left = `${this.stageOffset.x}px`;
    this.backgroundLayer.style.top = `${this.stageOffset.y}px`;
    this.backgroundLayer.style.right = "auto";
    this.backgroundLayer.style.bottom = "auto";

    this.overlayCanvas.width = worldWidth;
    this.overlayCanvas.height = worldHeight;
    this.overlayCanvas.style.width = `${worldWidth}px`;
    this.overlayCanvas.style.height = `${worldHeight}px`;

    this.interactionCanvas.width = worldWidth;
    this.interactionCanvas.height = worldHeight;
    this.interactionCanvas.style.width = `${worldWidth}px`;
    this.interactionCanvas.style.height = `${worldHeight}px`;

    this.originMarker.style.left = `${this.stageOffset.x}px`;
    this.originMarker.style.top = `${this.stageOffset.y}px`;
  }

  /**
   * buildBackgroundLayer 构建无量山底图切片层。
   * 功能：按 `x_y.jpg` 规则把 sandbox 中的无量山底图切片拼回整张底图矩形。
   * 参数：无。
   * 返回值：`Promise<void>`。
   * 注意事项：这里使用的是沙箱里的资源副本，不会读取原项目目录。
   */
  async buildBackgroundLayer() {
    const fragment = document.createDocumentFragment();
    const tilesX = Math.ceil(this.backgroundBounds.width / BACKGROUND_TILE_SIZE);
    const tilesY = Math.ceil(this.backgroundBounds.height / BACKGROUND_TILE_SIZE);

    for (let x = 0; x < tilesX; x += 1) {
      for (let y = 0; y < tilesY; y += 1) {
        const image = document.createElement("img");
        image.src = `${WULIANGSHAN_RESOURCE_ROOT}${x}_${y}.jpg`;
        image.alt = "";
        image.loading = "lazy";
        image.style.left = `${x * BACKGROUND_TILE_SIZE}px`;
        image.style.top = `${y * BACKGROUND_TILE_SIZE}px`;
        fragment.appendChild(image);
      }
    }

    this.backgroundLayer.replaceChildren(fragment);
  }

  /**
   * projectStagePoint 把世界坐标点映射到并集画布坐标。
   * 功能：给所有菱形格和参考线统一套上一层 stageOffset，使原本可能为负数的世界坐标落到画布可见区域中。
   * 参数：
   * - stagePoint：原始世界坐标点。
   * 返回值：
   * - `{ x, y }`：可直接绘制到画布上的正坐标点。
   * 注意事项：这里的结果是“并集画布坐标”，还没有叠加当前视图缩放和平移。
   */
  projectStagePoint(stagePoint) {
    return {
      x: stagePoint.x + this.stageOffset.x,
      y: stagePoint.y + this.stageOffset.y
    };
  }

  /**
   * canvasPointToStage 把并集画布坐标还原成原始世界坐标。
   * 功能：在鼠标命中测试时，把画布上的点减去 stageOffset，得到真正参与等角公式运算的世界坐标。
   * 参数：
   * - canvasPoint：并集画布坐标点。
   * 返回值：
   * - `{ x, y }`：原始世界坐标点。
   * 注意事项：这里的世界坐标仍然不包含视口平移和缩放。
   */
  canvasPointToStage(canvasPoint) {
    return {
      x: canvasPoint.x - this.stageOffset.x,
      y: canvasPoint.y - this.stageOffset.y
    };
  }

  /**
   * viewportPointToCanvas 把视口坐标换算成并集画布坐标。
   * 功能：根据当前 pan 和 scale，把鼠标在视口里的位置反推成世界层内部未缩放前的坐标。
   * 参数：
   * - viewportX：鼠标相对视口左边的像素坐标。
   * - viewportY：鼠标相对视口上边的像素坐标。
   * 返回值：
   * - `{ x, y }`：落在世界层内部的并集画布坐标。
   * 注意事项：这是“屏幕坐标 -> 世界画布坐标”链路中的第一步。
   */
  viewportPointToCanvas(viewportX, viewportY) {
    return {
      x: (viewportX - this.panX) / this.scale,
      y: (viewportY - this.panY) / this.scale
    };
  }

  /**
   * isTileInBounds 判断某个逻辑格是否落在 map1.txt 有效范围内。
   * 功能：避免绘制或命中时访问越界数组。
   * 参数：
   * - tileX：逻辑格 X。
   * - tileY：逻辑格 Y。
   * 返回值：
   * - `boolean`：在范围内返回 `true`，否则返回 `false`。
   * 注意事项：无特殊注意事项。
   */
  isTileInBounds(tileX, tileY) {
    return tileX >= 0 && tileX < this.mapData.rowCount && tileY >= 0 && tileY < this.mapData.colCount;
  }

  /**
   * resolveTileValue 读取指定逻辑格的原始值。
   * 功能：统一从二维数组中取出 `0/1/2`，供悬停信息和标签展示使用。
   * 参数：
   * - tileX：逻辑格 X。
   * - tileY：逻辑格 Y。
   * 返回值：
   * - 数字值 `0/1/2`；若越界则返回 `null`。
   * 注意事项：无特殊注意事项。
   */
  resolveTileValue(tileX, tileY) {
    if (!this.isTileInBounds(tileX, tileY)) {
      return null;
    }

    return this.mapData.grid[tileX][tileY];
  }

  /**
   * getTileDisplayData 计算某个格子在多个坐标系下的关键位置。
   * 功能：统一求出逻辑格中心点的世界坐标、画布坐标、视口坐标和浏览器坐标，供绘制与信息面板复用。
   * 参数：
   * - tileX：逻辑格 X。
   * - tileY：逻辑格 Y。
   * 返回值：
   * - 包含 `value`、`centerStage`、`centerCanvas`、`centerViewport`、`centerClient` 的对象；若越界则返回 `null`。
   * 注意事项：这里的“屏幕坐标”拆成了“视口内坐标”和“浏览器 client 坐标”，方便你分别观察。
   */
  getTileDisplayData(tileX, tileY) {
    if (!this.isTileInBounds(tileX, tileY)) {
      return null;
    }

    const value = this.resolveTileValue(tileX, tileY);
    const centerStage = IsoMath.tileToStage(tileX, tileY, this.floorConfig.floor);
    const centerCanvas = this.projectStagePoint(centerStage);
    const centerViewport = {
      x: this.panX + centerCanvas.x * this.scale,
      y: this.panY + centerCanvas.y * this.scale
    };
    const viewportRect = this.viewport.getBoundingClientRect();
    const centerClient = {
      x: viewportRect.left + centerViewport.x,
      y: viewportRect.top + centerViewport.y
    };

    return {
      value,
      centerStage,
      centerCanvas,
      centerViewport,
      centerClient
    };
  }

  /**
   * findTileUnderStagePoint 根据世界点寻找真正命中的格子。
   * 功能：先用逆公式求出原始逻辑浮点坐标，再检查附近候选格的菱形包含关系，得到鼠标当前真正落入的格子。
   * 参数：
   * - stageX：原始世界 X。
   * - stageY：原始世界 Y。
   * 返回值：
   * - `{ tileX, tileY, rawTileX, rawTileY }`：命中的逻辑格和原始浮点结果；未命中时返回 `null`。
   * 注意事项：该方法不会把鼠标吸附到最近边界外的格子，只有真正落入某个菱形内部才算命中。
   */
  findTileUnderStagePoint(stageX, stageY) {
    const rawTile = IsoMath.stageToTile(stageX, stageY, this.floorConfig.floor);
    const startTileX = Math.floor(rawTile.tileX) - 1;
    const endTileX = Math.floor(rawTile.tileX) + 1;
    const startTileY = Math.floor(rawTile.tileY) - 1;
    const endTileY = Math.floor(rawTile.tileY) + 1;
    let best = null;

    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
        if (!this.isTileInBounds(tileX, tileY)) {
          continue;
        }

        const centerStage = IsoMath.tileToStage(tileX, tileY, this.floorConfig.floor);
        const normalizedX = Math.abs(stageX - centerStage.x) / this.floorConfig.floor.halfWidth;
        const normalizedY = Math.abs(stageY - centerStage.y) / this.floorConfig.floor.halfHeight;
        const diamondDistance = normalizedX + normalizedY;

        if (diamondDistance <= 1.0001) {
          if (!best || diamondDistance < best.diamondDistance) {
            best = { tileX, tileY, diamondDistance };
          }
        }
      }
    }

    if (!best) {
      return null;
    }

    return {
      tileX: best.tileX,
      tileY: best.tileY,
      rawTileX: rawTile.tileX,
      rawTileY: rawTile.tileY
    };
  }
  /**
   * drawOverlayMap 把 map1.txt 绘制成完整菱形 45 度地图。
   * 功能：按照无量山的格子尺寸和偏移量，把全部 211x211 格子都画出来，并额外标出底图边界、完整网格外包范围以及世界原点参考轴。
   * 参数：无。
   * 返回值：无。
   * 注意事项：本方法不再只绘制 `1/2`，而是把 `0/1/2` 全部格子都绘制出来，方便观察完整投影关系。
   */
  drawOverlayMap() {
    const ctx = this.overlayContext;
    const { floor } = this.floorConfig;

    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    ctx.save();
    ctx.lineWidth = 1;

    for (let tileX = 0; tileX < this.mapData.rowCount; tileX += 1) {
      for (let tileY = 0; tileY < this.mapData.colCount; tileY += 1) {
        const value = this.mapData.grid[tileX][tileY];
        const stageCenter = IsoMath.tileToStage(tileX, tileY, floor);
        const canvasCenter = this.projectStagePoint(stageCenter);
        IsoMath.traceDiamondPath(ctx, canvasCenter, floor.halfWidth, floor.halfHeight);

        if (value === 2) {
          ctx.fillStyle = SPECIAL_FILL_STYLE;
          ctx.strokeStyle = SPECIAL_STROKE_STYLE;
        } else if (value === 1) {
          ctx.fillStyle = GRID_FILL_STYLE;
          ctx.strokeStyle = GRID_STROKE_STYLE;
        } else {
          ctx.fillStyle = EMPTY_TILE_FILL_STYLE;
          ctx.strokeStyle = EMPTY_TILE_STROKE_STYLE;
        }

        ctx.fill();
        ctx.stroke();
      }
    }

    this.drawOriginAxes(ctx);
    this.drawBackgroundBounds(ctx);
    this.drawGridBounds(ctx);
    ctx.restore();
  }

  /**
   * drawOriginAxes 绘制通过世界原点的参考轴。
   * 功能：在完整并集画布上画出穿过原点的水平线和垂直线，帮助观察 `(0,0)` 位于底图和网格的什么位置。
   * 参数：
   * - context：静态覆盖层 Canvas 的 2D 上下文。
   * 返回值：无。
   * 注意事项：这两条线只是调试辅助线，不参与任何寻路或逻辑计算。
   */
  drawOriginAxes(context) {
    const originX = this.stageOffset.x;
    const originY = this.stageOffset.y;

    context.save();
    context.strokeStyle = AXIS_STROKE_STYLE;
    context.lineWidth = 1.5;
    context.setLineDash([8, 6]);

    context.beginPath();
    context.moveTo(0, originY);
    context.lineTo(this.overlayCanvas.width, originY);
    context.stroke();

    context.beginPath();
    context.moveTo(originX, 0);
    context.lineTo(originX, this.overlayCanvas.height);
    context.stroke();

    context.setLineDash([]);
    context.fillStyle = "rgba(255, 255, 255, 0.95)";
    context.font = "18px 'Microsoft YaHei UI', sans-serif";
    context.fillText("Origin (0, 0)", originX + 18, originY - 18);
    context.restore();
  }

  /**
   * drawBackgroundBounds 绘制底图世界边界框。
   * 功能：把无量山底图的 `4200 x 4200` 世界矩形单独勾勒出来，方便和完整网格范围对照。
   * 参数：
   * - context：静态覆盖层 Canvas 的 2D 上下文。
   * 返回值：无。
   * 注意事项：这条矩形框的左上角正好就是世界原点映射到画布后的坐标。
   */
  drawBackgroundBounds(context) {
    const left = this.backgroundBounds.minX + this.stageOffset.x;
    const top = this.backgroundBounds.minY + this.stageOffset.y;

    context.save();
    context.strokeStyle = BACKGROUND_BOUNDS_STROKE_STYLE;
    context.lineWidth = 2;
    context.setLineDash([14, 8]);
    context.strokeRect(left, top, this.backgroundBounds.width, this.backgroundBounds.height);
    context.setLineDash([]);
    context.fillStyle = BACKGROUND_BOUNDS_STROKE_STYLE;
    context.font = "18px 'Microsoft YaHei UI', sans-serif";
    context.fillText("Background Bounds", left + 12, top + 28);
    context.restore();
  }

  /**
   * drawGridBounds 绘制完整网格外包边界框。
   * 功能：把完整 211x211 菱形投影的整体包围范围单独标出来，方便你直观看到它在哪些方向超出了底图。
   * 参数：
   * - context：静态覆盖层 Canvas 的 2D 上下文。
   * 返回值：无。
   * 注意事项：外包框只是辅助观察完整范围，不代表真实网格的外形就是矩形。
   */
  drawGridBounds(context) {
    const left = this.gridBounds.minX + this.stageOffset.x;
    const top = this.gridBounds.minY + this.stageOffset.y;

    context.save();
    context.strokeStyle = GRID_BOUNDS_STROKE_STYLE;
    context.lineWidth = 2;
    context.strokeRect(left, top, this.gridBounds.width, this.gridBounds.height);
    context.fillStyle = GRID_BOUNDS_STROKE_STYLE;
    context.font = "18px 'Microsoft YaHei UI', sans-serif";
    context.fillText("Full Grid Bounds", left + 12, top + 28);
    context.restore();
  }

  /**
   * bindEvents 绑定缩放、拖拽、透明度和悬停命中事件。
   * 功能：让查看器支持 Ctrl+滚轮缩放、鼠标拖拽平移、图层开关、透明度调节以及格子悬停观察。
   * 参数：无。
   * 返回值：无。
   * 注意事项：拖拽只处理主按钮按下的鼠标操作，避免和右键菜单等行为冲突。
   */
  bindEvents() {
    this.viewport.addEventListener("wheel", (event) => this.handleWheel(event), { passive: false });
    this.viewport.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    this.viewport.addEventListener("pointermove", (event) => this.handleViewportPointerMove(event));
    this.viewport.addEventListener("pointerleave", () => this.handleViewportPointerLeave());
    window.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    window.addEventListener("pointerup", () => this.handlePointerUp());
    window.addEventListener("resize", () => this.resetView());
    this.overlayOpacityInput.addEventListener("input", () => this.handleOverlayOpacityInput());
    this.backgroundOpacityInput.addEventListener("input", () => this.handleBackgroundOpacityInput());
    this.showBackgroundCheckbox.addEventListener("change", () => this.applyLayerVisualState());
    this.showOverlayCheckbox.addEventListener("change", () => this.applyLayerVisualState());
    this.resetViewButton.addEventListener("click", () => this.resetView());
  }

  /**
   * handleOverlayOpacityInput 处理覆盖层透明度滑块变化。
   * 功能：同步保存新透明度并刷新界面显示。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  handleOverlayOpacityInput() {
    this.overlayOpacity = Number(this.overlayOpacityInput.value) / 100;
    this.syncOpacityControls();
    this.applyLayerVisualState();
  }

  /**
   * handleBackgroundOpacityInput 处理底图透明度滑块变化。
   * 功能：同步保存底图透明度并刷新界面显示。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  handleBackgroundOpacityInput() {
    this.backgroundOpacity = Number(this.backgroundOpacityInput.value) / 100;
    this.syncOpacityControls();
    this.applyLayerVisualState();
  }

  /**
   * syncOpacityControls 同步透明度控件显示。
   * 功能：让滑块位置、文字百分比和内部状态始终一致。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  syncOpacityControls() {
    this.overlayOpacityInput.value = String(Math.round(this.overlayOpacity * 100));
    this.overlayOpacityValue.textContent = `${Math.round(this.overlayOpacity * 100)}%`;
    this.backgroundOpacityInput.value = String(Math.round(this.backgroundOpacity * 100));
    this.backgroundOpacityValue.textContent = `${Math.round(this.backgroundOpacity * 100)}%`;
  }

  /**
   * applyLayerVisualState 应用图层显隐和透明度。
   * 功能：根据勾选框和滑块状态控制底图层、静态覆盖层和动态交互层的最终显示效果。
   * 参数：无。
   * 返回值：无。
   * 注意事项：悬停高亮和格子坐标属于动态交互层，因此会和覆盖层一起显隐。
   */
  applyLayerVisualState() {
    this.backgroundLayer.style.opacity = this.showBackgroundCheckbox.checked ? String(this.backgroundOpacity) : "0";
    this.overlayCanvas.style.opacity = this.showOverlayCheckbox.checked ? String(this.overlayOpacity) : "0";
    this.interactionCanvas.style.opacity = this.showOverlayCheckbox.checked ? "1" : "0";
    this.renderInteractionLayer();
  }
  /**
   * handleWheel 处理 Ctrl+滚轮缩放。
   * 功能：以鼠标所在位置为缩放中心，对世界层执行放大或缩小。
   * 参数：
   * - event：滚轮事件对象。
   * 返回值：无。
   * 注意事项：只有按住 Ctrl 才会缩放，这是为了避免普通滚轮误触影响视图。
   */
  handleWheel(event) {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const rect = this.viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    this.zoomAt(pointerX, pointerY, factor);
  }

  /**
   * zoomAt 以指定视口点为中心执行缩放。
   * 功能：缩放时保持光标下的世界点不跳动，从而提升观察偏移时的手感。
   * 参数：
   * - viewportX：视口内 X 坐标。
   * - viewportY：视口内 Y 坐标。
   * - factor：缩放因子，大于 1 表示放大，小于 1 表示缩小。
   * 返回值：无。
   * 注意事项：缩放结果会被 `MIN_SCALE` 和 `MAX_SCALE` 限制。
   */
  zoomAt(viewportX, viewportY, factor) {
    const worldX = (viewportX - this.panX) / this.scale;
    const worldY = (viewportY - this.panY) / this.scale;
    const nextScale = Math.min(Math.max(this.scale * factor, MIN_SCALE), MAX_SCALE);

    if (nextScale === this.scale) {
      return;
    }

    this.scale = nextScale;
    this.panX = viewportX - worldX * this.scale;
    this.panY = viewportY - worldY * this.scale;
    this.updateWorldTransform();
  }

  /**
   * handlePointerDown 记录拖拽起点。
   * 功能：当用户按下鼠标左键时，保存初始位置和当前平移量，为后续拖拽做准备。
   * 参数：
   * - event：指针按下事件对象。
   * 返回值：无。
   * 注意事项：仅响应主按钮，避免与右键或触控板特殊手势混淆。
   */
  handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    this.dragState = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: this.panX,
      startPanY: this.panY
    };
    this.viewport.classList.add("viewer__viewport--dragging");
  }

  /**
   * handlePointerMove 处理拖拽中的平移。
   * 功能：根据鼠标相对按下点的位移，实时更新世界层的平移量。
   * 参数：
   * - event：指针移动事件对象。
   * 返回值：无。
   * 注意事项：只有在 `dragState` 存在时才会生效。
   */
  handlePointerMove(event) {
    if (!this.dragState) {
      return;
    }

    this.panX = this.dragState.startPanX + (event.clientX - this.dragState.startClientX);
    this.panY = this.dragState.startPanY + (event.clientY - this.dragState.startClientY);
    this.updateWorldTransform();
  }

  /**
   * handlePointerUp 结束拖拽。
   * 功能：清空拖拽状态并恢复视口样式。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  handlePointerUp() {
    this.dragState = null;
    this.viewport.classList.remove("viewer__viewport--dragging");
  }

  /**
   * handleViewportPointerMove 处理视口内的悬停命中。
   * 功能：在鼠标移动时，把当前位置反推成逻辑格，并更新高亮状态与悬停信息面板。
   * 参数：
   * - event：视口内的指针移动事件对象。
   * 返回值：无。
   * 注意事项：拖拽过程中不更新悬停格，避免边拖边闪烁影响观察。
   */
  handleViewportPointerMove(event) {
    if (this.dragState) {
      return;
    }

    this.updateHoveredTile(event);
  }

  /**
   * handleViewportPointerLeave 处理鼠标移出视口。
   * 功能：鼠标离开查看区域后，清掉当前悬停高亮和坐标信息。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  handleViewportPointerLeave() {
    this.clearHoveredTile();
  }

  /**
   * updateHoveredTile 根据当前鼠标位置更新命中的逻辑格。
   * 功能：完成“client 坐标 -> 视口坐标 -> 画布坐标 -> 世界坐标 -> 逻辑格”整条反推链路。
   * 参数：
   * - event：当前鼠标移动事件对象。
   * 返回值：无。
   * 注意事项：若鼠标没有真正落在某个菱形内部，会清空选中状态。
   */
  updateHoveredTile(event) {
    const rect = this.viewport.getBoundingClientRect();
    const viewportX = event.clientX - rect.left;
    const viewportY = event.clientY - rect.top;

    if (
      viewportX < 0 ||
      viewportY < 0 ||
      viewportX > this.viewport.clientWidth ||
      viewportY > this.viewport.clientHeight
    ) {
      this.clearHoveredTile();
      return;
    }

    const canvasPoint = this.viewportPointToCanvas(viewportX, viewportY);
    const stagePoint = this.canvasPointToStage(canvasPoint);
    const hovered = this.findTileUnderStagePoint(stagePoint.x, stagePoint.y);

    if (!hovered) {
      this.clearHoveredTile();
      return;
    }

    if (
      this.hoveredTile &&
      this.hoveredTile.tileX === hovered.tileX &&
      this.hoveredTile.tileY === hovered.tileY
    ) {
      return;
    }

    this.hoveredTile = hovered;
    this.renderInteractionLayer();
    this.updateHoverInfoPanel();
  }

  /**
   * clearHoveredTile 清除当前悬停格。
   * 功能：重置选中状态并清空对应的动态高亮显示。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  clearHoveredTile() {
    if (!this.hoveredTile) {
      return;
    }

    this.hoveredTile = null;
    this.renderInteractionLayer();
    this.updateHoverInfoPanel();
  }

  /**
   * renderInteractionLayer 渲染动态交互层。
   * 功能：在独立画布上绘制当前视口可见格子的坐标标签，以及当前悬停格的高亮边框、中心点和强调标签。
   * 参数：无。
   * 返回值：无。
   * 注意事项：该层会频繁重绘，所以只放“跟交互有关的动态元素”，不重复绘制静态底图和完整网格。
   */
  renderInteractionLayer() {
    const ctx = this.interactionContext;
    ctx.clearRect(0, 0, this.interactionCanvas.width, this.interactionCanvas.height);

    if (!this.showOverlayCheckbox.checked || !this.floorConfig || !this.mapData) {
      return;
    }

    if (this.scale >= TILE_LABEL_MIN_SCALE) {
      this.drawTileLabels(ctx);
    }

    if (this.hoveredTile) {
      this.drawHoveredTile(ctx);
    }
  }

  /**
   * drawTileLabels 绘制当前视口可见格子的坐标标签。
   * 功能：只在放大到足够近时，为当前可见区域内的格子写上 `(tileX, tileY)` 文字，方便你研究坐标分布。
   * 参数：
   * - context：动态交互层 Canvas 的 2D 上下文。
   * 返回值：无。
   * 注意事项：为了降低重绘成本，这里只遍历“当前视口可能看见的格子范围”。
   */
  drawTileLabels(context) {
    const visibleRange = this.getVisibleTileRange();

    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = TILE_LABEL_FONT;
    context.lineWidth = 3;
    context.strokeStyle = TILE_LABEL_STROKE_STYLE;
    context.fillStyle = TILE_LABEL_FILL_STYLE;

    for (let tileX = visibleRange.minTileX; tileX <= visibleRange.maxTileX; tileX += 1) {
      for (let tileY = visibleRange.minTileY; tileY <= visibleRange.maxTileY; tileY += 1) {
        if (
          this.hoveredTile &&
          this.hoveredTile.tileX === tileX &&
          this.hoveredTile.tileY === tileY
        ) {
          continue;
        }

        const tileDisplay = this.getTileDisplayData(tileX, tileY);
        const label = `${tileX},${tileY}`;
        const labelY = tileDisplay.centerCanvas.y - 1;
        context.strokeText(label, tileDisplay.centerCanvas.x, labelY);
        context.fillText(label, tileDisplay.centerCanvas.x, labelY);
      }
    }

    context.restore();
  }
  /**
   * getVisibleTileRange 估算当前视口内的可见逻辑格范围。
   * 功能：把视口四个角反推成逻辑浮点坐标，再取最小外包范围并加一点安全边距，作为标签绘制的遍历窗口。
   * 参数：无。
   * 返回值：
   * - `{ minTileX, maxTileX, minTileY, maxTileY }`：当前可见的逻辑格估算范围。
   * 注意事项：该范围是“足够覆盖当前视口”的近似窗口，不追求几何上最小，但要足够稳妥。
   */
  getVisibleTileRange() {
    const viewportWidth = this.viewport.clientWidth;
    const viewportHeight = this.viewport.clientHeight;
    const viewportCorners = [
      { x: 0, y: 0 },
      { x: viewportWidth, y: 0 },
      { x: viewportWidth, y: viewportHeight },
      { x: 0, y: viewportHeight }
    ];
    const padding = 3;
    const rawTiles = viewportCorners.map((corner) => {
      const canvasPoint = this.viewportPointToCanvas(corner.x, corner.y);
      const stagePoint = this.canvasPointToStage(canvasPoint);
      return IsoMath.stageToTile(stagePoint.x, stagePoint.y, this.floorConfig.floor);
    });
    const tileXs = rawTiles.map((item) => item.tileX);
    const tileYs = rawTiles.map((item) => item.tileY);

    return {
      minTileX: Math.max(0, Math.floor(Math.min(...tileXs)) - padding),
      maxTileX: Math.min(this.mapData.rowCount - 1, Math.ceil(Math.max(...tileXs)) + padding),
      minTileY: Math.max(0, Math.floor(Math.min(...tileYs)) - padding),
      maxTileY: Math.min(this.mapData.colCount - 1, Math.ceil(Math.max(...tileYs)) + padding)
    };
  }

  /**
   * drawHoveredTile 绘制当前悬停格的强调效果。
   * 功能：在动态交互层里画出选中格的高亮边框、中心点和单独的坐标标签，让当前命中的格子一眼就能看出来。
   * 参数：
   * - context：动态交互层 Canvas 的 2D 上下文。
   * 返回值：无。
   * 注意事项：该方法假定 `hoveredTile` 一定存在。
   */
  drawHoveredTile(context) {
    const tileDisplay = this.getTileDisplayData(this.hoveredTile.tileX, this.hoveredTile.tileY);

    if (!tileDisplay) {
      return;
    }

    context.save();
    IsoMath.traceDiamondPath(
      context,
      tileDisplay.centerCanvas,
      this.floorConfig.floor.halfWidth,
      this.floorConfig.floor.halfHeight
    );
    context.fillStyle = HOVER_TILE_FILL_STYLE;
    context.strokeStyle = HOVER_TILE_STROKE_STYLE;
    context.lineWidth = 2.5;
    context.fill();
    context.stroke();

    context.beginPath();
    context.arc(
      tileDisplay.centerCanvas.x,
      tileDisplay.centerCanvas.y,
      HOVER_CENTER_RADIUS,
      0,
      Math.PI * 2
    );
    context.fillStyle = HOVER_CENTER_FILL_STYLE;
    context.fill();

    this.drawHoveredTileLabel(context, tileDisplay);
    context.restore();
  }

  /**
   * drawHoveredTileLabel 绘制当前悬停格的强调标签。
   * 功能：把当前选中格的逻辑坐标单独标在格子上方，避免在一堆普通标签里不容易看清。
   * 参数：
   * - context：动态交互层 Canvas 的 2D 上下文。
   * - tileDisplay：当前悬停格的显示数据对象。
   * 返回值：无。
   * 注意事项：这里使用单独的字体和颜色，是为了和普通格子标签形成层次。
   */
  drawHoveredTileLabel(context, tileDisplay) {
    const label = `${this.hoveredTile.tileX},${this.hoveredTile.tileY}`;
    const labelY = tileDisplay.centerCanvas.y - this.floorConfig.floor.halfHeight - 14;

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = HOVER_LABEL_FONT;
    context.lineWidth = 4;
    context.strokeStyle = HOVER_LABEL_STROKE_STYLE;
    context.fillStyle = HOVER_LABEL_FILL_STYLE;
    context.strokeText(label, tileDisplay.centerCanvas.x, labelY);
    context.fillText(label, tileDisplay.centerCanvas.x, labelY);
  }

  /**
   * resetView 把完整并集世界重新放回视口中央。
   * 功能：根据当前视口尺寸自动计算一个能看到“完整网格 + 底图”的初始缩放和居中平移。
   * 参数：无。
   * 返回值：无。
   * 注意事项：窗口大小变化后调用该方法，会丢弃用户当前的局部观察位置。
   */
  resetView() {
    const viewportWidth = this.viewport.clientWidth;
    const viewportHeight = this.viewport.clientHeight;

    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    const fitScale = Math.min(
      viewportWidth / this.worldBounds.width,
      viewportHeight / this.worldBounds.height
    ) * DEFAULT_ZOOM_PADDING;
    this.scale = Math.min(Math.max(fitScale, MIN_SCALE), MAX_SCALE);
    this.panX = (viewportWidth - this.worldBounds.width * this.scale) / 2;
    this.panY = (viewportHeight - this.worldBounds.height * this.scale) / 2;
    this.updateWorldTransform();
  }

  /**
   * updateWorldTransform 把当前缩放和平移状态应用到世界层。
   * 功能：统一维护 `translate + scale` 变换，并同步右侧参数信息面板、悬停信息面板以及动态交互层。
   * 参数：无。
   * 返回值：无。
   * 注意事项：由于格子标签依赖当前缩放范围，所以每次视图变化后都要重绘动态交互层。
   */
  updateWorldTransform() {
    this.world.style.transformOrigin = "0 0";
    this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    this.updateInfoPanel();
    this.updateHoverInfoPanel();
    this.renderInteractionLayer();
  }

  /**
   * updateHoverInfoPanel 刷新右侧悬停格信息面板。
   * 功能：展示当前选中格的逻辑坐标、格值、中心世界坐标、中心画布坐标和中心屏幕坐标。
   * 参数：无。
   * 返回值：无。
   * 注意事项：这里的“屏幕坐标”拆成了“视口内坐标”和“浏览器 client 坐标”，避免阅读时混淆。
   */
  updateHoverInfoPanel() {
    if (!this.hoveredTile) {
      this.hoverInfoPanel.textContent =
        "把鼠标移动到格子上后，这里会显示逻辑格坐标、格值、中心世界坐标、中心画布坐标和中心屏幕坐标。";
      return;
    }

    const tileDisplay = this.getTileDisplayData(this.hoveredTile.tileX, this.hoveredTile.tileY);

    if (!tileDisplay) {
      this.hoverInfoPanel.textContent =
        "当前悬停格数据已失效，请把鼠标重新移动到可见格子上。";
      return;
    }

    this.hoverInfoPanel.textContent = [
      `逻辑格坐标：(${this.hoveredTile.tileX}, ${this.hoveredTile.tileY})`,
      `原始浮点坐标：(${this.hoveredTile.rawTileX.toFixed(3)}, ${this.hoveredTile.rawTileY.toFixed(3)})`,
      `格子值：${tileDisplay.value}`,
      `中心世界坐标：(${tileDisplay.centerStage.x.toFixed(1)}, ${tileDisplay.centerStage.y.toFixed(1)})`,
      `中心画布坐标：(${tileDisplay.centerCanvas.x.toFixed(1)}, ${tileDisplay.centerCanvas.y.toFixed(1)})`,
      `中心视口坐标：(${tileDisplay.centerViewport.x.toFixed(1)}, ${tileDisplay.centerViewport.y.toFixed(1)})`,
      `中心浏览器坐标：(${tileDisplay.centerClient.x.toFixed(1)}, ${tileDisplay.centerClient.y.toFixed(1)})`,
      "说明：这里的中心视口坐标，就是当前格中心点在查看窗口里的屏幕位置。"
    ].join("\n");
  }

  /**
   * updateInfoPanel 刷新右侧参数信息面板。
   * 功能：展示地图尺寸、完整网格外包范围、底图偏移、原点位置、当前缩放倍率和平移量等调试信息。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  updateInfoPanel() {
    if (!this.floorConfig || !this.mapData || !this.worldBounds || !this.gridBounds) {
      return;
    }

    this.infoPanel.textContent = [
      `地图名称：${this.floorConfig.mapName}`,
      `底图世界尺寸：${this.backgroundBounds.width} x ${this.backgroundBounds.height}`,
      `完整世界并集：${this.worldBounds.width.toFixed(1)} x ${this.worldBounds.height.toFixed(1)}`,
      `Floor 行列：${this.floorConfig.floor.row} x ${this.floorConfig.floor.col}`,
      `格子尺寸：${this.floorConfig.floor.tileWidth} x ${this.floorConfig.floor.tileHeight}`,
      `Floor 偏移：offsetX=${this.floorConfig.floor.offsetX}, offsetY=${this.floorConfig.floor.offsetY}`,
      `完整网格范围：minX=${this.gridBounds.minX.toFixed(1)}, minY=${this.gridBounds.minY.toFixed(1)}, maxX=${this.gridBounds.maxX.toFixed(1)}, maxY=${this.gridBounds.maxY.toFixed(1)}`,
      `底图范围：minX=${this.backgroundBounds.minX}, minY=${this.backgroundBounds.minY}, maxX=${this.backgroundBounds.maxX}, maxY=${this.backgroundBounds.maxY}`,
      `画布偏移：stageOffsetX=${this.stageOffset.x.toFixed(1)}, stageOffsetY=${this.stageOffset.y.toFixed(1)}`,
      `原点在画布：(${this.stageOffset.x.toFixed(1)}, ${this.stageOffset.y.toFixed(1)})`,
      `底图左上在画布：(${(this.backgroundBounds.minX + this.stageOffset.x).toFixed(1)}, ${(this.backgroundBounds.minY + this.stageOffset.y).toFixed(1)})`,
      `map1.txt 行列：${this.mapData.rowCount} x ${this.mapData.colCount}`,
      `值统计：0=${this.mapData.stats[0]}, 1=${this.mapData.stats[1]}, 2=${this.mapData.stats[2]}`,
      `当前缩放：${this.scale.toFixed(3)}x`,
      `当前平移：panX=${this.panX.toFixed(1)}, panY=${this.panY.toFixed(1)}`,
      `坐标标签阈值：${TILE_LABEL_MIN_SCALE.toFixed(2)}x 以上开始显示`,
      "说明：现在会把全部 211x211 菱形格都画出来，即使超出底图也会保留。"
    ].join("\n");
  }

  /**
   * setStatus 更新顶部状态栏文本。
   * 功能：向用户提示当前阶段或交互方式。
   * 参数：
   * - message：要显示的状态文字。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  setStatus(message) {
    this.statusText.textContent = message;
  }
}
