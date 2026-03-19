/**
 * WULIANGSHAN_RESOURCE_ROOT 指向已经复制到 sandbox 中的无量山资源目录。
 * 功能：供当前 mapdemo 查看器叠加原始底图时复用已有资源副本，而不是读取原项目目录。
 * 参数：无。
 * 返回值：字符串路径。
 * 注意事项：这里引用的是 `sandbox/wuliangshan-h5-demo` 里的资源副本，仍然属于沙箱目录，不会污染原项目。
 */
export const WULIANGSHAN_RESOURCE_ROOT = "../wuliangshan-h5-demo/assets/map/101/";

/**
 * WULIANGSHAN_CONFIG_URL 是无量山配置 XML 地址。
 * 功能：供查看器复用无量山的地图尺寸、Floor 行列、格子宽高、偏移量等参数。
 * 参数：无。
 * 返回值：字符串路径。
 * 注意事项：当前 mapdemo 的文本网格行列与无量山一致，所以直接借用它的参数最直观。
 */
export const WULIANGSHAN_CONFIG_URL = `${WULIANGSHAN_RESOURCE_ROOT}config.xml`;

/**
 * MAP_TEXT_URL 是 mapdemo 文本网格地址。
 * 功能：供查看器读取 `map1.txt` 中的 0/1/2 网格数据。
 * 参数：无。
 * 返回值：字符串路径。
 * 注意事项：虽然用户口头说“二进制地图”，但当前文件实际是按行存储的文本数字矩阵。
 */
export const MAP_TEXT_URL = "./map1.txt";

/**
 * BACKGROUND_TILE_SIZE 表示无量山底图切片固定尺寸。
 * 功能：指导背景拼装层按 `x_y.jpg` 规则把切片摆回世界坐标。
 * 参数：无。
 * 返回值：数字，单位像素。
 * 注意事项：若后续换底图资源且切片尺寸不同，这里也需要同步调整。
 */
export const BACKGROUND_TILE_SIZE = 300;

/**
 * DEFAULT_OVERLAY_OPACITY 表示默认网格覆盖层透明度。
 * 功能：控制 mapdemo 网格与无量山底图叠加时的初始可见程度。
 * 参数：无。
 * 返回值：数字，范围 0~1。
 * 注意事项：当前页面会绘制全部 211x211 菱形格，所以初始透明度略低一点，避免遮住太多底图细节。
 */
export const DEFAULT_OVERLAY_OPACITY = 0.7;

/**
 * DEFAULT_BACKGROUND_OPACITY 表示默认底图透明度。
 * 功能：控制无量山底图在叠加对照中的初始可见程度。
 * 参数：无。
 * 返回值：数字，范围 0~1。
 * 注意事项：这个值和覆盖层透明度通常要配合调整，才能看清偏移关系。
 */
export const DEFAULT_BACKGROUND_OPACITY = 0.76;

/**
 * EMPTY_TILE_STROKE_STYLE 表示值为 0 的空白格描边颜色。
 * 功能：把原本不会绘制的空白格也轻描出来，方便观察完整 211x211 网格如何覆盖到底图上。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：颜色故意比较淡，否则完整网格会过于抢眼。
 */
export const EMPTY_TILE_STROKE_STYLE = "rgba(173, 201, 215, 0.28)";

/**
 * EMPTY_TILE_FILL_STYLE 表示值为 0 的空白格填充颜色。
 * 功能：给空白格一点非常轻的底色，帮助肉眼辨认完整菱形区域范围。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：透明度很低，主要目的是保留“看得到格子”但不遮挡底图。
 */
export const EMPTY_TILE_FILL_STYLE = "rgba(173, 201, 215, 0.04)";

/**
 * GRID_STROKE_STYLE 表示值为 1 的普通占用格描边颜色。
 * 功能：让 `1` 类型格子的边界在地图上更清晰。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：当前颜色偏暖红，和无量山底图叠加时对比比较明显。
 */
export const GRID_STROKE_STYLE = "rgba(217, 93, 93, 0.92)";

/**
 * GRID_FILL_STYLE 表示值为 1 的普通占用格填充颜色。
 * 功能：用半透明颜色画出 `1` 类型格子的轮廓区域。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：填充透明度不宜过高，否则会盖住底图细节。
 */
export const GRID_FILL_STYLE = "rgba(217, 93, 93, 0.24)";

/**
 * SPECIAL_FILL_STYLE 表示特殊值 `2` 的填充颜色。
 * 功能：把 map1.txt 中的 `2` 单独高亮出来，便于和普通占用格区分。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：当前用金橙色是为了和 `1` 的红色明显区分。
 */
export const SPECIAL_FILL_STYLE = "rgba(250, 196, 68, 0.42)";

/**
 * SPECIAL_STROKE_STYLE 表示特殊值 `2` 的描边颜色。
 * 功能：让特殊区域边界在缩放后依然容易识别。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：无特殊注意事项。
 */
export const SPECIAL_STROKE_STYLE = "rgba(255, 214, 107, 0.96)";

/**
 * AXIS_STROKE_STYLE 表示原点参考轴颜色。
 * 功能：在查看器里画出穿过世界原点的水平线和垂直线，帮助你判断原点在完整网格中的位置。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：这两条线是参考线，不代表真实地形边界。
 */
export const AXIS_STROKE_STYLE = "rgba(255, 255, 255, 0.36)";

/**
 * BACKGROUND_BOUNDS_STROKE_STYLE 表示底图世界边界框颜色。
 * 功能：把无量山底图实际占用的 `4200 x 4200` 世界矩形单独框出来。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：这条矩形框能帮助你看出“完整网格”超出底图的部分到底有多少。
 */
export const BACKGROUND_BOUNDS_STROKE_STYLE = "rgba(102, 225, 255, 0.88)";

/**
 * GRID_BOUNDS_STROKE_STYLE 表示完整菱形网格外包框颜色。
 * 功能：把 211x211 菱形网格投影后的整体包围范围单独标出来。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：这个边界框只是方便你看范围，真实格子形状仍然以菱形为准。
 */
export const GRID_BOUNDS_STROKE_STYLE = "rgba(162, 255, 132, 0.84)";

/**
 * DEFAULT_ZOOM_PADDING 表示重置视图时给整张地图预留的边距比例。
 * 功能：避免刚进入页面时内容贴满容器边缘，看起来太挤。
 * 参数：无。
 * 返回值：数字比例。
 * 注意事项：值越大，初始缩放越小。
 */
export const DEFAULT_ZOOM_PADDING = 0.92;

/**
 * MIN_SCALE 表示允许缩小到的最小倍数。
 * 功能：限制 Ctrl+滚轮缩放时的最小比例，避免把地图缩得过小。
 * 参数：无。
 * 返回值：数字倍率。
 * 注意事项：无特殊注意事项。
 */
export const MIN_SCALE = 0.05;

/**
 * MAX_SCALE 表示允许放大到的最大倍数。
 * 功能：限制 Ctrl+滚轮缩放时的最大比例，避免过度放大影响交互。
 * 参数：无。
 * 返回值：数字倍率。
 * 注意事项：无特殊注意事项。
 */
export const MAX_SCALE = 6;
