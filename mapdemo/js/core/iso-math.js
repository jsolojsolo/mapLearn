/**
 * IsoMath 负责处理菱形等角地图的坐标换算。
 * 功能：在逻辑格坐标和世界像素坐标之间互转，方便把 mapdemo 文本网格绘制成 45 度菱形地图。
 * 参数：无。
 * 返回值：无。
 * 注意事项：这里的“世界坐标”指整张地图拼接后的绝对像素位置，不是浏览器视口里的屏幕坐标。
 */
export class IsoMath {
  /**
   * tileToStage 把逻辑格坐标转换为世界像素坐标。
   * 功能：根据格子半宽、半高和逻辑偏移量，计算某个格子中心点在世界中的位置。
   * 参数：
   * - tileX：逻辑格 X。
   * - tileY：逻辑格 Y。
   * - floor：Floor 配置对象，必须包含 `offsetX`、`offsetY`、`halfWidth`、`halfHeight`。
   * 返回值：
   * - `{ x, y }`：格子中心点对应的世界坐标。
   * 注意事项：无特殊注意事项。
   */
  static tileToStage(tileX, tileY, floor) {
    // 先把逻辑格索引减去 Floor 自身偏移，使计算落到统一的局部坐标系中。
    const offX = tileX - floor.offsetX;
    // Y 方向也要做同样的偏移修正。
    const offY = tileY - floor.offsetY;

    return {
      // 菱形投影下，屏幕 X 同时受逻辑 X 和逻辑 Y 共同影响，所以是两项相加。
      x: offX * floor.halfWidth + offY * floor.halfWidth,
      // 菱形投影下，屏幕 Y 由一正一负两项组成，这就是 45 度视角的核心效果。
      y: offX * floor.halfHeight - offY * floor.halfHeight
    };
  }

  /**
   * traceDiamondPath 在 Canvas 上描出一个格子的菱形路径。
   * 功能：把某个格子中心点转换成四个顶点，供 `fill()` 和 `stroke()` 复用。
   * 参数：
   * - context：Canvas 2D 绘图上下文。
   * - centerPoint：格子中心点世界坐标。
   * - halfWidth：格子半宽。
   * - halfHeight：格子半高。
   * 返回值：无。
   * 注意事项：该方法只写路径，不主动执行描边或填充。
   */
  static traceDiamondPath(context, centerPoint, halfWidth, halfHeight) {
    // 开始一条新的路径，避免和上一个格子串联。
    context.beginPath();
    // 顶点 1：上方。
    context.moveTo(centerPoint.x, centerPoint.y - halfHeight);
    // 顶点 2：右方。
    context.lineTo(centerPoint.x + halfWidth, centerPoint.y);
    // 顶点 3：下方。
    context.lineTo(centerPoint.x, centerPoint.y + halfHeight);
    // 顶点 4：左方。
    context.lineTo(centerPoint.x - halfWidth, centerPoint.y);
    // 收口形成完整菱形。
    context.closePath();
  }
}
