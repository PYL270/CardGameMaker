import React, { useEffect, useId, useRef, useState } from 'react';
import { setDialogHandler } from '../../utils/dialogService';

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * 游戏内对话框：承接所有 confirm / alert。
 * 原生弹窗会打断沉浸感，这里统一换成墨玉鎏金面板，并补齐键盘与焦点处理。
 */
export default function GameDialog() {
  const [dialog, setDialog] = useState(null);
  const dialogRef = useRef(null);
  const resolverRef = useRef(null);
  const queueRef = useRef([]);
  const panelRef = useRef(null);
  const okRef = useRef(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const off = setDialogHandler(options => new Promise(resolve => {
      const entry = { options: options || {}, resolve };
      // 已有对话框时排队，避免后一次请求覆盖前一次导致 Promise 永远悬空
      if (dialogRef.current) {
        queueRef.current.push(entry);
        return;
      }
      dialogRef.current = entry.options;
      resolverRef.current = entry.resolve;
      setDialog(entry.options);
    }));

    return () => {
      off();
      // 卸载时兜底 resolve，避免调用方一直等待
      queueRef.current.forEach(entry => {
        entry.resolve(entry.options.kind === 'confirm' ? true : undefined);
      });
      queueRef.current = [];
      if (resolverRef.current) {
        const resolve = resolverRef.current;
        const kind = dialogRef.current?.kind;
        resolverRef.current = null;
        dialogRef.current = null;
        resolve(kind === 'confirm' ? true : undefined);
      }
    };
  }, []);

  const close = (value) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    const next = queueRef.current.shift();
    if (next) {
      dialogRef.current = next.options;
      resolverRef.current = next.resolve;
      setDialog(next.options);
    } else {
      dialogRef.current = null;
      setDialog(null);
    }
    if (resolve) resolve(value);
  };

  useEffect(() => {
    if (!dialog) return undefined;
    const previousFocus = typeof document !== 'undefined' ? document.activeElement : null;
    const kind = dialog.kind === 'alert' ? 'alert' : 'confirm';

    // 打开后聚焦确认按钮，保证键盘用户直接落在主操作上
    okRef.current?.focus();

    const focusable = () => {
      const panel = panelRef.current;
      if (!panel) return [];
      return Array.from(panel.querySelectorAll(FOCUSABLE))
        .filter(el => !el.hidden && el.getClientRects().length > 0);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(kind === 'confirm' ? false : undefined);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      }
      if (e.key !== 'Tab') return;

      // 焦点陷阱：Tab / Shift+Tab 在对话框内部循环
      const list = focusable();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      // 关闭后焦点归位；触发元素可能已被卸载，需先确认仍在文档中
      if (previousFocus && previousFocus !== document.body && previousFocus.isConnected) {
        previousFocus.focus?.();
      }
    };
  }, [dialog]);

  if (!dialog) return null;

  const {
    kind = 'confirm',
    title,
    message,
    confirmText,
    cancelText,
    danger = false,
    kicker,
  } = dialog;
  const isConfirm = kind === 'confirm';
  const heading = title || (isConfirm ? '确认操作' : '提示');

  return (
    <div
      className={`game-dialog-overlay${danger ? ' is-danger' : ''}`}
      onClick={e => {
        if (e.target === e.currentTarget) close(isConfirm ? false : undefined);
      }}>
      <div
        className="game-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        ref={panelRef}
        onClick={e => e.stopPropagation()}>
        <span className="game-dialog-kicker">
          {kicker || (isConfirm ? 'CONFIRM' : 'NOTICE')}
        </span>
        <h3 id={titleId}>{heading}</h3>
        {message && <p className="game-dialog-body" id={messageId}>{message}</p>}
        <div className="game-dialog-actions">
          {isConfirm && (
            <button type="button" className="btn btn-small" onClick={() => close(false)}>
              {cancelText || '取消'}
            </button>
          )}
          <button
            type="button"
            ref={okRef}
            className={`btn btn-small btn-primary${danger ? ' is-danger' : ''}`}
            onClick={() => close(true)}>
            {confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  );
}
