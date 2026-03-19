/**
 * IsoMath 负责处理原版 Flash 使用的菱形网格坐标转换。
 * 功能：在逻辑格坐标和世界像素坐标之间互转，公式与反编译后的 `Tile` 类保持一致。
 * 参数：无。
 * 返回值：无。
 * 注意事项：这里的“世界像素坐标”指的是铺好整张地图切片后的大场景坐标，而不是浏览器可视区域里的屏幕坐标；屏幕坐标还需要额外叠加或减去相机偏移。
 */
export class IsoMath {
  /**
   * tileToStage 把逻辑格坐标转换为世界像素坐标。
   * 功能：根据菱形地图的半宽、半高和偏移量，算出某个逻辑格中心点在整张地图里的像素位置。
   * 参数：
   * - tileX：逻辑格 X，表示 Floor 数据中的行索引。
   * - tileY：逻辑格 Y，表示 Floor 数据中的列索引。
   * - floor：地图 Floor 配置对象，必须包含 `offsetX`、`offsetY`、`halfWidth`、`halfHeight` 等字段。
   * 返回值：
   * - `{ x, y }`：该逻辑格中心点对应的世界像素坐标。
   * 注意事项：无特殊注意事项。
   */
  static tileToStage(tileX, tileY, floor) {
    // 先减去逻辑网格自身的偏移，让公式在以逻辑原点为中心的坐标系里计算。
    const offX = tileX - floor.offsetX;
    // Y 方向也要做同样的偏移处理，否则最终渲染点会整体错位。
    const offY = tileY - floor.offsetY;

    return {
      // 菱形地图里，屏幕 X 同时受到逻辑 X 和逻辑 Y 的共同影响，所以是两项相加。
      x: offX * floor.halfWidth + offY * floor.halfWidth,
      // 菱形地图里，屏幕 Y 由两项相减得到，这正是“45 度斜视角”的核心效果来源。
      y: offX * floor.halfHeight - offY * floor.halfHeight
    };
  }

  /**
   * stageToTile 把世界像素坐标反推为逻辑格坐标。
   * 功能：把点击到的世界点重新映射回 Floor 网格，用于点击寻路、调试坐标和日志输出。
   * 参数：
   * - stageX：世界像素 X，通常等于“屏幕点击 X + 相机偏移 X”。
   * - stageY：世界像素 Y，通常等于“屏幕点击 Y + 相机偏移 Y”。
   * - floor：地图 Floor 配置对象，必须包含格子宽高、半宽和偏移量。
   * 返回值：
   * - `{ x, y }`：与该像素位置最接近的逻辑格索引。
   * 注意事项：这个公式来自反编译后的客户端实现，所以变量名和写法看起来不一定最“现代”，这里优先保持和原版思路一致，便于你对照学习。
   */
  static stageToTile(stageX, stageY, floor) {
    // 这是原版公式中的一条中间线性组合，用来拆出逻辑 Y 所在的菱形轴。
    let dataTempy = stageX - stageY * 2;

    // 当结果落在负半轴时，原版会额外减去一个整格宽度，避免 trunc 后向 0 取整带来的边界误差。
    if (dataTempy < 0) {
      dataTempy -= floor.tileWidth;
    }

    // 这是原版公式中的另一条中间线性组合，用来拆出逻辑 X 所在的菱形轴。
    const dataTempx = stageY * 2 + stageX;
    // 把线性组合结果换算成格索引，并加上半格宽做“落到最近格中心”的修正。
    const dataTempx1 = Math.trunc((dataTempx + floor.halfWidth) / floor.tileWidth);
    // 同理，另一条轴也做一次相同的换算。
    const dataTempy1 = Math.trunc((dataTempy + floor.halfWidth) / floor.tileWidth);

    return {
      // 计算完局部索引后，再把 Floor 自身偏移加回去，得到全局逻辑格坐标。
      x: floor.offsetX + dataTempx1,
      // Y 方向同样把偏移加回，得到可以直接喂给寻路器的网格坐标。
      y: floor.offsetY + dataTempy1
    };
  }
}
