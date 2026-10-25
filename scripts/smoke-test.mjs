/**
 * 引擎冒烟测试：验证核心机制在无浏览器环境下可运行
 * 运行方式: node scripts/run-smoke.mjs
 */
import Game from '../src/core/Game.js';
import Skill from '../src/core/Skill.js';
import Character from '../src/core/Character.js';
import Card from '../src/core/Card.js';
import Deck from '../src/core/Deck.js';
import Distance from '../src/core/Distance.js';
import Judgment from '../src/core/Judgment.js';
import Player from '../src/core/Player.js';
import { PHASE_ORDER } from '../src/core/Turn.js';
import { buildStandardDeck } from '../src/data/basicCards.js';
import { CARD_TEXT, getCardText } from '../src/data/cardText.js';
import { CLASSIC_SKILLS, CLASSIC_CHARACTERS } from '../src/data/classicCharacters.js';
import { BASE_SKILLS } from '../src/data/basicCharacter.js';
import { generateTemplateCode } from '../src/components/CodeGen/TemplateGenerator.js';
import { decidePlay, decideDiscard } from '../src/ai/AIPlayer.js';
import { buildPayload, EXAMPLES } from '../src/components/Editor/SkillComposer.jsx';

let passed = 0;
let failed = 0;
function assert(cond, name, extra = '') {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

async function main() {
  console.log('\n[1] 牌堆系统');
  const defs = buildStandardDeck();
  assert(defs.length >= 100, '标准牌堆数量 >= 100', `实际 ${defs.length}`);
  const deck = new Deck();
  deck.init(defs);
  assert(deck.remaining === defs.length, '初始化后牌堆数量');
  const drawn = deck.draw(5);
  assert(drawn.length === 5 && deck.remaining === defs.length - 5, '摸5张');
  deck.discard(drawn);
  assert(deck.discarded === 5, '弃牌堆数量');
  // 耗尽牌堆触发重洗
  deck.draw(defs.length - 5);
  const more = deck.draw(3);
  assert(more.length === 3, '牌堆耗尽后重洗可继续摸牌');

  console.log('\n[2] 距离系统');
  const p1 = new Player({ name: 'P1', isAI: true, seatNum: 0 });
  const p2 = new Player({ name: 'P2', isAI: true, seatNum: 1 });
  const p3 = new Player({ name: 'P3', isAI: true, seatNum: 2 });
  const p4 = new Player({ name: 'P4', isAI: true, seatNum: 3 });
  const dist = new Distance([p1, p2, p3, p4]);
  assert(dist.getSeatDistance(p1, p2) === 1, '相邻座次距离=1');
  assert(dist.getSeatDistance(p1, p4) === 1, '环形相邻(4人)距离=1');
  assert(dist.getSeatDistance(p1, p3) === 2, '对面(4人)距离=2');
  assert(dist.isInAttackRange(p1, p2) === true, '基础攻击范围命中相邻');
  assert(dist.isInAttackRange(p1, p3) === false, '基础攻击范围不命中对面');
  // 防御马 +1 距离
  const horse = new Card({ name: '的卢', suit: 'club', number: 5, type: 'equip', subtype: 'horse_def' });
  p2.equip(horse);
  assert(dist.getAttackDistance(p1, p2) === 2, '防御马使距离+1');
  assert(dist.getPlayersInRange(p1).includes(p2) === false, '防御马后不在攻击范围');
  p2.unequip('horse_def');
  // 武器范围
  const weapon = new Card({ name: '青龙偃月刀', suit: 'spade', number: 5, type: 'equip', subtype: 'weapon', range: 3 });
  p1.equip(weapon);
  assert(dist.isInAttackRange(p1, p3) === true, '武器范围3命中对面');
  p1.unequip('weapon');

  console.log('\n[3] 判定系统');
  const jDeck = new Deck();
  jDeck.init([]);
  const judge = new Judgment(jDeck);
  jDeck.cardPile.push(new Card({ name: 'x', suit: 'heart', number: 5 }));
  assert(judge.getResult(jDeck.cardPile[0], 'leshousishu') === false, '乐不思蜀判定红桃=不中');
  jDeck.cardPile.push(new Card({ name: 'y', suit: 'spade', number: 5 }));
  assert(judge.getResult(jDeck.cardPile[1], 'leshousishu') === true, '乐不思蜀判定黑桃=中');
  assert(judge.getResult(jDeck.cardPile[1], 'bingliangcunduan') === true, '兵粮寸断判定黑桃=中');
  jDeck.cardPile.push(new Card({ name: 'z', suit: 'spade', number: 5 }));
  assert(judge.getResult(jDeck.cardPile[2], 'shandian') === true, '闪电判定黑桃2~9=中');
  jDeck.cardPile.push(new Card({ name: 'w', suit: 'spade', number: 10 }));
  assert(judge.getResult(jDeck.cardPile[3], 'shandian') === false, '闪电判定黑桃10=不中');

  console.log('\n[4] 玩家体力/濒死/死亡');
  const px = new Player({ name: 'PX', isAI: true });
  px.setCharacter(new Character({ id: 'cx', name: '测试', hp: 3 }));
  px.damage(3);
  assert(px.isDying, '体力归零进入濒死');
  px.handCards.push(new Card({ name: '桃', suit: 'heart', number: 3 }));
  assert(px.askForPeach() === true, '桃自救成功');
  assert(px.isAlive && px.hp === 1, '自救后存活且体力=1');
  px.die();
  assert(px.isDead && px.handCards.length === 0, '死亡清空手牌');

  console.log('\n[5] 技能触发与统一伤害流程');
  const game = new Game();
  let drawSkillFired = 0;
  game.registerSkill({
    id: 't_yingzi',
    name: '测试英姿',
    type: 'trigger',
    triggerTiming: 'phaseDrawBegin2',
    usable: 0,
    forced: true,
    filter: () => true,
    cost: async () => {},
    content: async (event) => {
      drawSkillFired++;
      event.data.num += 1;
    },
  });
  game.registerSkill({
    id: 't_fankui',
    name: '测试反馈',
    type: 'trigger',
    triggerTiming: 'damaged',
    usable: 0,
    forced: true,
    filter: () => true,
    cost: async () => {},
    content: async (event, trigger, player) => {
      if (event.data.source) event.data.source.setStorage('fankui_hit', true);
    },
  });
  game.registerCharacter({
    id: 't_hero',
    name: '测试将',
    sex: 'male',
    group: 'wu',
    hp: 4,
    maxHp: 4,
    skillIds: ['t_yingzi', 't_fankui'],
  });
  await game.init([
    { name: 'AI-A', isAI: true, characterId: 't_hero' },
    { name: 'AI-B', isAI: true, characterId: 't_hero' },
  ]);
  assert(game.players[0].skills.length === 2, '技能已挂载');
  assert(game.players[0].skills[0] !== game.players[1].skills[0], '不同玩家持有独立技能实例');

  const ev = await game.fireTiming('phaseDrawBegin2', { player: game.players[0], num: 2 });
  assert(ev.data.num === 3, '触发技修改摸牌数', `num=${ev.data.num}`);
  assert(drawSkillFired === 1, '只有当前回合玩家触发', `实际${drawSkillFired}`);

  const target = game.players[1];
  const hpBefore = target.hp;
  const dealt = await game.dealDamage({ source: game.players[0], target, num: 1 });
  assert(dealt === 1 && target.hp === hpBefore - 1, '统一伤害流程扣血');
  assert(game.players[0].getStorage('fankui_hit') === true, '受到伤害触发 damaged 技能');

  // 打击感反馈
  const effects = [];
  game.ui.onEffect = (e) => effects.push(e);
  await game.dealDamage({ source: game.players[0], target, num: 2 });
  assert(
    effects.some(e => e.type === 'damage' && e.target === target && e.num === 2),
    '伤害触发 UI 打击反馈(震动/飘字)'
  );

  console.log('\n[6] 回合流程完整性');
  const phaseLog = [];
  game.turn.onPhaseChange = (phase) => phaseLog.push(phase);
  // 只跑准备~判定阶段，避免出牌阶段依赖交互
  await game.turn.startTurn(game.players[0]);
  assert(phaseLog.length >= PHASE_ORDER.length, '六阶段全部执行', `实际 ${phaseLog.length}`);
  assert(game.turn.roundNumber === 1, '回合计数');
  game.turn.onPhaseChange = null;

  console.log('\n[7] AI 决策');
  const aiAction = decidePlay(game.players[0], game);
  assert(aiAction === null || aiAction.card, 'AI出牌决策返回合法结构');
  const discard = decideDiscard(game.players[0], 1, game);
  assert(Array.isArray(discard) && discard.length <= 1, 'AI弃牌决策');

  console.log('\n[8] 代码生成与技能回环');
  const templateSkills = [
    new Skill({
      id: 'gen_skill',
      name: '英姿',
      type: 'trigger',
      triggerTiming: 'phaseDrawBegin2',
      usable: 1,
      filterCode: 'return true;',
      costCode: 'event.result = { bool: true };',
      contentCode: 'event.data.num += 1;',
    }),
  ];
  const genChar = new Character({ id: 'gen_hero', name: '周瑜', group: 'wu', hp: 3, skillIds: ['gen_skill'] });
  const code = generateTemplateCode(genChar, templateSkills);
  assert(code.includes('registerSkill') && code.includes('registerCharacter'), '模板代码包含注册语句');
  assert(code.includes('周瑜') && code.includes('英姿'), '模板代码包含武将/技能信息');
  // 语法校验
  let syntaxOk = true;
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
  } catch {
    syntaxOk = false;
  }
  assert(syntaxOk, '生成的模板代码语法合法');

  const rt = new Skill({
    id: 'rt_skill',
    name: '回环',
    filterCode: 'return 1;',
    contentCode: 'return 42;',
  });
  const rt2 = new Skill(rt.toJSON());
  rt2.applyCode();
  assert(rt2.filter({}, null) === 1, '技能filter代码回环');
  assert((await rt2.content({}, {}, null)) === 42, '技能content代码回环');

  console.log('\n[9] 自动对局(全AI，带回合上限保护)');
  const auto = new Game();
  await auto.init([
    { name: 'AI-1', isAI: true },
    { name: 'AI-2', isAI: true },
    { name: 'AI-3', isAI: true },
  ]);
  assert(
    auto.players.every(p => p.maxHp === 4 && p.hp === 4),
    '未选武将时使用基础角色(4 体力)',
    auto.players.map(p => `${p.name}:${p.hp}/${p.maxHp}`).join(',')
  );
  assert(
    auto.players.every(p => p.character && p.character.name === '基础角色'),
    '基础角色已挂载'
  );
  const origStartTurn = auto.turn.startTurn.bind(auto.turn);
  auto.turn.startTurn = async (p) => {
    if (auto.turn.roundNumber >= 60) throw new Error('ROUND_LIMIT');
    return origStartTurn(p);
  };
  let loopError = null;
  try {
    await auto.run(0);
  } catch (e) {
    loopError = e;
  }
  assert(
    loopError === null || loopError.message === 'ROUND_LIMIT',
    '自动对局无未捕获异常',
    loopError ? loopError.message : ''
  );
  assert(auto.turn.roundNumber >= 1, '对局推进了回合', `回合数 ${auto.turn.roundNumber}`);
  assert(auto.logs.length > 0, '对局产生日志', `日志 ${auto.logs.length} 条`);
  assert(auto.getGameState().players.length === 3, '游戏状态可序列化');

  console.log('\n[10] 重新开始对局');
  const again = new Game();
  await again.init([
    { name: 'AI-A2', isAI: true },
    { name: 'AI-B2', isAI: true },
  ]);
  assert(again.turn.roundNumber === 0, '新对局回合数归零');
  assert(again.players.every(p => p.isAlive && p.handCards.length === 4), '新对局玩家状态干净');
  await again.turn.startTurn(again.players[0]);
  assert(again.turn.roundNumber === 1, '新对局可正常开始回合');
  // 已结束的旧对局仍保留终局状态，但不影响新对局
  assert(auto.status === 'finished' || auto.status === 'running', '旧对局状态独立');

  console.log('\n[11] 基础角色技能');
  const baseGame = new Game();
  await baseGame.init([
    { name: 'B1', isAI: true },
    { name: 'B2', isAI: true },
  ]);
  const basePlayer = baseGame.players[0];
  assert(basePlayer.character?.name === '基础角色', '基础角色已挂载');
  assert(basePlayer.skills.some(s => s.id === 'base_qinxue'), '基础角色拥有【勤学】');
  assert(basePlayer.skills.some(s => s.id === 'base_wenshou'), '基础角色拥有【稳守】');

  // 勤学：仅在手牌不足时额外摸一张（与经典武将【英姿】区分）
  basePlayer.handCards = [];
  const drawEv = await baseGame.fireTiming('phaseDrawBegin2', { player: basePlayer, num: 2 });
  assert(drawEv.data.num === 3, '【勤学】手牌不足时额外摸1张牌', `num=${drawEv.data.num}`);
  basePlayer.drawCards([
    new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }),
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '酒', suit: 'spade', number: 3, type: 'basic' }),
  ]);
  const drawEv2 = await baseGame.fireTiming('phaseDrawBegin2', { player: basePlayer, num: 2 });
  assert(drawEv2.data.num === 2, '【勤学】手牌充足时不额外摸牌', `num=${drawEv2.data.num}`);

  const baseHp0 = basePlayer.hp;
  await baseGame.dealDamage({ source: baseGame.players[1], target: basePlayer, num: 2 });
  assert(basePlayer.hp === baseHp0 - 1, '【稳守】防止1点伤害', `hp=${basePlayer.hp}`);
  assert(baseGame.logs.some(l => l.message.includes('【稳守】')), '【稳守】减伤有日志');

  const baseHp1 = basePlayer.hp;
  await baseGame.dealDamage({ source: baseGame.players[1], target: basePlayer, num: 1 });
  assert(basePlayer.hp === baseHp1 - 1, '【稳守】每回合仅触发一次', `hp=${basePlayer.hp}`);

  console.log('\n[12] 经典武将技能');
  const mkGame = async (charId0, charId1, withPlain = false) => {
    const g = new Game();
    if (withPlain) g.registerCharacter({ id: 'plain', name: '素将', group: 'custom', hp: 4, maxHp: 4, skillIds: [] });
    await g.init([
      { name: 'P0', isAI: true, characterId: charId0 },
      { name: 'P1', isAI: true, characterId: charId1 },
    ]);
    return g;
  };

  const gJx = await mkGame('plain', 'cls_caocao', true);
  const cc = gJx.players[1];
  const jxAttacker = gJx.players[0];
  cc.handCards = [];
  const shaJx = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  jxAttacker.drawCards([shaJx]);
  await gJx.executeCardAction(jxAttacker, { card: shaJx, targets: [cc] });
  assert(cc.handCards.includes(shaJx), '【奸雄】获得造成伤害的牌');
  assert(!gJx.deck.discardPile.includes(shaJx), '【奸雄】取回的牌不再留在弃牌堆');

  const gFk = await mkGame('cls_simayi', 'plain', true);
  const fk = gFk.players[0];
  const fkSrc = gFk.players[1];
  fk.skills = fk.skills.filter(s => s.id !== 'cls_yinren'); // 隔离测试【反馈】
  fkSrc.drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  const fkBefore = fk.handCards.length;
  const srcBefore = fkSrc.handCards.length;
  await gFk.dealDamage({ source: fkSrc, target: fk, num: 1 });
  // 强化后【反馈】=获得来源一张手牌 + 摸1张牌
  assert(fk.handCards.length === fkBefore + 2 && fkSrc.handCards.length === srcBefore - 1,
    '【反馈】获得伤害来源一张手牌并摸1张牌');

  const gPx = await mkGame('cls_zhangfei', 'plain', true);
  const zf = gPx.players[0];
  zf.usedSha = 3;
  assert(zf.canSha === true, '【咆哮】出杀无次数限制');
  baseGame.players[0].usedSha = 1;
  assert(baseGame.players[0].canSha === false, '普通角色出杀仍限一次');

  const gKc = await mkGame('plain', 'cls_zhugeliang', true);
  const kcAttacker = gKc.players[0];
  const zhuge = gKc.players[1];
  zhuge.handCards = [];
  assert(!gKc.getValidTargets(kcAttacker, '杀').includes(zhuge), '【空城】无手牌时不能被【杀】指定');
  zhuge.drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  assert(gKc.getValidTargets(kcAttacker, '杀').includes(zhuge), '【空城】有手牌后可以成为目标');

  const gJz = await mkGame('cls_huangyueying', 'plain', true);
  const hy = gJz.players[0];
  const wzsy = new Card({ name: '无中生有', suit: 'heart', number: 7, type: 'trick' });
  hy.drawCards([wzsy]);
  const jzBefore = hy.handCards.length;
  await gJz.executeCardAction(hy, { card: wzsy, targets: [] });
  // 强化后【集智】使用红色锦囊摸2张：无中本身摸2 + 集智摸2 => 相对使用前 +3
  assert(hy.handCards.length === jzBefore + 3, '【集智】使用红色锦囊摸2张（强化后）', `hand=${hy.handCards.length}`);

  const gYz = await mkGame('cls_zhouyu', 'plain', true);
  const yzEv = await gYz.fireTiming('phaseDrawBegin2', { player: gYz.players[0], num: 2 });
  assert(yzEv.data.num === 3, '【英姿】额外摸1张牌');

  const gBy = await mkGame('cls_diaochan', 'plain', true);
  const dc = gBy.players[0];
  const byBefore = dc.handCards.length;
  await gBy.fireTiming('phaseEnd', { player: dc, phase: 'finish' });
  assert(dc.handCards.length === byBefore + 2, '【闭月】结束阶段摸2张牌（强化后）');

  // 主动技能
  const gZh = await mkGame('cls_sunquan', 'plain', true);
  const sq = gZh.players[0];
  sq.handCards = [];
  sq.drawCards([
    new Card({ name: '闪电', suit: 'spade', number: 1, type: 'delay_trick' }),
    new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: 'delay_trick' }),
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
  ]);
  const zhSkill = sq.skills.find(s => s.id === 'cls_zhiheng');
  const zhHand = sq.handCards.length;
  assert(await gZh.useActiveSkill(sq, zhSkill) === true, '【制衡】可主动发动');
  assert(sq.handCards.length === zhHand + 1, '【制衡】弃2摸3，手牌净增1张');
  assert(sq.handCards.some(c => c.name === '桃') && sq.handCards.some(c => c.name === '闪'),
    '【制衡】不会弃置桃/闪');
  assert(zhSkill.usedCount === 1, '【制衡】使用次数+1');

  const gRd = await mkGame('cls_liubei', 'plain', true);
  const lb = gRd.players[0];
  lb.hp = lb.maxHp - 1;
  const rdHand = lb.handCards.length;
  assert(await gRd.useActiveSkill(lb, lb.skills.find(s => s.id === 'cls_rende')) === true, '【仁德】可主动发动');
  assert(lb.handCards.length === rdHand - 1, '【仁德】交出一张手牌');
  assert(lb.hp === lb.maxHp, '【仁德】回复1点体力');

  const gWs = await mkGame('cls_guanyu', 'plain', true);
  const gy = gWs.players[0];
  gy.drawCards([new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' })]);
  assert(await gWs.useActiveSkill(gy, gy.skills.find(s => s.id === 'cls_wusheng')) === true, '【武圣】可主动发动');
  assert(gy.usedSha === 1, '【武圣】计入出杀次数');

  console.log('\n[13] 种子牌堆');
  const deckSig = (d) => d.cardPile.map(c => `${c.name}${c.suit}${c.number}`).join('|');
  const dA = new Deck(); dA.init(defs, 123456);
  const dB = new Deck(); dB.init(defs, 123456);
  const dC = new Deck(); dC.init(defs, 654321);
  assert(deckSig(dA) === deckSig(dB), '相同种子牌序一致');
  assert(deckSig(dA) !== deckSig(dC), '不同种子牌序不同');
  assert(dA.seed === 123456 && dC.seed === 654321, '牌堆记录种子', `${dA.seed}/${dC.seed}`);
  assert(dA.remaining === defs.length, '种子牌堆总数正确');

  console.log('\n[14] 出牌阶段可用性规则');
  const ruleGame = new Game();
  await ruleGame.init([
    { name: '规则A' }, { name: '规则B' }, { name: '规则C' },
  ]);
  const rp = ruleGame.players[0];
  const rq = ruleGame.players[1];
  const mkCard = (name, suit, number, type) => new Card({ name, suit, number, type });
  const shanCard = mkCard('闪', 'heart', 2, 'basic');
  const wuxieCard = mkCard('无懈可击', 'spade', 11, 'trick');
  const taoCard = mkCard('桃', 'heart', 3, 'basic');
  const jiuCard = mkCard('酒', 'spade', 3, 'basic');
  assert(!ruleGame.canPlayCard(rp, shanCard), '【闪】不能主动使用');
  assert(!ruleGame.canPlayCard(rp, wuxieCard), '【无懈可击】不能主动使用');
  assert(!ruleGame.canPlayCard(rp, taoCard), '满体力不能主动出【桃】');
  rp.hp = 2;
  assert(ruleGame.canPlayCard(rp, taoCard), '受伤后可以主动出【桃】');
  rp.hp = rp.maxHp;
  assert(ruleGame.canPlayCard(rp, jiuCard), '【酒】首次可以使用');
  rp.usedJiuCount = 1;
  assert(!ruleGame.canPlayCard(rp, jiuCard), '【酒】每回合限一次');
  rp.usedJiuCount = 0;

  rq.handCards = [];
  Object.keys(rq.equips).forEach(k => { rq.equips[k] = null; });
  rq.judgeCards = [];
  assert(!ruleGame.getValidTargets(rp, '顺手牵羊').includes(rq), '目标无牌时不能【顺手牵羊】');
  rq.drawCards([mkCard('闪', 'diamond', 2, 'basic')]);
  assert(ruleGame.getValidTargets(rp, '顺手牵羊').includes(rq), '目标有牌且距离1时可【顺手牵羊】');

  console.log('\n[15] 装备特效');
  const equipGame = new Game();
  await equipGame.init([
    { name: '器A', isAI: true }, { name: '器B', isAI: true },
  ]);
  const ea = equipGame.players[0];
  const eb = equipGame.players[1];
  ea.skills = [];
  eb.skills = [];
  ea.equip(new Card({ name: '诸葛连弩', suit: 'club', number: 1, type: 'equip', subtype: 'weapon', range: 1 }));
  ea.usedSha = 3;
  assert(ea.canSha, '【诸葛连弩】出杀无次数限制');
  ea.equip(new Card({ name: '青釭剑', suit: 'spade', number: 6, type: 'equip', subtype: 'weapon', range: 2 }));
  eb.equip(new Card({ name: '八卦阵', suit: 'spade', number: 2, type: 'equip', subtype: 'armor' }));
  eb.handCards = [];
  equipGame.deck.cardPile.push(new Card({ name: '判定', suit: 'heart', number: 5 }));
  const ebHp = eb.hp;
  await equipGame.resolveShaUse(ea, new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }), eb);
  assert(eb.hp === ebHp - 1, '【青釭剑】无视八卦阵');

  const eaWeaponEntry = ea.getEquipCards().find(e => e.card.subtype === 'weapon');
  if (eaWeaponEntry) ea.unequip(eaWeaponEntry.slot);
  eb.hp = eb.maxHp;
  equipGame.deck.cardPile.push(new Card({ name: '判定', suit: 'heart', number: 6 }));
  await equipGame.resolveShaUse(ea, new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' }), eb);
  assert(eb.hp === eb.maxHp, '【八卦阵】红色判定视为闪');

  ea.equip(new Card({ name: '麒麟弓', suit: 'heart', number: 5, type: 'equip', subtype: 'weapon', range: 5 }));
  const ebArmorEntry = eb.getEquipCards().find(e => e.card.subtype === 'armor');
  if (ebArmorEntry) eb.unequip(ebArmorEntry.slot);
  eb.equip(new Card({ name: '赤兔', suit: 'heart', number: 5, type: 'equip', subtype: 'horse_atk' }));
  equipGame.deck.cardPile.push(new Card({ name: '判定', suit: 'spade', number: 9 }));
  await equipGame.resolveShaUse(ea, new Card({ name: '杀', suit: 'spade', number: 9, type: 'basic' }), eb);
  assert(!Object.values(eb.equips).some(c => c?.name === '赤兔'), '【麒麟弓】伤害后射落坐骑');

  ea.equip(new Card({ name: '丈八蛇矛', suit: 'spade', number: 3, type: 'equip', subtype: 'weapon', range: 3 }));
  ea.usedSha = 0;
  ea.handCards = [];
  ea.drawCards([
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
  ]);
  assert(equipGame.getWeaponActions(ea).some(a => a.id === 'zhangba'), '【丈八蛇矛】提供双牌当杀入口');

  const fangGame = new Game();
  await fangGame.init([
    { name: '戟A', isAI: true }, { name: '戟B', isAI: true }, { name: '戟C', isAI: true },
  ]);
  const fa = fangGame.players[0];
  const fb = fangGame.players[1];
  const fc = fangGame.players[2];
  [fa, fb, fc].forEach(p => { p.skills = []; p.handCards = []; });
  fa.equip(new Card({ name: '方天画戟', suit: 'diamond', number: 12, type: 'equip', subtype: 'weapon', range: 4 }));
  fb.hp = 4; fc.hp = 4;
  await fangGame.executeBasicCard(fa, new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }), [fb, fc]);
  assert(fa.usedSha === 1, '【方天画戟】多目标只计一次出杀');
  assert(fb.hp === 3 && fc.hp === 3, '【方天画戟】同时命中多个目标');

  console.log('\n[16] 无懈可击反制');
  const wuxieGame = new Game();
  await wuxieGame.init([
    { name: '反A', isAI: true }, { name: '反B', isAI: true },
  ]);
  const wa = wuxieGame.players[0];
  const wb = wuxieGame.players[1];
  wa.skills = [];
  wb.skills = [];
  wa.handCards = [];
  wb.handCards = [];
  wb.drawCards([new Card({ name: '无懈可击', suit: 'spade', number: 11, type: 'trick' })]);
  wa.drawCards([new Card({ name: '顺手牵羊', suit: 'spade', number: 3, type: 'trick' })]);
  const wbHand = wb.handCardCount;
  const stolenCard = wa.handCards.find(c => c.name === '顺手牵羊');
  await wuxieGame.executeCardAction(wa, { card: stolenCard, targets: [wb] });
  assert(!wb.handCards.some(c => c.name === '无懈可击'), '无懈可击被消耗');
  assert(wb.handCardCount === wbHand - 1, '无懈抵消后不再顺走目标手牌');
  assert(wuxieGame.logs.some(l => l.message.includes('无懈可击')), '日志记录无懈反制');

  console.log('\n[17] 六花色牌堆');
  const sixDeck = buildStandardDeck();
  const suitSet = new Set(sixDeck.map(c => c.suit));
  assert(sixDeck.length > 106, '扩展花色后牌堆数量增加');
  assert(suitSet.size === 6, '牌堆包含 6 种花色', [...suitSet].join(','));
  assert(sixDeck.some(c => c.suit === 'sun') && sixDeck.some(c => c.suit === 'moon'), '包含日曜/月华花色');
  assert(new Card({ name: '测', suit: 'sun', number: 1 }).isRed, '日曜判定为红色');
  assert(new Card({ name: '测', suit: 'moon', number: 1 }).isBlack, '月华判定为黑色');

  console.log('\n[18] DIY 模块化技能');
  const firePayload = buildPayload({ ...EXAMPLES[0], name: '烈火' });
  assert(firePayload.description.includes('【触发时机】') && firePayload.description.includes('【执行效果】'), '生成五段式技能描述');
  assert(firePayload.filterCode.includes('player.handCards.length > player.hp'), '条件框生成 filterCode');
  assert(firePayload.costCode.includes('chooseCards'), '代价框生成 costCode');
  let compileError = '';
  try {
    new Function('event', 'player', firePayload.filterCode);
    new Function('event', 'trigger', 'player', `return (async () => { ${firePayload.costCode} })()`);
    new Function('event', 'trigger', 'player', `return (async () => { ${firePayload.contentCode} })()`);
  } catch (e) { compileError = e.message; }
  assert(!compileError, '模块化代码可编译', compileError);
  let multiError = '';
  try {
    const multi = buildPayload({
      ...EXAMPLES[0], name: '多重效果',
      effects: [{ type: 'draw', value: 1 }, { type: 'damage', value: 1 }, { type: 'recover', value: 1 }],
    });
    new Function('event', 'trigger', 'player', `return (async () => { ${multi.contentCode} })()`);
  } catch (e) { multiError = e.message; }
  assert(!multiError, '多效果模块变量不冲突', multiError);
  const limitedPayload = buildPayload({ ...EXAMPLES[2], name: '铁壁', frequency: 'game' });
  assert(limitedPayload.type === 'limited' && limitedPayload.usable === 1, '每局限一次映射为限定技');

  console.log('\n[19] 卡牌效果修复回归');
  // 酒：被闪避后效果也应被消耗，不能残留到下一张杀
  const jiuGame = new Game();
  await jiuGame.init([{ name: '酒A', isAI: true }, { name: '酒B', isAI: true }]);
  const ja = jiuGame.players[0];
  const jb = jiuGame.players[1];
  ja.skills = []; jb.skills = [];
  ja.handCards = []; jb.handCards = [];
  jb.drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  ja.usedJiu = true;
  const jbHp = jb.hp;
  await jiuGame.resolveShaUse(ja, new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }), jb);
  assert(jb.hp === jbHp, '【酒】杀被闪避后不造成伤害');
  assert(ja.usedJiu === false, '【酒】效果被闪避后也会消耗');

  // 无懈可击抵消链：受影响方出无懈，来源方再出无懈反制，锦囊最终生效
  const chainGame = new Game();
  await chainGame.init([{ name: '链A', isAI: true }, { name: '链B', isAI: true }]);
  const ca = chainGame.players[0];
  const cb = chainGame.players[1];
  ca.skills = []; cb.skills = [];
  ca.handCards = []; cb.handCards = [];
  ca.drawCards([
    new Card({ name: '顺手牵羊', suit: 'spade', number: 3, type: 'trick' }),
    new Card({ name: '无懈可击', suit: 'club', number: 12, type: 'trick' }),
  ]);
  cb.drawCards([
    new Card({ name: '无懈可击', suit: 'spade', number: 11, type: 'trick' }),
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
  ]);
  const cbHand = cb.handCardCount;
  const chainCard = ca.handCards.find(c => c.name === '顺手牵羊');
  await chainGame.executeCardAction(ca, { card: chainCard, targets: [cb] });
  assert(!ca.handCards.some(c => c.name === '无懈可击')
    && !cb.handCards.some(c => c.name === '无懈可击'), '无懈抵消链两张无懈都被消耗');
  assert(cb.handCardCount === cbHand - 2, '无懈被反制后锦囊最终生效（顺走一张牌）');
  assert(chainGame.logs.filter(l => l.message.includes('无懈可击')).length >= 2, '无懈链有两条日志记录');

  // 方天画戟：非最后一张手牌时不允许额外目标
  const ftGame = new Game();
  await ftGame.init([{ name: '戟1', isAI: true }, { name: '戟2', isAI: true }, { name: '戟3', isAI: true }]);
  const fta = ftGame.players[0];
  const ftb = ftGame.players[1];
  const ftc = ftGame.players[2];
  [fta, ftb, ftc].forEach(p => { p.skills = []; p.handCards = []; });
  fta.equip(new Card({ name: '方天画戟', suit: 'diamond', number: 12, type: 'equip', subtype: 'weapon', range: 4 }));
  ftb.hp = 4; ftc.hp = 4;
  fta.drawCards([new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' })]);
  await ftGame.executeBasicCard(fta, new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }), [ftb, ftc]);
  assert(ftb.hp === 3 && ftc.hp === 4, '【方天画戟】非最后手牌时只结算第一个目标');

  // 寒冰剑：真人可选择不发动，改为正常造成伤害
  const iceGame = new Game();
  await iceGame.init([{ name: '冰A', isAI: true }, { name: '冰B', isAI: true }]);
  iceGame.ui.askForConfirm = async () => false;
  const ia = iceGame.players[0];
  const ib = iceGame.players[1];
  ia.isAI = false; // 真人玩家：确认才会走 UI 询问
  ia.skills = []; ib.skills = [];
  ia.handCards = []; ib.handCards = [];
  ia.equip(new Card({ name: '寒冰剑', suit: 'spade', number: 2, type: 'equip', subtype: 'weapon', range: 2 }));
  ib.drawCards([
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 4, type: 'basic' }),
  ]);
  await iceGame.resolveShaUse(ia, new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }), ib);
  assert(ib.hp === 3, '【寒冰剑】放弃发动时正常造成伤害');
  assert(ib.handCardCount === 2, '【寒冰剑】放弃发动时不弃目标牌');

  console.log('\n[20] 判定/濒死/决斗补充回归');
  // 闪电：判定不中必须移动到下家，而不是弃置
  const sdGame = new Game();
  await sdGame.init([{ name: '电A', isAI: true }, { name: '电B', isAI: true }]);
  const sda = sdGame.players[0];
  const sdb = sdGame.players[1];
  sda.skills = []; sdb.skills = [];
  const sdCard = new Card({ name: '闪电', suit: 'club', number: 6, type: 'delay_trick' });
  sda.addJudgeCard(sdCard);
  sdGame.deck.cardPile.push(new Card({ name: '判定', suit: 'heart', number: 5 }));
  const sdaHp = sda.hp;
  await sdGame.turn.phaseJudge(sda);
  assert(!sda.judgeCards.includes(sdCard), '闪电判定不中离开原判定区');
  assert(sdb.judgeCards.includes(sdCard), '闪电判定不中移动到下家');
  assert(sda.hp === sdaHp, '闪电判定不中不造成伤害');

  sdb.judgeCards = [];
  const sdCard2 = new Card({ name: '闪电', suit: 'spade', number: 5, type: 'delay_trick' });
  sdb.addJudgeCard(sdCard2);
  sdGame.deck.cardPile.push(new Card({ name: '判定2', suit: 'spade', number: 5 }));
  const sdbHp = sdb.hp;
  await sdGame.turn.phaseJudge(sdb);
  assert(sdb.hp === sdbHp - 2, '闪电判定黑桃2~9造成2点伤害', `hp=${sdb.hp}, before=${sdbHp}`);

  // 乐不思蜀/兵粮寸断：判定生效应设置跳过标记（中文牌名 → 判定类型映射）
  const dpGame = new Game();
  await dpGame.init([{ name: '判A', isAI: true }, { name: '判B', isAI: true }]);
  const dpa = dpGame.players[0];
  dpa.skills = [];
  dpa.judgeCards = [];
  dpa.addJudgeCard(new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: 'delay_trick' }));
  dpGame.deck.cardPile.push(new Card({ name: '判定乐', suit: 'spade', number: 5 }));
  await dpGame.turn.phaseJudge(dpa);
  assert(dpa.getStorage('skipPlay') === true, '乐不思蜀判定非红桃→跳过出牌阶段');
  dpa.storage.delete('skipPlay');
  dpa.judgeCards = [];
  dpa.addJudgeCard(new Card({ name: '兵粮寸断', suit: 'club', number: 10, type: 'delay_trick' }));
  dpGame.deck.cardPile.push(new Card({ name: '判定粮', suit: 'spade', number: 8 }));
  await dpGame.turn.phaseJudge(dpa);
  assert(dpa.getStorage('skipDraw') === true, '兵粮寸断判定非梅花→跳过摸牌阶段');
  dpa.storage.delete('skipDraw');

  // 濒死求桃：真人拒绝时不得自动消耗其【桃】
  const dyGame = new Game();
  await dyGame.init([{ name: '人', isAI: false }, { name: 'AI濒死', isAI: true }]);
  dyGame.ui.askForConfirm = async () => false;
  const human = dyGame.players[0];
  const dyAi = dyGame.players[1];
  human.skills = []; dyAi.skills = [];
  human.handCards = []; dyAi.handCards = [];
  human.drawCards([new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' })]);
  dyAi.hp = 1;
  dyAi.damage(1);
  await dyGame.handleDying(dyAi);
  assert(dyAi.isDead, '无人救时濒死角色阵亡');
  assert(human.handCards.some(c => c.name === '桃'), '真人拒绝后不自动消耗其桃');

  // 决斗：真人拒绝出【杀】时应受到伤害
  const duelGame = new Game();
  await duelGame.init([{ name: '斗A', isAI: true }, { name: '斗B', isAI: false }]);
  const duA = duelGame.players[0];
  const duB = duelGame.players[1];
  duA.skills = []; duB.skills = [];
  duA.handCards = []; duB.handCards = [];
  duelGame.ui.askForCard = async () => null;
  const duHp = duB.hp;
  await duelGame.executeTrickCard(duA, new Card({ name: '决斗', suit: 'spade', number: 1, type: 'trick' }), [duB]);
  assert(duB.hp === duHp - 1, '决斗真人拒绝出杀时受到伤害');

  // 同一判定区不能重复放置同名延时锦囊
  const dupGame = new Game();
  await dupGame.init([{ name: '重A', isAI: true }, { name: '重B', isAI: true }]);
  const dupA = dupGame.players[0];
  const dupB = dupGame.players[1];
  dupA.skills = []; dupB.skills = [];
  dupB.addJudgeCard(new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: 'delay_trick' }));
  assert(!dupGame.getValidTargets(dupA, '乐不思蜀').includes(dupB), '判定区已有乐不思蜀时不可重复指定');
  await dupGame.executeDelayTrickCard(dupA, new Card({ name: '乐不思蜀', suit: 'heart', number: 6, type: 'delay_trick' }), [dupB]);
  assert(dupB.judgeCards.filter(c => c.name === '乐不思蜀').length === 1, '重复的乐不思蜀不会放入判定区');
  dupA.addJudgeCard(new Card({ name: '闪电', suit: 'club', number: 6, type: 'delay_trick' }));
  await dupGame.executeDelayTrickCard(dupA, new Card({ name: '闪电', suit: 'spade', number: 2, type: 'delay_trick' }), []);
  assert(dupA.judgeCards.filter(c => c.name === '闪电').length === 1, '重复的闪电不会放入判定区');

  console.log('\n[21] 【酒】+【方天画戟】多目标伤害');
  const jiuFanGame = new Game();
  await jiuFanGame.init([
    { name: '酒戟A', isAI: true },
    { name: '酒戟B', isAI: true },
    { name: '酒戟C', isAI: true },
  ]);
  const jfa = jiuFanGame.players[0];
  const jfb = jiuFanGame.players[1];
  const jfc = jiuFanGame.players[2];
  [jfa, jfb, jfc].forEach(p => { p.skills = []; p.handCards = []; });
  jfa.equip(new Card({ name: '方天画戟', suit: 'diamond', number: 12, type: 'equip', subtype: 'weapon', range: 4 }));
  const fanJiuCard = new Card({ name: '酒', suit: 'spade', number: 3, type: 'basic' });
  const shaFan = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  jfa.drawCards([fanJiuCard, shaFan]);
  await jiuFanGame.executeCardAction(jfa, { card: fanJiuCard, targets: [jfa] });
  assert(jfa.usedJiu === true, '【酒】使用后进入加伤状态');
  const jfbHp = jfb.hp;
  const jfcHp = jfc.hp;
  await jiuFanGame.executeCardAction(jfa, { card: shaFan, targets: [jfb, jfc] });
  assert(jfb.hp === jfbHp - 2, '【酒】+【方天画戟】第一个目标受到2点伤害', `hp=${jfb.hp}`);
  assert(jfc.hp === jfcHp - 2, '【酒】+【方天画戟】第二个目标同样受到2点伤害', `hp=${jfc.hp}`);
  assert(jfa.usedJiu === false, '多目标【杀】结算后【酒】效果被消耗');
  assert(jfa.usedSha === 1, '【酒】+【方天画戟】仍只计一次出杀', `usedSha=${jfa.usedSha}`);
  const shaAfterJiu = new Card({ name: '杀', suit: 'club', number: 3, type: 'basic' });
  jfa.drawCards([shaAfterJiu]);
  jfa.usedSha = 0;
  const jfbHp2 = jfb.hp;
  await jiuFanGame.executeBasicCard(jfa, shaAfterJiu, [jfb]);
  assert(jfb.hp === jfbHp2 - 1, '下一张【杀】不再享受【酒】加伤', `hp=${jfb.hp}`);

  console.log('\n[22] 武器触发顺序/重复触发/递归保护');
  // 贯石斧：被闪避后的强制伤害也应享受【酒】加伤
  const axGame = new Game();
  await axGame.init([{ name: '斧A', isAI: true }, { name: '斧B', isAI: true }]);
  const axa = axGame.players[0];
  const axb = axGame.players[1];
  [axa, axb].forEach(p => { p.skills = []; p.handCards = []; });
  axa.equip(new Card({ name: '贯石斧', suit: 'diamond', number: 5, type: 'equip', subtype: 'weapon', range: 3 }));
  axa.usedJiu = true;
  const axSha = new Card({ name: '杀', suit: 'spade', number: 9, type: 'basic' });
  axa.drawCards([axSha, new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }), new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  axb.drawCards([new Card({ name: '闪', suit: 'diamond', number: 2, type: 'basic' })]);
  const axbHp = axb.hp;
  await axGame.executeCardAction(axa, { card: axSha, targets: [axb] });
  assert(axb.hp === axbHp - 2, '【贯石斧】强制伤害享受【酒】加伤', `hp=${axb.hp}`);
  assert(axa.handCards.length === 0, '【贯石斧】弃两张牌作为代价');
  assert(axGame.logs.some(l => l.message.includes('【贯石斧】')), '【贯石斧】触发有日志');

  // 青龙偃月刀：被闪避后仅追加一次【杀】，递归保护生效
  const chaseGame = new Game();
  await chaseGame.init([{ name: '追A', isAI: true }, { name: '追B', isAI: true }]);
  const cha = chaseGame.players[0];
  const chb = chaseGame.players[1];
  [cha, chb].forEach(p => { p.skills = []; p.handCards = []; });
  cha.equip(new Card({ name: '青龙偃月刀', suit: 'spade', number: 5, type: 'equip', subtype: 'weapon', range: 3 }));
  const chaseSha1 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  const chaseSha2 = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  cha.drawCards([chaseSha1, chaseSha2]);
  chb.drawCards([
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
    new Card({ name: '闪', suit: 'diamond', number: 2, type: 'basic' }),
  ]);
  const chbHp = chb.hp;
  await chaseGame.executeCardAction(cha, { card: chaseSha1, targets: [chb] });
  assert(chb.hp === chbHp, '【青龙偃月刀】追击被连续闪避后不再造成伤害');
  assert(cha.handCards.length === 0, '【青龙偃月刀】只追加一张【杀】');
  assert(chb.handCardCount === 0, '目标的【闪】被连续消耗');
  assert(chaseGame.logs.filter(l => l.message.includes('【青龙偃月刀】')).length === 1,
    '【青龙偃月刀】单次触发，无递归重复');

  // 寒冰剑：防止伤害时连【酒】加伤一起防止
  const iceJiuGame = new Game();
  await iceJiuGame.init([{ name: '冰酒A', isAI: true }, { name: '冰酒B', isAI: true }]);
  const ija = iceJiuGame.players[0];
  const ijb = iceJiuGame.players[1];
  [ija, ijb].forEach(p => { p.skills = []; p.handCards = []; });
  ija.equip(new Card({ name: '寒冰剑', suit: 'spade', number: 2, type: 'equip', subtype: 'weapon', range: 2 }));
  ija.usedJiu = true;
  const iceSha = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  ija.drawCards([iceSha]);
  ijb.drawCards([
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 4, type: 'basic' }),
  ]);
  const ijbHp = ijb.hp;
  await iceJiuGame.executeCardAction(ija, { card: iceSha, targets: [ijb] });
  assert(ijb.hp === ijbHp, '【寒冰剑】防止伤害时【酒】加伤也不生效');
  assert(ijb.handCardCount === 0, '【寒冰剑】弃置目标两张牌');
  assert(ija.usedJiu === false, '【寒冰剑】分支结算后【酒】已被消耗');

  // 装备替换：旧装备进入弃牌堆
  const replaceGame = new Game();
  await replaceGame.init([{ name: '换A', isAI: true }, { name: '换B', isAI: true }]);
  const rpa = replaceGame.players[0];
  [rpa, replaceGame.players[1]].forEach(p => { p.skills = []; p.handCards = []; });
  const oldWeapon = new Card({ name: '青釭剑', suit: 'spade', number: 6, type: 'equip', subtype: 'weapon', range: 2 });
  rpa.equip(oldWeapon);
  const newWeapon = new Card({ name: '青龙偃月刀', suit: 'spade', number: 5, type: 'equip', subtype: 'weapon', range: 3 });
  rpa.drawCards([newWeapon]);
  await replaceGame.executeCardAction(rpa, { card: newWeapon, targets: [] });
  assert(rpa.getWeapon() === newWeapon, '新装备进入装备区');
  assert(replaceGame.deck.discardPile.includes(oldWeapon), '替换下来的旧装备进入弃牌堆');

  console.log('\n[23] 【决斗】响应顺序/终止条件/无限循环保护');
  // 目标先出杀：目标有杀，来源无杀 → 来源受伤
  const duel1 = new Game();
  await duel1.init([{ name: '斗A', isAI: true }, { name: '斗B', isAI: true }]);
  const d1a = duel1.players[0];
  const d1b = duel1.players[1];
  [d1a, d1b].forEach(p => { p.skills = []; p.handCards = []; });
  d1b.drawCards([new Card({ name: '杀', suit: 'club', number: 2, type: 'basic' })]);
  const d1aHp = d1a.hp;
  await duel1.executeTrickCard(d1a, new Card({ name: '决斗', suit: 'spade', number: 1, type: 'trick' }), [d1b]);
  assert(d1a.hp === d1aHp - 1, '【决斗】由目标先出杀，来源无杀则来源受伤', `hp=${d1a.hp}`);
  assert(d1b.hp === d1b.maxHp, '先出杀的决斗目标不受伤');

  // 来源被决斗打死时循环正确终止
  const duel2 = new Game();
  await duel2.init([{ name: '斗死A', isAI: true }, { name: '斗死B', isAI: true }]);
  const d2a = duel2.players[0];
  const d2b = duel2.players[1];
  [d2a, d2b].forEach(p => { p.skills = []; p.handCards = []; });
  d2a.hp = 1;
  d2b.drawCards([
    new Card({ name: '杀', suit: 'club', number: 2, type: 'basic' }),
    new Card({ name: '杀', suit: 'club', number: 3, type: 'basic' }),
  ]);
  await duel2.executeTrickCard(d2a, new Card({ name: '决斗', suit: 'club', number: 1, type: 'trick' }), [d2b]);
  assert(d2a.isDead, '【决斗】中出杀方（来源）阵亡后循环终止');
  assert(d2b.isAlive, '【决斗】胜者存活');

  // UI 返回不在手牌的【杀】：必须按无法出杀处理，不能死循环
  const duel3 = new Game();
  await duel3.init([{ name: '斗卡A', isAI: true }, { name: '斗卡B', isAI: false }]);
  const d3a = duel3.players[0];
  const d3b = duel3.players[1];
  [d3a, d3b].forEach(p => { p.skills = []; p.handCards = []; });
  const fakeSha = new Card({ name: '杀', suit: 'spade', number: 4, type: 'basic' });
  duel3.ui.askForCard = async () => fakeSha;
  const d3bHp = d3b.hp;
  await duel3.executeTrickCard(d3a, new Card({ name: '决斗', suit: 'diamond', number: 1, type: 'trick' }), [d3b]);
  assert(d3b.hp === d3bHp - 1, 'UI 返回无效【杀】时按无法出杀处理，不产生死循环');

  console.log('\n[24] 无懈可击目标集合与 AI 不误用');
  // AOE：受影响角色的无懈可击可完全抵消整张 AOE
  const wxGame = new Game();
  await wxGame.init([{ name: '懈A', isAI: true }, { name: '懈B', isAI: true }, { name: '懈C', isAI: true }]);
  const wxa = wxGame.players[0];
  const wxb = wxGame.players[1];
  const wxc = wxGame.players[2];
  [wxa, wxb, wxc].forEach(p => { p.skills = []; p.handCards = []; });
  wxa.drawCards([new Card({ name: '南蛮入侵', suit: 'spade', number: 7, type: 'trick' })]);
  wxb.drawCards([new Card({ name: '无懈可击', suit: 'spade', number: 11, type: 'trick' })]);
  const wxbHp = wxb.hp;
  const wxcHp = wxc.hp;
  const aoeCard = wxa.handCards[0];
  await wxGame.executeCardAction(wxa, { card: aoeCard, targets: [] });
  assert(wxb.handCardCount === 0, 'AOE 受影响角色的【无懈可击】被使用');
  assert(wxGame.logs.some(l => l.message.includes('被无懈可击抵消')), 'AOE 被无懈可击完全抵消');
  assert(wxb.hp === wxbHp && wxc.hp === wxcHp, 'AOE 被抵消后所有目标不受伤');

  // 来源自己的无懈不会用来抵消自己的 AOE
  const wx2 = new Game();
  await wx2.init([{ name: '源A', isAI: true }, { name: '源B', isAI: true }, { name: '源C', isAI: true }]);
  const sxA = wx2.players[0];
  const sxB = wx2.players[1];
  const sxC = wx2.players[2];
  [sxA, sxB, sxC].forEach(p => { p.skills = []; p.handCards = []; });
  const wandArrow = new Card({ name: '万箭齐发', suit: 'heart', number: 1, type: 'trick' });
  const sourceWuxie = new Card({ name: '无懈可击', suit: 'spade', number: 12, type: 'trick' });
  sxA.drawCards([wandArrow, sourceWuxie]);
  const sxBHp = sxB.hp;
  const sxCHp = sxC.hp;
  await wx2.executeCardAction(sxA, { card: wandArrow, targets: [] });
  assert(sxA.handCards.includes(sourceWuxie), '来源的【无懈可击】不会消耗在抵消自己的牌上');
  assert(sxB.hp === sxBHp - 1 && sxC.hp === sxCHp - 1, '无人无懈时 AOE 正常结算');

  // 【决斗】只询问目标，无关第三方不会误用无懈
  const wx3 = new Game();
  await wx3.init([{ name: '斗懈A', isAI: true }, { name: '斗懈B', isAI: true }, { name: '斗懈C', isAI: true }]);
  const txA = wx3.players[0];
  const txB = wx3.players[1];
  const txC = wx3.players[2];
  [txA, txB, txC].forEach(p => { p.skills = []; p.handCards = []; });
  const thirdWuxie = new Card({ name: '无懈可击', suit: 'club', number: 12, type: 'trick' });
  txC.drawCards([thirdWuxie]);
  const duelWx = new Card({ name: '决斗', suit: 'spade', number: 6, type: 'trick' });
  txA.drawCards([duelWx]);
  const txBHp = txB.hp;
  await wx3.executeCardAction(txA, { card: duelWx, targets: [txB] });
  assert(txC.handCards.includes(thirdWuxie), '【决斗】不会消耗无关第三方的无懈可击');
  assert(txB.hp === txBHp - 1, '【决斗】目标无法出杀时正常受伤');

  console.log('\n[25] 阵亡清理与距离更新');
  const deathGame = new Game();
  await deathGame.init([
    { name: '死A', isAI: true }, { name: '死B', isAI: true },
    { name: '死C', isAI: true }, { name: '死D', isAI: true },
  ]);
  const dPlayers = deathGame.players;
  dPlayers.forEach(p => { p.skills = []; p.handCards = []; });
  const victim = dPlayers[1];
  victim.drawCards([
    new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }),
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
  ]);
  victim.equip(new Card({ name: '青釭剑', suit: 'spade', number: 6, type: 'equip', subtype: 'weapon', range: 2 }));
  victim.addJudgeCard(new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: 'delay_trick' }));
  const discardBeforeDeath = deathGame.deck.discarded;
  await deathGame.dealDamage({ source: dPlayers[0], target: victim, num: 5 });
  assert(victim.isDead, '5点伤害后角色阵亡');
  assert(victim.handCards.length === 0 && victim.getWeapon() === null && victim.judgeCards.length === 0,
    '阵亡后手牌/装备区/判定区全部清空');
  assert(deathGame.deck.discarded === discardBeforeDeath + 4,
    '阵亡角色的牌全部进入弃牌堆', `弃牌堆 ${discardBeforeDeath}→${deathGame.deck.discarded}`);
  assert(deathGame.distance.getSeatDistance(dPlayers[0], dPlayers[2]) === 1,
    '阵亡后距离按剩余存活角色重新计算');

  console.log('\n[26] 【闪电】传递边界');
  // 仅剩1名存活角色：闪电不会自己传自己
  const loneGame = new Game();
  await loneGame.init([{ name: '独A', isAI: true }, { name: '独B', isAI: true }]);
  const loneA = loneGame.players[0];
  const loneB = loneGame.players[1];
  [loneA, loneB].forEach(p => { p.skills = []; p.handCards = []; });
  loneB.die();
  const loneSd = new Card({ name: '闪电', suit: 'club', number: 12, type: 'delay_trick' });
  loneA.addJudgeCard(loneSd);
  loneGame.deck.cardPile.push(new Card({ name: '独判', suit: 'heart', number: 5 }));
  const loneHp = loneA.hp;
  await loneGame.turn.phaseJudge(loneA);
  assert(loneA.judgeCards.length === 0, '仅剩1人时【闪电】不会传回自己');
  assert(loneGame.deck.discardPile.includes(loneSd), '无人可传时【闪电】进入弃牌堆');
  assert(loneA.hp === loneHp, '【闪电】判定不中不造成伤害');

  // 下家已有闪电时跳过，避免判定区同名重复
  const sdSkipGame = new Game();
  await sdSkipGame.init([
    { name: '电跳A', isAI: true }, { name: '电跳B', isAI: true }, { name: '电跳C', isAI: true },
  ]);
  const sd0 = sdSkipGame.players[0];
  const sd1 = sdSkipGame.players[1];
  const sd2 = sdSkipGame.players[2];
  [sd0, sd1, sd2].forEach(p => { p.skills = []; p.handCards = []; });
  const sdMove = new Card({ name: '闪电', suit: 'club', number: 6, type: 'delay_trick' });
  sd0.addJudgeCard(sdMove);
  sd1.addJudgeCard(new Card({ name: '闪电', suit: 'spade', number: 1, type: 'delay_trick' }));
  sdSkipGame.deck.cardPile.push(new Card({ name: '跳判', suit: 'heart', number: 6 }));
  await sdSkipGame.turn.phaseJudge(sd0);
  assert(sd0.judgeCards.length === 0, '【闪电】判定后离开原判定区');
  assert(sd2.judgeCards.some(c => c.name === '闪电'), '【闪电】跳过已有闪电的下家传给空闲角色');
  assert(sd1.judgeCards.filter(c => c.name === '闪电').length === 1, '已有闪电的角色不会重复获得');

  console.log('\n[27] 技能触发异常与取消');
  const timingGame = new Game();
  await timingGame.init([{ name: '技A', isAI: true }, { name: '技B', isAI: true }]);
  const tma = timingGame.players[0];
  const tmb = timingGame.players[1];
  [tma, tmb].forEach(p => { p.skills = []; p.handCards = []; });
  tmb.skills.push(new Skill({
    id: 't_cancel_damage', name: '取消伤害', type: 'trigger',
    triggerTiming: 'damageBegin', triggerSource: 'target', usable: 0, forced: true,
    filter: () => true, cost: async () => {},
    content: async (event) => { event.cancel(); },
  }));
  const tmbHp = tmb.hp;
  const cancelDealt = await timingGame.dealDamage({ source: tma, target: tmb, num: 2 });
  assert(cancelDealt === 0 && tmb.hp === tmbHp, '技能调用 event.cancel() 可正确防止伤害');
  assert(timingGame.logs.some(l => l.message.includes('伤害被防止')), '取消伤害会记录日志');

  // 技能 content 抛异常：不影响伤害结算，且后续技能仍触发
  const throwGame = new Game();
  await throwGame.init([{ name: '抛A', isAI: true }, { name: '抛B', isAI: true }]);
  const tga = throwGame.players[0];
  const tgb = throwGame.players[1];
  [tga, tgb].forEach(p => { p.skills = []; p.handCards = []; });
  const afterSkillFired = [];
  tgb.skills.push(new Skill({
    id: 't_throw', name: '爆炸技能', type: 'trigger',
    triggerTiming: 'damaged', triggerSource: 'target', usable: 0, forced: true,
    filter: () => true, cost: async () => {},
    content: async () => { throw new Error('boom'); },
  }));
  tgb.skills.push(new Skill({
    id: 't_after', name: '后续技能', type: 'trigger',
    triggerTiming: 'damaged', triggerSource: 'target', usable: 0, forced: true,
    filter: () => true, cost: async () => {},
    content: async () => { afterSkillFired.push(true); },
  }));
  const tgbHp = tgb.hp;
  const dealt2 = await throwGame.dealDamage({ source: tga, target: tgb, num: 1 });
  assert(dealt2 === 1 && tgb.hp === tgbHp - 1, '技能异常不影响伤害结算');
  assert(throwGame.logs.some(l => l.message.includes('执行出错')), '技能异常被记录到日志，不再静默吞掉');
  assert(afterSkillFired.length === 1, '异常技能之后的技能仍能触发');

  // 技能 filter 抛异常：只跳过该技能，不影响伤害结算
  const filterGame = new Game();
  await filterGame.init([{ name: '滤A', isAI: true }, { name: '滤B', isAI: true }]);
  const fga = filterGame.players[0];
  const fgb = filterGame.players[1];
  [fga, fgb].forEach(p => { p.skills = []; p.handCards = []; });
  fgb.skills.push(new Skill({
    id: 't_bad_filter', name: '坏条件技能', type: 'trigger',
    triggerTiming: 'damageBegin', triggerSource: 'target', usable: 0, forced: true,
    filter: () => { throw new Error('filter boom'); },
    cost: async () => {}, content: async () => {},
  }));
  const fgbHp = fgb.hp;
  const dealt3 = await filterGame.dealDamage({ source: fga, target: fgb, num: 1 });
  assert(dealt3 === 1 && fgb.hp === fgbHp - 1, 'filter 异常不阻断伤害结算');
  assert(filterGame.logs.some(l => l.message.includes('触发判定出错')), 'filter 异常已记录日志');

  console.log('\n[28] AI 出牌决策');
  const aiGame = new Game();
  await aiGame.init([
    { name: '智A', isAI: true }, { name: '智B', isAI: true }, { name: '智C', isAI: true },
  ]);
  const a0 = aiGame.players[0];
  const a1 = aiGame.players[1];
  const a2 = aiGame.players[2];
  [a0, a1, a2].forEach(p => { p.skills = []; p.handCards = []; });
  a0.drawCards([
    new Card({ name: '酒', suit: 'spade', number: 9, type: 'basic' }),
    new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' }),
  ]);
  let aiDecision = await aiGame.aiAutoPlay(a0);
  assert(aiDecision.card?.name === '酒', 'AI 有【杀】且目标在范围内时会先喝【酒】');
  a0.usedJiu = true;
  a0.usedJiuCount = 1;
  aiDecision = await aiGame.aiAutoPlay(a0);
  assert(aiDecision.card?.name === '杀', 'AI 喝【酒】后接着出【杀】');

  a0.handCards = [];
  a0.hp = a0.maxHp - 1;
  a0.drawCards([new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' })]);
  aiDecision = await aiGame.aiAutoPlay(a0);
  assert(aiDecision.card?.name === '桃', 'AI 受伤时使用【桃】');
  a0.hp = a0.maxHp;

  a0.handCards = [];
  a0.usedJiu = false;
  a0.usedJiuCount = 0;
  a0.drawCards([new Card({ name: '决斗', suit: 'spade', number: 1, type: 'trick' })]);
  aiDecision = await aiGame.aiAutoPlay(a0);
  assert(aiDecision.type === 'endPlay', 'AI 手里没有【杀】时不主动使用【决斗】');

  a0.handCards = [];
  a0.drawCards([
    new Card({ name: '青釭剑', suit: 'spade', number: 6, type: 'equip', subtype: 'weapon', range: 2 }),
    new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' }),
  ]);
  aiDecision = await aiGame.aiAutoPlay(a0);
  assert(aiDecision.card?.name === '青釭剑', 'AI 会先装备武器再出【杀】');

  a0.handCards = [];
  a0.equip(new Card({ name: '青龙偃月刀', suit: 'spade', number: 5, type: 'equip', subtype: 'weapon', range: 3 }));
  a0.drawCards([
    new Card({ name: '诸葛连弩', suit: 'club', number: 1, type: 'equip', subtype: 'weapon', range: 1 }),
    new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' }),
  ]);
  aiDecision = await aiGame.aiAutoPlay(a0);
  assert(aiDecision.card?.name === '杀', 'AI 不会用低范围武器替换已有高范围武器');

  // AI 延时锦囊：乐不思蜀/兵粮寸断打手牌最多的敌人，闪电在体力充足时放自己
  const delayGame = new Game();
  await delayGame.init([
    { name: '延A', isAI: true }, { name: '延B', isAI: true },
    { name: '延C', isAI: true }, { name: '延D', isAI: true },
  ]);
  const d0 = delayGame.players[0];
  const d1 = delayGame.players[1];
  const d2 = delayGame.players[2];
  const d3 = delayGame.players[3];
  [d0, d1, d2, d3].forEach(p => { p.skills = []; p.handCards = []; });
  d1.drawCards([new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' })]);
  d2.drawCards([
    new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' }),
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
  ]);
  d0.drawCards([new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: 'delay_trick' })]);
  aiDecision = await delayGame.aiAutoPlay(d0);
  assert(aiDecision.card?.name === '乐不思蜀' && aiDecision.targets?.[0] === d2,
    'AI 会把【乐不思蜀】交给手牌最多的敌人');

  d0.handCards = [];
  d0.drawCards([new Card({ name: '兵粮寸断', suit: 'spade', number: 10, type: 'delay_trick' })]);
  aiDecision = await delayGame.aiAutoPlay(d0);
  assert(aiDecision.card?.name === '兵粮寸断' && aiDecision.targets?.[0] === d1,
    'AI 会把【兵粮寸断】交给距离内手牌最多的敌人');

  d0.handCards = [];
  d0.hp = 4;
  d0.drawCards([new Card({ name: '闪电', suit: 'spade', number: 1, type: 'delay_trick' })]);
  aiDecision = await delayGame.aiAutoPlay(d0);
  assert(aiDecision.card?.name === '闪电' && aiDecision.targets?.[0] === d0,
    'AI 体力充足时会把【闪电】放入自己的判定区');

  // AI 主动技：制衡弃低价值牌、保留桃/闪；仁德给受伤队友送牌并回血；武圣用红牌补杀
  const zhiGame = new Game();
  await zhiGame.init([
    { name: '制衡AI', isAI: true, characterId: 'cls_sunquan' },
    { name: '制衡B', isAI: true },
  ]);
  const z0 = zhiGame.players[0];
  z0.handCards = [];
  z0.drawCards([
    new Card({ name: '闪电', suit: 'spade', number: 1, type: 'delay_trick' }),
    new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: 'delay_trick' }),
    new Card({ name: '兵粮寸断', suit: 'spade', number: 10, type: 'delay_trick' }),
    new Card({ name: '酒', suit: 'spade', number: 9, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
  ]);
  aiDecision = await zhiGame.aiAutoPlay(z0);
  assert(aiDecision.type === 'useSkill' && aiDecision.skillId === 'cls_zhiheng',
    'AI 有至少两张低价值牌时会发动【制衡】');
  const zhiSkill = z0.skills.find(s => s.id === 'cls_zhiheng');
  const zBefore = z0.handCards.length;
  await zhiGame.useActiveSkill(z0, zhiSkill);
  assert(zhiSkill.usedCount === 1 && z0.handCards.length === zBefore + 1,
    'AI【制衡】弃2摸3，手牌净增1张');
  assert(z0.handCards.some(c => c.name === '桃') && z0.handCards.some(c => c.name === '闪'),
    'AI【制衡】不会弃置桃/闪');

  const rendeGame = new Game();
  rendeGame.config.teamMode = '2v2';
  await rendeGame.init([
    { name: '仁德AI', isAI: true, characterId: 'cls_liubei', team: 0 },
    { name: '仁德队友', isAI: true, team: 0 },
    { name: '仁德敌人A', isAI: true, team: 1 },
    { name: '仁德敌人B', isAI: true, team: 1 },
  ]);
  const r0 = rendeGame.players[0];
  const r1 = rendeGame.players[1];
  [r0, r1].forEach(p => { p.handCards = []; });
  r0.hp = r0.maxHp - 1;
  r1.hp = r1.maxHp - 1;
  r0.drawCards([
    new Card({ name: '闪电', suit: 'spade', number: 1, type: 'delay_trick' }),
    new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: 'delay_trick' }),
    new Card({ name: '兵粮寸断', suit: 'spade', number: 10, type: 'delay_trick' }),
  ]);
  aiDecision = await rendeGame.aiAutoPlay(r0);
  assert(aiDecision.type === 'useSkill' && aiDecision.skillId === 'cls_rende',
    'AI 在组队模式且有人受伤时会发动【仁德】');
  const rendeSkill = r0.skills.find(s => s.id === 'cls_rende');
  const r0Hp = r0.hp;
  await rendeGame.useActiveSkill(r0, rendeSkill);
  assert(r0.hp === r0Hp + 1 && r1.handCards.length >= 2,
    'AI【仁德】优先送牌给受伤队友并回复体力');

  const wuGame = new Game();
  await wuGame.init([
    { name: '武圣AI', isAI: true, characterId: 'cls_guanyu' },
    { name: '武圣B', isAI: true },
  ]);
  const w0 = wuGame.players[0];
  w0.handCards = [];
  w0.drawCards([new Card({ name: '决斗', suit: 'heart', number: 1, type: 'trick' })]);
  aiDecision = await wuGame.aiAutoPlay(w0);
  assert(aiDecision.type === 'useSkill' && aiDecision.skillId === 'cls_wusheng',
    'AI 没有【杀】时会用红色低价值牌发动【武圣】');

  z0.handCards = [];
  z0.drawCards([
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
  ]);
  aiDecision = await zhiGame.aiAutoPlay(z0);
  assert(aiDecision.type === 'endPlay', 'AI 手里只有桃/闪时不会发动【制衡】');

  console.log('\n[29] 酒加伤与减伤日志（默认角色【稳守】）');
  const jwGame = new Game();
  await jwGame.init([{ name: 'JW1', isAI: true }, { name: 'JW2', isAI: true }]);
  const jw1 = jwGame.players[0];
  const jw2 = jwGame.players[1];
  jw1.handCards = []; jw2.handCards = [];
  jw2.hp = 4;
  jw1.drawCards([
    new Card({ name: '酒', suit: 'spade', number: 3, type: 'basic' }),
    new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }),
  ]);
  await jwGame.executeCardAction(jw1, { card: jw1.handCards.find(c => c.name === '酒'), targets: [] });
  await jwGame.executeCardAction(jw1, { card: jw1.handCards.find(c => c.name === '杀'), targets: [jw2] });
  assert(jw2.hp === 3, '【酒】+【稳守】后实际造成1点伤害', `hp=${jw2.hp}`);
  assert(jwGame.logs.some(l => l.message.includes('【酒】') && l.message.includes('伤害+1')), '【酒】加伤有明确日志');
  assert(jwGame.logs.some(l => l.message.includes('【稳守】')), '【稳守】减伤有明确日志');
  assert(jwGame.logs.some(l => l.message.includes('受到1点伤害')), '战报显示的是实际伤害值');
  // 无减伤目标：酒应造成2点
  const jw3 = jwGame.players[0];
  jw2.skills = [];
  jw2.hp = 4;
  jw3.usedSha = 0;
  jw3.usedJiu = true;
  jw3.drawCards([new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' })]);
  await jwGame.executeCardAction(jw3, { card: jw3.handCards.find(c => c.name === '杀'), targets: [jw2] });
  assert(jw2.hp === 2, '【酒】在无减伤目标上造成2点伤害', `hp=${jw2.hp}`);

  console.log('\n[30] 万箭齐发与青釭剑/八卦阵');
  const wjGame = new Game();
  await wjGame.init([{ name: 'WJ1', isAI: true }, { name: 'WJ2', isAI: true }]);
  const wj1 = wjGame.players[0];
  const wj2 = wjGame.players[1];
  wj1.skills = []; wj2.skills = [];
  wj1.handCards = []; wj2.handCards = [];
  wj1.equip(new Card({ name: '青釭剑', suit: 'spade', number: 6, type: 'equip', subtype: 'weapon', range: 2 }));
  wj2.equip(new Card({ name: '八卦阵', suit: 'spade', number: 2, type: 'equip', subtype: 'armor' }));
  wj2.hp = 4;
  wjGame.deck.cardPile.push(new Card({ name: '判定', suit: 'heart', number: 5 }));
  await wjGame.executeTrickCard(wj1, new Card({ name: '万箭齐发', suit: 'heart', number: 1, type: 'trick' }), [wj2]);
  assert(wj2.hp === 4, '青釭剑不影响【万箭齐发】时八卦阵的判定（红色视为闪）', `hp=${wj2.hp}`);

  console.log('\n[31] 组队/阵营契约（teamMode/分队/工具函数）');
  // ffa 默认：team 一律 null，isEnemy 恒 true，行为不外溢
  const tmFfa = new Game();
  await tmFfa.init([{ name: '混A', isAI: false }, { name: '混B', isAI: true }]);
  assert(tmFfa.teamMode === 'ffa', '默认 teamMode=ffa');
  assert(tmFfa.players.every(p => p.team === null), 'ffa 玩家 team 均为 null');
  assert(tmFfa.isEnemy(tmFfa.players[0], tmFfa.players[1]) === true, 'ffa isEnemy 恒为 true');
  assert(tmFfa.getAliveTeamIds().length === 0, 'ffa getAliveTeamIds 为空数组');
  assert(tmFfa.getGameState().teamMode === 'ffa', 'getGameState().teamMode=ffa');
  assert(tmFfa.players[0].toJSON().team === null, 'ffa Player.toJSON().team=null');
  assert(tmFfa.getValidTargets(tmFfa.players[0], '杀').length === 1, 'ffa 单体目标候选不受组队过滤');

  // 2v2：默认按座次 0/1 交替分队
  const tm22 = new Game();
  tm22.config.teamMode = '2v2';
  await tm22.init([
    { name: '2A', isAI: false }, { name: '2B', isAI: true },
    { name: '2C', isAI: true }, { name: '2D', isAI: true },
  ]);
  assert(tm22.teamMode === '2v2', 'init 读取 config.teamMode=2v2');
  assert(tm22.players.map(p => p.team).join(',') === '0,1,0,1', '2v2 按座次 0/1 交替分队');
  assert(tm22.getTeamPlayers(0).length === 2 && tm22.getTeamPlayers(1).length === 2, 'getTeamPlayers 分队列正确');
  assert(tm22.isEnemy(tm22.players[1], tm22.players[3]) === false, '同队 isEnemy=false');
  assert(tm22.isEnemy(tm22.players[0], tm22.players[1]) === true, '异队 isEnemy=true');
  assert(tm22.getAliveTeamIds().join(',') === '0,1', 'getAliveTeamIds=[0,1]');
  assert(tm22.getGameState().teamMode === '2v2', '2v2 getGameState().teamMode');
  assert(tm22.players[2].toJSON().team === 0, 'Player.toJSON() 输出 team');
  assert(tm22.logs.some(l => l.message.includes('组队模式 2v2')
    && l.message.includes('我方') && l.message.includes('敌方')), '组队模式开局日志含我方/敌方');
  // 显式 cfg.team 优先（team:0 不能被 falsy 判断丢掉）
  const tmExplicit = new Game();
  tmExplicit.config.teamMode = '2v2';
  await tmExplicit.init([
    { name: 'e0', isAI: true, team: 1 }, { name: 'e1', isAI: true, team: 1 },
    { name: 'e2', isAI: true, team: 0 }, { name: 'e3', isAI: true, team: 0 },
  ]);
  assert(tmExplicit.players.map(p => p.team).join(',') === '1,1,0,0', '显式 team 配置优先且支持 0');

  // 3v3：0/2/4 一队，1/3/5 一队
  const tm33 = new Game();
  tm33.config.teamMode = '3v3';
  await tm33.init(Array.from({ length: 6 }, (_, i) => ({ name: `3-${i}`, isAI: true })));
  assert(tm33.players.map(p => p.team).join(',') === '0,1,0,1,0,1', '3v3 分队 0/2/4 vs 1/3/5');
  assert(tm33.getTeamPlayers(0).length === 3 && tm33.getTeamPlayers(1).length === 3, '3v3 两队各3人');
  assert(tm33.getAliveTeamIds().join(',') === '0,1', '3v3 getAliveTeamIds=[0,1]');

  console.log('\n[32] 组队胜负判定');
  // 2v2：队友阵亡但敌方全灭 → win
  const tmWin22 = new Game();
  tmWin22.config.teamMode = '2v2';
  await tmWin22.init([
    { name: 'w0', isAI: false }, { name: 'w1', isAI: true },
    { name: 'w2', isAI: true }, { name: 'w3', isAI: true },
  ]);
  tmWin22.players[2].die();
  tmWin22.players[1].die();
  tmWin22.players[3].die();
  assert(tmWin22.checkWinLose() === 'win', '2v2 队友阵亡但敌方全灭仍判胜');
  // 敌方全灭、队友存活 → win
  const tmWin22b = new Game();
  tmWin22b.config.teamMode = '2v2';
  await tmWin22b.init([
    { name: 'x0', isAI: false }, { name: 'x1', isAI: true },
    { name: 'x2', isAI: true }, { name: 'x3', isAI: true },
  ]);
  tmWin22b.players[1].die();
  tmWin22b.players[3].die();
  assert(tmWin22b.checkWinLose() === 'win', '2v2 敌方全灭且我方存活判胜');
  // 我方全灭、敌方存活 → lose
  const tmLose22 = new Game();
  tmLose22.config.teamMode = '2v2';
  await tmLose22.init([
    { name: 'y0', isAI: false }, { name: 'y1', isAI: true },
    { name: 'y2', isAI: true }, { name: 'y3', isAI: true },
  ]);
  tmLose22.players[0].die();
  tmLose22.players[2].die();
  assert(tmLose22.checkWinLose() === 'lose', '2v2 我方全灭判负');
  // 双方均有人存活 → null
  const tmMid = new Game();
  tmMid.config.teamMode = '2v2';
  await tmMid.init([
    { name: 'm0', isAI: false }, { name: 'm1', isAI: true },
    { name: 'm2', isAI: true }, { name: 'm3', isAI: true },
  ]);
  assert(tmMid.checkWinLose() === null, '2v2 双方均有存活时未分胜负');
  // 自定义胜负条件仍优先于组队判定
  tmMid.winCondition = () => 'win';
  assert(tmMid.checkWinLose() === 'win', '自定义 winCondition 优先级保持不变');
  // 3v3：敌方全灭 → win
  const tmWin33 = new Game();
  tmWin33.config.teamMode = '3v3';
  await tmWin33.init(Array.from({ length: 6 }, (_, i) => ({ name: `v-${i}`, isAI: i > 0 })));
  [1, 3, 5].forEach(i => tmWin33.players[i].die());
  assert(tmWin33.checkWinLose() === 'win', '3v3 敌方(1/3/5)全灭判胜');
  assert(tmWin33.getAliveTeamIds().join(',') === '0', '3v3 仅剩我方队伍存活');
  // 组队胜利日志
  tmWin33.status = 'running';
  await tmWin33.run(0);
  assert(tmWin33.status === 'finished', '组队胜负判定后对局结束');
  assert(tmWin33.logs.some(l => l.message === '你的队伍获胜！'), '组队模式胜利日志为“你的队伍获胜！”');
  // ffa 判定逻辑完全不变
  const ffaWin = new Game();
  await ffaWin.init([{ name: 'fA', isAI: false }, { name: 'fB', isAI: true }]);
  ffaWin.players[1].die();
  assert(ffaWin.checkWinLose() === 'win', 'ffa 仅剩玩家本人时判胜（行为不变）');
  const ffaLose = new Game();
  await ffaLose.init([{ name: 'gA', isAI: false }, { name: 'gB', isAI: true }]);
  ffaLose.players[0].die();
  assert(ffaLose.checkWinLose() === 'lose', 'ffa 玩家本人阵亡判负（行为不变）');

  console.log('\n[32b] 投降结束对局');
  const surrenderGame = new Game();
  await surrenderGame.init([{ name: '投降者', isAI: false }, { name: '对手', isAI: true }]);
  const surrenderLogs = [];
  surrenderGame.onLog = (log) => surrenderLogs.push(log);
  assert(surrenderGame.surrender(surrenderGame.players[0]) === true, '存活玩家可以投降');
  assert(surrenderGame.status === 'finished', '投降后对局立即结束');
  assert(surrenderGame.surrenderSeat === 0, '记录投降座位');
  assert(surrenderGame.getGameState().surrenderSeat === 0, '游戏状态携带投降座位');
  assert(surrenderLogs.some(l => l.message.includes('投降')), '投降写入对局日志');
  assert(surrenderGame.surrender(surrenderGame.players[1]) === false, '对局结束后不能重复投降');
  const surrenderSeatGame = new Game();
  await surrenderSeatGame.init([{ name: 'A', isAI: false }, { name: 'B', isAI: false }]);
  assert(surrenderSeatGame.surrender(1) === true && surrenderSeatGame.surrenderSeat === 1,
    '支持按座位号投降（联机房主结算）');
  assert(surrenderSeatGame.surrender(99) === false, '非法座位投降被拒绝');

  console.log('\n[33] 组队 AI 目标过滤 / 求桃 / AOE');
  const tmAi = new Game();
  tmAi.config.teamMode = '2v2';
  await tmAi.init([
    { name: '盟0', isAI: true, team: 0 }, { name: '盟1', isAI: true, team: 0 },
    { name: '敌2', isAI: true, team: 1 }, { name: '敌3', isAI: true, team: 1 },
  ]);
  const allyA = tmAi.players[0];
  const allyB = tmAi.players[1];
  const foeB = tmAi.players[3];
  tmAi.players.forEach(p => { p.skills = []; p.handCards = []; });
  allyA.drawCards([new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' })]);
  // 座次：盟0-盟1 相邻(距离1)、盟0-敌3 相邻(距离1)，队友在攻击范围内
  assert(!tmAi.getValidTargets(allyA, '杀').includes(allyB), '组队模式【杀】候选不含队友');
  assert(tmAi.getValidTargets(allyA, '杀').includes(foeB), '组队模式【杀】候选仍含敌人');
  const aiGroupAction = await tmAi.aiAutoPlay(allyA);
  assert(aiGroupAction.card?.name === '杀', '组队 AI 有敌人可攻击时仍会出【杀】');
  assert(aiGroupAction.targets.length === 1
    && tmAi.isEnemy(allyA, aiGroupAction.targets[0]), 'AI 不把队友选为【杀】目标');
  assert(aiGroupAction.targets[0] !== allyB, 'AI【杀】目标明确排除队友');
  // 决斗/顺手/过河拆桥同样排除队友
  allyB.drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  foeB.drawCards([new Card({ name: '闪', suit: 'diamond', number: 2, type: 'basic' })]);
  assert(!tmAi.getValidTargets(allyA, '决斗').includes(allyB), '【决斗】候选不含队友');
  assert(!tmAi.getValidTargets(allyA, '顺手牵羊').includes(allyB), '【顺手牵羊】候选不含队友');
  assert(!tmAi.getValidTargets(allyA, '过河拆桥').includes(allyB), '【过河拆桥】候选不含队友');
  assert(tmAi.getValidTargets(allyA, '过河拆桥').includes(foeB), '【过河拆桥】候选仍含敌人');
  // 自动选目标（无 UI 注入时的 AI 兜底）同样跳过队友
  const autoPicked = await tmAi.askForTarget(allyA, [allyB, foeB]);
  assert(autoPicked === foeB, 'AI 自动选目标 askForTarget 会跳过队友');

  // AI 求桃：只救同队；敌人濒死不出桃
  const tmPeach = new Game();
  tmPeach.config.teamMode = '2v2';
  await tmPeach.init([
    { name: '救A', isAI: true, team: 0 }, { name: '敌B', isAI: true, team: 1 },
    { name: '救C', isAI: true, team: 0 }, { name: '敌D', isAI: true, team: 1 },
  ]);
  const peachA = tmPeach.players[0];
  const peachB = tmPeach.players[1];
  const peachC = tmPeach.players[2];
  tmPeach.players.forEach(p => { p.skills = []; p.handCards = []; });
  peachA.drawCards([new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' })]);
  peachC.hp = 1;
  peachC.damage(1);
  await tmPeach.handleDying(peachC);
  assert(peachC.isAlive, '队友濒死时 AI 使用【桃】救回');
  assert(peachA.handCardCount === 0, '救队友消耗了 AI 的【桃】');
  peachB.hp = 1;
  peachB.damage(1);
  const peachAAfter = peachA.handCardCount;
  await tmPeach.handleDying(peachB);
  assert(peachB.isDead, '敌人濒死时 AI 不出【桃】，敌人阵亡');
  assert(peachA.handCardCount === peachAAfter, 'AI 未把【桃】浪费在敌人身上');
  // ffa 保持原有“AI 见死就救”
  const ffaPeach = new Game();
  await ffaPeach.init([{ name: 'freeA', isAI: true }, { name: 'freeB', isAI: true }]);
  ffaPeach.players.forEach(p => { p.skills = []; p.handCards = []; });
  ffaPeach.players[0].drawCards([new Card({ name: '桃', suit: 'heart', number: 4, type: 'basic' })]);
  ffaPeach.players[1].hp = 1;
  ffaPeach.players[1].damage(1);
  await ffaPeach.handleDying(ffaPeach.players[1]);
  assert(ffaPeach.players[1].isAlive, 'ffa 下 AI 仍会出【桃】救其他角色（行为不变）');

  // AOE：组队模式下仍命中所有人（含队友）
  const tmAoe = new Game();
  tmAoe.config.teamMode = '2v2';
  await tmAoe.init([
    { name: '箭A', isAI: true, team: 0 }, { name: '箭B', isAI: true, team: 0 },
    { name: '箭C', isAI: true, team: 1 }, { name: '箭D', isAI: true, team: 1 },
  ]);
  const aoeA = tmAoe.players[0];
  const aoeB = tmAoe.players[1];
  const aoeC = tmAoe.players[2];
  const aoeD = tmAoe.players[3];
  tmAoe.players.forEach(p => { p.skills = []; p.handCards = []; });
  const tmNanman = new Card({ name: '南蛮入侵', suit: 'spade', number: 7, type: 'trick' });
  aoeA.drawCards([tmNanman]);
  await tmAoe.executeCardAction(aoeA, { card: tmNanman, targets: [] });
  assert(aoeB.hp === 3 && aoeC.hp === 3 && aoeD.hp === 3, 'AOE 仍命中所有人（含队友，不做过滤）');

  console.log('\n[34] 组队异常人数与重开');
  // 2v2 但人数≠4：按实际人数 i%2 分队，不崩溃
  const tmOdd = new Game();
  tmOdd.config.teamMode = '2v2';
  await tmOdd.init(Array.from({ length: 3 }, (_, i) => ({ name: `odd-${i}`, isAI: true })));
  assert(tmOdd.players.map(p => p.team).join(',') === '0,1,0', '2v2 人数≠4 时按 i%2 分队不崩溃');
  assert(tmOdd.checkWinLose() === null, '异常人数下双方均有存活时未分胜负');
  const tmOdd5 = new Game();
  tmOdd5.config.teamMode = '2v2';
  await tmOdd5.init(Array.from({ length: 5 }, (_, i) => ({ name: `odd5-${i}`, isAI: true })));
  assert(tmOdd5.players.map(p => p.team).join(',') === '0,1,0,1,0', '2v2 5人分队 0/1/0/1/0');
  // 只有 1 人：队伍 0，不误判负
  const tmSolo = new Game();
  tmSolo.config.teamMode = '3v3';
  await tmSolo.init([{ name: '独狼', isAI: false }]);
  assert(tmSolo.players[0].team === 0, '单人组队时队伍为 0');
  assert(tmSolo.checkWinLose() !== 'lose', '单人组队不误判负');
  assert(tmSolo.checkWinLose() === 'win', '仅剩我方队伍存活时判胜');
  // 重开：同一 Game 对象再次 init，config.teamMode 与显式 team 仍生效
  const tmRestart = new Game();
  tmRestart.config.teamMode = '2v2';
  const restartCfgs = [
    { name: 'r0', isAI: true, team: 0 }, { name: 'r1', isAI: true, team: 1 },
    { name: 'r2', isAI: true, team: 1 }, { name: 'r3', isAI: true, team: 0 },
  ];
  await tmRestart.init(restartCfgs);
  assert(tmRestart.players.map(p => p.team).join(',') === '0,1,1,0', '首次 init 使用显式 team 配置');
  await tmRestart.init(restartCfgs);
  assert(tmRestart.teamMode === '2v2' && tmRestart.players.map(p => p.team).join(',') === '0,1,1,0',
    '重开沿用 config.teamMode 与 team 配置');

  console.log('\n[35] 组队误伤开关 friendlyFire');
  const mkTeam4 = async (configPatch = {}, name = 'ff') => {
    const g = new Game();
    g.config.teamMode = '2v2';
    Object.assign(g.config, configPatch);
    await g.init([
      { name: `${name}0`, isAI: false, team: 0 }, { name: `${name}1`, isAI: true, team: 0 },
      { name: `${name}2`, isAI: true, team: 1 }, { name: `${name}3`, isAI: true, team: 1 },
    ]);
    g.players.forEach(p => { p.skills = []; p.handCards = []; });
    return g;
  };

  // 默认关闭：目标候选排除队友
  const ffOff = await mkTeam4();
  const ffOffA = ffOff.players[0];
  const ffOffAlly = ffOff.players[1];
  assert(ffOff.friendlyFire === false, 'friendlyFire 默认关闭');
  assert(ffOff.getGameState().friendlyFire === false, 'getGameState().friendlyFire 默认 false');
  assert(!ffOff.getValidTargets(ffOffA, '杀').includes(ffOffAlly), '误伤关闭时【杀】候选不含队友（现状不变）');
  assert(ffOff.getValidTargets(ffOffA, '杀').some(t => ffOff.isEnemy(ffOffA, t)), '误伤关闭时【杀】候选仍含敌人');

  // 开启：人类可选队友，但 AI 目标池仍排除队友
  const ffOn = await mkTeam4({ friendlyFire: true }, 'on');
  const ffOnA = ffOn.players[0];
  const ffOnAlly = ffOn.players[1];
  const ffOnFoe = ffOn.players[3];
  assert(ffOn.friendlyFire === true, 'config.friendlyFire=true 在 init 后生效');
  assert(ffOn.getGameState().friendlyFire === true, 'getGameState().friendlyFire=true');
  assert(ffOn.getValidTargets(ffOnA, '杀').includes(ffOnAlly), '误伤开启后【杀】可选队友为目标');
  assert(ffOn.getValidTargets(ffOnA, '决斗').includes(ffOnAlly), '误伤开启后【决斗】可选队友');
  ffOnAlly.drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  assert(ffOn.getValidTargets(ffOnA, '顺手牵羊').includes(ffOnAlly), '误伤开启后【顺手牵羊】可选队友');
  assert(ffOn.getValidTargets(ffOnA, '过河拆桥').includes(ffOnAlly), '误伤开启后【过河拆桥】可选队友');
  assert(!ffOn.getAITargets(ffOnA, '杀').includes(ffOnAlly), '误伤开启后 AI 目标池仍排除队友');
  assert(ffOn.getAITargets(ffOnA, '杀').includes(ffOnFoe), '误伤开启后 AI 目标池仍含敌人');
  ffOnA.isAI = true; // 模拟 AI 座位的自动选目标/自动出牌路径
  const ffAutoPick = await ffOn.askForTarget(ffOnA, [ffOnAlly, ffOnFoe]);
  assert(ffAutoPick === ffOnFoe, '误伤开启后 AI 自动选目标仍优先敌方');
  ffOnA.drawCards([new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' })]);
  const ffAiAction = await ffOn.aiAutoPlay(ffOnA);
  assert(ffAiAction.card?.name === '杀' && ffAiAction.targets[0] !== ffOnAlly
    && ffOn.isEnemy(ffOnA, ffAiAction.targets[0]), '误伤开启后 AI 仍不主动打队友');
  // 误伤开启后对队友的伤害正常结算
  ffOnAlly.handCards = [];
  const ffAllyHp = ffOnAlly.hp;
  await ffOn.executeCardAction(ffOnA, { card: ffOnA.handCards.find(c => c.name === '杀'), targets: [ffOnAlly] });
  assert(ffOnAlly.hp === ffAllyHp - 1, '误伤开启后对队友的【杀】正常结算伤害', `hp=${ffOnAlly.hp}`);

  // AOE 不受误伤开关影响，仍命中所有人
  const ffAoe = await mkTeam4({ friendlyFire: true }, 'aoe');
  const ffAoeA = ffAoe.players[0];
  const ffAoeAlly = ffAoe.players[1];
  const ffAoeFoe1 = ffAoe.players[2];
  const ffAoeFoe2 = ffAoe.players[3];
  const ffNanman = new Card({ name: '南蛮入侵', suit: 'spade', number: 7, type: 'trick' });
  ffAoeA.drawCards([ffNanman]);
  await ffAoe.executeCardAction(ffAoeA, { card: ffNanman, targets: [] });
  assert(ffAoeAlly.hp === 3 && ffAoeFoe1.hp === 3 && ffAoeFoe2.hp === 3,
    'AOE 不受误伤开关影响，仍命中所有人（含队友）');

  // ffa 下 friendlyFire 不改变目标集合
  const ffFfa = new Game();
  ffFfa.config.friendlyFire = true;
  await ffFfa.init([{ name: 'ffaF0', isAI: false }, { name: 'ffaF1', isAI: true }, { name: 'ffaF2', isAI: true }]);
  assert(ffFfa.teamMode === 'ffa', 'friendlyFire 不影响默认 ffa 模式');
  assert(ffFfa.getValidTargets(ffFfa.players[0], '杀').length === 2, 'ffa 下 friendlyFire 不改变【杀】目标集合');
  assert(ffFfa.getGameState().friendlyFire === true, 'ffa 下 getGameState 同样输出 friendlyFire');

  // 非法值一律视为关闭（严格布尔）
  const ffBad = await mkTeam4({ friendlyFire: 'yes' }, 'bad');
  assert(ffBad.friendlyFire === false, '非法 friendlyFire 字符串按 false 处理');
  assert(!ffBad.getValidTargets(ffBad.players[0], '杀').includes(ffBad.players[1]), '非法值下仍排除队友');
  const ffNum = await mkTeam4({ friendlyFire: 1 }, 'num');
  assert(ffNum.friendlyFire === false, '数字 1 不被当作开启（严格布尔）');
  assert(ffNum.getGameState().friendlyFire === false, '非法值 getGameState().friendlyFire=false');

  console.log('\n[36] 全卡牌审计：基本牌 / 锦囊 / 延时');
  const mkAuditGame = async (n = 2, prefix = '审') => {
    const g = new Game();
    await g.init(Array.from({ length: n }, (_, i) => ({ name: `${prefix}${i}`, isAI: true })));
    g.players.forEach(p => { p.skills = []; p.handCards = []; });
    return g;
  };
  // 杀：造成1点伤害
  const auSha = await mkAuditGame(2, '杀');
  const auShaCard = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  auSha.players[0].drawCards([auShaCard]);
  await auSha.executeCardAction(auSha.players[0], { card: auShaCard, targets: [auSha.players[1]] });
  assert(auSha.players[1].hp === 3, '【杀】造成1点伤害');
  // 闪：抵消杀
  const auShan = await mkAuditGame(2, '闪');
  const auShanCard = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  auShan.players[0].drawCards([auShanCard]);
  auShan.players[1].drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  await auShan.executeCardAction(auShan.players[0], { card: auShanCard, targets: [auShan.players[1]] });
  assert(auShan.players[1].hp === 4 && auShan.players[1].handCardCount === 0, '【闪】抵消【杀】（目标不掉血且闪被消耗）');
  // 桃：回复1点体力
  const auTao = await mkAuditGame(2, '桃');
  auTao.players[0].hp = 2;
  const auTaoCard = new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' });
  auTao.players[0].drawCards([auTaoCard]);
  await auTao.executeCardAction(auTao.players[0], { card: auTaoCard, targets: [auTao.players[0]] });
  assert(auTao.players[0].hp === 3, '【桃】回复1点体力');
  // 酒：下一张杀伤害+1
  const auJiu = await mkAuditGame(2, '酒');
  const auJiuCard = new Card({ name: '酒', suit: 'spade', number: 3, type: 'basic' });
  const auJiuShaCard = new Card({ name: '杀', suit: 'spade', number: 9, type: 'basic' });
  auJiu.players[0].drawCards([auJiuCard, auJiuShaCard]);
  await auJiu.executeCardAction(auJiu.players[0], { card: auJiuCard, targets: [] });
  await auJiu.executeCardAction(auJiu.players[0], { card: auJiuShaCard, targets: [auJiu.players[1]] });
  assert(auJiu.players[1].hp === 2, '【酒】使下一张【杀】伤害+1');
  // 决斗：目标无杀受到1点伤害
  const auDuel = await mkAuditGame(2, '斗');
  await auDuel.executeTrickCard(auDuel.players[0], new Card({ name: '决斗', suit: 'spade', number: 1, type: 'trick' }), [auDuel.players[1]]);
  assert(auDuel.players[1].hp === 3, '【决斗】目标无【杀】时受到1点伤害');
  // 南蛮：无杀受伤、有杀免疫
  const auNan = await mkAuditGame(3, '蛮');
  auNan.players[2].drawCards([new Card({ name: '杀', suit: 'club', number: 3, type: 'basic' })]);
  await auNan.executeTrickCard(auNan.players[0], new Card({ name: '南蛮入侵', suit: 'spade', number: 7, type: 'trick' }), []);
  assert(auNan.players[1].hp === 3 && auNan.players[2].hp === 4, '【南蛮入侵】需出【杀】：无杀者受伤、有杀者免疫');
  // 万箭：无闪受伤、有闪免疫
  const auArrow = await mkAuditGame(3, '箭');
  auArrow.players[2].drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  await auArrow.executeTrickCard(auArrow.players[0], new Card({ name: '万箭齐发', suit: 'heart', number: 1, type: 'trick' }), []);
  assert(auArrow.players[1].hp === 3 && auArrow.players[2].hp === 4, '【万箭齐发】需出【闪】：无闪者受伤、有闪者免疫');
  // 桃园：所有存活角色回复1点
  const auPeachGarden = await mkAuditGame(3, '园');
  auPeachGarden.players[1].hp = 2;
  auPeachGarden.players[2].hp = 3;
  await auPeachGarden.executeTrickCard(auPeachGarden.players[0], new Card({ name: '桃园结义', suit: 'heart', number: 1, type: 'trick' }), []);
  assert(auPeachGarden.players[1].hp === 3 && auPeachGarden.players[2].hp === 4, '【桃园结义】所有存活角色回复1点体力');
  // 无懈：抵消锦囊
  const auWuxie = await mkAuditGame(2, '懈');
  auWuxie.players[0].drawCards([new Card({ name: '顺手牵羊', suit: 'spade', number: 3, type: 'trick' })]);
  auWuxie.players[1].drawCards([new Card({ name: '无懈可击', suit: 'spade', number: 11, type: 'trick' })]);
  await auWuxie.executeCardAction(auWuxie.players[0], {
    card: auWuxie.players[0].handCards.find(c => c.name === '顺手牵羊'), targets: [auWuxie.players[1]],
  });
  assert(auWuxie.players[1].handCardCount === 0
    && auWuxie.logs.some(l => l.message.includes('被无懈可击抵消')), '【无懈可击】抵消锦囊');
  // 顺手牵羊：获得目标一张牌
  const auSnatch = await mkAuditGame(2, '顺');
  auSnatch.players[1].drawCards([new Card({ name: '桃', suit: 'heart', number: 4, type: 'basic' })]);
  const auSnatchCard = new Card({ name: '顺手牵羊', suit: 'spade', number: 4, type: 'trick' });
  auSnatch.players[0].drawCards([auSnatchCard]);
  await auSnatch.executeCardAction(auSnatch.players[0], { card: auSnatchCard, targets: [auSnatch.players[1]] });
  assert(auSnatch.players[0].handCardCount === 1 && auSnatch.players[1].handCardCount === 0, '【顺手牵羊】获得目标一张牌');
  // 过河拆桥：弃置目标一张牌
  const auDismantle = await mkAuditGame(2, '拆');
  auDismantle.players[1].drawCards([new Card({ name: '桃', suit: 'heart', number: 6, type: 'basic' })]);
  const auDismantleCard = new Card({ name: '过河拆桥', suit: 'spade', number: 3, type: 'trick' });
  auDismantle.players[0].drawCards([auDismantleCard]);
  await auDismantle.executeCardAction(auDismantle.players[0], { card: auDismantleCard, targets: [auDismantle.players[1]] });
  assert(auDismantle.players[1].handCardCount === 0 && auDismantle.deck.discardPile.includes(
    auDismantle.deck.discardPile.find(c => c.name === '桃')), '【过河拆桥】弃置目标一张牌');
  // 无中生有：摸2张
  const auDraw2 = await mkAuditGame(2, '生');
  const auDraw2Card = new Card({ name: '无中生有', suit: 'heart', number: 7, type: 'trick' });
  auDraw2.players[0].drawCards([auDraw2Card]);
  await auDraw2.executeCardAction(auDraw2.players[0], { card: auDraw2Card, targets: [] });
  assert(auDraw2.players[0].handCardCount === 2, '【无中生有】摸2张牌');
  // 乐不思蜀：判定非红桃跳过出牌阶段
  const auLe = await mkAuditGame(2, '乐');
  auLe.players[0].addJudgeCard(new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: 'delay_trick' }));
  auLe.deck.cardPile.push(new Card({ name: '审判', suit: 'spade', number: 5 }));
  await auLe.turn.phaseJudge(auLe.players[0]);
  assert(auLe.players[0].getStorage('skipPlay') === true, '【乐不思蜀】判定非红桃→跳过出牌阶段');
  // 兵粮寸断：判定非梅花跳过摸牌阶段
  const auBing = await mkAuditGame(2, '粮');
  auBing.players[0].addJudgeCard(new Card({ name: '兵粮寸断', suit: 'club', number: 10, type: 'delay_trick' }));
  auBing.deck.cardPile.push(new Card({ name: '审判2', suit: 'spade', number: 8 }));
  await auBing.turn.phaseJudge(auBing.players[0]);
  assert(auBing.players[0].getStorage('skipDraw') === true, '【兵粮寸断】判定非梅花→跳过摸牌阶段');
  // 闪电：判定生效造成2点雷伤并传递
  const auBolt = await mkAuditGame(2, '电');
  const auBoltCard = new Card({ name: '闪电', suit: 'spade', number: 1, type: 'delay_trick' });
  auBolt.players[0].addJudgeCard(auBoltCard);
  auBolt.deck.cardPile.push(new Card({ name: '审判3', suit: 'spade', number: 5 }));
  await auBolt.turn.phaseJudge(auBolt.players[0]);
  assert(auBolt.players[0].hp === 2 && auBolt.players[1].judgeCards.includes(auBoltCard),
    '【闪电】判定黑桃2~9造成2点雷伤并传递给下家');

  console.log('\n[37] 全卡牌审计：武器 / 防具 / 坐骑距离');
  // 诸葛连弩：出杀无次数限制
  const auCross = await mkAuditGame(2, '弩');
  auCross.players[0].equip(new Card({ name: '诸葛连弩', suit: 'club', number: 1, type: 'equip', subtype: 'weapon', range: 1 }));
  auCross.players[0].usedSha = 5;
  assert(auCross.players[0].canSha === true, '【诸葛连弩】出杀无次数限制');
  // 青釭剑：无视八卦阵
  const auQinggang = await mkAuditGame(2, '釭');
  auQinggang.players[0].equip(new Card({ name: '青釭剑', suit: 'spade', number: 6, type: 'equip', subtype: 'weapon', range: 2 }));
  auQinggang.players[1].equip(new Card({ name: '八卦阵', suit: 'spade', number: 2, type: 'equip', subtype: 'armor' }));
  auQinggang.deck.cardPile.push(new Card({ name: '釭判', suit: 'heart', number: 5 }));
  await auQinggang.resolveShaUse(auQinggang.players[0], new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }), auQinggang.players[1]);
  assert(auQinggang.players[1].hp === 3, '【青釭剑】使【八卦阵】失效，杀正常命中');
  // 八卦阵：红色判定视为闪
  const auBagua = await mkAuditGame(2, '卦');
  auBagua.players[1].equip(new Card({ name: '八卦阵', suit: 'club', number: 2, type: 'equip', subtype: 'armor' }));
  auBagua.deck.cardPile.push(new Card({ name: '卦判', suit: 'heart', number: 6 }));
  await auBagua.resolveShaUse(auBagua.players[0], new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' }), auBagua.players[1]);
  assert(auBagua.players[1].hp === 4
    && auBagua.logs.some(l => l.message.includes('【八卦阵】')), '【八卦阵】红色判定视为【闪】');
  // 雌雄双股剑：异性目标弃一张手牌
  const auXiong = await mkAuditGame(2, '雄');
  auXiong.players[0].equip(new Card({ name: '雌雄双股剑', suit: 'spade', number: 2, type: 'equip', subtype: 'weapon', range: 2 }));
  auXiong.players[1].setCharacter(new Character({ id: 'audit_female', name: '审女', sex: 'female', hp: 4, maxHp: 4, skillIds: [] }));
  auXiong.players[1].drawCards([new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' })]);
  await auXiong.resolveShaUse(auXiong.players[0], new Card({ name: '杀', suit: 'spade', number: 9, type: 'basic' }), auXiong.players[1]);
  assert(auXiong.players[1].handCardCount === 0, '【雌雄双股剑】对异性目标：目标弃一张手牌');
  const auXiong2 = await mkAuditGame(2, '雄2');
  auXiong2.players[0].equip(new Card({ name: '雌雄双股剑', suit: 'spade', number: 2, type: 'equip', subtype: 'weapon', range: 2 }));
  auXiong2.players[1].setCharacter(new Character({ id: 'audit_female2', name: '审女2', sex: 'female', hp: 4, maxHp: 4, skillIds: [] }));
  const auXiong2Hand = auXiong2.players[0].handCardCount;
  await auXiong2.resolveShaUse(auXiong2.players[0], new Card({ name: '杀', suit: 'spade', number: 9, type: 'basic' }), auXiong2.players[1]);
  assert(auXiong2.players[0].handCardCount === auXiong2Hand + 1, '【雌雄双股剑】目标无手牌时使用者摸一张');
  // 寒冰剑：弃目标两张牌并防止伤害
  const auIce = await mkAuditGame(2, '冰');
  auIce.players[0].equip(new Card({ name: '寒冰剑', suit: 'spade', number: 2, type: 'equip', subtype: 'weapon', range: 2 }));
  auIce.players[1].drawCards([
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 4, type: 'basic' }),
  ]);
  await auIce.resolveShaUse(auIce.players[0], new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }), auIce.players[1]);
  assert(auIce.players[1].hp === 4 && auIce.players[1].handCardCount === 0, '【寒冰剑】弃置目标两张牌并防止伤害');
  // 青龙偃月刀：被闪避后追击（最多一次）
  const auGreenDragon = await mkAuditGame(2, '龙');
  auGreenDragon.players[0].equip(new Card({ name: '青龙偃月刀', suit: 'spade', number: 5, type: 'equip', subtype: 'weapon', range: 3 }));
  const auGdSha1 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  const auGdSha2 = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  auGreenDragon.players[0].drawCards([auGdSha1, auGdSha2]);
  auGreenDragon.players[1].drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  await auGreenDragon.executeCardAction(auGreenDragon.players[0], { card: auGdSha1, targets: [auGreenDragon.players[1]] });
  assert(auGreenDragon.players[1].hp === 3 && auGreenDragon.players[0].handCardCount === 0,
    '【青龙偃月刀】被闪避后追击一张【杀】并命中');
  // 丈八蛇矛：两张手牌当杀（审计修复：原 askForCards 不存在会抛异常）
  const auZhangba = await mkAuditGame(2, '丈');
  auZhangba.players[0].equip(new Card({ name: '丈八蛇矛', suit: 'spade', number: 3, type: 'equip', subtype: 'weapon', range: 3 }));
  auZhangba.players[0].drawCards([
    new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }),
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
  ]);
  let zhangbaError = '';
  let zhangbaOk = false;
  try {
    zhangbaOk = await auZhangba.useWeaponAction(auZhangba.players[0], 'zhangba');
  } catch (e) { zhangbaError = e.message; }
  assert(!zhangbaError, '【丈八蛇矛】发动不再抛异常（审计修复）', zhangbaError);
  assert(zhangbaOk === true && auZhangba.players[0].handCardCount === 0
    && auZhangba.players[1].hp === 3 && auZhangba.players[0].usedSha === 1,
    '【丈八蛇矛】两张手牌当【杀】使用并命中');
  // 贯石斧：被闪避后弃两张牌强制造成伤害
  const auAxe = await mkAuditGame(2, '斧');
  auAxe.players[0].equip(new Card({ name: '贯石斧', suit: 'diamond', number: 5, type: 'equip', subtype: 'weapon', range: 3 }));
  const auAxeSha = new Card({ name: '杀', suit: 'spade', number: 9, type: 'basic' });
  auAxe.players[0].drawCards([auAxeSha, new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }), new Card({ name: '闪', suit: 'heart', number: 4, type: 'basic' })]);
  auAxe.players[1].drawCards([new Card({ name: '闪', suit: 'diamond', number: 2, type: 'basic' })]);
  await auAxe.executeCardAction(auAxe.players[0], { card: auAxeSha, targets: [auAxe.players[1]] });
  assert(auAxe.players[1].hp === 3 && auAxe.players[0].handCardCount === 0, '【贯石斧】被闪避后弃两张牌强制造成1点伤害');
  // 方天画戟：最后手牌多目标
  const auFangtian = await mkAuditGame(3, '戟');
  auFangtian.players[0].equip(new Card({ name: '方天画戟', suit: 'diamond', number: 12, type: 'equip', subtype: 'weapon', range: 4 }));
  const auFtSha = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  auFangtian.players[0].drawCards([auFtSha]);
  await auFangtian.executeCardAction(auFangtian.players[0], { card: auFtSha, targets: [auFangtian.players[1], auFangtian.players[2]] });
  assert(auFangtian.players[1].hp === 3 && auFangtian.players[2].hp === 3
    && auFangtian.players[0].usedSha === 1, '【方天画戟】最后手牌可多目标且只计一次出杀');
  // 麒麟弓：造成伤害后射落坐骑
  const auQilin = await mkAuditGame(2, '麟');
  auQilin.players[0].equip(new Card({ name: '麒麟弓', suit: 'heart', number: 5, type: 'equip', subtype: 'weapon', range: 5 }));
  auQilin.players[1].equip(new Card({ name: '赤兔', suit: 'heart', number: 5, type: 'equip', subtype: 'horse_atk' }));
  await auQilin.resolveShaUse(auQilin.players[0], new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }), auQilin.players[1]);
  assert(auQilin.players[1].hp === 3 && auQilin.players[1].getEquipByType('horse_atk') === null, '【麒麟弓】造成伤害后射落目标坐骑');
  // 6 张坐骑的距离修正
  const auMount = await mkAuditGame(4, '马');
  const auM0 = auMount.players[0];
  const auM1 = auMount.players[1];
  const auM2 = auMount.players[2];
  for (const name of ['绝影', '的卢', '爪黄飞电']) {
    auM1.equip(new Card({ name, suit: 'spade', number: 5, type: 'equip', subtype: 'horse_def' }));
    assert(auMount.distance.getAttackDistance(auM0, auM1) === 2, `【${name}】防御距离+1`);
    auM1.unequip('horse_def');
  }
  for (const name of ['赤兔', '大宛', '紫骍']) {
    auM0.equip(new Card({ name, suit: 'heart', number: 5, type: 'equip', subtype: 'horse_atk' }));
    assert(auMount.distance.getAttackDistance(auM0, auM2) === 1, `【${name}】进攻距离-1`);
    auM0.unequip('horse_atk');
  }

  console.log('\n[38] 6 张坐骑差异化效果');
  // 绝影：受到杀伤害后摸1张（每回合1次）
  const mntJueying = await mkAuditGame(2, '绝');
  mntJueying.players[1].equip(new Card({ name: '绝影', suit: 'spade', number: 5, type: 'equip', subtype: 'horse_def' }));
  const mntJySha1 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  mntJueying.players[0].drawCards([mntJySha1]);
  await mntJueying.executeCardAction(mntJueying.players[0], { card: mntJySha1, targets: [mntJueying.players[1]] });
  assert(mntJueying.players[1].hp === 3 && mntJueying.players[1].handCardCount === 1,
    '【绝影】受到【杀】伤害后摸1张牌');
  mntJueying.players[1].handCards = [];
  const mntJySha2 = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  mntJueying.players[0].drawCards([mntJySha2]);
  await mntJueying.executeCardAction(mntJueying.players[0], { card: mntJySha2, targets: [mntJueying.players[1]] });
  assert(mntJueying.players[1].hp === 2 && mntJueying.players[1].handCardCount === 0,
    '【绝影】每回合仅触发一次');
  // 的卢：未出闪时防止1点伤害（每回合1次）
  const mntDilu = await mkAuditGame(2, '的');
  mntDilu.players[1].equip(new Card({ name: '的卢', suit: 'club', number: 5, type: 'equip', subtype: 'horse_def' }));
  const mntDlSha1 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  mntDilu.players[0].drawCards([mntDlSha1]);
  await mntDilu.executeCardAction(mntDilu.players[0], { card: mntDlSha1, targets: [mntDilu.players[1]] });
  assert(mntDilu.players[1].hp === 4 && mntDilu.logs.some(l => l.message.includes('【的卢】')),
    '【的卢】未打出【闪】时防止1点伤害');
  const mntDlSha2 = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  mntDilu.players[0].drawCards([mntDlSha2]);
  await mntDilu.executeCardAction(mntDilu.players[0], { card: mntDlSha2, targets: [mntDilu.players[1]] });
  assert(mntDilu.players[1].hp === 3, '【的卢】每回合仅防止一次');
  // 爪黄飞电：结束阶段若本回合未受伤则摸1张
  const mntZhuahuang = await mkAuditGame(2, '爪');
  mntZhuahuang.players[0].equip(new Card({ name: '爪黄飞电', suit: 'heart', number: 13, type: 'equip', subtype: 'horse_def' }));
  await mntZhuahuang.turn.phaseFinish(mntZhuahuang.players[0]);
  assert(mntZhuahuang.players[0].handCardCount === 1, '【爪黄飞电】结束阶段本回合未受伤则摸1张牌');
  await mntZhuahuang.dealDamage({ source: mntZhuahuang.players[1], target: mntZhuahuang.players[0], num: 1 });
  await mntZhuahuang.turn.phaseFinish(mntZhuahuang.players[0]);
  assert(mntZhuahuang.players[0].handCardCount === 1
    && mntZhuahuang.logs.filter(l => l.message.includes('【爪黄飞电】')).length === 1,
    '【爪黄飞电】本回合受伤后结束阶段不再摸牌');
  // 赤兔：出牌阶段首次使用杀时摸1张
  const mntChitu = await mkAuditGame(2, '赤');
  mntChitu.players[0].equip(new Card({ name: '赤兔', suit: 'heart', number: 5, type: 'equip', subtype: 'horse_atk' }));
  mntChitu.turn.currentPhase = 'play';
  const mntCtSha1 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  mntChitu.players[0].drawCards([mntCtSha1]);
  await mntChitu.executeCardAction(mntChitu.players[0], { card: mntCtSha1, targets: [mntChitu.players[1]] });
  assert(mntChitu.players[0].handCardCount === 1 && mntChitu.logs.some(l => l.message.includes('【赤兔】')),
    '【赤兔】本回合首次使用【杀】时摸1张牌');
  const mntCtSha2 = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  mntChitu.players[0].drawCards([mntCtSha2]);
  const mntCtHandBefore = mntChitu.players[0].handCardCount;
  await mntChitu.executeCardAction(mntChitu.players[0], { card: mntCtSha2, targets: [mntChitu.players[1]] });
  assert(mntChitu.players[0].handCardCount === mntCtHandBefore - 1, '【赤兔】同一回合第二次出杀不再摸牌');
  // 大宛：杀被闪抵消后摸1张
  const mntDawan = await mkAuditGame(2, '宛');
  mntDawan.players[0].equip(new Card({ name: '大宛', suit: 'spade', number: 13, type: 'equip', subtype: 'horse_atk' }));
  mntDawan.players[1].drawCards([
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
    new Card({ name: '闪', suit: 'diamond', number: 2, type: 'basic' }),
  ]);
  const mntDwSha1 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  mntDawan.players[0].drawCards([mntDwSha1]);
  await mntDawan.executeCardAction(mntDawan.players[0], { card: mntDwSha1, targets: [mntDawan.players[1]] });
  assert(mntDawan.players[0].handCardCount === 1 && mntDawan.logs.some(l => l.message.includes('【大宛】')),
    '【大宛】的【杀】被闪抵消后摸1张牌');
  const mntDwSha2 = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  mntDawan.players[0].drawCards([mntDwSha2]);
  const mntDwHandBefore = mntDawan.players[0].handCardCount;
  await mntDawan.executeCardAction(mntDawan.players[0], { card: mntDwSha2, targets: [mntDawan.players[1]] });
  assert(mntDawan.players[0].handCardCount === mntDwHandBefore - 1, '【大宛】每回合仅触发一次');
  // 紫骍：杀造成伤害后弃目标1张牌
  const mntZixing = await mkAuditGame(2, '紫');
  mntZixing.players[0].equip(new Card({ name: '紫骍', suit: 'diamond', number: 13, type: 'equip', subtype: 'horse_atk' }));
  mntZixing.players[1].drawCards([
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 4, type: 'basic' }),
  ]);
  const mntZxSha1 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  mntZixing.players[0].drawCards([mntZxSha1]);
  await mntZixing.executeCardAction(mntZixing.players[0], { card: mntZxSha1, targets: [mntZixing.players[1]] });
  assert(mntZixing.players[1].hp === 3 && mntZixing.players[1].handCardCount === 1
    && mntZixing.logs.some(l => l.message.includes('【紫骍】')), '【紫骍】的【杀】造成伤害后弃置目标1张牌');
  const mntZxSha2 = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  mntZixing.players[0].drawCards([mntZxSha2]);
  await mntZixing.executeCardAction(mntZixing.players[0], { card: mntZxSha2, targets: [mntZixing.players[1]] });
  assert(mntZixing.players[1].hp === 2 && mntZixing.players[1].handCardCount === 1, '【紫骍】每回合仅触发一次');
  // 6 条坐骑说明必须两两不同且保留距离特性
  const mountNames6 = ['绝影', '的卢', '爪黄飞电', '赤兔', '大宛', '紫骍'];
  const mountDetails = mountNames6.map(n => getCardText(n).detail);
  assert(new Set(mountDetails).size === 6, '6 张坐骑说明两两不同（不再复制粘贴）');
  assert(mountNames6.every(n => getCardText(n).detail.includes('距离')), '6 张坐骑说明均保留距离特性');

  console.log('\n[39] 无懈可击与【闪电】');
  // 无懈可击可以抵消【闪电】的放置（延时锦囊放置时）
  const wxBolt = await mkAuditGame(2, '懈电');
  const wxBoltCard = new Card({ name: '闪电', suit: 'club', number: 12, type: 'delay_trick' });
  wxBolt.players[0].drawCards([wxBoltCard, new Card({ name: '无懈可击', suit: 'spade', number: 11, type: 'trick' })]);
  await wxBolt.executeCardAction(wxBolt.players[0], { card: wxBoltCard, targets: [] });
  assert(wxBolt.players[0].judgeCards.length === 0
    && !wxBolt.players[0].handCards.some(c => c.name === '无懈可击')
    && wxBolt.logs.some(l => l.message.includes('被无懈可击抵消')),
    '【无懈可击】可以抵消【闪电】的放置（延时锦囊统一处理）');
  // 未持无懈时闪电正常放置；非受影响方（敌人）不会替其抵消
  const wxBolt2 = await mkAuditGame(2, '懈电2');
  const wxBoltCard2 = new Card({ name: '闪电', suit: 'spade', number: 1, type: 'delay_trick' });
  wxBolt2.players[0].drawCards([wxBoltCard2]);
  wxBolt2.players[1].drawCards([new Card({ name: '无懈可击', suit: 'club', number: 12, type: 'trick' })]);
  await wxBolt2.executeCardAction(wxBolt2.players[0], { card: wxBoltCard2, targets: [] });
  assert(wxBolt2.players[0].judgeCards.includes(wxBoltCard2), '无人抵消时【闪电】正常置于判定区');
  assert(wxBolt2.players[1].handCardCount === 1, '非受影响方（敌人）不会误用无懈为对手抵消闪电');
  assert(CARD_TEXT['闪电'].detail.includes('无懈'), '【闪电】说明已补充可被无懈抵消');
  // 31 种牌名说明齐备且两两不同（用户反馈“很多牌效果一样”的文案侧回归）
  const allCardNames31 = [
    '杀', '闪', '桃', '酒',
    '决斗', '南蛮入侵', '万箭齐发', '桃园结义', '无懈可击', '顺手牵羊', '过河拆桥', '无中生有',
    '乐不思蜀', '兵粮寸断', '闪电',
    '诸葛连弩', '青釭剑', '雌雄双股剑', '寒冰剑', '青龙偃月刀', '丈八蛇矛', '贯石斧', '方天画戟', '麒麟弓',
    '八卦阵', '绝影', '的卢', '爪黄飞电', '赤兔', '大宛', '紫骍',
  ];
  assert(allCardNames31.length === 31 && allCardNames31.every(n => CARD_TEXT[n]?.detail),
    '31 种牌名均有卡牌说明');
  assert(new Set(allCardNames31.map(n => CARD_TEXT[n].detail)).size === 31,
    '31 种牌名说明两两不同（无复制粘贴）');

  console.log('\n[40] 演出特效事件 death / dying / judge / heal');
  const fxCollect = (g) => {
    const list = [];
    g.ui.onEffect = (e) => list.push(e);
    return list;
  };

  // 1) 伤害致死：damage → dying → death，且携带 source id / reason
  const fxKill = new Game();
  await fxKill.init([{ name: 'FX0', isAI: true }, { name: 'FX1', isAI: true }]);
  fxKill.players.forEach(p => { p.skills = []; p.handCards = []; });
  const fxKillList = fxCollect(fxKill);
  fxKill.players[1].hp = 1;
  await fxKill.dealDamage({ source: fxKill.players[0], target: fxKill.players[1], num: 1 });
  const fxDmgIdx = fxKillList.findIndex(e => e.type === 'damage');
  const fxDyingIdx = fxKillList.findIndex(e => e.type === 'dying');
  const fxDeathIdx = fxKillList.findIndex(e => e.type === 'death');
  const fxDying = fxKillList[fxDyingIdx];
  const fxDeath = fxKillList[fxDeathIdx];
  assert(fxDyingIdx !== -1 && fxDying.player?.id === fxKill.players[1].id
    && fxDying.source?.id === fxKill.players[0].id, '死亡流程发出 dying 事件（含 source id）');
  assert(fxDeathIdx !== -1 && fxDeath.player?.id === fxKill.players[1].id
    && fxDeath.source?.id === fxKill.players[0].id && fxDeath.reason === 'damage',
    '死亡发出 death 事件（player/source/reason=damage）');
  assert(fxDmgIdx !== -1 && fxDmgIdx < fxDyingIdx && fxDyingIdx < fxDeathIdx,
    '事件顺序稳定：伤害 → dying → death');
  assert(fxDeath.player && typeof fxDeath.player.name === 'string'
    && typeof fxDeath.player.seatNum === 'number' && 'character' in fxDeath.player
    && 'team' in fxDeath.player, 'death 事件的 player 为序列化安全字段');

  // 2) 闪电致死：judge 事件 + damage(nature thunder) + death.reason='lightning'、source=null
  const fxBolt = new Game();
  await fxBolt.init([{ name: 'BOLT0', isAI: true }, { name: 'BOLT1', isAI: true }]);
  fxBolt.players.forEach(p => { p.skills = []; p.handCards = []; });
  const fxBoltList = fxCollect(fxBolt);
  fxBolt.players[0].hp = 2;
  const fxBoltCard = new Card({ name: '闪电', suit: 'spade', number: 1, type: 'delay_trick' });
  fxBolt.players[0].addJudgeCard(fxBoltCard);
  fxBolt.deck.cardPile.push(new Card({ name: '雷判', suit: 'spade', number: 5 }));
  await fxBolt.turn.phaseJudge(fxBolt.players[0]);
  const fxBoltJudge = fxBoltList.find(e => e.type === 'judge');
  const fxBoltDeath = fxBoltList.find(e => e.type === 'death');
  assert(fxBoltJudge && fxBoltJudge.success === true
    && fxBoltJudge.delayCard?.name === '闪电' && fxBoltJudge.card?.name === '雷判'
    && fxBoltJudge.card?.suit === 'spade' && fxBoltJudge.card?.isRed === false,
    'judge 事件含 card(suit/isRed)/delayCard/success');
  assert(fxBoltDeath && fxBoltDeath.reason === 'lightning' && fxBoltDeath.source === null,
    '闪电致死 death.reason=lightning 且 source=null');
  assert(fxBoltList.some(e => e.type === 'damage' && e.nature === 'thunder'),
    '闪电伤害仍发 damage 事件（nature=thunder）');

  // 3) 乐不思蜀判定：judge.success=false（红桃不中）
  const fxLe = new Game();
  await fxLe.init([{ name: 'LE0', isAI: true }, { name: 'LE1', isAI: true }]);
  fxLe.players.forEach(p => { p.skills = []; p.handCards = []; });
  const fxLeList = fxCollect(fxLe);
  fxLe.players[0].addJudgeCard(new Card({ name: '乐不思蜀', suit: 'spade', number: 6, type: 'delay_trick' }));
  fxLe.deck.cardPile.push(new Card({ name: '乐判', suit: 'heart', number: 5 }));
  await fxLe.turn.phaseJudge(fxLe.players[0]);
  const fxLeJudge = fxLeList.find(e => e.type === 'judge');
  assert(fxLeJudge && fxLeJudge.success === false
    && fxLeJudge.delayCard?.name === '乐不思蜀' && fxLeJudge.card?.isRed === true,
    '判定阶段 judge 事件（乐不思蜀红桃→success=false）');

  // 4) 八卦阵判定也发 judge 事件
  const fxBagua = new Game();
  await fxBagua.init([{ name: 'BAGUA0', isAI: true }, { name: 'BAGUA1', isAI: true }]);
  fxBagua.players.forEach(p => { p.skills = []; p.handCards = []; });
  fxBagua.players[1].equip(new Card({ name: '八卦阵', suit: 'spade', number: 2, type: 'equip', subtype: 'armor' }));
  fxBagua.deck.cardPile.push(new Card({ name: '卦判', suit: 'heart', number: 6 }));
  const fxBaguaList = fxCollect(fxBagua);
  await fxBagua.resolveShaUse(fxBagua.players[0], new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }), fxBagua.players[1]);
  const fxBaguaJudge = fxBaguaList.find(e => e.type === 'judge');
  assert(fxBaguaJudge && fxBaguaJudge.success === true && fxBaguaJudge.delayCard === null
    && fxBaguaJudge.card?.isRed === true && fxBaguaJudge.player?.id === fxBagua.players[1].id,
    '八卦阵判定也发 judge 事件（delayCard=null）');

  // 5) 桃回复发 heal
  const fxHeal = new Game();
  await fxHeal.init([{ name: 'HEAL0', isAI: true }, { name: 'HEAL1', isAI: true }]);
  fxHeal.players.forEach(p => { p.skills = []; p.handCards = []; });
  fxHeal.players[0].hp = 2;
  const fxHealCard = new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' });
  fxHeal.players[0].drawCards([fxHealCard]);
  const fxHealList = fxCollect(fxHeal);
  await fxHeal.executeCardAction(fxHeal.players[0], { card: fxHealCard, targets: [fxHeal.players[0]] });
  const fxHealFx = fxHealList.find(e => e.type === 'heal');
  assert(fxHealFx && fxHealFx.player?.id === fxHeal.players[0].id && fxHealFx.num === 1,
    '【桃】回复触发 heal 事件（player/num）');

  // 6) 桃园结义：每个回复者各发 heal
  const fxGarden = new Game();
  await fxGarden.init([{ name: 'GAR0', isAI: true }, { name: 'GAR1', isAI: true }, { name: 'GAR2', isAI: true }]);
  fxGarden.players.forEach(p => { p.skills = []; p.handCards = []; });
  fxGarden.players[1].hp = 2;
  fxGarden.players[2].hp = 3;
  const fxGardenList = fxCollect(fxGarden);
  await fxGarden.executeTrickCard(fxGarden.players[0], new Card({ name: '桃园结义', suit: 'heart', number: 1, type: 'trick' }), []);
  const fxGardenHeals = fxGardenList.filter(e => e.type === 'heal');
  assert(fxGardenHeals.length === 2
    && fxGardenHeals.every(e => e.num === 1)
    && fxGardenHeals.map(e => e.player?.id).sort().join(',')
      === [fxGarden.players[1].id, fxGarden.players[2].id].sort().join(','),
    '【桃园结义】为每个回复者发 heal 事件');

  // 7) 濒死自救：dying + heal，不出现 death
  const fxSelf = new Game();
  await fxSelf.init([{ name: 'SELF0', isAI: true }, { name: 'SELF1', isAI: true }]);
  fxSelf.players.forEach(p => { p.skills = []; p.handCards = []; });
  fxSelf.players[0].drawCards([new Card({ name: '桃', suit: 'heart', number: 4, type: 'basic' })]);
  fxSelf.players[0].hp = 1;
  const fxSelfList = fxCollect(fxSelf);
  await fxSelf.dealDamage({ source: fxSelf.players[1], target: fxSelf.players[0], num: 1 });
  const fxSelfHeal = fxSelfList.find(e => e.type === 'heal' && e.player?.id === fxSelf.players[0].id);
  assert(fxSelf.players[0].isAlive, '濒死自救成功（桃）');
  assert(fxSelfHeal && fxSelfHeal.num === 1 && fxSelfHeal.source === null,
    '濒死自救发 heal 事件（source=null）');
  assert(fxSelfList.some(e => e.type === 'dying') && !fxSelfList.some(e => e.type === 'death'),
    '濒死被救回时发 dying 但不发 death');

  // 8) 他人出桃救援：heal 事件带 healer source
  const fxHelp = new Game();
  await fxHelp.init([{ name: 'HELP0', isAI: true }, { name: 'HELP1', isAI: true }]);
  fxHelp.players.forEach(p => { p.skills = []; p.handCards = []; });
  fxHelp.players[1].drawCards([new Card({ name: '桃', suit: 'heart', number: 6, type: 'basic' })]);
  fxHelp.players[0].hp = 1;
  const fxHelpList = fxCollect(fxHelp);
  await fxHelp.dealDamage({ source: fxHelp.players[1], target: fxHelp.players[0], num: 1 });
  const fxHelpHeal = fxHelpList.find(e => e.type === 'heal' && e.player?.id === fxHelp.players[0].id);
  assert(fxHelp.players[0].isAlive && fxHelpHeal && fxHelpHeal.source?.id === fxHelp.players[1].id,
    '他人【桃】救援发 heal 事件且带 source');

  // 9) 决斗致死：death.reason='duel'
  const fxDuel = new Game();
  await fxDuel.init([{ name: 'DUEL0', isAI: true }, { name: 'DUEL1', isAI: true }]);
  fxDuel.players.forEach(p => { p.skills = []; p.handCards = []; });
  fxDuel.players[0].hp = 1;
  fxDuel.players[1].drawCards([new Card({ name: '杀', suit: 'club', number: 2, type: 'basic' })]);
  const fxDuelList = fxCollect(fxDuel);
  await fxDuel.executeTrickCard(fxDuel.players[0], new Card({ name: '决斗', suit: 'spade', number: 1, type: 'trick' }), [fxDuel.players[1]]);
  const fxDuelDeath = fxDuelList.find(e => e.type === 'death');
  assert(fxDuelDeath && fxDuelDeath.reason === 'duel' && fxDuelDeath.source?.id === fxDuel.players[1].id,
    '【决斗】致死 death.reason=duel 且 source 为对方');

  console.log('\n[41] 技能分类严格化 + autoTrigger');
  const mkSkillGame = async (autoTrigger = null) => {
    const g = new Game();
    if (autoTrigger !== null) g.config.autoTrigger = autoTrigger;
    await g.init([{ name: '技人', isAI: false }, { name: '技AI', isAI: true }]);
    g.players.forEach(p => { p.skills = []; p.handCards = []; });
    return g;
  };

  // 1) active + 错误 triggerTiming：不自动触发、不进主动列表、日志提示数据异常
  const badGame = await mkSkillGame();
  let badFired = 0;
  const badSkill = new Skill({
    id: 't_bad_active', name: '伪被动', type: 'active', triggerTiming: 'damaged',
    usable: 0, forced: false, filter: () => true, cost: async () => {},
    content: async () => { badFired++; },
  });
  badGame.players[0].skills.push(badSkill);
  await badGame.dealDamage({ source: badGame.players[1], target: badGame.players[0], num: 1 });
  assert(badFired === 0, 'active+triggerTiming 不会因时机自动触发');
  assert(!badGame.getActiveSkills(badGame.players[0]).some(s => s.id === 't_bad_active'),
    'active+triggerTiming 不进主动技能列表');
  assert(badGame.logs.some(l => l.message.includes('数据异常')), 'active+triggerTiming 数据异常有日志提示');
  assert(await badGame.useActiveSkill(badGame.players[0], badSkill) === false,
    '异常分类技能不能走主动发动入口');

  // 2) trigger：受伤正常触发，但不进主动列表
  const trigGame = await mkSkillGame();
  let trigFired = 0;
  const trigSkill = new Skill({
    id: 't_real_trigger', name: '真触发', type: 'trigger', triggerTiming: 'damaged',
    triggerSource: 'player', usable: 0, forced: true, filter: () => true, cost: async () => {},
    content: async () => { trigFired++; },
  });
  trigGame.players[0].skills.push(trigSkill);
  await trigGame.dealDamage({ source: trigGame.players[1], target: trigGame.players[0], num: 1 });
  assert(trigFired === 1, 'trigger 技能受伤时正常触发');
  assert(!trigGame.getActiveSkills(trigGame.players[0]).some(s => s.id === 't_real_trigger'),
    'trigger 技能不进主动技能列表');
  assert(await trigGame.useActiveSkill(trigGame.players[0], trigSkill) === false,
    'trigger 技能不能走主动发动入口');

  // 3) locked 不进主动列表；phaseUse / 无触发时机的 active 仍在主动列表
  const listGame = await mkSkillGame();
  listGame.players[0].skills.push(
    new Skill({ id: 't_locked', name: '锁定技', type: 'locked', triggerTiming: '', usable: 0, forced: true, filter: () => false, cost: async () => {}, content: async () => {} }),
    new Skill({ id: 't_phase_active', name: '主动A', type: 'active', enable: 'phaseUse', usable: 0, forced: false, filter: () => true, cost: async () => {}, content: async () => {} }),
    new Skill({ id: 't_plain_active', name: '主动B', type: 'active', usable: 0, forced: false, filter: () => true, cost: async () => {}, content: async () => {} }),
  );
  const activeIds = listGame.getActiveSkills(listGame.players[0]).map(s => s.id);
  assert(!activeIds.includes('t_locked'), 'locked 技能不进主动技能列表');
  assert(activeIds.includes('t_phase_active') && activeIds.includes('t_plain_active'),
    '真正主动技（phaseUse / 无触发时机）保留在主动列表');

  // 4) autoTrigger=false：真人可选触发技走确认，拒绝则不发动
  const confirmGame = await mkSkillGame(false);
  assert(confirmGame.getGameState().autoTrigger === false, 'getGameState().autoTrigger 默认 false');
  let confirmCalls = 0;
  confirmGame.ui.askForConfirm = async () => { confirmCalls++; return false; };
  let optFired = 0;
  confirmGame.players[0].skills.push(new Skill({
    id: 't_optional', name: '可选触发', type: 'trigger', triggerTiming: 'damaged',
    triggerSource: 'player', usable: 0, forced: false, filter: () => true, cost: async () => {},
    content: async () => { optFired++; },
    ai: { order: 0, check: () => true },
  }));
  await confirmGame.dealDamage({ source: confirmGame.players[1], target: confirmGame.players[0], num: 1 });
  assert(confirmCalls === 1 && optFired === 0, 'autoTrigger=false：真人可选触发技走确认，拒绝不发动');

  // 5) autoTrigger=true：不弹确认、按 ai.check 自动发动、日志含【自动发动】
  const autoGame = await mkSkillGame(true);
  assert(autoGame.getGameState().autoTrigger === true, 'getGameState().autoTrigger=true');
  let autoConfirmCalls = 0;
  autoGame.ui.askForConfirm = async () => { autoConfirmCalls++; return false; };
  let autoFired = 0;
  const autoSkill = new Skill({
    id: 't_auto', name: '自动触发', type: 'trigger', triggerTiming: 'damaged',
    triggerSource: 'player', usable: 0, forced: false, filter: () => true, cost: async () => {},
    content: async () => { autoFired++; },
    ai: { order: 0, check: () => true },
  });
  autoGame.players[0].skills.push(autoSkill);
  await autoGame.dealDamage({ source: autoGame.players[1], target: autoGame.players[0], num: 1 });
  assert(autoConfirmCalls === 0, 'autoTrigger=true：真人不再弹确认');
  assert(autoFired === 1 && autoSkill.usedCount === 1, 'autoTrigger=true：可选触发技按 ai.check 自动发动');
  assert(autoGame.logs.some(l => l.message.includes('自动发动')), 'autoTrigger=true：日志含“自动发动”');
  // ai.check=false 时不发动
  const autoNoGame = await mkSkillGame(true);
  let autoNoFired = 0;
  autoNoGame.players[0].skills.push(new Skill({
    id: 't_auto_no', name: '自动不触发', type: 'trigger', triggerTiming: 'damaged',
    triggerSource: 'player', usable: 0, forced: false, filter: () => true, cost: async () => {},
    content: async () => { autoNoFired++; },
    ai: { order: 0, check: () => false },
  }));
  await autoNoGame.dealDamage({ source: autoNoGame.players[1], target: autoNoGame.players[0], num: 1 });
  assert(autoNoFired === 0, 'autoTrigger=true 时 ai.check=false 不发动');

  // 6) AI 可选触发技路径不变（自动按 ai.check，不弹确认）
  const aiTrigGame = await mkSkillGame();
  let aiTrigFired = 0;
  aiTrigGame.players[1].skills.push(new Skill({
    id: 't_ai_optional', name: 'AI可选', type: 'trigger', triggerTiming: 'damaged',
    triggerSource: 'player', usable: 0, forced: false, filter: () => true, cost: async () => {},
    content: async () => { aiTrigFired++; },
    ai: { order: 0, check: () => true },
  }));
  await aiTrigGame.dealDamage({ source: aiTrigGame.players[0], target: aiTrigGame.players[1], num: 1 });
  assert(aiTrigFired === 1, 'AI 可选触发技行为不变（自动按 ai.check）');

  // 7) 数据审计：CLASSIC_SKILLS + BASE_SKILLS 分类合规
  const dataSkills = [...CLASSIC_SKILLS, ...BASE_SKILLS].map(def => new Skill(def));
  assert(dataSkills.every(s => !(s.type === 'active' && s.triggerTiming)),
    '数据审计：不存在 active+triggerTiming 混用');
  assert(dataSkills.filter(s => s.type === 'active').every(s => s.enable === 'phaseUse' || !s.triggerTiming),
    '数据审计：所有 active 技能均符合主动技分类');
  const auditClassifier = await mkSkillGame();
  assert(dataSkills.every(s => !['trigger', 'locked'].includes(s.type) || auditClassifier.isActiveSkill(s) === false),
    '数据审计：trigger/locked 均不会被判定为主动技');
  assert(dataSkills.every(s => s.type !== 'active' || auditClassifier.isActiveSkill(s) === true),
    '数据审计：所有 active 技能均可被识别为主动技');

  console.log('\n[42] 经典武将强化回归（历史增强）');
  const mkCharGame = async (charId, extraIds = []) => {
    const g = new Game();
    g.registerCharacter({ id: 'plain42', name: '素将', group: 'custom', hp: 4, maxHp: 4, skillIds: [] });
    const configs = [{ name: '强0', isAI: true, characterId: charId }];
    extraIds.forEach((id, i) => configs.push({ name: `强${i + 1}`, isAI: true, characterId: id }));
    await g.init(configs);
    return g;
  };

  // 1) 曹操【奸雄】：受伤后获得伤害牌 + 摸1张
  const gJx42 = await mkCharGame('cls_caocao', ['plain42']);
  const cc42 = gJx42.players[0];
  const jxAtk42 = gJx42.players[1];
  cc42.handCards = [];
  const shaJx42 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  jxAtk42.drawCards([shaJx42]);
  await gJx42.executeCardAction(jxAtk42, { card: shaJx42, targets: [cc42] });
  assert(cc42.handCards.includes(shaJx42) && cc42.handCardCount === 2,
    '【奸雄】强化：获得伤害牌并摸1张牌', `hand=${cc42.handCardCount}`);
  assert(gJx42.logs.some(l => l.message.includes('【奸雄】摸1张牌')), '【奸雄】强化摸牌有日志');

  // 2) 刘备【仁德】：交1~2张、交2张摸1、已伤回1
  const gRd42 = await mkCharGame('cls_liubei', ['plain42']);
  const lb42 = gRd42.players[0];
  lb42.hp = lb42.maxHp - 1;
  gRd42.ui.askForCards = async (p) => p.handCards.slice(0, 2);
  const rdHand42 = lb42.handCardCount;
  assert(await gRd42.useActiveSkill(lb42, lb42.skills.find(s => s.id === 'cls_rende')) === true,
    '【仁德】强化后可发动');
  assert(lb42.handCardCount === rdHand42 - 1, '【仁德】交出2张摸1张（净-1）', `hand=${lb42.handCardCount}`);
  assert(lb42.hp === lb42.maxHp, '【仁德】强化：已受伤回复1点体力');
  assert(gRd42.logs.some(l => l.message.includes('交出2张牌，摸1张牌')), '【仁德】交2张摸1有日志');

  // 3) 孙权【制衡】：弃≥2额外摸1
  const gZh42 = await mkCharGame('cls_sunquan', ['plain42']);
  const sq42 = gZh42.players[0];
  gZh42.ui.askForCards = async (p) => p.handCards.slice(0, 2);
  const zhHand42 = sq42.handCardCount;
  assert(await gZh42.useActiveSkill(sq42, sq42.skills.find(s => s.id === 'cls_zhiheng')) === true,
    '【制衡】强化后可发动');
  assert(sq42.handCardCount === zhHand42 + 1, '【制衡】弃2额外摸1（净+1）', `hand=${sq42.handCardCount}`);
  assert(gZh42.logs.some(l => l.message.includes('弃≥2额外+1')), '【制衡】额外摸牌有日志');

  // 4) 关羽【武圣】：使用【杀】无距离限制（距离数值/次数限制不变）
  const gWs42 = await mkCharGame('cls_guanyu', ['plain42', 'plain42', 'plain42']);
  const gy42 = gWs42.players[0];
  const p1_42 = gWs42.players[1];
  const p2_42 = gWs42.players[2];
  const p3_42 = gWs42.players[3];
  assert(gWs42.distance.getAttackDistance(gy42, p2_42) === 2, '【武圣】未改变距离数值（仅改目标计算）');
  assert(gWs42.getValidTargets(gy42, '杀').includes(p2_42), '【武圣】强化：距离2的角色也可被【杀】指定');
  assert(!gWs42.getValidTargets(p1_42, '杀').includes(p3_42), '对照组：普通角色【杀】仍受距离限制');
  gy42.usedSha = 1;
  assert(gy42.canSha === false, '【武圣】强化后仍受出杀次数限制');

  // 5) 张飞【咆哮】：出杀无限制 + 杀造成伤害后摸1（每回合1次）
  const gPx42 = await mkCharGame('cls_zhangfei', ['plain42']);
  const zf42 = gPx42.players[0];
  const zfTarget42 = gPx42.players[1];
  zf42.handCards = [];
  zfTarget42.handCards = [];
  const zfSha1 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  zf42.drawCards([zfSha1]);
  await gPx42.executeCardAction(zf42, { card: zfSha1, targets: [zfTarget42] });
  assert(zf42.handCardCount === 1 && gPx42.logs.some(l => l.message.includes('【咆哮】')),
    '【咆哮】强化：【杀】造成伤害后摸1张牌');
  const zfSha2 = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  zf42.drawCards([zfSha2]);
  await gPx42.executeCardAction(zf42, { card: zfSha2, targets: [zfTarget42] });
  assert(zf42.handCardCount === 1
    && gPx42.logs.filter(l => l.message.includes('【咆哮】')).length === 1,
    '【咆哮】强化：每回合仅摸1次');

  // 6) 诸葛亮【空城】：无手牌时摸牌阶段额外摸1
  const gKc42 = await mkCharGame('cls_zhugeliang', ['plain42']);
  const zg42 = gKc42.players[0];
  zg42.handCards = [];
  const kcEvEmpty = await gKc42.fireTiming('phaseDrawBegin2', { player: zg42, num: 2 });
  assert(kcEvEmpty.data.num === 3, '【空城】强化：无手牌时摸牌阶段额外摸1张');
  zg42.drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  const kcEvHas = await gKc42.fireTiming('phaseDrawBegin2', { player: zg42, num: 2 });
  assert(kcEvHas.data.num === 2, '【空城】有手牌时不额外摸牌');

  // 7) 司马懿【反馈】：获得来源一张手牌 + 摸1张
  const gFk42 = await mkCharGame('cls_simayi', ['plain42']);
  const fk42 = gFk42.players[0];
  const fkSrc42 = gFk42.players[1];
  fk42.skills = fk42.skills.filter(s => s.id !== 'cls_yinren'); // 隔离测试【反馈】
  fkSrc42.handCards = [];
  fkSrc42.drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  const fkBefore42 = fk42.handCardCount;
  await gFk42.dealDamage({ source: fkSrc42, target: fk42, num: 1 });
  assert(fk42.handCardCount === fkBefore42 + 2 && fkSrc42.handCardCount === 0,
    '【反馈】强化：获得来源一张手牌并摸1张牌');
  assert(gFk42.logs.some(l => l.message.includes('【反馈】摸1张牌')), '【反馈】强化摸牌有日志');

  // 8) 周瑜【英姿】：摸牌+1、手牌上限+1（弃牌阶段）
  const gYz42 = await mkCharGame('cls_zhouyu', ['plain42']);
  const yz42 = gYz42.players[0];
  const plainYz42 = gYz42.players[1];
  assert(yz42.handLimit === yz42.hp + 1, '【英姿】强化：手牌上限+1', `limit=${yz42.handLimit}`);
  assert(plainYz42.handLimit === plainYz42.hp, '对照：普通角色手牌上限=体力值');
  yz42.handCards = [];
  yz42.drawCards(Array.from({ length: 5 }, (_, i) => new Card({ name: '闪', suit: 'heart', number: (i % 13) + 2, type: 'basic' })));
  plainYz42.handCards = [];
  plainYz42.hp = 3;
  plainYz42.drawCards(Array.from({ length: 5 }, (_, i) => new Card({ name: '闪', suit: 'diamond', number: (i % 13) + 2, type: 'basic' })));
  await gYz42.turn.phaseDiscard(yz42);
  await gYz42.turn.phaseDiscard(plainYz42);
  assert(yz42.handCardCount === 4, '【英姿】弃牌阶段按上限+1弃1张（5→4）', `hand=${yz42.handCardCount}`);
  assert(plainYz42.handCardCount === 3, '对照：普通角色弃牌阶段按体力弃2张（5→3）');

  // 9) 黄月英【集智】：非延时锦囊摸1，红色改为摸2
  const gJz42 = await mkCharGame('cls_huangyueying', ['plain42']);
  const hy42 = gJz42.players[0];
  hy42.handCards = [];
  await gJz42.fireTiming('useCard', { player: hy42, card: new Card({ name: '过河拆桥', suit: 'spade', number: 3, type: 'trick' }) });
  assert(hy42.handCardCount === 1, '【集智】黑色锦囊摸1张（强化后仍摸1）', `hand=${hy42.handCardCount}`);
  hy42.handCards = [];
  await gJz42.fireTiming('useCard', { player: hy42, card: new Card({ name: '无中生有', suit: 'heart', number: 7, type: 'trick' }) });
  assert(hy42.handCardCount === 2, '【集智】红色锦囊摸2张（强化后）', `hand=${hy42.handCardCount}`);

  // 10) 貂蝉【闭月】：结束阶段摸2
  const gBy42 = await mkCharGame('cls_diaochan', ['plain42']);
  const dc42 = gBy42.players[0];
  const byBefore42 = dc42.handCardCount;
  await gBy42.fireTiming('phaseEnd', { player: dc42, phase: 'finish' });
  assert(dc42.handCardCount === byBefore42 + 2
    && gBy42.logs.some(l => l.message.includes('【闭月】摸2张牌')), '【闭月】强化：结束阶段摸2张牌');

  // 11) 第二技能：每名经典武将至少两条技能，且都有可执行实现
  assert(CLASSIC_CHARACTERS.every(c => (c.skillIds || []).length >= 2),
    '10 名经典武将均至少拥有两个技能');
  const classicSkillIds = new Set(CLASSIC_SKILLS.map(s => s.id));
  assert(CLASSIC_CHARACTERS.every(c => (c.skillIds || []).every(id => classicSkillIds.has(id))),
    '武将引用的技能 ID 全部已注册');
  assert(CLASSIC_SKILLS.every(s => s.description && s.description.length > 0),
    '所有经典技能都有说明文案');

  // 曹操【魏武】：手牌上限+1
  const gWw = await mkCharGame('cls_caocao', ['plain42']);
  assert(gWw.players[0].handLimit === gWw.players[0].hp + 1, '【魏武】手牌上限+1');

  // 刘备【仁望】：结束阶段手牌少于体力时摸1
  const gRw = await mkCharGame('cls_liubei', ['plain42']);
  const lbRw = gRw.players[0];
  lbRw.handCards = [];
  await gRw.fireTiming('phaseEnd', { player: lbRw, phase: 'finish' });
  assert(lbRw.handCardCount >= 1, '【仁望】结束阶段补1张牌');

  // 张飞【当阳】：低血时手牌上限与攻击范围各+1
  const gDy = await mkCharGame('cls_zhangfei', ['plain42']);
  const zfDy = gDy.players[0];
  zfDy.hp = 2;
  assert(zfDy.handLimit === zfDy.hp + 1 && zfDy.getAttackRange() === 2,
    '【当阳】低血时手牌上限/攻击范围+1');
  zfDy.hp = 3;
  assert(zfDy.handLimit === zfDy.hp && zfDy.getAttackRange() === 1,
    '【当阳】体力恢复后加成消失');

  // 诸葛亮【观星】：准备阶段把价值最高的牌置于牌堆顶
  const gGx = await mkCharGame('cls_zhugeliang', ['plain42']);
  const zgGx = gGx.players[0];
  const gxLow = new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' });
  const gxMid = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  const gxHigh = new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' });
  gxLow.ai = { order: 1 };
  gxMid.ai = { order: 3 };
  gxHigh.ai = { order: 9 };
  gGx.deck.cardPile = [gxLow, gxHigh, gxMid];
  await gGx.fireTiming('phaseBegin', { player: zgGx, phase: 'prepare' });
  assert(gGx.deck.cardPile[gGx.deck.cardPile.length - 1] === gxHigh,
    '【观星】把最高价值牌置于牌堆顶');

  // 黄月英【奇才】：顺手牵羊不受距离限制
  const gQc = await mkCharGame('cls_huangyueying', ['plain42', 'plain42', 'plain42']);
  const hyQc = gQc.players[0];
  const farQc = gQc.players[2];
  farQc.drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  assert(gQc.getValidTargets(hyQc, '顺手牵羊').includes(farQc),
    '【奇才】顺手牵羊可指定距离2的角色');
  const gNoQc = await mkCharGame('plain42', ['plain42', 'plain42', 'plain42']);
  const plainQc = gNoQc.players[0];
  const farNoQc = gNoQc.players[2];
  farNoQc.drawCards([new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' })]);
  assert(!gNoQc.getValidTargets(plainQc, '顺手牵羊').includes(farNoQc),
    '对照：无【奇才】时顺手牵羊仍受距离限制');

  // 周瑜【火计】：弃红牌造成1点火焰伤害
  const gHj = await mkCharGame('cls_zhouyu', ['plain42']);
  const zyHj = gHj.players[0];
  const targetHj = gHj.players[1];
  zyHj.handCards = [new Card({ name: '杀', suit: 'heart', number: 7, type: 'basic' })];
  targetHj.handCards = [];
  const hpBeforeHj = targetHj.hp;
  assert(await gHj.useActiveSkill(zyHj, zyHj.skills.find(s => s.id === 'cls_huoji')) === true,
    '【火计】可主动发动');
  assert(targetHj.hp === hpBeforeHj - 1 && zyHj.handCards.length === 0,
    '【火计】弃红牌并造成1点伤害');

  // 孙权【纳贤】：2v2 中给队友补牌，同队再摸1
  const gNx = new Game();
  gNx.config.teamMode = '2v2';
  await gNx.init([
    { name: '孙权', characterId: 'cls_sunquan', team: 0 },
    { name: '队友', characterId: 'cls_caocao', team: 0 },
    { name: '敌1', characterId: 'cls_liubei', team: 1 },
    { name: '敌2', characterId: 'cls_guanyu', team: 1 },
  ]);
  const sqNx = gNx.players[0];
  const allyNx = gNx.players[1];
  sqNx.handCards = [new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' })];
  allyNx.handCards = [];
  assert(await gNx.useActiveSkill(sqNx, sqNx.skills.find(s => s.id === 'cls_naxian')) === true,
    '【纳贤】可主动发动');
  assert(allyNx.handCardCount === 1 && sqNx.handCardCount === 1,
    '【纳贤】队友摸1；同队孙权再摸1（弃1净0）');

  // 貂蝉【离间】：目标有杀则弃杀，无杀则受伤
  const gLj = await mkCharGame('cls_diaochan', ['plain42']);
  const dcLj = gLj.players[0];
  const maleLj = gLj.players[1];
  dcLj.handCards = [new Card({ name: '杀', suit: 'club', number: 7, type: 'basic' })];
  maleLj.handCards = [new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' })];
  assert(await gLj.useActiveSkill(dcLj, dcLj.skills.find(s => s.id === 'cls_lijian')) === true,
    '【离间】可主动发动');
  assert(maleLj.handCardCount === 0, '【离间】目标用【杀】化解');
  const gLj2 = await mkCharGame('cls_diaochan', ['plain42']);
  const dcLj2 = gLj2.players[0];
  const maleLj2 = gLj2.players[1];
  dcLj2.handCards = [new Card({ name: '杀', suit: 'club', number: 7, type: 'basic' })];
  maleLj2.handCards = [];
  const hpLj2 = maleLj2.hp;
  await gLj2.useActiveSkill(dcLj2, dcLj2.skills.find(s => s.id === 'cls_lijian'));
  assert(maleLj2.hp === hpLj2 - 1, '【离间】目标无【杀】时受到1点伤害');

  // 司马懿【隐忍】：低血受伤后摸1
  const gYr = await mkCharGame('cls_simayi', ['plain42']);
  const syYr = gYr.players[0];
  const srcYr = gYr.players[1];
  syYr.hp = 2;
  syYr.handCards = [];
  srcYr.handCards = [];
  await gYr.dealDamage({ source: srcYr, target: syYr, num: 1 });
  assert(syYr.handCardCount === 1, '【隐忍】体力≤2受伤后摸1张');

  // 12) 数据/文案审计：10 名武将简介与技能说明已按历史定位重写
  assert(CLASSIC_CHARACTERS.length === 10
    && CLASSIC_CHARACTERS.every(c => c.description && c.description.length >= 10),
    '10 名经典武将简介均已重写（历史定位）');
  const enhancedDescriptions = [
    'cls_jianxiong', 'cls_rende', 'cls_zhiheng', 'cls_wusheng', 'cls_paoxiao',
    'cls_kongcheng', 'cls_fankui', 'cls_yingzi', 'cls_jizhi', 'cls_biyue',
  ].map(id => CLASSIC_SKILLS.find(s => s.id === id)?.description || '');
  assert(enhancedDescriptions.every(d => d.length > 0)
    && enhancedDescriptions.every((d, i, arr) => arr.indexOf(d) === i),
    '10 条经典技能说明均非空且互不相同（含强化描述）');

  console.log('\n[43] 弃牌事件（discard）+ 阵亡卡面信息');
  const fxCollect43 = (g) => {
    const list = [];
    g.ui.onEffect = (e) => list.push(e);
    return list;
  };
  const mkFxGame43 = async () => {
    const g = new Game();
    g.registerCharacter({
      id: 'fx_hero43', name: '演出武将', sex: 'female', group: 'wu',
      hp: 4, maxHp: 4, skillIds: [], imageUrl: 'data:image/png;base64,AAAA',
    });
    await g.init([
      { name: 'FXA', isAI: true, characterId: 'fx_hero43' },
      { name: 'FXB', isAI: true, characterId: 'fx_hero43' },
    ]);
    g.players.forEach(p => { p.skills = []; p.handCards = []; });
    return g;
  };

  // 1) 出牌阶段手动弃牌：一批弃牌合并成一个 discard 事件（reason=phase）
  const fxPhase = await mkFxGame43();
  fxPhase.players[0].hp = 3;
  fxPhase.players[0].drawCards([
    new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' }),
    new Card({ name: '闪', suit: 'heart', number: 2, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '酒', suit: 'spade', number: 3, type: 'basic' }),
    new Card({ name: '决斗', suit: 'spade', number: 1, type: 'trick' }),
  ]);
  const fxPhaseList = fxCollect43(fxPhase);
  await fxPhase.turn.phaseDiscard(fxPhase.players[0]);
  const fxPhaseDiscard = fxPhaseList.filter(e => e.type === 'discard');
  assert(fxPhaseDiscard.length === 1, '手动弃牌只发 1 个 discard 事件（同批合并）', `count=${fxPhaseDiscard.length}`);
  assert(fxPhaseDiscard[0]?.reason === 'phase', '手动弃牌 reason=phase');
  assert(fxPhaseDiscard[0]?.player?.id === fxPhase.players[0].id, 'discard 事件的 player 为弃牌角色（序列化安全字段）');
  assert(fxPhaseDiscard[0]?.cards?.length === 2, 'discard 事件 cards 数量与实弃牌数一致', `cards=${fxPhaseDiscard[0]?.cards?.length}`);
  const fxCard0 = fxPhaseDiscard[0]?.cards?.[0];
  assert(fxCard0 && typeof fxCard0.name === 'string' && typeof fxCard0.suit === 'string'
    && fxCard0.numberDisplay !== undefined && typeof fxCard0.type === 'string',
    'discard 事件 card 含 name/suit/numberDisplay/type');

  // 2) 过河拆桥：弃置目标一张牌（reason=effect）
  const fxDismantle43 = await mkFxGame43();
  fxDismantle43.players[1].drawCards([new Card({ name: '桃', suit: 'heart', number: 4, type: 'basic' })]);
  const fxDismantleCard43 = new Card({ name: '过河拆桥', suit: 'spade', number: 3, type: 'trick' });
  fxDismantle43.players[0].drawCards([fxDismantleCard43]);
  const fxDismantleList43 = fxCollect43(fxDismantle43);
  await fxDismantle43.executeCardAction(fxDismantle43.players[0], { card: fxDismantleCard43, targets: [fxDismantle43.players[1]] });
  const fxDismantleFx43 = fxDismantleList43.find(e => e.type === 'discard');
  assert(fxDismantleFx43 && fxDismantleFx43.reason === 'effect'
    && fxDismantleFx43.player?.id === fxDismantle43.players[1].id
    && fxDismantleFx43.cards?.[0]?.name === '桃', '过河拆桥产生 discard 事件（reason=effect，player=被拆者）');

  // 3) 寒冰剑：弃目标两张牌合并为一个事件
  const fxIce43 = await mkFxGame43();
  fxIce43.players[0].equip(new Card({ name: '寒冰剑', suit: 'spade', number: 2, type: 'equip', subtype: 'weapon', range: 2 }));
  fxIce43.players[1].drawCards([
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '桃', suit: 'heart', number: 5, type: 'basic' }),
  ]);
  const fxIceSha43 = new Card({ name: '杀', suit: 'spade', number: 7, type: 'basic' });
  fxIce43.players[0].drawCards([fxIceSha43]);
  const fxIceList43 = fxCollect43(fxIce43);
  await fxIce43.executeCardAction(fxIce43.players[0], { card: fxIceSha43, targets: [fxIce43.players[1]] });
  const fxIceDiscards43 = fxIceList43.filter(e => e.type === 'discard');
  assert(fxIceDiscards43.length === 1 && fxIceDiscards43[0].reason === 'effect'
    && fxIceDiscards43[0].player?.id === fxIce43.players[1].id
    && fxIceDiscards43[0].cards?.length === 2,
    '寒冰剑弃目标两张牌合并为 1 个 discard 事件（reason=effect）');

  // 4) 装备替换：旧装备进入弃牌（reason=replace）
  const fxReplace43 = await mkFxGame43();
  const oldWeapon43 = new Card({ name: '青釭剑', suit: 'spade', number: 6, type: 'equip', subtype: 'weapon', range: 2 });
  fxReplace43.players[0].equip(oldWeapon43);
  const newWeapon43 = new Card({ name: '青龙偃月刀', suit: 'spade', number: 5, type: 'equip', subtype: 'weapon', range: 3 });
  fxReplace43.players[0].drawCards([newWeapon43]);
  const fxReplaceList43 = fxCollect43(fxReplace43);
  await fxReplace43.executeCardAction(fxReplace43.players[0], { card: newWeapon43, targets: [] });
  const fxReplaceFx43 = fxReplaceList43.find(e => e.type === 'discard');
  assert(fxReplaceFx43 && fxReplaceFx43.reason === 'replace'
    && fxReplaceFx43.player?.id === fxReplace43.players[0].id
    && fxReplaceFx43.cards?.[0]?.name === '青釭剑', '装备替换产生 discard 事件（reason=replace，旧装备）');

  // 5) 贯石斧：弃两张牌作为代价合并为一个事件（reason=cost）
  const fxAxe43 = await mkFxGame43();
  fxAxe43.players[0].equip(new Card({ name: '贯石斧', suit: 'diamond', number: 5, type: 'equip', subtype: 'weapon', range: 3 }));
  const fxAxeSha43 = new Card({ name: '杀', suit: 'spade', number: 9, type: 'basic' });
  fxAxe43.players[0].drawCards([
    fxAxeSha43,
    new Card({ name: '桃', suit: 'heart', number: 3, type: 'basic' }),
    new Card({ name: '闪', suit: 'heart', number: 4, type: 'basic' }),
  ]);
  fxAxe43.players[1].drawCards([new Card({ name: '闪', suit: 'diamond', number: 2, type: 'basic' })]);
  const fxAxeList43 = fxCollect43(fxAxe43);
  await fxAxe43.executeCardAction(fxAxe43.players[0], { card: fxAxeSha43, targets: [fxAxe43.players[1]] });
  const fxAxeCost43 = fxAxeList43.find(e => e.type === 'discard' && e.reason === 'cost');
  assert(fxAxeCost43 && fxAxeCost43.cards?.length === 2, '贯石斧弃两张牌产生 1 个 discard 事件（reason=cost，同批合并）');

  // 6) 阵亡：death/dying 的 player 带 characterImage/hp/maxHp/sex/group，且阵亡清理发 discard
  const fxDeath43 = await mkFxGame43();
  fxDeath43.players[1].hp = 1;
  fxDeath43.players[1].drawCards([new Card({ name: '杀', suit: 'club', number: 2, type: 'basic' })]);
  const fxDeathList43 = fxCollect43(fxDeath43);
  await fxDeath43.dealDamage({ source: fxDeath43.players[0], target: fxDeath43.players[1], num: 1 });
  const fxDeathFx43 = fxDeathList43.find(e => e.type === 'death');
  const fxDyingFx43 = fxDeathList43.find(e => e.type === 'dying');
  assert(fxDeathFx43?.player?.characterImage === 'data:image/png;base64,AAAA',
    'death 事件 player.characterImage 透传（dataURL 原样）');
  assert(fxDeathFx43?.player?.maxHp === 4 && fxDeathFx43?.player?.hp <= 0,
    'death 事件 player 含 hp/maxHp（阵亡时 hp<=0）', `hp=${fxDeathFx43?.player?.hp}`);
  assert(fxDeathFx43?.player?.sex === 'female' && fxDeathFx43?.player?.group === 'wu',
    'death 事件 player 含 sex/group');
  assert(fxDeathFx43?.player?.id === fxDeath43.players[1].id
    && fxDeathFx43?.player?.seatNum === 1 && fxDeathFx43?.player?.character === '演出武将',
    'death 事件保留 id/seatNum/character 字段');
  assert(fxDyingFx43?.player?.characterImage === 'data:image/png;base64,AAAA',
    'dying 事件自动带出卡面信息');
  const fxDeathDiscard43 = fxDeathList43.find(e => e.type === 'discard' && e.reason === 'other');
  assert(fxDeathDiscard43 && fxDeathDiscard43.player?.id === fxDeath43.players[1].id
    && fxDeathDiscard43.cards?.some(c => c.name === '杀'),
    '阵亡清理手牌会发 discard 事件（reason=other）');

  // 7) 卡牌使用事件仍保留（type:'card' + player/card/targetName）
  const fxUse43 = await mkFxGame43();
  const fxUseCard43 = new Card({ name: '杀', suit: 'spade', number: 8, type: 'basic' });
  fxUse43.players[0].drawCards([fxUseCard43]);
  const fxUseList43 = fxCollect43(fxUse43);
  await fxUse43.executeCardAction(fxUse43.players[0], { card: fxUseCard43, targets: [fxUse43.players[1]] });
  const fxUseFx43 = fxUseList43.find(e => e.type === 'card');
  assert(fxUseFx43 && fxUseFx43.card?.name === '杀' && fxUseFx43.player?.id === fxUse43.players[0].id,
    '卡牌使用事件（type:card）保留 player/card');
  assert(fxUseFx43?.card?.numberDisplay !== undefined && fxUseFx43?.targetName === fxUse43.players[1].name,
    '卡牌使用事件带 numberDisplay/targetName（便于桌面展示）');

  // 8) 顺手牵羊：牌离开目标（reason=effect）；无懈可击作为代价弃牌（reason=cost）
  const fxSnatch43 = await mkFxGame43();
  fxSnatch43.players[1].drawCards([new Card({ name: '桃', suit: 'heart', number: 6, type: 'basic' })]);
  const fxSnatchCard43 = new Card({ name: '顺手牵羊', suit: 'spade', number: 4, type: 'trick' });
  fxSnatch43.players[0].drawCards([fxSnatchCard43]);
  const fxSnatchList43 = fxCollect43(fxSnatch43);
  await fxSnatch43.executeCardAction(fxSnatch43.players[0], { card: fxSnatchCard43, targets: [fxSnatch43.players[1]] });
  const fxSnatchFx43 = fxSnatchList43.find(e => e.type === 'discard');
  assert(fxSnatchFx43 && fxSnatchFx43.reason === 'effect'
    && fxSnatchFx43.player?.id === fxSnatch43.players[1].id
    && fxSnatchFx43.cards?.[0]?.name === '桃', '顺手牵羊产生牌离开目标的 discard 事件（reason=effect）');

  const fxWuxie43 = await mkFxGame43();
  fxWuxie43.players[1].drawCards([new Card({ name: '无懈可击', suit: 'spade', number: 11, type: 'trick' })]);
  const fxWuxieSnatch43 = new Card({ name: '顺手牵羊', suit: 'spade', number: 5, type: 'trick' });
  fxWuxie43.players[0].drawCards([fxWuxieSnatch43]);
  const fxWuxieList43 = fxCollect43(fxWuxie43);
  await fxWuxie43.executeCardAction(fxWuxie43.players[0], { card: fxWuxieSnatch43, targets: [fxWuxie43.players[1]] });
  const fxWuxieCost43 = fxWuxieList43.find(e => e.type === 'discard' && e.reason === 'cost');
  assert(fxWuxieCost43 && fxWuxieCost43.player?.id === fxWuxie43.players[1].id
    && fxWuxieCost43.cards?.[0]?.name === '无懈可击', '无懈可击作为代价弃牌产生 discard 事件（reason=cost）');

  console.log('\n[44] 通用装备槽 + 装备栏数量 + 满槽替换选择');
  const mkEquipCard = (name, subtype, range = 1) => new Card({
    name, suit: 'spade', number: 2, type: 'equip', subtype, range,
  });

  // --- 角色 schema：equipSlots 默认 3，范围 1~6 ---
  assert(new Character({ id: 'slot_default', name: '默认槽', hp: 4, maxHp: 4 }).equipSlots === 3,
    '角色未配置 equipSlots 时默认 3');
  assert(Character.normalizeEquipSlots(undefined) === 3, '旧角色/旧存档无 equipSlots 回退 3');
  assert(new Character({ id: 'slot_4', name: '四槽', equipSlots: 4 }).equipSlots === 4,
    '角色 equipSlots=4 生效');
  assert(new Character({ id: 'slot_5', name: '五槽', equipSlots: 5 }).equipSlots === 5,
    '角色 equipSlots=5 生效');
  assert(Character.normalizeEquipSlots(0) === 1 && Character.normalizeEquipSlots(9) === 6,
    'equipSlots 规范到 1~6');

  // --- 默认 3 槽 / 空槽装备 / toJSON ---
  const slotGame = new Game();
  await slotGame.init([{ name: '槽A', isAI: true }, { name: '槽B', isAI: true }]);
  const sg = slotGame.players[0];
  [sg, slotGame.players[1]].forEach(p => { p.skills = []; p.handCards = []; });
  assert(sg.equipLimit === 3, '默认角色 equipLimit=3');
  assert(Object.keys(sg.equips).sort().join(',') === 'slot1,slot2,slot3', '装备区为通用槽 slot1..slot3');
  assert(sg.getEmptyEquipSlot() === 'slot1' && sg.getEquipCards().length === 0, '初始空槽与装备数正确');
  const sgWeapon = mkEquipCard('青釭剑', 'weapon', 2);
  sg.drawCards([sgWeapon]);
  await slotGame.executeCardAction(sg, { card: sgWeapon, targets: [] });
  assert(sg.getWeapon() === sgWeapon && sg.getEquipCards()[0].slot === 'slot1', '空槽装备进入 slot1');
  assert(sg.getAttackRange() === 2, '通用槽下武器攻击范围生效');
  const sgJson = sg.toJSON();
  assert(sgJson.equipLimit === 3 && sgJson.equipSlots === 3, 'toJSON 输出 equipLimit/equipSlots');
  assert(Array.isArray(sgJson.equipCards) && sgJson.equipCards[0]?.slot === 'slot1'
    && sgJson.equipCards[0]?.card?.name === '青釭剑', 'toJSON 输出 equipCards');

  // --- 同 subtype：默认替换旧装备，不占新槽 ---
  const sgWeapon2 = mkEquipCard('青龙偃月刀', 'weapon', 3);
  sg.drawCards([sgWeapon2]);
  await slotGame.executeCardAction(sg, { card: sgWeapon2, targets: [] });
  assert(sg.getEquipCards().length === 1 && sg.getWeapon() === sgWeapon2, '同 subtype 默认替换且不占新槽');
  assert(slotGame.deck.discardPile.includes(sgWeapon), '同 subtype 旧装备进入弃牌堆');

  // --- 填满 3 槽 + 防具/坐骑 helper ---
  const sgArmor = mkEquipCard('八卦阵', 'armor');
  sg.drawCards([sgArmor]);
  await slotGame.executeCardAction(sg, { card: sgArmor, targets: [] });
  const sgHorseAtk = mkEquipCard('赤兔', 'horse_atk');
  sg.drawCards([sgHorseAtk]);
  await slotGame.executeCardAction(sg, { card: sgHorseAtk, targets: [] });
  assert(sg.getEquipCards().length === 3 && sg.getEmptyEquipSlot() === null, '3 件装备后槽位已满');
  assert(sg.getArmor() === sgArmor && sg.getHorse('atk') === sgHorseAtk, 'getArmor/getHorse 生效');
  assert(slotGame.hasEquip(sg, '八卦阵'), 'hasEquip 在通用槽下按名称查找');

  // --- 武器范围 + 防具/马距离 ---
  const distGame = new Game();
  await distGame.init(Array.from({ length: 4 }, (_, i) => ({ name: `距${i}`, isAI: true })));
  const dg0 = distGame.players[0];
  const dg2 = distGame.players[2];
  distGame.players.forEach(p => { p.skills = []; p.handCards = []; });
  dg2.equip(mkEquipCard('绝影', 'horse_def'));
  dg0.equip(mkEquipCard('赤兔', 'horse_atk'));
  dg0.equip(mkEquipCard('青釭剑', 'weapon', 3));
  assert(dg0.getAttackRange() === 3 && dg0.getDefenseDistance() === 0 && dg0.getAttackDistanceFix() === -1,
    '通用槽下武器/马的距离属性正确');
  assert(dg2.getDefenseDistance() === 1, '防御马 +1 防御距离');
  assert(distGame.distance.getAttackDistance(dg0, dg2) === 2,
    '座次距离+防御马-进攻马 计算正确（2+1-1）');
  assert(distGame.distance.isInAttackRange(dg0, dg2), '范围 3 覆盖修正后距离 2');

  // --- 满槽：askForEquipReplace 选择第 2 槽 ---
  const hookGame = new Game();
  await hookGame.init([{ name: '选A', isAI: true }, { name: '选B', isAI: true }]);
  const hp = hookGame.players[0];
  [hp, hookGame.players[1]].forEach(p => { p.skills = []; p.handCards = []; });
  const hw = mkEquipCard('青釭剑', 'weapon', 2);
  const ha = mkEquipCard('八卦阵', 'armor');
  const hm = mkEquipCard('的卢', 'horse_def');
  hp.equip(hw);
  hp.equip(ha);
  hp.equip(hm);
  const hookCalls = [];
  const hookEffects = [];
  hookGame.ui.onEffect = (e) => hookEffects.push(e);
  hookGame.ui.askForEquipReplace = async (player, newCard, current, limit) => {
    hookCalls.push({ player, newCard, current, limit });
    return 'slot2';
  };
  const hookNew = mkEquipCard('赤兔', 'horse_atk');
  hp.drawCards([hookNew]);
  await hookGame.executeCardAction(hp, { card: hookNew, targets: [] });
  assert(hookCalls.length === 1 && hookCalls[0].limit === 3
    && hookCalls[0].current.length === 3 && hookCalls[0].newCard === hookNew,
    '满槽装备触发 askForEquipReplace(player,newCard,current,limit)');
  assert(hp.getEquipCards().length === 3 && hp.getHorse('atk') === hookNew, '选择槽后新装备入槽且数量仍为 limit');
  assert(hp.getEquipCards().find(e => e.slot === 'slot2')?.card === hookNew, '新装备进入玩家选择的 slot2 槽');
  assert(hookGame.deck.discardPile.includes(ha), '被选择的旧防具进入弃牌堆');
  const hookDiscardFx = hookEffects.find(e => e.type === 'discard' && e.cards?.some(c => c.name === '八卦阵'));
  assert(hookDiscardFx?.reason === 'replace' && hookDiscardFx.player?.id === hp.id,
    '满槽替换发出 discard 事件（旧卡）');

  // --- 取消 / 非法选择：fallback 第一张，不挂起 ---
  const mkFullGame = async (choiceFn) => {
    const g = new Game();
    await g.init([{ name: '满A', isAI: true }, { name: '满B', isAI: true }]);
    const p = g.players[0];
    g.players.forEach(x => { x.skills = []; x.handCards = []; });
    const w = mkEquipCard('青釭剑', 'weapon', 2);
    p.equip(w);
    p.equip(mkEquipCard('八卦阵', 'armor'));
    p.equip(mkEquipCard('的卢', 'horse_def'));
    g.ui.askForEquipReplace = choiceFn;
    const n = mkEquipCard('赤兔', 'horse_atk');
    p.drawCards([n]);
    await g.executeCardAction(p, { card: n, targets: [] });
    return { g, p, n, w };
  };
  const invalidFull = await mkFullGame(async () => 'slot404');
  assert(invalidFull.p.getEquipCards().find(e => e.slot === 'slot1')?.card === invalidFull.n,
    '非法槽选择 fallback 第一张（slot1）');
  assert(invalidFull.g.deck.discardPile.includes(invalidFull.w), '非法选择 fallback 时第一张旧装备进弃牌堆');
  const cancelFull = await mkFullGame(async () => undefined);
  assert(cancelFull.p.getEquipCards().find(e => e.slot === 'slot1')?.card === cancelFull.n,
    '取消选择 fallback 第一张且不挂起');
  assert(cancelFull.p.getEquipCards().length === 3, '取消选择后装备数量仍为 limit');

  // --- 4 槽角色生效 ---
  const fourGame = new Game();
  fourGame.registerCharacter({ id: 'slot_4char', name: '四槽将', hp: 4, maxHp: 4, skillIds: [], equipSlots: 4 });
  await fourGame.init([
    { name: '四槽A', isAI: true, characterId: 'slot_4char' },
    { name: '四槽B', isAI: true },
  ]);
  const fourP = fourGame.players[0];
  fourP.skills = [];
  fourP.handCards = [];
  assert(fourP.equipLimit === 4
    && Object.keys(fourP.equips).sort().join(',') === 'slot1,slot2,slot3,slot4',
    '角色 equipSlots=4 生成 4 个通用槽');
  assert(fourP.toJSON().equipSlots === 4 && fourP.toJSON().equipLimit === 4,
    '4 槽角色 toJSON.equipSlots/equipLimit=4');

  // --- 旧存档：按 subtype 命名的装备槽迁移到通用槽 ---
  const legacyPlayer = new Player({ name: '旧档' });
  const legacyWeapon = mkEquipCard('青釭剑', 'weapon', 2);
  legacyPlayer.equips = { weapon: legacyWeapon, armor: null, horse_def: null, horse_atk: null };
  legacyPlayer.setCharacter(new Character({ id: 'legacy_char', name: '旧将', hp: 4, equipSlots: 3 }));
  assert(legacyPlayer.getWeapon() === legacyWeapon && !('weapon' in legacyPlayer.equips),
    '旧版 subtype 装备槽迁移到通用槽（旧存档兼容）');
  assert(legacyPlayer.equips.slot1 === legacyWeapon, '迁移后的旧装备进入 slot1');

  console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('测试运行异常:', e);
  process.exitCode = 1;
});
