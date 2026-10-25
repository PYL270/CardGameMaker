# CardGameMaker 运行环境问题报告

---

## 🔴 核心问题

**系统未安装 Node.js**，无法运行 React + Vite 项目。

---

## ✅ 当前状态

- ✅ 项目代码完整
- ✅ `package.json` 配置正确
- ✅ `node_modules` 已存在（可省略重新安装）
- ❌ `node` 命令不可用
- ❌ `npm` 命令不可用

---

## 🔧 解决步骤

### 1. 安装 Node.js

访问 https://nodejs.org/ 下载并安装 **Node.js LTS 版本**

Windows 安装向导会自动配置环境变量，安装后重启终端即可。

---

### 2. 验证安装

打开新的 CMD/PowerShell，执行：

```bash
node --version   # 应显示 v18.x.x 或更高
npm --version    # 应显示 9.x.x 或更高
```

---

### 3. 启动项目

**方式 A：桌面快捷方式**
- 双击 `C:\Users\99263\Desktop\CardGameMaker.lnk`

**方式 B：命令行**
```bash
cd D:\CardGameMaker
start.bat
```

**方式 C：开发服务器**
```bash
cd D:\CardGameMaker
npm run dev
```

---

## 🧪 运行测试（可选）

```bash
# 运行所有测试（105引擎 + 191UI + 13中继）
npm test

# 或单独运行某个模块
npm run test:engine   # 引擎测试
npm run test:ui       # UI测试
npm run test:net      # 网络测试
```

---

## 📞 如遇其他问题

1. 检查防火墙是否阻止了 3000/8787 端口
2. 确保端口未被其他程序占用
3. 查看 `launcher.log` 日志文件获取错误信息

---

**生成时间：** 2026-10-23