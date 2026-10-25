/**
 * 扩展统一注册入口
 * 所有扩展在此汇总注册到游戏
 */
import DemoExtension from './DemoExtension';

export const allExtensions = [
  DemoExtension,
  // 在此处添加更多扩展...
  // import MyExt from './MyExtension';
  // MyExt,
];

/**
 * 将所有扩展注册到游戏
 * @param {Game} game
 */
export function registerAllExtensions(game) {
  for (const ext of allExtensions) {
    game.registerExtension(ext.name, ext);
  }
}
