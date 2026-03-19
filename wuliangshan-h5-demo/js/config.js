/**
 * MAP_RESOURCE_ROOT 指向 demo 自己携带的无量山资源目录。
 * 功能：让独立 demo 只依赖自身目录下的资源副本，不再读取原项目中的同名资源。
 * 参数：无。
 * 返回值：字符串路径。
 * 注意事项：如果你后续想切到别的地图做教学，只需要先复制对应资源，再把这里改到新的目录即可。
 */
export const MAP_RESOURCE_ROOT = "./assets/map/101/";

/**
 * MAP_CONFIG_URL 是地图 XML 配置地址。
 * 功能：供 `fetch()` 在初始化阶段读取 Floor 网格、地图尺寸和传送点数据。
 * 参数：无。
 * 返回值：字符串路径。
 * 注意事项：它基于 `MAP_RESOURCE_ROOT` 拼接，因此切换资源根目录时会自动联动更新。
 */
export const MAP_CONFIG_URL = `${MAP_RESOURCE_ROOT}config.xml`;

/**
 * MINI_MAP_URL 是大地图底图图片地址。
 * 功能：供 M 弹层中的 `small.jpg` 显示使用。
 * 参数：无。
 * 返回值：字符串路径。
 * 注意事项：无特殊注意事项。
 */
export const MINI_MAP_URL = `${MAP_RESOURCE_ROOT}small.jpg`;

/**
 * BACKGROUND_TILE_SIZE 表示背景切片固定尺寸。
 * 功能：告诉背景拼装逻辑每张 `x_y.jpg` 切片的理论宽高。
 * 参数：无。
 * 返回值：数字，单位为像素。
 * 注意事项：如果原始资源切片尺寸变化，这个常量也必须同步修改，否则底图会错位。
 */
export const BACKGROUND_TILE_SIZE = 300;

/**
 * DEFAULT_PLAYER_MOVE_SPEED 表示默认移动速度。
 * 功能：决定页面初次打开时角色每秒能走多少像素。
 * 参数：无。
 * 返回值：数字，单位为像素每秒。
 * 注意事项：它同时影响初始化后的滑块默认值。
 */
export const DEFAULT_PLAYER_MOVE_SPEED = 240;

/**
 * MIN_PLAYER_MOVE_SPEED 表示速度滑块允许的最小值。
 * 功能：限制教学时最慢能调到多低。
 * 参数：无。
 * 返回值：数字，单位为像素每秒。
 * 注意事项：无特殊注意事项。
 */
export const MIN_PLAYER_MOVE_SPEED = 60;

/**
 * MAX_PLAYER_MOVE_SPEED 表示速度滑块允许的最大值。
 * 功能：限制教学时最快能调到多高。
 * 参数：无。
 * 返回值：数字，单位为像素每秒。
 * 注意事项：过大时虽然代码仍可运行，但观察逐格移动会变得不直观。
 */
export const MAX_PLAYER_MOVE_SPEED = 600;

/**
 * GRID_STROKE_STYLE 表示主视野网格描边颜色。
 * 功能：用稍浅的红色把所有逻辑格边界画出来。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：这里故意不设成太深的红色，避免压住地图底图细节。
 */
export const GRID_STROKE_STYLE = "rgba(214, 92, 92, 0.32)";

/**
 * GRID_LINE_WIDTH 表示主视野网格线宽。
 * 功能：控制主场景里每个菱形格边框的粗细。
 * 参数：无。
 * 返回值：数字，单位为像素。
 * 注意事项：无特殊注意事项。
 */
export const GRID_LINE_WIDTH = 1;

/**
 * BLOCKED_TILE_FILL_STYLE 表示主场景中阻挡格的填充颜色。
 * 功能：用半透明红色标出不可通行区域，方便和可通行区域区分。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：透明度过高会压暗底图，过低则不易观察。
 */
export const BLOCKED_TILE_FILL_STYLE = "rgba(147, 112, 219, 0.24)";

/**
 * MINI_MAP_BLOCKED_FILL_STYLE 表示大地图中阻挡格的填充颜色。
 * 功能：在缩略视图中更明显地标记障碍区域。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：这里透明度略高于主视野，是因为大地图缩小后更需要对比度。
 */
export const MINI_MAP_BLOCKED_FILL_STYLE = "rgba(178, 34, 34, 0.54)";

/**
 * MINI_MAP_GRID_STROKE_STYLE 表示大地图逻辑网格描边颜色。
 * 功能：控制 M 弹层中网格边线的颜色。
 * 参数：无。
 * 返回值：CSS 颜色字符串。
 * 注意事项：无特殊注意事项。
 */
export const MINI_MAP_GRID_STROKE_STYLE = "rgba(214, 92, 92, 0.4)";

/**
 * MINI_MAP_GRID_LINE_WIDTH 表示大地图逻辑网格描边宽度。
 * 功能：控制大地图缩略视图中的边框粗细。
 * 参数：无。
 * 返回值：数字，单位为像素。
 * 注意事项：因为大地图整体缩得更小，所以这里比主视野线宽更细。
 */
export const MINI_MAP_GRID_LINE_WIDTH = 0.8;

/**
 * MAX_LOG_LINES 表示日志面板保留的最大日志行数。
 * 功能：防止长时间点击调试后页面日志无限增长。
 * 参数：无。
 * 返回值：数字，单位为行。
 * 注意事项：它只限制页面可见日志，不影响浏览器控制台里的历史输出。
 */
export const MAX_LOG_LINES = 120;
