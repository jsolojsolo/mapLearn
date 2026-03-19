/**
 * AStarPathFinder 复刻原版客户端的 A* 寻路思想。
 * 功能：支持八方向移动、斜角防穿墙，以及与原版接近的代价模型。
 * 参数：无。
 * 返回值：无。
 * 注意事项：这里的代价模型使用常见的 10/14 设计，分别表示直走和斜走的相对代价；它不是严格的真实像素距离，但非常适合网格寻路教学和原版思路对照。
 */
export class AStarPathFinder {
  /**
   * constructor 绑定地图对象。
   * 功能：保存后续寻路所需的地图引用，并初始化当前目标格状态。
   * 参数：
   * - map：已经解析好的 `GridMap` 实例，内部必须能提供可通行判断、最近可走格搜索等能力。
   * 返回值：无。
   * 注意事项：无特殊注意事项。
   */
  constructor(map) {
    /** map 保存当前寻路依赖的地图模型，所有阻挡判断都通过它来完成。 */
    this.map = map;
    /** currentTarget 记录本次寻路真正采用的目标格，供启发式函数重复使用。 */
    this.currentTarget = null;
  }

  /**
   * findPath 计算从起点到终点的逻辑格路径。
   * 功能：先把起点和终点修正到最近可走格，再执行标准 A* 搜索，最后回溯出完整路径。
   * 参数：
   * - startTile：起点逻辑格对象，通常来自玩家当前所在格。
   * - targetTile：终点逻辑格对象，通常来自点击换算后的目标格。
   * 返回值：
   * - 数组：包含起点和终点的路径；找不到时返回空数组。
   * 注意事项：返回路径为空并不一定表示算法异常，也可能只是目标附近完全被阻挡，或起终点无法连通。
   */
  findPath(startTile, targetTile) {
    // 先把起点修正到最近可走格，避免角色恰好站在不规范数据点上导致寻路一开始就失败。
    const start = this.map.findNearestPassable(startTile.x, startTile.y, 8);
    // 再把目标点也修正到最近可走格，这样点击在障碍边缘时也能尽量给出一个合理目标。
    const end = this.map.findNearestPassable(targetTile.x, targetTile.y, 16);

    // 只要起点或终点任意一方找不到可走格，就直接返回空路径，表示本次寻路不可执行。
    if (!start || !end) {
      return [];
    }

    // 记录当前真正的目标格，供后续邻居节点计算 h 值时复用。
    this.currentTarget = end;
    // openList 是待探索节点列表，A* 每一步都会从这里挑出 f 值最小的节点继续展开。
    const openList = [];
    // nodeMap 用来记录某个坐标当前已知的最佳节点，避免同一格无限重复创建低质量节点。
    const nodeMap = new Map();
    // closedSet 记录已经“正式处理完”的格子，后续不再重复展开。
    const closedSet = new Set();
    // 创建起点节点：起点到起点的实际代价 g 为 0，h 则是到终点的估算代价。
    const startNode = this.createNode(start.x, start.y, 0, this.heuristic(start, end), null);

    // 起点节点首先进入开放列表，作为搜索起点。
    openList.push(startNode);
    // 同时记录到 nodeMap 中，便于后续比较是否出现了更优路径。
    nodeMap.set(this.key(start.x, start.y), startNode);

    // 只要开放列表里还有候选节点，就继续搜索。
    while (openList.length > 0) {
      // 每次都把 f 最小的节点提到最前面；若 f 相同，则优先 h 更小的节点，让搜索更倾向终点方向。
      openList.sort((left, right) => left.f - right.f || left.h - right.h);
      // 取出本轮最值得扩展的节点。
      const current = openList.shift();

      // 理论上这里不会为空，但保留保护分支可以让代码在异常数据下更安全。
      if (!current) {
        break;
      }

      // 生成当前节点坐标的唯一键，用于集合和映射查询。
      const currentKey = this.key(current.x, current.y);
      // 如果这个节点坐标已经被关闭过，说明它只是重复候选，直接跳过即可。
      if (closedSet.has(currentKey)) {
        continue;
      }
      // 把当前坐标标记为已处理，表示它的最优路径已经确定。
      closedSet.add(currentKey);

      // 如果当前节点就是终点，就说明最优路径已经找到，直接从终点往回回溯即可。
      if (current.x === end.x && current.y === end.y) {
        return this.buildPath(current);
      }

      // 枚举当前格四周所有可达邻居，并尝试用当前节点去“松弛”它们。
      for (const neighbor of this.getNeighbors(current)) {
        // 为邻居生成唯一键，方便快速查重。
        const neighborKey = this.key(neighbor.x, neighbor.y);
        // 已经进入关闭集合的节点无需再参与比较，因为它的最佳路径已经确定。
        if (closedSet.has(neighborKey)) {
          continue;
        }

        // 取出这个邻居坐标目前已知的旧节点，后面要比较新旧 g 值谁更优。
        const existed = nodeMap.get(neighborKey);
        // 如果这个邻居是第一次出现，或当前路线到它的 g 更小，就用新节点覆盖旧记录。
        if (!existed || neighbor.g < existed.g) {
          nodeMap.set(neighborKey, neighbor);
          openList.push(neighbor);
        }
      }
    }

    // 开放列表耗尽仍没到终点，说明起点和终点之间不存在可达路径。
    return [];
  }

  /**
   * createNode 构造寻路节点。
   * 功能：把坐标、代价和父节点封装成 A* 搜索使用的统一节点对象。
   * 参数：
   * - x：逻辑格 X。
   * - y：逻辑格 Y。
   * - g：起点到当前点的实际代价。
   * - h：当前点到终点的估算代价。
   * - parent：父节点，用于最终回溯路径。
   * 返回值：
   * - 节点对象，包含 `x`、`y`、`g`、`h`、`f`、`parent` 字段。
   * 注意事项：无特殊注意事项。
   */
  createNode(x, y, g, h, parent) {
    return {
      // x 表示当前节点在逻辑网格中的横向索引。
      x,
      // y 表示当前节点在逻辑网格中的纵向索引。
      y,
      // g 是从起点一路走到这里已经付出的真实代价。
      g,
      // h 是从这里到终点的启发式估价，用于指导搜索方向。
      h,
      // f 是 A* 的排序核心，等于 g + h。
      f: g + h,
      // parent 指向父节点，方便成功后从终点一路倒推回起点。
      parent
    };
  }

  /**
   * getNeighbors 枚举当前节点可到达的相邻节点。
   * 功能：按八方向检查周边格子，并在斜走时执行“防穿墙”限制。
   * 参数：
   * - node：当前寻路节点。
   * 返回值：
   * - 数组：所有合法相邻节点。
   * 注意事项：若某个斜方向虽然目标格可走，但水平或垂直相邻格有任意一个不可走，该斜方向也会被禁止，以避免角色从墙角对角线穿过去。
   */
  getNeighbors(node) {
    // 用来收集当前节点所有合法的下一步候选节点。
    const result = [];

    // 外层循环枚举 X 方向偏移：-1、0、1 分别表示左、不变、右。
    for (let dx = -1; dx <= 1; dx += 1) {
      // 内层循环枚举 Y 方向偏移：-1、0、1 分别表示上、不变、下。
      for (let dy = -1; dy <= 1; dy += 1) {
        // dx 和 dy 同时为 0 时表示原地不动，这不是一个有效邻居，要跳过。
        if (dx === 0 && dy === 0) {
          continue;
        }

        // 计算候选邻居的逻辑格 X。
        const nextX = node.x + dx;
        // 计算候选邻居的逻辑格 Y。
        const nextY = node.y + dy;

        // 如果目标格本身不可通行，就不可能成为合法邻居。
        if (!this.map.isPassable(nextX, nextY)) {
          continue;
        }

        // 只要两个方向偏移都不为 0，就说明这是一次斜向移动。
        const diagonal = dx !== 0 && dy !== 0;
        if (diagonal) {
          // sideA 表示沿 X 方向先走一步是否可通行。
          const sideA = this.map.isPassable(node.x + dx, node.y);
          // sideB 表示沿 Y 方向先走一步是否可通行。
          const sideB = this.map.isPassable(node.x, node.y + dy);

          // 只要两侧任意一边被挡住，就禁止对角穿过墙角。
          if (!sideA || !sideB) {
            continue;
          }
        }

        // 斜走成本设为 14，近似于 sqrt(2) * 10；直走成本设为 10。
        const stepCost = diagonal ? 14 : 10;
        // 新节点的 g 等于父节点 g 加上本次迈出的步进成本。
        const g = node.g + stepCost;
        // 新节点的 h 由当前坐标到目标坐标的启发式函数计算得出。
        const h = this.heuristic({ x: nextX, y: nextY }, this.currentTarget);

        // 把这个合法邻居封装成节点后加入结果列表。
        result.push(this.createNode(nextX, nextY, g, h, node));
      }
    }

    return result;
  }

  /**
   * heuristic 计算八方向移动的启发式估价。
   * 功能：使用对角距离模型估算“从当前格到目标格大概还要走多少代价”。
   * 参数：
   * - from：当前格。
   * - to：目标格。
   * 返回值：
   * - 数字：启发式代价，数值越小说明越接近终点。
   * 注意事项：启发式函数必须尽量低估或接近真实代价，才能保证 A* 在效率和正确性之间取得平衡。
   */
  heuristic(from, to) {
    // dx 表示当前格和目标格在 X 轴上还差多少格。
    const dx = Math.abs(from.x - to.x);
    // dy 表示当前格和目标格在 Y 轴上还差多少格。
    const dy = Math.abs(from.y - to.y);
    // 可以直接走对角线消化掉的部分，等于两个方向差值中的较小者。
    const diagonal = Math.min(dx, dy);
    // 对角线走完后剩余的那部分，只能继续直走。
    const straight = Math.max(dx, dy) - diagonal;
    // 总估价 = 对角部分成本 + 直线部分成本。
    return diagonal * 14 + straight * 10;
  }

  /**
   * buildPath 从终点节点回溯出完整路径。
   * 功能：沿着 parent 指针从终点一路回到起点，再反转数组得到正向路径。
   * 参数：
   * - endNode：终点节点。
   * 返回值：
   * - 数组：从起点到终点的逻辑格数组。
   * 注意事项：无特殊注意事项。
   */
  buildPath(endNode) {
    // 先创建一个空数组，用来从终点往前收集路径节点。
    const path = [];
    // current 初始指向终点，后面会一路沿 parent 往回走。
    let current = endNode;

    // 只要当前节点还存在，就说明还没有回溯到起点之前的位置。
    while (current) {
      // 每经过一个节点，就把它的逻辑坐标压入数组。
      path.push({ x: current.x, y: current.y });
      // 继续沿父节点向前回溯。
      current = current.parent;
    }

    // 当前数组顺序是“终点 -> 起点”，这里反转成更符合行走顺序的“起点 -> 终点”。
    path.reverse();
    return path;
  }

  /**
   * key 为逻辑格生成唯一键。
   * 功能：把二维网格坐标压平成一个字符串，方便作为 `Map` 和 `Set` 的键。
   * 参数：
   * - x：逻辑格 X。
   * - y：逻辑格 Y。
   * 返回值：
   * - 字符串键值，例如 `"12,34"`。
   * 注意事项：无特殊注意事项。
   */
  key(x, y) {
    // 使用逗号拼接成稳定字符串键，足以区分绝大多数二维整数坐标。
    return `${x},${y}`;
  }
}
