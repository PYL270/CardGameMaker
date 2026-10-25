/**
 * 核心模块统一导出
 * 方便其他模块 import * from '../core'
 */

export { default as EventEmitter } from './EventEmitter';
export { default as Game, GAME_STATUS } from './Game';
export { default as Player, PLAYER_STATUS } from './Player';
export { default as Card, SUITS, SUIT_SYMBOLS, SUIT_COLORS, SUIT_NAMES, CARD_TYPES, EQUIP_SLOTS } from './Card';
export { default as Skill, SKILL_TYPES, TRIGGER_TIMINGS } from './Skill';
export { default as Character, GROUPS, GROUP_NAMES, GROUP_COLORS, SEX } from './Character';
export { default as Deck } from './Deck';
export { default as Distance } from './Distance';
export { default as Judgment } from './Judgment';
export { default as Turn, PHASES, PHASE_ORDER, PHASE_NAMES } from './Turn';
export { GameExtension, ExtensionManager, createEmptyExtension } from './ExtensionSystem';
