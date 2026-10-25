import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement(node)) return textOf(node.props?.children);
  return '';
}

/** 从 children 中提取 option（支持条件/数组/Fragment/disabled/optgroup 简单子项） */
export function collectSelectOptions(children, out = []) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      collectSelectOptions(child.props.children, out);
      return;
    }
    if (child.type === 'option') {
      const label = child.props.children;
      const text = textOf(label);
      const value = child.props.value !== undefined ? String(child.props.value) : text;
      out.push({ value, label, text, disabled: !!child.props.disabled });
    } else if (child.type === 'optgroup') {
      collectSelectOptions(child.props.children, out);
    }
  });
  return out;
}

let selectSeq = 0;

/**
 * 黑金自绘下拉：视觉 trigger + 隐藏原生 select（兼容 id/表单/测试）。
 * 支持 children=<option>、键盘 ↑↓/Enter/Esc、外点关闭、空间不足 drop-up、stagger 展开。
 */
export default function Select({
  id,
  value,
  onChange,
  disabled = false,
  className = '',
  children,
  name,
  title,
  'aria-label': ariaLabel,
  ...rest
}) {
  const options = useMemo(() => collectSelectOptions(children), [children]);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxIdRef = useRef(`ui-select-listbox-${++selectSeq}`);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState(null);
  const [dropUp, setDropUp] = useState(false);

  const valueText = value === undefined || value === null ? '' : String(value);
  const currentIndex = Math.max(0, options.findIndex(option => option.value === valueText));
  const current = options.find(option => option.value === valueText) || options[0] || null;
  const enabledIndexes = options.map((option, index) => (option.disabled ? -1 : index)).filter(i => i >= 0);

  const close = (focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger && rootRef.current) {
      const trigger = rootRef.current.querySelector('.ui-select-trigger');
      trigger?.focus?.();
    }
  };

  const choose = (option) => {
    if (!option || option.disabled) return;
    if (typeof onChange === 'function') onChange({ target: { value: option.value } });
    close(true);
  };

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    const start = currentIndex >= 0 ? currentIndex : (enabledIndexes[0] ?? 0);
    setActiveIndex(start);
    setOpen(true);
  };

  const moveActive = (delta) => {
    if (enabledIndexes.length === 0) return;
    const pos = enabledIndexes.indexOf(activeIndex);
    const nextPos = pos < 0
      ? 0
      : (pos + delta + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPos]);
  };

  // 菜单定位：空间不足自动 drop-up，左右/宽度限制在视口内
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const update = () => {
      const trigger = rootRef.current?.querySelector('.ui-select-trigger');
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const estimated = Math.min(260, Math.max(44, options.length * 40 + 8));
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const nextDropUp = spaceBelow < estimated && spaceAbove > spaceBelow;
      const width = Math.max(120, rect.width);
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
      setDropUp(nextDropUp);
      setMenuStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${nextDropUp ? Math.max(8, rect.top - estimated - 6) : rect.bottom + 6}px`,
        width: `${width}px`,
        maxHeight: `${Math.min(260, nextDropUp ? Math.max(60, spaceAbove) : Math.max(60, spaceBelow))}px`,
        zIndex: 3000,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, options.length]);

  // 外点 / Esc 关闭；打开时焦点落在当前选项
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    const timer = setTimeout(() => {
      optionRefs.current[activeIndex]?.focus?.();
    }, 20);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onTriggerKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }
  };

  const onMenuKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1); }
    else if (event.key === 'Home') { event.preventDefault(); if (enabledIndexes.length) setActiveIndex(enabledIndexes[0]); }
    else if (event.key === 'End') { event.preventDefault(); if (enabledIndexes.length) setActiveIndex(enabledIndexes[enabledIndexes.length - 1]); }
    else if (event.key === 'Enter') {
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const menu = open && menuStyle && typeof document !== 'undefined'
    ? createPortal(
      <div
        id={listboxIdRef.current}
        ref={menuRef}
        className={`ui-select-menu ${dropUp ? 'drop-up' : ''}`}
        style={menuStyle}
        role="listbox"
        aria-label={ariaLabel || '选项列表'}
        onKeyDown={onMenuKeyDown}
        onMouseDown={(event) => event.preventDefault()}>
        <div className="ui-select-menu-inner">
          {options.map((option, index) => (
            <button
              type="button"
              key={`${option.value}-${index}`}
              ref={(el) => { optionRefs.current[index] = el; }}
              className={`ui-select-option ${index === currentIndex ? 'selected' : ''} ${index === activeIndex ? 'active' : ''} ${option.disabled ? 'disabled' : ''}`}
              style={{ '--i': index }}
              role="option"
              aria-selected={index === currentIndex}
              disabled={option.disabled}
              tabIndex={-1}
              onClick={() => choose(option)}>
              <span className="ui-select-option-text">{option.label}</span>
              {index === currentIndex && <Icon name="check" size={13} className="ui-select-check" />}
            </button>
          ))}
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div
      ref={rootRef}
      className={`ui-select ${open ? 'open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
      title={title}>
      <button
        type="button"
        className="ui-select-trigger"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxIdRef.current : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}>
        <span className="ui-select-value">{current ? current.label : ''}</span>
        <Icon name="chevron-down" size={14} className="ui-select-chevron" />
      </button>
      <select
        id={id}
        name={name}
        className="ui-select-native"
        value={value}
        onChange={onChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        {...rest}>
        {children}
      </select>
      {menu}
    </div>
  );
}
