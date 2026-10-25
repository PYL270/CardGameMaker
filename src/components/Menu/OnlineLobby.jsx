import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import useGameStore from '../../store/gameStore';
import { net, NetClient } from '../../net/netClient';
import Select from '../ui/Select';

/**
 * OnlineLobby - 联机大厅：创建/加入房间、成员列表、房主开局
 */
export default function OnlineLobby({ navigate, initialOnline = null }) {
  const storeOnline = useGameStore(s => s.online);
  const online = initialOnline || storeOnline;
  const onlineCreate = useGameStore(s => s.onlineCreate);
  const onlineJoin = useGameStore(s => s.onlineJoin);
  const leaveOnline = useGameStore(s => s.leaveOnline);
  const hostStartOnline = useGameStore(s => s.hostStartOnline);
  const initNet = useGameStore(s => s.initNet);

  const [serverUrl, setServerUrl] = useState(() => NetClient.defaultUrl());
  const [name, setName] = useState(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem('cgm_name'))
      || `玩家${Math.floor(Math.random() * 900 + 100)}`
  );
  const [code, setCode] = useState(() => {
    try {
      if (typeof window === 'undefined') return '';
      return (new URLSearchParams(window.location.search).get('room') || '').toUpperCase();
    } catch {
      return '';
    }
  });
  const [fromQr] = useState(() => {
    try {
      return !!(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('room'));
    } catch {
      return false;
    }
  });
  const [playerCount, setPlayerCount] = useState(2);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrData, setQrData] = useState('');
  const autoJoinRef = useRef(false);
  const isSpectator = !!(online.spectator || online.role === 'spectator');
  const memberList = online.members || [];
  const spectatorMembers = online.spectators
    || memberList.filter(m => m?.spectator || m?.role === 'spectator' || m?.seat === null || m?.seat === undefined);
  const playerMembers = online.spectators
    ? memberList
    : memberList.filter(m => !(m?.spectator || m?.role === 'spectator' || m?.seat === null || m?.seat === undefined));
  const playerCountValue = online.playerCount ?? playerMembers.length;
  const spectatorCountValue = online.spectatorCount ?? spectatorMembers.length;

  useEffect(() => {
    initNet();
    // 离开页面时不断线（保留房间），只有点"离开房间"才断开
  }, []);

  // 扫码进入（URL 带 ?room=XXXXX）时自动加入，不再要求手动点“加入”
  useEffect(() => {
    if (!fromQr || !code || online.roomCode || online.connecting || autoJoinRef.current) return;
    autoJoinRef.current = true;
    onlineJoin({ serverUrl, code, name });
  }, [fromQr, code, online.roomCode, online.connecting]);

  // 房主：请求服务器返回局域网 IP，用于生成手机扫码地址
  useEffect(() => {
    if (online.roomCode && online.isHost) {
      net.send({ t: 'lanip' });
    }
  }, [online.roomCode, online.isHost]);

  // 手机扫码地址（优先局域网 IP）
  const lanIp = online.lanIps?.[0] || (
    typeof window !== 'undefined' ? window.location.hostname : ''
  );
  const lanPort = typeof window !== 'undefined'
    ? (window.location.port || (window.location.protocol === 'https:' ? '443' : '80'))
    : '3000';
  const lanUrl = online.roomCode && lanIp
    ? `http://${lanIp}:${lanPort}/?room=${online.roomCode}`
    : '';

  useEffect(() => {
    if (!lanUrl) {
      setQrData('');
      return;
    }
    let alive = true;
    QRCode.toDataURL(lanUrl, {
      width: 190,
      margin: 1,
      color: { dark: '#0b1020', light: '#ffffff' },
    })
      .then(url => { if (alive) setQrData(url); })
      .catch(() => {});
    return () => { alive = false; };
  }, [lanUrl]);

  useEffect(() => {
    if (online.members.length > playerCount) setPlayerCount(online.members.length);
  }, [online.members.length]);

  const persistSettings = () => {
    try {
      localStorage.setItem('cgm_name', name);
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    persistSettings();
    await onlineCreate({ serverUrl, name });
  };

  const handleJoin = async () => {
    persistSettings();
    await onlineJoin({ serverUrl, code, name });
  };

  const handleSpectate = async () => {
    persistSettings();
    await onlineJoin({ serverUrl, code, name, spectate: true });
  };

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const ok = await hostStartOnline(playerCount);
      if (ok) navigate('game');
    } finally {
      setStarting(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(lanUrl || online.roomCode || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const minPlayers = Math.max(2, online.members.length || 2);

  return (
    <div className="online-page">
      <div className="page-header">
        <button className="btn btn-small" onClick={() => {
          if (online.roomCode) leaveOnline();
          navigate('menu');
        }}>← 返回</button>
        <h2>联机对战</h2>
      </div>

      <div className="online-layout">
        <div className="online-main">
      {!online.roomCode ? (
        <div className="panel lobby-card">
          <h3>一键联机</h3>
          <p className="lobby-hint">
            房主点「创建房间」，把房间号或二维码发给朋友；朋友输入房间号加入，即可一起出牌。
          </p>
          <div className="form-group">
            <label>你的昵称</label>
            <input value={name} maxLength={16} onChange={e => setName(e.target.value)} />
          </div>

          <div className="lobby-actions">
            <button className="btn btn-primary" disabled={online.connecting} onClick={handleCreate}>
              {online.connecting ? '连接中…' : '创建房间'}
            </button>
          </div>

          <details className="lobby-advanced">
            <summary>高级设置 · 中继服务器</summary>
            <div className="form-group">
              <label>中继地址（通常无需修改）</label>
              <input value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                placeholder="ws://192.168.x.x:8787" />
              <small>默认自动使用当前电脑地址；只有换服务器时才需要改。</small>
            </div>
          </details>

          <div className="lobby-divider"><span>或加入已有房间</span></div>

          <div className="join-row">
            <input value={code} maxLength={8}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="输入房间号，如 A3F9K" />
            <button className="btn" disabled={online.connecting} onClick={handleJoin}>
              加入
            </button>
            <button className="btn spectate-join-btn" disabled={online.connecting} onClick={handleSpectate}>
              观战加入
            </button>
          </div>

          {fromQr && code && (
            <p className="lobby-tip">已通过扫码带入房间号 {code}，正在自动加入…</p>
          )}

          {online.error && <p className="lobby-error">{online.error}</p>}
          <p className="lobby-tip">
            玩法说明：房主运行对局逻辑，其他玩家加入后在各自设备上出牌。
            首次使用请确保中继服务器已启动（双击 start.bat 会自动启动）。
          </p>
        </div>
      ) : (
        <div className="panel room-card">
          <div className="room-head">
            <div>
              <span className="room-label">房间号</span>
              <span className="room-code">{online.roomCode}</span>
              {isSpectator && <span className="spectator-badge room-spectator-badge">观战中</span>}
              <button className="btn btn-small" onClick={copyInvite}>
                {copied ? '已复制' : '复制邀请链接'}
              </button>
            </div>
            <span className={`room-conn ${online.connected ? 'ok' : 'bad'}`}>
              {online.connected ? '● 已连接' : '● 未连接'}
            </span>
          </div>

          {isSpectator && (
            <p className="spectator-lobby-note">观战中 · 不占座位，仅观看对局。</p>
          )}

          <div className="member-groups">
            <div className="member-group">
              <div className="member-group-title">{`玩家 ${playerCountValue}`}</div>
              <div className="member-list">
                {playerMembers.map(m => (
                  <div key={`p-${m.seat ?? m.id ?? m.name}`} className="member-item">
                    <span className="member-avatar">{m.name?.[0] || '?'}</span>
                    <span className="member-name">{m.name}</span>
                    <span className="member-tag">{m.seat === 0 ? '房主' : `座位 ${(m.seat ?? 0) + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="member-group">
              <div className="member-group-title">{`观战 ${spectatorCountValue}`}</div>
              {spectatorMembers.length === 0
                ? <div className="member-empty">暂无观战者</div>
                : (
                  <div className="member-list">
                    {spectatorMembers.map(m => (
                      <div key={`s-${m.id ?? m.name}`} className="member-item spectator-member">
                        <span className="member-avatar">{m.name?.[0] || '?'}</span>
                        <span className="member-name">{m.name}</span>
                        <span className="member-tag">观战</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {isSpectator ? (
            <p className="wait-host">观战者不占座位；等待房主开始对局…</p>
          ) : online.isHost ? (
            <div className="host-controls">
              <div className="form-group">
                <label>对局人数（不足的座位由 AI 补齐）</label>
                <Select value={playerCount}
                  onChange={e => setPlayerCount(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6]
                    .filter(n => n >= minPlayers)
                    .map(n => (
                      <option key={n} value={n}>
                        {n} 人{online.members.length > n ? '（人数不足）' : ''}
                      </option>
                    ))}
                </Select>
              </div>
              <button className="btn btn-primary" disabled={starting} onClick={handleStart}>
                {starting ? '正在开局…' : '开始对局'}
              </button>
            </div>
          ) : (
            <p className="wait-host">等待房主开始对局…</p>
          )}

          <button className="btn btn-danger leave-btn" onClick={() => {
            leaveOnline();
          }}>
            离开房间
          </button>

          {online.notice && <p className="lobby-tip">{online.notice}</p>}
          {online.error && <p className="lobby-error">{online.error}</p>}
        </div>
      )}
        </div>

        <aside className="online-aside">
          <div className="panel online-aside-card">
            <h3>局域网联机</h3>
            <ol className="online-steps">
              <li><b>01</b><span>电脑创建房间，生成房间号与邀请二维码</span></li>
              <li><b>02</b><span>手机与电脑连同一 WiFi，扫码或输入房间号加入</span></li>
              <li><b>03</b><span>满员后房主点「开始对局」，无需安装 App</span></li>
            </ol>
            <div className="online-status-row">
              <span>中继服务器</span>
              <b className={online.connected ? 'ok' : 'bad'}>
                {online.connected ? '已连接' : '未连接'}
              </b>
            </div>
            <div className="online-status-row">
              <span>当前身份</span>
              <b>{isSpectator ? '观战者（不占座位）' : online.roomCode ? (online.isHost ? '房主' : '玩家') : '未入房'}</b>
            </div>
          </div>

          {online.roomCode && online.isHost && (
            <div className="panel online-aside-card online-invite-card">
              <h3>邀请手机加入</h3>
              {qrData
                ? <img className="qr-img" src={qrData} alt="手机加入二维码" />
                : <div className="qr-loading">正在生成二维码…</div>}
              {lanUrl && <div className="qr-url">{lanUrl}</div>}
              <div className="qr-tip">手机与电脑连同一 WiFi 后扫码；打不开时运行 allow-lan.bat 放行防火墙。</div>
            </div>
          )}

          <div className="panel online-aside-card online-spectator-guide">
            <h3>观战说明</h3>
            <ul>
              <li>观战不占玩家座位，不参与出牌与判定操作。</li>
              <li>只读：可查看全部玩家、装备、判定、血量与公共牌桌。</li>
              <li>公共视图：看不到任何玩家手牌与操作提示。</li>
            </ul>
          </div>
        </aside>
      </div>

      <style>{`
        .online-page {
          padding: 20px; height: 100%; overflow-y: auto;
          display: flex; flex-direction: column; align-items: center;
        }
        .online-page .page-header {
          width: 100%; max-width: 560px;
          display: flex; align-items: center; gap: 16px; margin-bottom: 20px;
        }
        .online-page .page-header h2 { color: var(--accent-gold); }
        .lobby-card, .room-card { width: min(560px, 100%); }
        .lobby-card h3, .room-card h3 { color: var(--accent-gold); margin-bottom: 16px; }
        .lobby-hint { font-size: 12.5px; line-height: 1.65; color: var(--text-secondary); margin: -6px 0 16px; }
        .lobby-advanced { margin-top: 14px; font-size: 12px; color: var(--text-secondary); }
        .lobby-advanced summary { cursor: pointer; color: var(--gold); opacity: .8; }
        .lobby-advanced[open] summary { margin-bottom: 10px; }
        .lobby-actions { display: flex; gap: 10px; }
        .lobby-actions .btn { flex: 1; }
        .lobby-divider {
          display: flex; align-items: center; gap: 10px;
          margin: 20px 0 14px; color: var(--text-secondary); font-size: 12px;
        }
        .lobby-divider::before, .lobby-divider::after {
          content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.14);
        }
        .join-row { display: flex; gap: 10px; }
        .join-row input {
          flex: 1;
          background: rgba(8, 12, 18, 0.92);
          color: var(--text-primary);
          border: 1px solid rgba(214, 185, 110, 0.24);
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 14px;
          outline: none;
        }
        .join-row input:focus { border-color: rgba(214, 185, 110, 0.65); }
        .lobby-error { color: var(--accent-red); font-size: 13px; margin-top: 12px; }
        .lobby-tip { color: var(--text-secondary); font-size: 12px; margin-top: 14px; line-height: 1.6; }
        .room-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap; margin-bottom: 16px;
        }
        .room-label { font-size: 12px; color: var(--text-secondary); margin-right: 8px; }
        .room-code {
          font-size: 24px; font-weight: 800; letter-spacing: 4px;
          color: var(--accent-gold); margin-right: 10px;
          text-shadow: 0 0 20px rgba(247, 201, 72, 0.4);
        }
        .room-conn { font-size: 12px; }
        .room-conn.ok { color: var(--accent-green); }
        .room-conn.bad { color: var(--accent-red); }
        .qr-panel {
          margin-bottom: 16px; padding: 10px;
          border-radius: 12px;
          background: linear-gradient(160deg, rgba(28, 31, 38, 0.92), rgba(9, 11, 16, 0.94));
          border: 1px solid rgba(214, 185, 110, 0.24);
          text-align: center;
        }
        .qr-title { font-size: 12px; color: var(--accent-gold); margin-bottom: 8px; letter-spacing: 0.5px; }
        .qr-img { width: 150px; height: 150px; border-radius: 8px; background: #fff; padding: 6px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4); }
        .qr-loading { font-size: 12px; color: var(--text-secondary); padding: 24px 0; }
        .qr-url { font-size: 10.5px; color: var(--text-secondary); margin-top: 6px; word-break: break-all; }
        .qr-tip { font-size: 10.5px; color: var(--text-secondary); opacity: 0.8; margin-top: 6px; line-height: 1.5; }
        @media (max-width: 520px) {
          .qr-img { width: 132px; height: 132px; }
          .room-code { font-size: 20px; letter-spacing: 3px; }
          .online-page { padding: 12px; }
          .lobby-card, .room-card { padding: 14px; }
        }
        .member-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
        .member-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 10px;
          background: linear-gradient(160deg, rgba(30, 33, 40, 0.9), rgba(10, 12, 17, 0.92));
          border: 1px solid rgba(214, 185, 110, 0.18);
        }
        .member-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.14), transparent 60%),
            linear-gradient(160deg, #2a2416, #0d0b07);
          border: 1px solid rgba(214, 185, 110, 0.4);
          font-weight: 700; font-size: 13px;
          color: var(--gold-bright);
        }
        .member-name { flex: 1; font-size: 13.5px; }
        .member-tag { font-size: 11px; color: var(--text-secondary); }
        .host-controls { margin-bottom: 16px; }
        .wait-host { color: var(--text-secondary); font-size: 13px; margin: 14px 0; }
        .leave-btn { margin-top: 8px; }
      `}</style>
    </div>
  );
}
