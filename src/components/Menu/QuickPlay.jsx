import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import useGameStore from '../../store/gameStore';
import { net, NetClient } from '../../net/netClient';
import Icon from '../ui/Icon';
import {
  buildLanAddress,
  buildQuickPlayUrl,
  resolveQuickPlayQr,
} from './quickPlay.js';

/**
 * QuickPlay - 速玩 / 扫码即玩
 * A：手机单机速玩（扫码 ?quick=1 自动开一局）
 * B：创建速玩房间（电脑建房，手机扫码 ?room=CODE 加入，满 2 人自动开局）
 */
export default function QuickPlay({ navigate }) {
  const online = useGameStore(s => s.online);
  const onlineCreate = useGameStore(s => s.onlineCreate);
  const leaveOnline = useGameStore(s => s.leaveOnline);
  const hostStartOnline = useGameStore(s => s.hostStartOnline);
  const initNet = useGameStore(s => s.initNet);

  const [quickSvg, setQuickSvg] = useState('');
  const [quickQrError, setQuickQrError] = useState(null);
  const [roomSvg, setRoomSvg] = useState('');
  const [roomQrError, setRoomQrError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [quickRoom, setQuickRoom] = useState(false);
  const [copied, setCopied] = useState('');
  const autoStartRef = useRef(false);

  const win = typeof window !== 'undefined' ? window : null;
  const lanInfo = buildLanAddress({
    origin: win?.location?.origin || '',
    hostname: win?.location?.hostname || '',
    port: win?.location?.port || '',
    protocol: win?.location?.protocol || 'http:',
    lanIps: online.lanIps,
  });
  const quickUrl = buildQuickPlayUrl({ baseUrl: lanInfo.baseUrl, kind: 'quick' });
  const roomUrl = online.roomCode
    ? buildQuickPlayUrl({ baseUrl: lanInfo.baseUrl, kind: 'room', code: online.roomCode })
    : '';
  const quickQr = resolveQuickPlayQr({ url: quickUrl, data: quickSvg, error: quickQrError });
  const roomQr = resolveQuickPlayQr({ url: roomUrl, data: roomSvg, error: roomQrError });

  // 进入页面先拿一次局域网 IP（向中继要 lanip），失败则用 hostname 并提示
  useEffect(() => {
    initNet();
    let alive = true;
    (async () => {
      try {
        await net.connect(NetClient.defaultUrl());
        if (alive) net.send({ t: 'lanip' });
      } catch {
        /* 中继未启动时用 hostname 兜底并显示警告 */
      }
    })();
    return () => {
      alive = false;
      // 未创建房间时释放探测连接，避免占用中继
      if (!useGameStore.getState().online.roomCode) {
        try { net.close(); } catch { /* ignore */ }
      }
    };
  }, []);

  // 单机速玩二维码
  useEffect(() => {
    let alive = true;
    if (!quickUrl) {
      setQuickSvg('');
      return () => { alive = false; };
    }
    QRCode.toString(quickUrl, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1020', light: '#ffffff' },
    })
      .then(svg => { if (alive) { setQuickSvg(svg); setQuickQrError(null); } })
      .catch(e => { if (alive) { setQuickSvg(''); setQuickQrError(e?.message || 'qr-error'); } });
    return () => { alive = false; };
  }, [quickUrl]);

  // 房间二维码
  useEffect(() => {
    let alive = true;
    if (!roomUrl) {
      setRoomSvg('');
      return () => { alive = false; };
    }
    QRCode.toString(roomUrl, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1020', light: '#ffffff' },
    })
      .then(svg => { if (alive) { setRoomSvg(svg); setRoomQrError(null); } })
      .catch(e => { if (alive) { setRoomSvg(''); setRoomQrError(e?.message || 'qr-error'); } });
    return () => { alive = false; };
  }, [roomUrl]);

  // 创建房间成功后再要一次 LAN IP（此时一定已连中继）
  useEffect(() => {
    if (quickRoom && online.roomCode && online.isHost) {
      try { net.send({ t: 'lanip' }); } catch { /* ignore */ }
    }
  }, [quickRoom, online.roomCode, online.isHost]);

  // 速玩房间：成员 ≥2 自动开局（只对本页创建的房间生效）
  useEffect(() => {
    if (!quickRoom || !online.isHost || !online.roomCode) return;
    if ((online.members?.length || 0) < 2 || autoStartRef.current) return;
    autoStartRef.current = true;
    (async () => {
      setStarting(true);
      try {
        const ok = await hostStartOnline(2);
        if (ok && navigate) navigate('game');
      } finally {
        setStarting(false);
      }
    })();
  }, [quickRoom, online.isHost, online.roomCode, online.members.length]);

  const handleCreateRoom = async () => {
    if (creating) return;
    setCreating(true);
    autoStartRef.current = false;
    try {
      await onlineCreate({ serverUrl: NetClient.defaultUrl(), name: '速玩房主' });
      setQuickRoom(true);
    } finally {
      setCreating(false);
    }
  };

  const handleLeaveRoom = () => {
    autoStartRef.current = false;
    setQuickRoom(false);
    leaveOnline();
  };

  const copyLink = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      /* 剪贴板不可用时保留链接可手动选择复制 */
    }
  };

  return (
    <div className="quick-play">
      <div className="quick-play-head">
        <button className="btn btn-small" onClick={() => navigate && navigate('menu')}>
          <Icon name="arrow-left" size={14} /><span>返回主菜单</span>
        </button>
        <h2>速玩 / 扫码即玩</h2>
        <p className="quick-subtitle">任何扫码软件均可，无需安装 App</p>
      </div>

      <div className="quick-grid">
        <section className="panel quick-block">
          <h3><Icon name="sparkle" size={17} /> 手机单机速玩</h3>
          <p className="quick-desc">扫码后直接开始单机对局（你 + AI1，自由混战），无需选将。</p>
          {quickQr.canShowQr ? (
            <div className="quick-qr" role="img" aria-label="手机单机速玩二维码"
              dangerouslySetInnerHTML={{ __html: quickSvg }} />
          ) : (
            <div className="quick-qr missing">
              <Icon name="alert" size={22} />
              <span>二维码准备中…也可直接复制下方链接</span>
            </div>
          )}
          <div className="quick-link-row">
            <code className="quick-link">{quickUrl || 'http://<电脑局域网IP>:3000/?quick=1'}</code>
            <button className="btn btn-small" disabled={!quickUrl}
              onClick={() => copyLink(quickUrl, 'quick')}>
              {copied === 'quick' ? '已复制' : '复制链接'}
            </button>
          </div>
          <p className="quick-note">
            相机 / 微信 / 支付宝 / 浏览器等任意扫码工具均可打开；手机与电脑需同一局域网；无需安装 App。
            链接中的 ?quick=1 会让手机自动开局。
          </p>
          {lanInfo.warning && <p className="quick-warning">{lanInfo.warning}</p>}
        </section>

        <section className="panel quick-block">
          <h3><Icon name="team" size={17} /> 创建速玩房间（手机加入）</h3>
          <p className="quick-desc">电脑创建房间，手机扫码加入；满 2 人后自动开局，无需手动操作。</p>

          {!online.roomCode && (
            <button className="btn btn-primary" onClick={handleCreateRoom} disabled={creating}>
              <Icon name="plus" size={15} />
              <span>{creating ? '创建中…' : '创建速玩房间'}</span>
            </button>
          )}

          {online.roomCode && (
            <div className="quick-room">
              <div className="quick-room-code">
                房间号 <b>{online.roomCode}</b>
              </div>
              {roomQr.canShowQr ? (
                <div className="quick-qr" role="img" aria-label="速玩房间二维码"
                  dangerouslySetInnerHTML={{ __html: roomSvg }} />
              ) : (
                <div className="quick-qr missing">
                  <Icon name="alert" size={22} />
                  <span>二维码准备中…也可直接复制下方链接</span>
                </div>
              )}
              <div className="quick-link-row">
                <code className="quick-link">{roomUrl || 'http://<电脑局域网IP>:3000/?room=房间号'}</code>
                <button className="btn btn-small" disabled={!roomUrl}
                  onClick={() => copyLink(roomUrl, 'room')}>
                  {copied === 'room' ? '已复制' : '复制链接'}
                </button>
              </div>
              <p className="quick-status">
                {starting
                  ? '正在开局…'
                  : `等待手机加入…（当前 ${online.members?.length || 1} 人，≥2 人自动开局）`}
              </p>
              <button className="btn btn-small btn-danger" onClick={handleLeaveRoom}>
                <Icon name="close" size={14} /><span>取消 / 离开房间</span>
              </button>
            </div>
          )}

          {online.error && <p className="quick-warning">{online.error}</p>}
          <p className="quick-note">
            手机扫码后打开 ?room=房间号 会自动进入大厅并加入房间；若二维码无法显示，复制链接发给手机即可。
          </p>
          {lanInfo.warning && <p className="quick-warning">{lanInfo.warning}</p>}
        </section>
      </div>

      <div className="quick-foot">
        <span>手机与电脑同一 WiFi</span>
        <i aria-hidden="true" />
        <span>任意扫码工具</span>
        <i aria-hidden="true" />
        <span>无需安装 App</span>
        <i aria-hidden="true" />
        <span>扫码即开局</span>
      </div>
    </div>
  );
}
