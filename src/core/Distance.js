/**
 * Distance - 距离计算系统
 * 计算玩家间的座次距离、攻击距离等
 */

export default class Distance {
  /**
   * @param {Player[]} players - 玩形座位排列的玩家列表(仅存活)
   */
  constructor(players = []) {
    this.players = players;
  }

  /**
   * 更新存活玩家列表
   */
  updatePlayers(players) {
    this.players = players.filter(p => p.isAlive);
  }

  /**
   * 获取两个玩家的座次距离(环形)
   * @param {Player} from
   * @param {Player} to
   * @returns {number}
   */
  getSeatDistance(from, to) {
    const alive = this.players;
    const fromIdx = alive.indexOf(from);
    const toIdx = alive.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return Infinity;
    const n = alive.length;
    return Math.min(
      Math.abs(fromIdx - toIdx),
      n - Math.abs(fromIdx - toIdx)
    );
  }

  /**
   * 计算from到to的攻击距离
   * = 座次距离 + to的防御距离修正 - from的进攻距离修正
   * @param {Player} from
   * @param {Player} to
   * @returns {number}
   */
  getAttackDistance(from, to) {
    const seatDist = this.getSeatDistance(from, to);
    const defFix = to.getDefenseDistance();
    const atkFix = from.getAttackDistanceFix();
    return Math.max(1, seatDist + defFix + atkFix);
  }

  /**
   * 判断from是否在to的攻击范围内
   * @param {Player} from - 攻击者
   * @param {Player} to - 被攻击者
   * @returns {boolean}
   */
  isInAttackRange(from, to) {
    const dist = this.getAttackDistance(from, to);
    return dist <= from.getAttackRange();
  }

  /**
   * 获取from攻击范围内的所有存活玩家
   * @param {Player} from
   * @returns {Player[]}
   */
  getPlayersInRange(from) {
    return this.players.filter(p => p !== from && this.isInAttackRange(from, p));
  }

  /**
   * 获取from可以出杀的所有目标(距离内且存活)
   * @param {Player} from
   * @returns {Player[]}
   */
  getShaTargets(from) {
    return this.players.filter(p => p !== from && p.isAlive && this.isInAttackRange(from, p));
  }

  /**
   * 获取所有存活玩家(除自己)
   * @param {Player} self
   * @returns {Player[]}
   */
  getOtherAlivePlayers(self) {
    return this.players.filter(p => p !== self && p.isAlive);
  }

  /**
   * 按座次顺序获取从from到to之间的玩家(不含from和to)
   * @param {Player} from
   * @param {Player} to
   * @param {boolean} clockwise - 是否顺时针
   * @returns {Player[]}
   */
  getPlayersBetween(from, to, clockwise = true) {
    const alive = this.players;
    const fromIdx = alive.indexOf(from);
    const toIdx = alive.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return [];
    const result = [];
    const n = alive.length;
    if (clockwise) {
      let i = (fromIdx + 1) % n;
      while (i !== toIdx) {
        result.push(alive[i]);
        i = (i + 1) % n;
      }
    } else {
      let i = (fromIdx - 1 + n) % n;
      while (i !== toIdx) {
        result.push(alive[i]);
        i = (i - 1 + n) % n;
      }
    }
    return result;
  }
}
