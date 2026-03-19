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
  MAP_TEXT_URL,
  MAX_SCALE,
  MIN_SCALE,
  SPECIAL_FILL_STYLE,
  SPECIAL_STROKE_STYLE,
  WULIANGSHAN_CONFIG_URL,
  WULIANGSHAN_RESOURCE_ROOT
} from "../config.js";
import { IsoMath } from "../core/iso-math.js";
import { parseMapText, parseWuliangshanConfig } from "../core/mapdemo-data.js";

/**
 * MapDemoViewerApp 负责驱动 mapdemo 的 45 度地图查看器。
 * 功能：加载无量山参数和 map1.txt 网格，绘制完整 211x211 菱形地图，叠加无量山底图，并提供缩放、拖拽与透明度调节。
 * 参数：无。
 * 返回值：无。
 * 注意事项：这个类是纯查看器，不负责寻路和角色移动；它的重点是让你观察“完整逻辑网格、底图矩形、世界原点”三者之间如何偏移。
 */
export class MapDemoViewerApp {
  /**
   * constructor 绑定页面节点并初始化运行时状态。
   * 功能：收集 DOM 引用，准备绘图上下文和视图状态，等待 `init()` 统一启动。
   * 参数：无。
   * 返回值：无。
   * 注意事项：构造函数不做异步请求，真正加载地图和底图的工作放在 `init()` 中进行。
   */
  constructor() {
    /** viewport 是主查看窗口，缩放和拖拽都以它为交互容器。 */
    this.viewport = document.getElementById("viewport");
    /** world 是整张地图的世界层容器，内部会挂背景层、覆盖层和原点标记。 */
    this.world = document.getElementById("world");
    /** backgroundLayer 是无量山底图切片层，专门用于对照偏移。 */
    this.backgroundLayer = document.getElementById("backgroundLayer");
    /** overlayCanvas 是 mapdemo 菱形地图的绘制层。 */
    this.overlayCanvas = document.getElementById("overlayCanvas");
    /** overlayContext 是覆盖层对应的 2D 上下文。 */
    this.overlayContext = this.overlayCanvas.getContext("2d");
    /** originMarker 是世界原点提示点，帮助观察 `(0, 0)` 在底图和完整网格中的位置。 */
    this.originMarker = document.getElementById("originMarker");
    /** statusText 是顶部状态栏。 */
    this.statusText = document.getElementById("appStatus");
    /** infoPanel 是右侧参数信息面板。 */
    this.infoPanel = document.getElementById("infoPanel");
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
    /** showOverlayCheckbox 控制是否显示 mapdemo 菱形覆盖层。 */
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
    // 根据并集范围初始化世界层、底图层和覆盖层的尺寸与偏移。
    this.setupWorldSize();
    // 构建无量山底图切片层，让你能直接观察底图在完整网格中的相对位置。
    await this.buildBackgroundLayer();
    // 按无量山参数把 map1.txt 的全部格子绘制成完整的菱形 45 度网格覆盖层。
    this.drawOverlayMap();
    // 根据当前勾选状态和透明度设置应用可见性。
    this.applyLayerVisualState();
    // 绑定拖拽、缩放、复位和透明度调节事件。
    this.bindEvents();
    // 更新右侧信息面板，展示当前地图和参数摘要。
    this.updateInfoPanel();
    // 等浏览器完成一次布局后，再根据视口大小重置视图到合适位置。
    requestAnimationFrame(() => this.resetView());
    // 通知用户当前页面已经准备完成，并强调“全部格子都会画出来”。
    this.setStatus("完整 211x211 菱形网格已绘制。按住 Ctrl + 滚轮缩放，按住鼠标左键拖拽平移，观察底图、原点和完整网格的偏移关系。");
  }

  /**
   * computeWorldBounds 计算完整网格和底图的世界范围。
   * 功能：把所有逻辑格投影到世界坐标后，算出完整菱形网格外包框，再与底图矩形取并集，得到最终世界容器范围。
   * 参数：无。
   * 返回值：无。
   * 注意事项：这是本次查看器改动的关键步骤，因为只有把世界扩成并集范围，才能看到“超出底图”的完整格子。
   */
  computeWorldBounds() {
    // 取出 Floor 参数，后面会频繁用于逻辑格投影。
    const { floor, mapWidth, mapHeight } = this.floorConfig;
    // 初始化完整网格范围的最小 X，为后续逐格比较做准备。
    let minGridX = Number.POSITIVE_INFINITY;
    // 初始化完整网格范围的最小 Y。
    let minGridY = Number.POSITIVE_INFINITY;
    // 初始化完整网格范围的最大 X。
    let maxGridX = Number.NEGATIVE_INFINITY;
    // 初始化完整网格范围的最大 Y。
    let maxGridY = Number.NEGATIVE_INFINITY;

    // 逐行遍历所有逻辑格，确保“完整网格”而不是只有非零格参与边界计算。
    for (let tileX = 0; tileX < this.mapData.rowCount; tileX += 1) {
      // 在当前行里逐列遍历所有逻辑格。
      for (let tileY = 0; tileY < this.mapData.colCount; tileY += 1) {
        // 把当前逻辑格中心点投影到世界坐标中。
        const center = IsoMath.tileToStage(tileX, tileY, floor);
        // 当前格左边界等于中心 X 减半格宽。
        const left = center.x - floor.halfWidth;
        // 当前格右边界等于中心 X 加半格宽。
        const right = center.x + floor.halfWidth;
        // 当前格上边界等于中心 Y 减半格高。
        const top = center.y - floor.halfHeight;
        // 当前格下边界等于中心 Y 加半格高。
        const bottom = center.y + floor.halfHeight;

        // 用当前格子修正完整网格范围的最小 X。
        minGridX = Math.min(minGridX, left);
        // 修正完整网格范围的最小 Y。
        minGridY = Math.min(minGridY, top);
        // 修正完整网格范围的最大 X。
        maxGridX = Math.max(maxGridX, right);
        // 修正完整网格范围的最大 Y。
        maxGridY = Math.max(maxGridY, bottom);
      }
    }

    // 保存无量山底图本身在世界坐标里的矩形范围；它天然从 `(0,0)` 开始铺到 `(4200,4200)`。
    this.backgroundBounds = {
      minX: 0,
      minY: 0,
      maxX: mapWidth,
      maxY: mapHeight,
      width: mapWidth,
      height: mapHeight
    };

    // 保存完整菱形网格投影后的外包矩形范围。
    this.gridBounds = {
      minX: minGridX,
      minY: minGridY,
      maxX: maxGridX,
      maxY: maxGridY,
      width: maxGridX - minGridX,
      height: maxGridY - minGridY
    };

    // 取底图范围和网格范围的并集最小 X，作为最终世界容器左边界。
    const worldMinX = Math.min(this.backgroundBounds.minX, this.gridBounds.minX);
    // 取并集最小 Y，作为最终世界容器上边界。
    const worldMinY = Math.min(this.backgroundBounds.minY, this.gridBounds.minY);
    // 取并集最大 X，作为最终世界容器右边界。
    const worldMaxX = Math.max(this.backgroundBounds.maxX, this.gridBounds.maxX);
    // 取并集最大 Y，作为最终世界容器下边界。
    const worldMaxY = Math.max(this.backgroundBounds.maxY, this.gridBounds.maxY);

    // 保存完整世界范围，后续视图复位和画布尺寸都要用它。
    this.worldBounds = {
      minX: worldMinX,
      minY: worldMinY,
      maxX: worldMaxX,
      maxY: worldMaxY,
      width: worldMaxX - worldMinX,
      height: worldMaxY - worldMinY
    };

    // 计算把世界坐标整体平移到正坐标画布中的偏移量，本质上就是把 world min 搬到 `(0,0)`。
    this.stageOffset = {
      x: -this.worldBounds.minX,
      y: -this.worldBounds.minY
    };
  }

  /**
   * setupWorldSize 设置世界层、底图层和覆盖层尺寸。
   * 功能：让 DOM 世界层和 Canvas 覆盖层使用“并集范围”作为画布，同时把底图层偏移到它在完整世界中的真实位置。
   * 参数：无。
   * 返回值：无。
   * 注意事项：该方法依赖 `computeWorldBounds()` 已经先算好并集范围和偏移量。
   */
  setupWorldSize() {
    // 取出完整世界宽高，后续多个节点都会使用它作为参考尺寸。
    const { width: worldWidth, height: worldHeight } = this.worldBounds;
    // 设置世界容器宽度，使其能够容纳“底图 + 超出底图的完整网格”。
    this.world.style.width = `${worldWidth}px`;
    // 设置世界容器高度。
    this.world.style.height = `${worldHeight}px`;

    // 底图层只需要使用无量山底图自身尺寸，而不是整个并集世界尺寸。
    this.backgroundLayer.style.width = `${this.backgroundBounds.width}px`;
    // 底图层高度也使用底图自身高度。
    this.backgroundLayer.style.height = `${this.backgroundBounds.height}px`;
    // 把底图层摆到“世界坐标 `(0,0)` 在并集画布中的位置”，这样就能直观看到它相对完整网格的偏移。
    this.backgroundLayer.style.left = `${this.stageOffset.x}px`;
    // Y 方向也做同样的偏移处理。
    this.backgroundLayer.style.top = `${this.stageOffset.y}px`;
    // 取消可能存在的 right 自动拉伸效果，保证底图层不会被世界容器撑满。
    this.backgroundLayer.style.right = "auto";
    // 取消 bottom 自动拉伸效果。
    this.backgroundLayer.style.bottom = "auto";

    // 覆盖层 Canvas 必须覆盖完整并集世界范围，才能显示所有超出底图的格子。
    this.overlayCanvas.width = worldWidth;
    // 设置覆盖层实际绘图高度。
    this.overlayCanvas.height = worldHeight;
    // 同步 CSS 宽度，避免浏览器对画布再做额外缩放。
    this.overlayCanvas.style.width = `${worldWidth}px`;
    // 同步 CSS 高度。
    this.overlayCanvas.style.height = `${worldHeight}px`;

    // 把原点提示点摆到“世界坐标 `(0,0)` 映射到并集画布后”的真实位置。
    this.originMarker.style.left = `${this.stageOffset.x}px`;
    // Y 方向同理。
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
    // 用文档片段先在内存里拼装图片节点，减少频繁回流。
    const fragment = document.createDocumentFragment();
    // 计算横向需要多少张底图切片。
    const tilesX = Math.ceil(this.backgroundBounds.width / BACKGROUND_TILE_SIZE);
    // 计算纵向需要多少张底图切片。
    const tilesY = Math.ceil(this.backgroundBounds.height / BACKGROUND_TILE_SIZE);

    // 逐列遍历所有切片坐标。
    for (let x = 0; x < tilesX; x += 1) {
      // 在当前列中逐行摆放切片。
      for (let y = 0; y < tilesY; y += 1) {
        // 创建图片节点来承载当前切片。
        const image = document.createElement("img");
        // 切片路径遵循原版命名方式，例如 `0_0.jpg`。
        image.src = `${WULIANGSHAN_RESOURCE_ROOT}${x}_${y}.jpg`;
        // 底图只是对照参考，不需要朗读文本。
        image.alt = "";
        // 开启懒加载，减轻首屏解码压力。
        image.loading = "lazy";
        // 切片在底图层内部仍然从 `(0,0)` 开始铺，不需要再叠加 stageOffset。
        image.style.left = `${x * BACKGROUND_TILE_SIZE}px`;
        // Y 方向同理。
        image.style.top = `${y * BACKGROUND_TILE_SIZE}px`;
        // 追加到片段中，等待统一挂载。
        fragment.appendChild(image);
      }
    }

    // 一次性把所有切片装进底图层。
    this.backgroundLayer.replaceChildren(fragment);
  }

  /**
   * projectStagePoint 把世界坐标点映射到并集画布坐标。
   * 功能：给所有菱形格和参考线统一套上一层 stageOffset，使原本可能为负数的世界坐标落到画布可见区域中。
   * 参数：
   * - stagePoint：原始世界坐标点。
   * 返回值：
   * - `{ x, y }`：可直接绘制到覆盖层 Canvas 上的正坐标点。
   * 注意事项：无特殊注意事项。
   */
  projectStagePoint(stagePoint) {
    return {
      // X 方向把世界点整体右移 `stageOffset.x`，使最小 X 对齐到画布左边界。
      x: stagePoint.x + this.stageOffset.x,
      // Y 方向整体下移 `stageOffset.y`，使最小 Y 对齐到画布上边界。
      y: stagePoint.y + this.stageOffset.y
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
    // 取出覆盖层上下文，后面所有格子都会画到这张大画布上。
    const ctx = this.overlayContext;
    // 取出 Floor 参数，避免多次长链访问。
    const { floor } = this.floorConfig;

    // 先清空整个覆盖层，防止重复初始化时出现叠影。
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    // 保存绘图状态，便于最后统一恢复。
    ctx.save();
    // 设置统一线宽，让完整网格在各种缩放倍率下都比较均衡。
    ctx.lineWidth = 1;

    // 逐行遍历 map1.txt 的二维数组，确保全部格子都参与绘制。
    for (let tileX = 0; tileX < this.mapData.rowCount; tileX += 1) {
      // 在当前行里逐列读取每一个格值。
      for (let tileY = 0; tileY < this.mapData.colCount; tileY += 1) {
        // 取出当前格的数字值，可能是 0、1 或 2。
        const value = this.mapData.grid[tileX][tileY];
        // 先把逻辑格 `(tileX, tileY)` 转成原始世界坐标中心点。
        const stageCenter = IsoMath.tileToStage(tileX, tileY, floor);
        // 再把世界坐标映射到并集画布坐标中，这样即使格子超出底图也能完整显示。
        const canvasCenter = this.projectStagePoint(stageCenter);
        // 在上下文中描出当前格子的菱形路径。
        IsoMath.traceDiamondPath(ctx, canvasCenter, floor.halfWidth, floor.halfHeight);

        // 值为 2 时使用金色高亮，方便单独观察特殊区域。
        if (value === 2) {
          ctx.fillStyle = SPECIAL_FILL_STYLE;
          ctx.strokeStyle = SPECIAL_STROKE_STYLE;
        } else if (value === 1) {
          // 值为 1 时使用红色着色，代表主要轮廓区域。
          ctx.fillStyle = GRID_FILL_STYLE;
          ctx.strokeStyle = GRID_STROKE_STYLE;
        } else {
          // 值为 0 时也要绘制，只是颜色更淡，作用是把完整 211x211 网格都显示出来。
          ctx.fillStyle = EMPTY_TILE_FILL_STYLE;
          ctx.strokeStyle = EMPTY_TILE_STROKE_STYLE;
        }

        // 先填充格子内部区域。
        ctx.fill();
        // 再描出格子边框。
        ctx.stroke();
      }
    }

    // 绘制通过世界原点 `(0,0)` 的参考轴，帮助你判断底图和完整网格相对原点的位置。
    this.drawOriginAxes(ctx);
    // 绘制底图矩形边界框，表示无量山真实底图占用的世界矩形范围。
    this.drawBackgroundBounds(ctx);
    // 绘制完整菱形网格投影后的外包矩形边界框。
    this.drawGridBounds(ctx);
    // 恢复绘图状态，结束覆盖层绘制。
    ctx.restore();
  }

  /**
   * drawOriginAxes 绘制通过世界原点的参考轴。
   * 功能：在完整并集画布上画出穿过原点的水平线和垂直线，帮助观察 `(0,0)` 位于底图和网格的什么位置。
   * 参数：
   * - context：覆盖层 Canvas 的 2D 上下文。
   * 返回值：无。
   * 注意事项：这两条线只是调试辅助线，不参与任何寻路或逻辑计算。
   */
  drawOriginAxes(context) {
    // 原点在并集画布中的 X 坐标，等于 world 坐标 0 加上 stageOffset.x。
    const originX = this.stageOffset.x;
    // 原点在并集画布中的 Y 坐标，等于 world 坐标 0 加上 stageOffset.y。
    const originY = this.stageOffset.y;

    // 保存当前绘图状态，便于局部设置虚线和颜色。
    context.save();
    // 设置参考轴颜色。
    context.strokeStyle = AXIS_STROKE_STYLE;
    // 设置参考轴线宽。
    context.lineWidth = 1.5;
    // 设置虚线样式，让它和正常网格边线区分开。
    context.setLineDash([8, 6]);

    // 绘制穿过原点的水平参考线。
    context.beginPath();
    context.moveTo(0, originY);
    context.lineTo(this.overlayCanvas.width, originY);
    context.stroke();

    // 绘制穿过原点的垂直参考线。
    context.beginPath();
    context.moveTo(originX, 0);
    context.lineTo(originX, this.overlayCanvas.height);
    context.stroke();

    // 在原点旁边写一段小标签，明确告诉你这里就是世界 `(0,0)`。
    context.setLineDash([]);
    context.fillStyle = "rgba(255, 255, 255, 0.95)";
    context.font = "18px 'Microsoft YaHei UI', sans-serif";
    context.fillText("Origin (0, 0)", originX + 18, originY - 18);
    // 恢复绘图状态。
    context.restore();
  }

  /**
   * drawBackgroundBounds 绘制底图世界边界框。
   * 功能：把无量山底图的 `4200 x 4200` 世界矩形单独勾勒出来，方便和完整网格范围对照。
   * 参数：
   * - context：覆盖层 Canvas 的 2D 上下文。
   * 返回值：无。
   * 注意事项：这条矩形框的左上角正好就是世界原点映射到画布后的坐标。
   */
  drawBackgroundBounds(context) {
    // 计算底图矩形左上角在并集画布中的 X 坐标。
    const left = this.backgroundBounds.minX + this.stageOffset.x;
    // 计算底图矩形左上角在并集画布中的 Y 坐标。
    const top = this.backgroundBounds.minY + this.stageOffset.y;

    // 保存状态，局部设置颜色和虚线。
    context.save();
    // 设置底图边界框颜色。
    context.strokeStyle = BACKGROUND_BOUNDS_STROKE_STYLE;
    // 设置线宽。
    context.lineWidth = 2;
    // 给底图边界框加虚线，让它和完整网格范围框区分开。
    context.setLineDash([14, 8]);
    // 真正画出底图矩形边界。
    context.strokeRect(left, top, this.backgroundBounds.width, this.backgroundBounds.height);
    // 在矩形附近标一个文字，明确告诉你这条框代表底图范围。
    context.setLineDash([]);
    context.fillStyle = BACKGROUND_BOUNDS_STROKE_STYLE;
    context.font = "18px 'Microsoft YaHei UI', sans-serif";
    context.fillText("Background Bounds", left + 12, top + 28);
    // 恢复状态。
    context.restore();
  }

  /**
   * drawGridBounds 绘制完整网格外包边界框。
   * 功能：把完整 211x211 菱形投影的整体包围范围单独标出来，方便你直观看到它在哪些方向超出了底图。
   * 参数：
   * - context：覆盖层 Canvas 的 2D 上下文。
   * 返回值：无。
   * 注意事项：外包框只是辅助观察完整范围，不代表真实网格的外形就是矩形。
   */
  drawGridBounds(context) {
    // 计算完整网格外包框左上角在并集画布中的 X 坐标。
    const left = this.gridBounds.minX + this.stageOffset.x;
    // 计算完整网格外包框左上角在并集画布中的 Y 坐标。
    const top = this.gridBounds.minY + this.stageOffset.y;

    // 保存状态，局部设置颜色和线样式。
    context.save();
    // 设置完整网格边界框颜色。
    context.strokeStyle = GRID_BOUNDS_STROKE_STYLE;
    // 设置线宽。
    context.lineWidth = 2;
    // 这里不使用虚线，和底图范围框形成视觉对比。
    context.strokeRect(left, top, this.gridBounds.width, this.gridBounds.height);
    // 写一个说明标签，避免和底图边界框混淆。
    context.fillStyle = GRID_BOUNDS_STROKE_STYLE;
    context.font = "18px 'Microsoft YaHei UI', sans-serif";
    context.fillText("Full Grid Bounds", left + 12, top + 28);
    // 恢复状态。
    context.restore();
  }

  /**
   * bindEvents 绑定缩放、拖拽和面板交互事件。
   * 功能：让查看器支持 Ctrl+滚轮缩放、鼠标拖拽平移、图层开关和透明度调节。
   * 参数：无。
   * 返回值：无。
   * 注意事项：拖拽只处理主按钮按下的鼠标操作，避免和右键菜单等行为冲突。
   */
  bindEvents() {
    // 监听滚轮事件；只有按下 Ctrl 时才执行缩放。
    this.viewport.addEventListener("wheel", (event) => this.handleWheel(event), { passive: false });
    // 鼠标按下时开始记录拖拽起点。
    this.viewport.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    // 鼠标移动时，如果处于拖拽态则实时更新平移量。
    window.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    // 鼠标抬起时结束拖拽。
    window.addEventListener("pointerup", () => this.handlePointerUp());
    // 窗口尺寸变化时重新居中地图，避免视图被裁坏。
    window.addEventListener("resize", () => this.resetView());
    // 调整覆盖层透明度时同步界面和图层透明度。
    this.overlayOpacityInput.addEventListener("input", () => this.handleOverlayOpacityInput());
    // 调整底图透明度时同步界面和图层透明度。
    this.backgroundOpacityInput.addEventListener("input", () => this.handleBackgroundOpacityInput());
    // 切换底图显示状态。
    this.showBackgroundCheckbox.addEventListener("change", () => this.applyLayerVisualState());
    // 切换覆盖层显示状态。
    this.showOverlayCheckbox.addEventListener("change", () => this.applyLayerVisualState());
    // 点击复位按钮时恢复到整图视图。
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
    // 把 0~100 的滑块值换算为 0~1 的透明度小数。
    this.overlayOpacity = Number(this.overlayOpacityInput.value) / 100;
    // 同步数值文本和图层样式。
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
    // 把底图滑块值从百分比换算成 0~1 小数。
    this.backgroundOpacity = Number(this.backgroundOpacityInput.value) / 100;
    // 同步数值文本和图层样式。
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
    // 把当前覆盖层透明度写回滑块，保证复位或初始化时 UI 正确。
    this.overlayOpacityInput.value = String(Math.round(this.overlayOpacity * 100));
    // 把覆盖层透明度显示为百分比文本。
    this.overlayOpacityValue.textContent = `${Math.round(this.overlayOpacity * 100)}%`;
    // 把底图透明度写回滑块。
    this.backgroundOpacityInput.value = String(Math.round(this.backgroundOpacity * 100));
    // 把底图透明度显示为百分比文本。
    this.backgroundOpacityValue.textContent = `${Math.round(this.backgroundOpacity * 100)}%`;
  }

  /**
   * applyLayerVisualState 应用图层显隐和透明度。
   * 功能：根据勾选框和滑块状态控制底图层与覆盖层的最终显示效果。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  applyLayerVisualState() {
    // 底图勾选时按当前透明度显示，否则直接隐藏整个底图层。
    this.backgroundLayer.style.opacity = this.showBackgroundCheckbox.checked ? String(this.backgroundOpacity) : "0";
    // 覆盖层勾选时按当前透明度显示，否则隐藏覆盖层画布。
    this.overlayCanvas.style.opacity = this.showOverlayCheckbox.checked ? String(this.overlayOpacity) : "0";
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
    // 没按 Ctrl 时不抢占滚轮，让页面保持普通行为。
    if (!event.ctrlKey) {
      return;
    }

    // 阻止浏览器默认缩放页面或滚动页面的行为。
    event.preventDefault();
    // 读取当前视口矩形，用于把 client 坐标转换成容器内坐标。
    const rect = this.viewport.getBoundingClientRect();
    // 算出鼠标在视口内部的 X 位置。
    const pointerX = event.clientX - rect.left;
    // 算出鼠标在视口内部的 Y 位置。
    const pointerY = event.clientY - rect.top;
    // 根据滚轮方向计算一个平滑的缩放因子；向上滚放大，向下滚缩小。
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    // 按鼠标位置执行缩放，让用户感觉是在“对着那里放大”。
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
    // 记录缩放前鼠标下方对应的世界 X 坐标，后面要用它做锚点保持。
    const worldX = (viewportX - this.panX) / this.scale;
    // 记录缩放前鼠标下方对应的世界 Y 坐标。
    const worldY = (viewportY - this.panY) / this.scale;
    // 计算目标缩放值，并裁剪到允许范围内。
    const nextScale = Math.min(Math.max(this.scale * factor, MIN_SCALE), MAX_SCALE);

    // 若缩放值没有变化，就无需继续更新视图。
    if (nextScale === this.scale) {
      return;
    }

    // 更新当前缩放倍率。
    this.scale = nextScale;
    // 调整平移量，使得同一个世界点仍然停留在鼠标当前位置下面。
    this.panX = viewportX - worldX * this.scale;
    // Y 方向同理。
    this.panY = viewportY - worldY * this.scale;
    // 应用最新 transform 到世界层。
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
    // 只有鼠标左键才启动拖拽。
    if (event.button !== 0) {
      return;
    }

    // 保存拖拽开始时的鼠标位置和平移量快照。
    this.dragState = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: this.panX,
      startPanY: this.panY
    };
    // 给视口加上拖拽中的样式，提升交互反馈。
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
    // 若当前没有拖拽状态，说明用户并未按住拖动，直接返回。
    if (!this.dragState) {
      return;
    }

    // 根据当前鼠标位置与按下时位置的差值，计算新的 X 平移量。
    this.panX = this.dragState.startPanX + (event.clientX - this.dragState.startClientX);
    // 根据 Y 方向差值计算新的 Y 平移量。
    this.panY = this.dragState.startPanY + (event.clientY - this.dragState.startClientY);
    // 把新的平移状态应用到世界层上。
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
    // 只要抬起鼠标，就结束本轮拖拽状态。
    this.dragState = null;
    // 移除拖拽中的样式。
    this.viewport.classList.remove("viewer__viewport--dragging");
  }

  /**
   * resetView 把完整并集世界重新放回视口中央。
   * 功能：根据当前视口尺寸自动计算一个能看到“完整网格 + 底图”的初始缩放和居中平移。
   * 参数：无。
   * 返回值：无。
   * 注意事项：窗口大小变化后调用该方法，会丢弃用户当前的局部观察位置。
   */
  resetView() {
    // 读取当前视口容器实际宽度。
    const viewportWidth = this.viewport.clientWidth;
    // 读取当前视口容器实际高度。
    const viewportHeight = this.viewport.clientHeight;

    // 如果视口还没布局完成，尺寸可能为 0，此时先不做复位。
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    // 根据完整并集世界宽高和视口大小，计算“刚好放下完整内容”的基础缩放比例。
    const fitScale = Math.min(
      viewportWidth / this.worldBounds.width,
      viewportHeight / this.worldBounds.height
    ) * DEFAULT_ZOOM_PADDING;
    // 在缩放范围限制内保存最终初始缩放值。
    this.scale = Math.min(Math.max(fitScale, MIN_SCALE), MAX_SCALE);
    // 把完整世界水平居中到视口中。
    this.panX = (viewportWidth - this.worldBounds.width * this.scale) / 2;
    // 把完整世界垂直居中到视口中。
    this.panY = (viewportHeight - this.worldBounds.height * this.scale) / 2;
    // 应用最新的缩放和平移状态。
    this.updateWorldTransform();
  }

  /**
   * updateWorldTransform 把当前缩放和平移状态应用到世界层。
   * 功能：统一维护 `translate + scale` 变换，并同步右侧信息面板。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  updateWorldTransform() {
    // 用左上角为变换原点，保证平移与缩放逻辑更直观。
    this.world.style.transformOrigin = "0 0";
    // 先平移再缩放，让世界层以当前 pan 和 scale 显示到视口中。
    this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    // 每次视图变化后都同步刷新右侧状态面板。
    this.updateInfoPanel();
  }

  /**
   * updateInfoPanel 刷新右侧信息面板。
   * 功能：展示地图尺寸、完整网格外包范围、底图偏移、原点位置、当前缩放倍率和平移量等调试信息。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  updateInfoPanel() {
    // 若核心数据尚未加载完成，就不更新面板，避免空对象报错。
    if (!this.floorConfig || !this.mapData || !this.worldBounds || !this.gridBounds) {
      return;
    }

    // 直接拼装多行文本，便于你在页面上快速核对“完整网格、底图和原点”的关系。
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
    // 直接替换状态栏内容。
    this.statusText.textContent = message;
  }
}
