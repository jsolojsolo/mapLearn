import {
  BACKGROUND_TILE_SIZE,
  BLOCKED_TILE_FILL_STYLE,
  DEFAULT_PLAYER_MOVE_SPEED,
  GRID_LINE_WIDTH,
  GRID_STROKE_STYLE,
  MAP_CONFIG_URL,
  MAP_RESOURCE_ROOT,
  MAX_PLAYER_MOVE_SPEED,
  MINI_MAP_BLOCKED_FILL_STYLE,
  MINI_MAP_GRID_LINE_WIDTH,
  MINI_MAP_GRID_STROKE_STYLE,
  MIN_PLAYER_MOVE_SPEED,
  MINI_MAP_URL
} from "../config.js";
import { IsoMath } from "../core/iso-math.js";
import { GridMap } from "../core/grid-map.js";
import { AStarPathFinder } from "../core/astar-path-finder.js";
import { EventLogger } from "../ui/event-logger.js";

/**
 * WuliangshanApp 负责把地图、输入、相机和 UI 串起来。
 * 功能：提供完整的主场景浏览、点击寻路、镜头跟随、全景地图交互和教学日志输出。
 * 参数：无。
 * 返回值：无。
 * 注意事项：该类是独立 demo 的核心协调者，本身并不实现底层坐标公式或 A* 算法，而是把地图模型、寻路器、DOM 层和动画循环组织起来。
 */
export class WuliangshanApp {
  /**
   * constructor 绑定页面节点并初始化运行时状态。
   * 功能：把页面上的所有 DOM 元素、渲染上下文和运行时变量挂到实例上，方便后续方法直接访问。
   * 参数：无。
   * 返回值：无。
   * 注意事项：构造函数只做“准备工作”，不做异步加载；真正读取地图和拼背景要等 `init()` 调用后才开始。
   */
  constructor() {
    /** sceneViewport 是主场景可视窗口，用户看到的“屏幕坐标”就是以它左上角为原点。 */
    this.sceneViewport = document.getElementById("sceneViewport");
    /** worldLayer 是整个世界层容器，移动相机时通过修改它的 transform 来实现整体平移。 */
    this.worldLayer = document.getElementById("worldLayer");
    /** backgroundLayer 只负责承载地图底图切片，不参与路径线和网格线绘制。 */
    this.backgroundLayer = document.getElementById("backgroundLayer");
    /** gridCanvas 是主视野里的网格覆盖层，用来画菱形格边界和不可通行区域。 */
    this.gridCanvas = document.getElementById("gridCanvas");
    /** gridContext 是主视野网格层对应的 2D 绘图上下文。 */
    this.gridContext = this.gridCanvas.getContext("2d");
    /** pathCanvas 是主视野里的路径覆盖层，用来画当前寻路折线和路径节点。 */
    this.pathCanvas = document.getElementById("pathCanvas");
    /** pathContext 是路径层对应的 2D 绘图上下文。 */
    this.pathContext = this.pathCanvas.getContext("2d");
    /** playerMarker 是玩家当前位置的小圆点 DOM 标记。 */
    this.playerMarker = document.getElementById("playerMarker");
    /** destinationMarker 是目标位置标记，点击寻路后会显示在目标格中心。 */
    this.destinationMarker = document.getElementById("destinationMarker");
    /** statusText 是顶部状态栏，用于显示当前系统状态和操作提示。 */
    this.statusText = document.getElementById("statusText");
    /** debugText 是右侧调试面板文本区，集中显示地图、坐标、相机等即时数据。 */
    this.debugText = document.getElementById("debugText");
    /** speedInput 是走路速度调节滑块，单位是像素每秒。 */
    this.speedInput = document.getElementById("speedInput");
    /** speedValue 是滑块右侧的实时数值显示。 */
    this.speedValue = document.getElementById("speedValue");
    /** logText 是学习日志输出区域，用来展示点击坐标、路径和经过格子。 */
    this.logText = document.getElementById("logText");
    /** clearLogButton 是清空日志按钮。 */
    this.clearLogButton = document.getElementById("clearLogButton");
    /** mapOverlay 是按 M 打开的大地图弹层根节点。 */
    this.mapOverlay = document.getElementById("mapOverlay");
    /** miniMapViewport 是大地图内容容器，用来接收点击并配合图片做相对定位。 */
    this.miniMapViewport = document.getElementById("miniMapViewport");
    /** miniMapImage 是大地图底图图片，本质上就是 small.jpg 的展示节点。 */
    this.miniMapImage = document.getElementById("miniMapImage");
    /** miniMapCanvas 是盖在大地图图片之上的 Canvas，用来画网格、阻挡、路径、玩家点和视口框。 */
    this.miniMapCanvas = document.getElementById("miniMapCanvas");
    /** miniMapContext 是大地图动态覆盖层对应的 2D 绘图上下文。 */
    this.miniMapContext = this.miniMapCanvas.getContext("2d");
    /** miniMapStaticCanvas 是离屏静态缓存层，专门缓存大地图上的网格线和阻挡着色。 */
    this.miniMapStaticCanvas = document.createElement("canvas");
    /** miniMapStaticContext 是离屏静态缓存层对应的 2D 绘图上下文。 */
    this.miniMapStaticContext = this.miniMapStaticCanvas.getContext("2d");
    /** toggleMapButton 是打开大地图的按钮。 */
    this.toggleMapButton = document.getElementById("toggleMapButton");
    /** closeMapButton 是关闭大地图的按钮。 */
    this.closeMapButton = document.getElementById("closeMapButton");

    /** logger 负责把交互日志同时输出到页面和浏览器控制台。 */
    this.logger = new EventLogger(this.logText);
    /** map 保存当前已经解析完成的地图模型；在 init 完成之前它为 null。 */
    this.map = null;
    /** pathFinder 保存当前地图对应的 A* 寻路器实例。 */
    this.pathFinder = null;
    /** playerTile 记录玩家当前所在的逻辑格坐标。 */
    this.playerTile = null;
    /** playerStage 记录玩家当前的世界像素坐标，移动时会连续变化。 */
    this.playerStage = null;
    /** pathQueue 保存“尚未走完”的路径点队列，每一项同时带有逻辑格和世界坐标。 */
    this.pathQueue = [];
    /** activePathTiles 保存一次完整寻路返回的全量逻辑格路径，主要用于教学展示和调试。 */
    this.activePathTiles = [];
    /** destinationTile 保存当前点击后的最终目标格，若没有活动路径则为 null。 */
    this.destinationTile = null;
    /** camera 保存当前视口左上角及可视宽高，单位都是世界像素。 */
    this.camera = { x: 0, y: 0, width: 0, height: 0 };
    /** lastFrameTime 记录上一帧动画时间戳，用来计算本帧时间差。 */
    this.lastFrameTime = 0;
    /** playerMoveSpeed 表示玩家移动速度，单位为像素每秒，可通过滑块实时调整。 */
    this.playerMoveSpeed = DEFAULT_PLAYER_MOVE_SPEED;
  }

  /**
   * init 初始化应用。
   * 功能：读取地图、创建寻路器、搭建场景层、加载底图资源、放置出生点、绑定事件，并启动动画循环。
   * 参数：无。
   * 返回值：`Promise<void>`，初始化完成后 resolve；若地图配置或资源加载失败则抛出异常。
   * 注意事项：这是整个 demo 的启动总入口，阅读代码时建议从这里开始，因为它最能体现各个模块之间的先后依赖关系。
   */
  async init() {
    // 先把速度滑块的最小值、最大值和当前值同步到 UI，避免初始化完成前界面显示错乱。
    this.applySpeedLimits();
    // 把当前移动速度文本同步到右侧提示区，让用户一打开页面就看到初始速度是多少。
    this.syncSpeedValue();
    // 顶部先提示“正在读取配置”，告诉用户页面没有卡死，只是在做初始化。
    this.setStatus("正在读取独立 demo 的地图配置...");

    // 通过 fetch 读取独立目录里的无量山 config.xml，这是教学版最关键的数据入口。
    const response = await fetch(MAP_CONFIG_URL);
    // 如果 HTTP 状态码不是 2xx，就说明资源路径不对或服务没配好，此时直接抛错更容易定位问题。
    if (!response.ok) {
      throw new Error(`地图配置加载失败，HTTP 状态码 ${response.status}`);
    }

    // 把响应体读取成纯文本，因为后面要交给 GridMap.fromXml 自己解析 XML 结构。
    const xmlText = await response.text();
    // 根据 XML 文本构造地图模型，里面会生成 Floor 网格、地图尺寸和传送点数据。
    this.map = GridMap.fromXml(xmlText);
    // 地图有了之后，就可以创建对应的 A* 寻路器，后续每次点击都复用它。
    this.pathFinder = new AStarPathFinder(this.map);
    // 根据当前浏览器窗口大小初始化 camera.width 和 camera.height。
    this.resizeViewport();
    // 按照地图像素尺寸设置 worldLayer、backgroundLayer、Canvas 等世界层大小。
    this.setupWorldLayer();
    // 并行完成两件独立的耗时任务：拼接背景切片，以及加载大地图 small.jpg。
    await Promise.all([this.buildBackground(), this.ensureMiniMapLoaded()]);

    // 在主视野网格层上把所有菱形格和阻挡区域先画出来，方便后续学习观察。
    this.drawGridOverlay();
    // 把玩家放到出生点附近的一个可走格上，并同步好相机和玩家标记。
    this.placePlayerAtSpawn();
    // 到这里数据和初始画面都准备好了，再绑定点击、按键、滑块、窗口缩放等事件最稳妥。
    this.bindEvents();
    // 统一刷新一次路径层、大地图层和右侧调试面板，确保初始状态完整显示。
    this.updateScene();
    // 在日志区打印一条初始化完成提示，方便你确认页面已经进入可交互状态。
    this.logger.log("系统", "初始化完成。你可以点击场景并观察日志中的屏幕坐标、逻辑格坐标和经过的格子。");
    // 顶部状态栏也给用户一个简洁的操作提示。
    this.setStatus("无量山教学版 H5 场景已就绪。单击地面寻路，按 M 打开全景地图。");
    // 启动 requestAnimationFrame 循环，从这一帧开始页面会持续更新角色移动和相机状态。
    requestAnimationFrame((time) => this.loop(time));
  }

  /**
   * applySpeedLimits 为速度滑块设置合法范围。
   * 功能：把配置文件里的最小速度、最大速度和当前速度同步到表单控件。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  applySpeedLimits() {
    // 设置滑块允许的最小速度值，防止用户拖到过慢甚至无意义的范围。
    this.speedInput.min = String(MIN_PLAYER_MOVE_SPEED);
    // 设置滑块允许的最大速度值，避免快到看不清路径效果。
    this.speedInput.max = String(MAX_PLAYER_MOVE_SPEED);
    // 把当前实际移动速度同步到滑块当前位置，保证 UI 与运行时状态一致。
    this.speedInput.value = String(this.playerMoveSpeed);
  }

  /**
   * syncSpeedValue 同步右侧速度显示文本。
   * 功能：把当前像素每秒速度以字符串形式展示在页面上。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  syncSpeedValue() {
    // 直接把当前速度拼成易读字符串，显示在滑块旁边。
    this.speedValue.textContent = `${this.playerMoveSpeed} px/s`;
  }

  /**
   * setupWorldLayer 根据地图尺寸初始化世界层和绘图层。
   * 功能：让背景层、网格层、路径层都拥有与整张地图完全一致的世界尺寸。
   * 参数：无。
   * 返回值：无。
   * 注意事项：该方法依赖 `this.map` 已经存在，因此必须在 XML 解析完成之后调用。
   */
  setupWorldLayer() {
    // 把世界层宽度设置成地图总宽度，后续相机平移时 transform 的参考空间就是它。
    this.worldLayer.style.width = `${this.map.mapWidth}px`;
    // 把世界层高度设置成地图总高度。
    this.worldLayer.style.height = `${this.map.mapHeight}px`;
    // 背景切片层也必须和整张地图一样大，否则切片定位会超出容器。
    this.backgroundLayer.style.width = `${this.map.mapWidth}px`;
    // 背景切片层高度同步成地图高度。
    this.backgroundLayer.style.height = `${this.map.mapHeight}px`;
    // 主视野网格 Canvas 的绘图缓冲区宽度按地图总宽设置。
    this.gridCanvas.width = this.map.mapWidth;
    // 主视野网格 Canvas 的绘图缓冲区高度按地图总高设置。
    this.gridCanvas.height = this.map.mapHeight;
    // 再同步 CSS 宽度，确保绘图像素和显示尺寸一致，不发生拉伸。
    this.gridCanvas.style.width = `${this.map.mapWidth}px`;
    // 同步 CSS 高度。
    this.gridCanvas.style.height = `${this.map.mapHeight}px`;
    // 路径 Canvas 也使用和整张地图一致的绘图宽度。
    this.pathCanvas.width = this.map.mapWidth;
    // 路径 Canvas 也使用和整张地图一致的绘图高度。
    this.pathCanvas.height = this.map.mapHeight;
    // 同步路径 Canvas 的 CSS 宽度。
    this.pathCanvas.style.width = `${this.map.mapWidth}px`;
    // 同步路径 Canvas 的 CSS 高度。
    this.pathCanvas.style.height = `${this.map.mapHeight}px`;
  }

  /**
   * buildBackground 创建地图底图切片。
   * 功能：把 `x_y.jpg` 形式的预渲染切片拼回完整背景。
   * 参数：无。
   * 返回值：`Promise<void>`。
   * 注意事项：虽然函数体内部没有 await，但保留 async 形式能让它和其他异步资源加载统一被 `Promise.all` 管理。
   */
  async buildBackground() {
    // DocumentFragment 可以先在内存中批量组装 DOM，最后一次性挂入页面，减少频繁重排。
    const fragment = document.createDocumentFragment();
    // 计算横向需要多少张 300x300 的切片才能铺满整张地图。
    const tilesX = Math.ceil(this.map.mapWidth / BACKGROUND_TILE_SIZE);
    // 计算纵向需要多少张切片才能铺满整张地图。
    const tilesY = Math.ceil(this.map.mapHeight / BACKGROUND_TILE_SIZE);

    // 逐列创建切片图片节点。
    for (let x = 0; x < tilesX; x += 1) {
      // 在当前列下再逐行创建切片图片节点。
      for (let y = 0; y < tilesY; y += 1) {
        // 创建一个 img 元素来承载当前 `(x, y)` 对应的 JPG 切片。
        const image = document.createElement("img");
        // 切片命名规则直接复用原版资源目录格式，例如 `0_0.jpg`、`0_1.jpg`。
        image.src = `${MAP_RESOURCE_ROOT}${x}_${y}.jpg`;
        // 这里是纯装饰性图片，不需要额外的可访问性文本。
        image.alt = "";
        // 允许浏览器懒加载这些切片，降低首屏解码压力。
        image.loading = "lazy";
        // 根据切片列号设置它在世界坐标中的 left 偏移。
        image.style.left = `${x * BACKGROUND_TILE_SIZE}px`;
        // 根据切片行号设置它在世界坐标中的 top 偏移。
        image.style.top = `${y * BACKGROUND_TILE_SIZE}px`;
        // 把当前切片先追加到内存片段中，等循环结束后再统一插入页面。
        fragment.appendChild(image);
      }
    }

    // 一次性替换背景层内容，完成整张地图底图的拼装。
    this.backgroundLayer.replaceChildren(fragment);
  }

  /**
   * ensureMiniMapLoaded 等待大地图底图资源完成加载。
   * 功能：为 `small.jpg` 设置地址，并在图片真正可用后才继续后续流程。
   * 参数：无。
   * 返回值：`Promise<void>`。
   * 注意事项：如果图片此前已经加载成功，这里会直接返回，不会重复等待。
   */
  async ensureMiniMapLoaded() {
    // 给大地图图片节点指定资源地址，后续 M 弹层里会直接显示它。
    this.miniMapImage.src = MINI_MAP_URL;
    // 如果浏览器已经把图片成功加载过，就不必再重复监听 onload 了。
    if (this.miniMapImage.complete && this.miniMapImage.naturalWidth > 0) {
      return;
    }

    // 否则创建一个 Promise，等图片真正加载成功或失败后再继续。
    await new Promise((resolve, reject) => {
      // 图片加载成功时，通知外层 Promise 完成。
      this.miniMapImage.onload = () => resolve();
      // 图片加载失败时，抛出明确错误，方便定位路径问题。
      this.miniMapImage.onerror = () => reject(new Error("小地图资源加载失败。"));
    });
  }

  /**
   * traceDiamondPath 在指定 Canvas 上下文里描出一个逻辑格对应的菱形路径。
   * 功能：封装“一个菱形格该怎么画”，供主视野网格和大地图静态层重复使用。
   * 参数：
   * - context：要写入路径的 Canvas 2D 上下文。
   * - centerPoint：菱形中心点坐标。
   * - halfWidth：菱形半宽。
   * - halfHeight：菱形半高。
   * 返回值：无。
   * 注意事项：该方法只负责写路径，不主动调用 `stroke()` 或 `fill()`，这样主场景和大地图可以用不同颜色和线宽分别控制渲染效果。
   */
  traceDiamondPath(context, centerPoint, halfWidth, halfHeight) {
    // 开始绘制一个新的路径，避免与上一个格子的路径串在一起。
    context.beginPath();
    // 先移动到菱形顶部顶点。
    context.moveTo(centerPoint.x, centerPoint.y - halfHeight);
    // 连到右侧顶点。
    context.lineTo(centerPoint.x + halfWidth, centerPoint.y);
    // 连到底部顶点。
    context.lineTo(centerPoint.x, centerPoint.y + halfHeight);
    // 连到左侧顶点。
    context.lineTo(centerPoint.x - halfWidth, centerPoint.y);
    // 收口回到起点，形成完整闭合菱形。
    context.closePath();
  }

  /**
   * drawGridOverlay 把逻辑网格绘制到主场景中。
   * 功能：用淡红色边框描出所有格子，并对不可通行区域做填充，帮助区分逻辑网格和障碍分布。
   * 参数：无。
   * 返回值：无。
   * 注意事项：该层只需要在初始化时绘制一次，因为地图格数据本身不会动态变化。
   */
  drawGridOverlay() {
    // 拿到主视野网格层的绘图上下文，后面会反复使用。
    const ctx = this.gridContext;
    // 取出单个逻辑格的半宽，画菱形时要频繁用到。
    const halfWidth = this.map.floor.halfWidth;
    // 取出单个逻辑格的半高。
    const halfHeight = this.map.floor.halfHeight;

    // 先清空整个网格层，避免重复初始化或后续重绘时出现叠色残影。
    ctx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
    // 保存当前绘图状态，方便后面恢复 lineWidth、fillStyle 等设置。
    ctx.save();

    // 先设置不可通行格子的填充颜色，让障碍区域更容易一眼看出来。
    ctx.fillStyle = BLOCKED_TILE_FILL_STYLE;
    this.map.forEachTile((tile, cellValue) => {
      // 只有值为 1 的格子才被当前教学版视为硬阻挡，其余值直接跳过不填充。
      if (cellValue !== 1) {
        return;
      }
      // 先把当前阻挡格对应的菱形路径写到 Canvas 上。
      this.traceDiamondPath(ctx, this.map.getStagePoint(tile), halfWidth, halfHeight);
      // 再用当前填充色把这一个格子涂出来。
      ctx.fill();
    });

    // 设置统一的网格线宽度，让所有格边界看起来足够清楚但不过分抢画面。
    ctx.lineWidth = GRID_LINE_WIDTH;
    // 设置主视野网格线颜色。
    ctx.strokeStyle = GRID_STROKE_STYLE;
    this.map.forEachTile((tile) => {
      // 为当前格子写出菱形边框路径。
      this.traceDiamondPath(ctx, this.map.getStagePoint(tile), halfWidth, halfHeight);
      // 按当前描边样式画出边框。
      ctx.stroke();
    });

    // 恢复进入方法前的绘图状态，避免影响后续别的绘图逻辑。
    ctx.restore();
  }

  /**
   * renderMiniMapStaticLayer 生成大地图的静态底层。
   * 功能：把阻挡着色和逻辑网格线一次性画到离屏 Canvas，后续每次刷新大地图时直接复用。
   * 参数：
   * - width：大地图当前显示宽度。
   * - height：大地图当前显示高度。
   * 返回值：无。
   * 注意事项：该方法只负责与地图静态结构有关的内容，玩家点、路径线和视口框这类动态信息仍由 `renderMiniMap()` 每帧叠加。
   */
  renderMiniMapStaticLayer(width, height) {
    // 拿到离屏静态缓存层的绘图上下文。
    const context = this.miniMapStaticContext;
    // 让离屏 Canvas 的实际绘图宽度与当前大地图显示宽度一致。
    this.miniMapStaticCanvas.width = width;
    // 让离屏 Canvas 的实际绘图高度与当前大地图显示高度一致。
    this.miniMapStaticCanvas.height = height;
    // 每次重建静态层前先清空旧内容，避免尺寸变化后出现残留。
    context.clearRect(0, 0, width, height);

    // 计算“世界坐标 -> 大地图 Canvas 坐标”在 X 方向上的缩放比例。
    const scaleX = width / (this.map.mapWidth * this.map.scale);
    // 计算 Y 方向上的缩放比例。
    const scaleY = height / (this.map.mapHeight * this.map.scale);
    // 计算单个逻辑格在大地图 Canvas 上对应的半宽。
    const halfWidth = this.map.floor.halfWidth * this.map.scale * scaleX;
    // 计算单个逻辑格在大地图 Canvas 上对应的半高。
    const halfHeight = this.map.floor.halfHeight * this.map.scale * scaleY;

    /**
     * toMiniPoint 把世界坐标转换成大地图 Canvas 坐标。
     * 功能：把逻辑格中心点的世界像素位置缩放到当前大地图显示尺寸上。
     * 参数：
     * - stagePoint：世界坐标点。
     * 返回值：
     * - `{ x, y }`：落在大地图 Canvas 上的像素坐标。
     * 注意事项：无特殊注意事项。
     */
    const toMiniPoint = (stagePoint) => ({
      // 世界 X 先乘原版小地图缩放，再乘当前显示尺寸相对 small.jpg 的缩放。
      x: stagePoint.x * this.map.scale * scaleX,
      // Y 方向同理。
      y: stagePoint.y * this.map.scale * scaleY
    });

    // 保存当前绘图状态，避免影响外部绘图设置。
    context.save();
    // 先设置不可通行格在大地图上的填充颜色。
    context.fillStyle = MINI_MAP_BLOCKED_FILL_STYLE;
    this.map.forEachTile((tile, cellValue) => {
      // 只有硬阻挡格才做填充，其余格子跳过。
      if (cellValue !== 1) {
        return;
      }
      // 在大地图坐标系里描出当前阻挡格的菱形路径。
      this.traceDiamondPath(context, toMiniPoint(this.map.getStagePoint(tile)), halfWidth, halfHeight);
      // 用大地图专用颜色填充这个阻挡格。
      context.fill();
    });

    // 设置大地图网格线宽。
    context.lineWidth = MINI_MAP_GRID_LINE_WIDTH;
    // 设置大地图网格描边颜色。
    context.strokeStyle = MINI_MAP_GRID_STROKE_STYLE;
    this.map.forEachTile((tile) => {
      // 描出当前格子在大地图上的菱形边界。
      this.traceDiamondPath(context, toMiniPoint(this.map.getStagePoint(tile)), halfWidth, halfHeight);
      // 绘制边框。
      context.stroke();
    });

    // 恢复绘图状态，结束静态层构建。
    context.restore();
  }

  /**
   * placePlayerAtSpawn 把角色放到出生点附近的可走区域。
   * 功能：优先使用第一个传送点附近作为出生参考点，找不到时再退回地图中心附近。
   * 参数：无。
   * 返回值：无。
   * 注意事项：最终真正使用的出生格不一定等于传送点自身，因为传送点落在障碍上时会先搜索最近可走格。
   */
  placePlayerAtSpawn() {
    // 如果地图里存在传送点，就优先拿第一个传送点作为出生参考位置；否则退回到网格中心附近。
    const preferredTile = this.map.transfers.length > 0
      ? { x: this.map.transfers[0].x, y: this.map.transfers[0].y }
      : { x: Math.floor(this.map.floor.row / 2), y: Math.floor(this.map.floor.col / 2) };
    // 在参考点附近搜索一个真正可走的格子，避免出生在障碍里。
    const startTile = this.map.findNearestPassable(preferredTile.x, preferredTile.y, 48);

    // 如果连较大半径里都找不到可走格，说明地图数据异常，直接抛错比默默失败更好定位。
    if (!startTile) {
      throw new Error("初始化失败：未能找到可通行出生点。");
    }

    // 把玩家逻辑位置初始化到最终出生格。
    this.playerTile = startTile;
    // 同步计算出生格中心对应的世界像素坐标，供渲染和移动使用。
    this.playerStage = this.map.getStagePoint(startTile);
    // 相机先对准出生点，让开场视野自然落在玩家附近。
    this.centerCameraOn(this.playerStage);
    // 更新玩家圆点 DOM 标记的位置。
    this.positionPlayerMarker();
    // 记录一条出生日志，方便你确认最终出生格是否被“附近可走格搜索”修正过。
    this.logger.log("系统", `出生格已定位到 (${startTile.x}, ${startTile.y})。`);
  }

  /**
   * bindEvents 绑定鼠标、键盘和表单交互事件。
   * 功能：把点击寻路、M 键开图、拖动速度、清空日志、窗口缩放等交互统一接到对应处理方法上。
   * 参数：无。
   * 返回值：无。
   * 注意事项：该方法只应在地图和 DOM 都准备完成后调用，否则回调里访问的状态可能为空。
   */
  bindEvents() {
    // 主视野点击时，尝试把屏幕坐标换算成逻辑格并发起一次寻路。
    this.sceneViewport.addEventListener("click", (event) => this.handleSceneClick(event));
    // 点击“打开地图”按钮时切换大地图弹层显隐。
    this.toggleMapButton.addEventListener("click", () => this.toggleMapOverlay());
    // 点击弹层里的关闭按钮时关闭大地图。
    this.closeMapButton.addEventListener("click", () => this.closeMapOverlay());
    // 点击遮罩层空白区域时也允许关闭大地图，符合常见弹层交互习惯。
    this.mapOverlay.addEventListener("click", (event) => {
      // 只有点到最外层遮罩或专门的 backdrop 区域时才关闭，避免误伤内部内容点击。
      if (event.target === this.mapOverlay || event.target.classList.contains("map-overlay__backdrop")) {
        this.closeMapOverlay();
      }
    });
    // 点击大地图时，不移动角色，只平移相机视野到对应区域。
    this.miniMapViewport.addEventListener("click", (event) => this.handleMiniMapClick(event));
    // 拖动速度滑块时实时更新玩家移动速度。
    this.speedInput.addEventListener("input", () => this.handleSpeedInput());
    // 点击清空按钮时清除页面日志。
    this.clearLogButton.addEventListener("click", () => this.logger.clear());
    // 监听全局键盘事件，用于处理 M 和 Escape 快捷键。
    window.addEventListener("keydown", (event) => this.handleKeyDown(event));
    // 浏览器窗口尺寸变化时，重新计算视口和相机。
    window.addEventListener("resize", () => this.handleResize());
  }

  /**
   * handleSpeedInput 响应速度滑块变化。
   * 功能：把滑块值同步到运行时速度、界面文本、日志和调试面板。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  handleSpeedInput() {
    // 读取滑块值并转成数字；若浏览器异常返回空值，则退回默认速度作为兜底。
    this.playerMoveSpeed = Number(this.speedInput.value || DEFAULT_PLAYER_MOVE_SPEED);
    // 更新滑块旁边的速度文字显示。
    this.syncSpeedValue();
    // 记一条日志，方便你观察速度变化对移动表现的影响。
    this.logger.log("速度", `移动速度已调整为 ${this.playerMoveSpeed} px/s。`);
    // 调试面板里也同步刷新当前速度值。
    this.updateDebugPanel();
  }

  /**
   * handleSceneClick 处理主场景点击寻路。
   * 功能：把点击事件从“屏幕坐标”一步步换算到“世界坐标”和“逻辑格坐标”，再启动寻路。
   * 参数：
   * - event：鼠标点击事件对象。
   * 返回值：无。
   * 注意事项：这是最适合打断点学习坐标转换流程的方法之一，建议重点观察 `screenX/screenY`、`worldX/worldY`、`rawTile` 和 `safeTarget`。
   */
  handleSceneClick(event) {
    // 如果地图或玩家位置还没准备好，就直接忽略点击，避免空对象错误。
    if (!this.map || !this.playerTile) {
      return;
    }

    // 获取主视野容器在浏览器窗口中的实际矩形位置。
    const rect = this.sceneViewport.getBoundingClientRect();
    // 鼠标 clientX 减去容器 left，得到“相对于当前可视窗口左上角”的屏幕 X。
    const screenX = event.clientX - rect.left;
    // 鼠标 clientY 减去容器 top，得到屏幕 Y。
    const screenY = event.clientY - rect.top;
    // 再叠加当前相机左上角偏移，得到点击点在整张地图中的世界 X。
    const worldX = screenX + this.camera.x;
    // Y 方向同理，得到世界 Y。
    const worldY = screenY + this.camera.y;
    // 把世界像素坐标通过菱形公式反推成原始逻辑格。
    const rawTile = IsoMath.stageToTile(worldX, worldY, this.map.floor);
    // 如果原始格不可走，就在附近搜索一个最近的可走格作为真正目标。
    const safeTarget = this.map.findNearestPassable(rawTile.x, rawTile.y, 18);

    // 记录一次完整的点击换算日志，方便你比对“屏幕 -> 世界 -> 格子”的全过程。
    this.logger.log(
      "点击",
      `屏幕坐标=(${screenX.toFixed(1)}, ${screenY.toFixed(1)})，世界坐标=(${worldX.toFixed(1)}, ${worldY.toFixed(1)})，原始格子=(${rawTile.x}, ${rawTile.y})${safeTarget ? `，最近可走格=(${safeTarget.x}, ${safeTarget.y})` : "，附近无可走格"}`
    );

    // 如果附近完全找不到可走格，就给用户一个明确提示并终止本次寻路。
    if (!safeTarget) {
      this.setStatus("该位置附近没有可通行格子。", true);
      return;
    }

    // 目标合法时，正式进入寻路流程。
    this.startPathTo(safeTarget);
  }

  /**
   * handleMiniMapClick 处理大地图点击。
   * 功能：把大地图图片上的点击位置换算回世界坐标，并把相机中心平移过去。
   * 参数：
   * - event：鼠标点击事件对象。
   * 返回值：无。
   * 注意事项：该方法不会让角色自动走过去，它只改变相机位置，目的是让你快速浏览整张地图结构。
   */
  handleMiniMapClick(event) {
    // 如果地图还没初始化完成，就不处理大地图点击。
    if (!this.map) {
      return;
    }

    // 读取当前大地图图片在浏览器中的显示区域。
    const rect = this.miniMapImage.getBoundingClientRect();
    // 计算点击点在大地图图片内部的局部 X 坐标。
    const localX = event.clientX - rect.left;
    // 计算点击点在大地图图片内部的局部 Y 坐标。
    const localY = event.clientY - rect.top;
    // 计算当前显示宽度相对于原始小地图世界宽度的 X 缩放比。
    const displayScaleX = rect.width / (this.map.mapWidth * this.map.scale);
    // 计算 Y 缩放比。
    const displayScaleY = rect.height / (this.map.mapHeight * this.map.scale);
    // 把大地图内部点击 X 反算回整张世界地图中的 X 坐标。
    const worldX = localX / (this.map.scale * displayScaleX);
    // 把点击 Y 反算回世界 Y 坐标。
    const worldY = localY / (this.map.scale * displayScaleY);
    // 让相机中心移动到点击点附近，而不是把点击点对齐到左上角，所以要减半个视口尺寸。
    this.setCamera(worldX - this.camera.width / 2, worldY - this.camera.height / 2);
    // 记录一条日志，便于学习大地图点击与世界坐标之间的对应关系。
    this.logger.log("大地图", `镜头已平移到接近世界坐标 (${worldX.toFixed(1)}, ${worldY.toFixed(1)})。`);
  }

  /**
   * handleKeyDown 处理键盘快捷键。
   * 功能：支持按 M 切换大地图，按 Escape 关闭大地图。
   * 参数：
   * - event：键盘事件对象。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  handleKeyDown(event) {
    // 按下 m 或 M 时切换大地图显示状态。
    if (event.key === "m" || event.key === "M") {
      // 阻止浏览器或页面的默认按键行为，确保快捷键只服务于本 demo。
      event.preventDefault();
      // 切换弹层显隐。
      this.toggleMapOverlay();
      return;
    }

    // 按下 Escape 时关闭大地图弹层。
    if (event.key === "Escape") {
      this.closeMapOverlay();
    }
  }

  /**
   * handleResize 在窗口尺寸变化时重算视口和大地图。
   * 功能：更新 camera 宽高、重新对准玩家，并刷新主场景和调试信息。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  handleResize() {
    // 先重新读取当前主视野容器的实际可视尺寸。
    this.resizeViewport();
    // 再把相机重新居中到玩家当前位置；若玩家尚未准备好，则尽量保持原相机中心附近。
    this.centerCameraOn(this.playerStage || { x: this.camera.x, y: this.camera.y });
    // 最后统一刷新路径层、大地图层和调试面板。
    this.updateScene();
  }

  /**
   * resizeViewport 读取最新视口大小并更新相机尺寸。
   * 功能：把主场景窗口当前的客户端宽高同步到 camera 上。
   * 参数：无。
   * 返回值：无。
   * 注意事项：该方法只更新相机宽高，不负责调整相机位置。
   */
  resizeViewport() {
    // 读取主视野容器当前的内容宽度，作为 camera.width。
    this.camera.width = this.sceneViewport.clientWidth;
    // 读取主视野容器当前的内容高度，作为 camera.height。
    this.camera.height = this.sceneViewport.clientHeight;
  }

  /**
   * startPathTo 计算并启动到目标格的路径。
   * 功能：调用 A* 生成路径、准备剩余路径队列、放置目标标记并刷新状态提示。
   * 参数：
   * - targetTile：目标逻辑格。
   * 返回值：无。
   * 注意事项：返回路径长度小于等于 1 时，通常表示已在目标点上或本次未找到有效路径。
   */
  startPathTo(targetTile) {
    // 调用寻路器计算从当前玩家格到目标格的完整逻辑路径。
    const pathTiles = this.pathFinder.findPath(this.playerTile, targetTile);
    // 如果路径长度不足两点，说明没有真正需要移动的路径，直接提示并结束。
    if (pathTiles.length <= 1) {
      this.setStatus("当前位置已经到达目标点，或者无法生成有效路径。", true);
      return;
    }

    // 保存完整逻辑路径，供日志和后续教学观察使用。
    this.activePathTiles = pathTiles;
    // 从第二个节点开始构造待行走队列，因为第一个节点就是玩家当前所在格。
    this.pathQueue = pathTiles.slice(1).map((tile) => ({
      // 记录该路径点的逻辑格坐标。
      tile,
      // 同步缓存它对应的世界坐标，后续逐帧移动时就不必重复换算。
      stage: this.map.getStagePoint(tile)
    }));
    // 保存当前最终目标格，供调试面板和状态展示使用。
    this.destinationTile = targetTile;
    // 计算目标格中心在世界坐标中的位置，以便显示目标标记。
    const destinationStage = this.map.getStagePoint(targetTile);
    // 把目标标记摆到目标格中心位置。
    this.destinationMarker.style.left = `${destinationStage.x}px`;
    // 设置目标标记的纵向位置。
    this.destinationMarker.style.top = `${destinationStage.y}px`;
    // 让目标标记从隐藏状态切换为可见。
    this.destinationMarker.classList.remove("destination-marker--hidden");

    // 把完整路径拼成 `(x, y) -> (x, y)` 的可读文本，用于日志输出。
    const routeText = pathTiles.map((tile) => `(${tile.x}, ${tile.y})`).join(" -> ");
    // 记录一次详细寻路日志，方便你观察 A* 返回了哪些格子。
    this.logger.log("寻路", `目标格=(${targetTile.x}, ${targetTile.y})，路径长度=${pathTiles.length}，经过格子：${routeText}`);
    // 顶部状态栏同步提示当前从哪里将走到哪里。
    this.setStatus(`已规划路径：从 (${this.playerTile.x}, ${this.playerTile.y}) 前往 (${targetTile.x}, ${targetTile.y})。`);
    // 立即刷新一次场景，让路径线和大地图立刻显示出来。
    this.updateScene();
  }

  /**
   * loop 动画主循环。
   * 功能：按帧计算时间差、驱动角色移动、刷新场景，并持续请求下一帧。
   * 参数：
   * - time：`requestAnimationFrame` 提供的高精度时间戳，单位毫秒。
   * 返回值：无。
   * 注意事项：这里对单帧时间差做了上限裁剪，避免浏览器切后台或卡顿后恢复时角色一下子跨越太远。
   */
  loop(time) {
    // 第一帧没有“上一帧时间”，先把当前时间记下来，作为后续差值计算基准。
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = time;
    }
    // 把毫秒差转换成秒，并限制单帧最大步长为 0.05 秒，防止大跳帧导致移动异常。
    const deltaSeconds = Math.min((time - this.lastFrameTime) / 1000, 0.05);
    // 更新上一帧时间戳，为下一轮循环做准备。
    this.lastFrameTime = time;
    // 根据本帧时间差推进角色沿路径移动。
    this.updateMovement(deltaSeconds);
    // 移动完成后统一刷新路径层、大地图层和调试面板。
    this.updateScene();
    // 继续请求下一帧，形成持续动画循环。
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  /**
   * updateMovement 驱动角色沿路径移动。
   * 功能：按“本帧可移动距离”逐段消耗 `pathQueue`，必要时在一帧内跨过多个格点。
   * 参数：
   * - deltaSeconds：本帧与上一帧的时间差，单位秒。
   * 返回值：无。
   * 注意事项：该方法会同时更新 `playerStage`、`playerTile`、`pathQueue`、目标标记和顶部状态，是整个“走路”过程的核心逻辑。
   */
  updateMovement(deltaSeconds) {
    // 只要玩家位置还没就绪，或者当前没有任何待走路径，就无需做移动计算。
    if (!this.playerStage || this.pathQueue.length === 0) {
      return;
    }

    // 根据“像素每秒速度 * 本帧秒数”算出这一帧最多能走多少像素距离。
    let remainingDistance = this.playerMoveSpeed * deltaSeconds;

    // 只要本帧还有剩余可走距离，并且路径队列里还有目标点，就持续推进。
    while (remainingDistance > 0 && this.pathQueue.length > 0) {
      // 取出当前要追赶的下一个路径点，但先不弹出，因为可能本帧还走不到它。
      const nextPoint = this.pathQueue[0];
      // 计算从玩家当前位置到目标点在 X 方向上的位移差。
      const dx = nextPoint.stage.x - this.playerStage.x;
      // 计算 Y 方向上的位移差。
      const dy = nextPoint.stage.y - this.playerStage.y;
      // 通过勾股定理得到当前距离目标点还剩多少像素。
      const distance = Math.hypot(dx, dy);

      // 如果本帧剩余距离足够直接走到这个路径点，就把玩家精确落到该点上。
      if (distance <= remainingDistance) {
        // 把世界坐标对齐到这个路径点，避免浮点累计误差。
        this.playerStage = { ...nextPoint.stage };
        // 同步把逻辑格更新成这个路径点对应的格子。
        this.playerTile = { ...nextPoint.tile };
        // 当前路径点已经到达，正式从队列头部移除。
        this.pathQueue.shift();
        // 扣掉走到这个点所消耗的距离，剩余距离继续尝试推进后续路径点。
        remainingDistance -= distance;
        // 记录一条“经过某格”的日志，方便你观察逐格移动顺序。
        this.logger.log("行走", `经过格子 (${this.playerTile.x}, ${this.playerTile.y})。`);

        // 如果移除后路径队列已经空了，说明本次寻路已经完全走完。
        if (this.pathQueue.length === 0) {
          // 清空完整路径缓存，表示没有活动路径了。
          this.activePathTiles = [];
          // 清空目标格引用。
          this.destinationTile = null;
          // 隐藏目标标记。
          this.destinationMarker.classList.add("destination-marker--hidden");
          // 顶部提示角色已经到达最终格子。
          this.setStatus(`已到达 (${this.playerTile.x}, ${this.playerTile.y})。`);
        }
      } else {
        // 如果本帧走不到下一个路径点，就按剩余距离占整段距离的比例做一次线性插值。
        const ratio = remainingDistance / distance;
        this.playerStage = {
          // 沿着当前路径段朝目标点推进一小段 X 位移。
          x: this.playerStage.x + dx * ratio,
          // 沿着当前路径段朝目标点推进一小段 Y 位移。
          y: this.playerStage.y + dy * ratio
        };
        // 本帧距离已经全部用完，结束 while，等待下一帧继续走。
        remainingDistance = 0;
      }
    }

    // 无论是否刚好到格，都让相机重新追随玩家当前位置。
    this.centerCameraOn(this.playerStage);
    // 同步更新玩家标记在 DOM 中的位置。
    this.positionPlayerMarker();
  }

  /**
   * centerCameraOn 让镜头以某个世界点为中心。
   * 功能：把目标点平移到当前视口中心位置附近。
   * 参数：
   * - stagePoint：世界像素坐标点。
   * 返回值：无。
   * 注意事项：真正的边界裁剪由 `setCamera()` 处理，因此即使目标点靠近地图边缘也不会把相机移出地图外。
   */
  centerCameraOn(stagePoint) {
    // 目标点减去半个视口尺寸，就得到“以它为中心时相机左上角应该在哪里”。
    this.setCamera(stagePoint.x - this.camera.width / 2, stagePoint.y - this.camera.height / 2);
  }

  /**
   * setCamera 设置镜头左上角并做边界裁切。
   * 功能：更新相机状态，并通过给 worldLayer 设置 translate 实现世界整体平移。
   * 参数：
   * - x：期望的相机左上角世界 X。
   * - y：期望的相机左上角世界 Y。
   * 返回值：无。
   * 注意事项：该方法会把相机坐标限制在 `[0, 地图尺寸 - 视口尺寸]` 范围内，避免看到地图外的空白区域。
   */
  setCamera(x, y) {
    // 计算相机在 X 方向上允许的最大值；如果地图比视口还小，则至少取 0。
    const maxX = Math.max(0, this.map.mapWidth - this.camera.width);
    // 计算 Y 方向允许的最大值。
    const maxY = Math.max(0, this.map.mapHeight - this.camera.height);
    // 先把期望 X 裁到合法范围内，再保存到 camera.x。
    this.camera.x = Math.min(Math.max(0, x), maxX);
    // 同理，裁切并保存 camera.y。
    this.camera.y = Math.min(Math.max(0, y), maxY);
    // 通过负向平移整个世界层，让相机“看到”的区域等于当前 camera 左上角开始的窗口。
    this.worldLayer.style.transform = `translate(${-this.camera.x}px, ${-this.camera.y}px)`;
  }

  /**
   * positionPlayerMarker 把玩家标记摆到当前世界坐标上。
   * 功能：同步 DOM 圆点与 `playerStage` 的位置。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  positionPlayerMarker() {
    // 把玩家标记的 left 设置为当前世界 X 坐标。
    this.playerMarker.style.left = `${this.playerStage.x}px`;
    // 把玩家标记的 top 设置为当前世界 Y 坐标。
    this.playerMarker.style.top = `${this.playerStage.y}px`;
  }

  /**
   * updateScene 统一刷新路径、大地图和调试信息。
   * 功能：把当前运行时状态同步到所有可见 UI 层。
   * 参数：无。
   * 返回值：无。
   * 注意事项：该方法不负责重画背景层和主视野网格层，因为它们是静态内容。
   */
  updateScene() {
    // 刷新主视野中的路径折线和路径节点。
    this.renderPath();
    // 刷新 M 弹层中的大地图覆盖内容。
    this.renderMiniMap();
    // 刷新右侧调试面板文本。
    this.updateDebugPanel();
  }

  /**
   * renderPath 在主场景里绘制当前剩余路径。
   * 功能：把玩家当前位置到尚未走完的路径节点画成折线，并给每个节点画出圆点。
   * 参数：无。
   * 返回值：无。
   * 注意事项：这里只绘制剩余路径，不会把已经走过的段保留下来。
   */
  renderPath() {
    // 取出主视野路径层的绘图上下文。
    const ctx = this.pathContext;
    // 每次重绘前先清空旧路径，避免角色移动后留下残影。
    ctx.clearRect(0, 0, this.pathCanvas.width, this.pathCanvas.height);

    // 如果玩家还没就绪，或者当前根本没有待行走路径，就没有必要绘制任何内容。
    if (!this.playerStage || this.pathQueue.length === 0) {
      return;
    }

    // 保存当前绘图状态，避免设置影响其他 Canvas 绘制。
    ctx.save();
    // 设置路径线宽，使其在地图上足够清晰。
    ctx.lineWidth = 4;
    // 设置路径主颜色。
    ctx.strokeStyle = "rgba(255, 213, 107, 0.95)";
    // 为路径添加一点暖色阴影，让它和地图底图区分更明显。
    ctx.shadowColor = "rgba(255, 188, 71, 0.45)";
    // 设置阴影模糊半径。
    ctx.shadowBlur = 10;
    // 开始绘制路径线。
    ctx.beginPath();
    // 从玩家当前位置开始连线。
    ctx.moveTo(this.playerStage.x, this.playerStage.y);
    for (const point of this.pathQueue) {
      // 依次把后续每个路径点连起来，形成折线。
      ctx.lineTo(point.stage.x, point.stage.y);
    }
    // 真正把折线画到路径层上。
    ctx.stroke();

    // 设置路径节点圆点的填充颜色。
    ctx.fillStyle = "rgba(255, 241, 198, 0.95)";
    for (const point of this.pathQueue) {
      // 为每个未走完的路径点单独创建一个圆形路径。
      ctx.beginPath();
      // 在该路径点中心画一个小圆。
      ctx.arc(point.stage.x, point.stage.y, 4, 0, Math.PI * 2);
      // 填充圆点。
      ctx.fill();
    }
    // 恢复绘图状态。
    ctx.restore();
  }

  /**
   * renderMiniMap 在全景地图上绘制内容。
   * 功能：先绘制静态层中的网格和阻挡格，再叠加角色、路径和当前视口框。
   * 参数：无。
   * 返回值：无。
   * 注意事项：该方法即使大地图弹层当前是隐藏的，也可能被调用，但只要底图尺寸不可用就会直接返回，不会造成错误。
   */
  renderMiniMap() {
    // 如果地图还没准备好，或者大地图图片还没真正加载完成，就无法正确绘制，直接退出。
    if (!this.map || !this.miniMapImage.naturalWidth) {
      return;
    }

    // 读取当前大地图图片在页面上的实际显示宽度。
    const width = this.miniMapImage.clientWidth;
    // 读取当前显示高度。
    const height = this.miniMapImage.clientHeight;
    // 如果图片当前还没参与布局，尺寸可能为 0，此时也先不绘制。
    if (width === 0 || height === 0) {
      return;
    }

    // 当大地图 Canvas 尺寸和图片显示尺寸不一致时，需要重建动态层和静态缓存层。
    if (this.miniMapCanvas.width !== width || this.miniMapCanvas.height !== height) {
      // 让动态 Canvas 的实际宽度与当前图片显示宽度对齐。
      this.miniMapCanvas.width = width;
      // 让动态 Canvas 的实际高度与当前图片显示高度对齐。
      this.miniMapCanvas.height = height;
      // 基于新尺寸重新生成一次网格与阻挡的静态缓存层。
      this.renderMiniMapStaticLayer(width, height);
    }

    // 取出大地图动态层的绘图上下文。
    const ctx = this.miniMapContext;
    // 计算世界坐标转大地图显示坐标的 X 缩放比例。
    const scaleX = width / (this.map.mapWidth * this.map.scale);
    // 计算 Y 缩放比例。
    const scaleY = height / (this.map.mapHeight * this.map.scale);

    /**
     * stageToMini 把世界坐标转换成当前大地图显示坐标。
     * 功能：供玩家点、路径线和视口框绘制时重复使用。
     * 参数：
     * - stage：世界坐标点。
     * 返回值：
     * - `{ x, y }`：大地图 Canvas 上的坐标点。
     * 注意事项：无特殊注意事项。
     */
    const stageToMini = (stage) => ({
      // 世界 X 先经过原版小地图 scale，再经过当前显示尺寸缩放。
      x: stage.x * this.map.scale * scaleX,
      // Y 方向同理。
      y: stage.y * this.map.scale * scaleY
    });

    // 先清空上一帧的大地图动态内容。
    ctx.clearRect(0, 0, width, height);
    // 把已经缓存好的静态网格和阻挡层直接贴上来，避免每帧重算所有格子。
    ctx.drawImage(this.miniMapStaticCanvas, 0, 0);

    // 只有在玩家已经成功出生后，才有必要绘制玩家点、路径和视口框。
    if (this.playerStage) {
      // 把玩家世界坐标换算成大地图上的像素位置。
      const playerMini = stageToMini(this.playerStage);
      // 保存绘图状态，避免线宽和颜色泄漏到外部。
      ctx.save();
      // 设置大地图路径线宽。
      ctx.lineWidth = 2;
      // 设置路径线描边颜色。
      ctx.strokeStyle = "rgba(255, 237, 175, 0.95)";
      // 设置玩家点填充颜色。
      ctx.fillStyle = "rgba(255, 196, 70, 0.95)";

      // 如果还有剩余路径，就先把玩家当前位置到路径点的折线画出来。
      if (this.pathQueue.length > 0) {
        // 开始绘制大地图路径。
        ctx.beginPath();
        // 从玩家当前位置开始。
        ctx.moveTo(playerMini.x, playerMini.y);
        for (const point of this.pathQueue) {
          // 把每个剩余路径点依次换算到大地图坐标。
          const miniPoint = stageToMini(point.stage);
          // 连线到这个路径点。
          ctx.lineTo(miniPoint.x, miniPoint.y);
        }
        // 真正画出路径线。
        ctx.stroke();
      }

      // 开始绘制玩家当前位置圆点。
      ctx.beginPath();
      // 在玩家大地图位置画一个半径 5 的圆。
      ctx.arc(playerMini.x, playerMini.y, 5, 0, Math.PI * 2);
      // 填充玩家圆点。
      ctx.fill();

      // 改用较亮颜色绘制当前主视野对应的矩形框。
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      // 设置视口框线宽。
      ctx.lineWidth = 1.5;
      // 根据相机左上角和视口尺寸，在大地图上画出当前可见区域框。
      ctx.strokeRect(
        this.camera.x * this.map.scale * scaleX,
        this.camera.y * this.map.scale * scaleY,
        this.camera.width * this.map.scale * scaleX,
        this.camera.height * this.map.scale * scaleY
      );
      // 恢复绘图状态。
      ctx.restore();
    }
  }

  /**
   * updateDebugPanel 刷新右侧调试信息。
   * 功能：把地图尺寸、格子尺寸、玩家坐标、相机坐标、路径状态等信息汇总成多行文本。
   * 参数：无。
   * 返回值：无。
   * 注意事项：这块文本是学习用的“状态快照”，非常适合配合断点和日志一起观察。
   */
  updateDebugPanel() {
    // 只有地图、玩家逻辑格和玩家世界坐标都已经准备好时，调试面板内容才有意义。
    if (!this.map || !this.playerTile || !this.playerStage) {
      return;
    }

    // 取出当前剩余路径的下一个目标格，方便单独展示。
    const nextTarget = this.pathQueue[0]?.tile;
    // 把关键信息整理成多行文本，直接显示在右侧调试面板中。
    this.debugText.textContent = [
      `地图：${this.map.mapName}`,
      `资源目录：${MAP_RESOURCE_ROOT}`,
      `地图尺寸：${this.map.mapWidth} x ${this.map.mapHeight}`,
      `逻辑网格：${this.map.floor.row} x ${this.map.floor.col}`,
      `格子尺寸：${this.map.floor.tileWidth} x ${this.map.floor.tileHeight}`,
      `移动速度：${this.playerMoveSpeed} px/s`,
      `玩家逻辑格：(${this.playerTile.x}, ${this.playerTile.y})`,
      `玩家世界坐标：(${this.playerStage.x.toFixed(1)}, ${this.playerStage.y.toFixed(1)})`,
      `镜头左上角：(${this.camera.x.toFixed(1)}, ${this.camera.y.toFixed(1)})`,
      `剩余路径点：${this.pathQueue.length}`,
      `下一目标格：${nextTarget ? `(${nextTarget.x}, ${nextTarget.y})` : "无"}`,
      `传送点数量：${this.map.transfers.length}`,
      "说明：底图是平面切片，寻路走的是菱形逻辑网格。"
    ].join("\n");
  }

  /**
   * toggleMapOverlay 切换全景地图弹层显隐。
   * 功能：如果当前隐藏则打开，如果当前显示则关闭。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  toggleMapOverlay() {
    // 如果当前大地图是隐藏状态，就执行打开逻辑。
    if (this.mapOverlay.classList.contains("map-overlay--hidden")) {
      this.openMapOverlay();
      return;
    }
    // 否则说明当前已经打开，执行关闭逻辑。
    this.closeMapOverlay();
  }

  /**
   * openMapOverlay 打开全景地图弹层。
   * 功能：显示弹层并立刻刷新一次大地图内容。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  openMapOverlay() {
    // 去掉隐藏类名，让弹层显示出来。
    this.mapOverlay.classList.remove("map-overlay--hidden");
    // 更新无障碍属性，告诉辅助技术当前弹层可见。
    this.mapOverlay.setAttribute("aria-hidden", "false");
    // 打开时立即刷新一次大地图，确保你看到的是当前最新状态。
    this.renderMiniMap();
  }

  /**
   * closeMapOverlay 关闭全景地图弹层。
   * 功能：隐藏弹层并更新无障碍属性。
   * 参数：无。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  closeMapOverlay() {
    // 加回隐藏类名，让弹层退出显示状态。
    this.mapOverlay.classList.add("map-overlay--hidden");
    // 更新无障碍属性，标记为隐藏。
    this.mapOverlay.setAttribute("aria-hidden", "true");
  }

  /**
   * setStatus 更新顶部状态文本。
   * 功能：在顶部状态栏显示当前阶段提示，并按是否为警告切换颜色。
   * 参数：
   * - message：要显示的状态信息。
   * - isWarning：是否以提醒色显示这条信息，默认为 `false`。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  setStatus(message, isWarning = false) {
    // 直接替换顶部状态栏文本内容。
    this.statusText.textContent = message;
    // 如果是警告，则用更醒目的暖黄色；否则使用默认柔和文字色。
    this.statusText.style.color = isWarning ? "#ffd7a0" : "rgba(255, 239, 214, 0.8)";
  }
}
