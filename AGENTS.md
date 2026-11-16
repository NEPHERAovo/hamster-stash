# AGENTS.md — hamsterStash 项目开发规范与架构说明

> **AI Agent 与开发者必读文件。开始任何开发任务前，请先完整阅读本文。**

---

## 1. 项目概述

**hamsterStash** 是一款面向个人和小商户的极简纸感记账渐进式 Web 应用（PWA），核心目标是：

- **极简、快速的日常记账体验**：无冗余动画，打开即记，单条录入 3 秒内完成。
- **纸感极简设计系统**：
  - 微暖纸张底色配合精致的点阵方格背景。
  - 自然、低饱和的功能色板（松柏青绿收入、陶瓦赭红支出）。
  - 弃用 Emoji，全站统一采用 **Lucide** 线条图标库。
  - 弃用沉重的玻璃位移滤镜与复杂悬浮菜单，改用纯粹平整的纸质卡片与细线分隔。
- **可插拔数据层**：通过存储适配器抽象存储接口，界面层与持久化存储完全解耦（首选本地 IndexedDB，未来支持 WebDAV 与云端同步）。
- **离线可用**：移动端优先（专注于竖屏视图体验，暂不做桌面端双栏适配），支持桌面端与各种移动设备独立安装运行。

当前阶段：**已完成视觉原型验证与全站小票化重构，落实手帐页眉与纯白纸质小票设计系统。**

---

## 2. 技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | React | ^19.2.0 | 函数组件与 Hooks |
| 语言 | TypeScript | ~5.9.3 | 严格模式，禁止 `any` |
| 构建 | Vite | ^7.1.9 | 快速构建与 ESM |
| 样式 | Tailwind CSS | ^4.3.2 | 原子化样式配合全局 CSS 变量 |
| 图标库 | lucide-react | ^1.x | 统一的轻量级矢量线条图标 |
| 状态管理 | Zustand | ^5.0.14 | 模块化切片状态 |
| 本地存储 | idb | ^8.x | 轻量 IndexedDB Promise 包装 |
| 离线支持 | vite-plugin-pwa + workbox | ^1.1.0 / ^7.4.0 | 离线缓存与应用安装支持 |
| 路由 | react-router-dom | ^7.x | 核心页面与设置子页切换 |
| 包管理 | pnpm | 9.x | 严格依赖锁定 |
| 代码检查 | ESLint + typescript-eslint | ^9.x | 零错误零警告标准 |

---

## 3. 设计规范：纸感极简设计系统

本项目的交互与视觉已经过独立原型验证，源码见：[`prototype/index.html`](file:///Users/evergret/Documents/mycodes/hamsterStash/prototype/index.html)。

### 3.1 核心设计理念：有机文具记账簿

1. **纸张肌理与微噪点**：底色微暖，挂载纯代码轻量 SVG 纸浆微噪点（`<feTurbulence>`），赋予背景与卡片如日本竹尾棉纸般的自然漫反射与有机呼吸感。
2. **毛刺撕纸边**：票据存根底部弃用机械虚线，采用真实物理微锯齿毛边裁切（`.paper-deckle`），还原从小票簿上撕下存根的物理触感。
3. **和纸胶带与实体附件**：
   - 核心存根卡片顶端贴有半透明微纤维和纸胶带（`.washi-tape`）。
   - **黄铜回形针**：与功能强绑定，仅当账单存在发票凭证附件时展示，避免无意义拟物堆砌。
4. **手帐便签式底部抽屉与按天成张小票列表**：
   - **按天成张小票**：将同一天的“日期头部”与“当天所有流水明细”包裹在同一个独立纸质小票容器内（`bg-(--paper-sheet)` 自适应 10 套深浅主题，`rounded-[2px]`，`shadow-[0_2px_8px_rgba(0,0,0,0.04)]`，卡片间距 `mb-3.5`）。日期头部与流水之间采用 `1px dashed` 票据虚线分隔（左侧 `12 MON · 1笔`，右侧当日小计）；单日多笔流水之间采用极浅 `1px dashed` 虚线区隔，最后一条流水不加底边，构建“一张张小票陈列在网格书桌上”的文具呼吸感与视觉节奏；
   - **纯粹高效的流水浏览**：账本流水列表彻底移除行内展开编辑器，仅保留微方块分类微标、事由与包含时间的副标题（`10:57 · 餐饮 · 微信零钱`）以及纯粹等宽金额，彻底移除每笔流水下方的轧账余额噪音，阅读动线清晰无杂质；
   - **统一手帐便签抽屉**：点击右下角悬浮印章（新增）或点击任意单条流水项（编辑），从屏幕底部平滑滑出统一的便签抽屉面板。抽屉顶沿通过 CSS/SVG 实现经典小票锯齿（`.paper-sawtooth-top`，外层保持 `overflow: visible` 防裁剪），顶部居中固定和纸胶带（`.washi-tape`）；编辑态在顶栏右上角展示红色“删除”图标按钮（带二次确认），并自动回填数据；计算器键盘第四行按钮文案统一为 **`再记一笔`**；
   - **报销与凭证级联联动**：支出态下元数据横条默认仅展示 `[报销]` 微胶囊，隐藏 `[📎 凭证]`；仅当点击激活 `[待报销 ✓]` 时才在其右侧动态展开 `[📎 凭证]` 微胶囊（取消待报销时同步隐藏并清理附件）；确保横条默认仅由 `[账户 ▾] · [时间 ▾] · [报销] · [物品 ▾]` 4 个轻量微胶囊构成，单行整齐对齐不换行；
   - **手帐便签质感**：顶部边缘平直或极微圆角（`0px ~ 2px`）；背景遮罩杜绝深黑色重度压暗，改用极浅暖灰半透明层（`bg-stone-900/18`）结合纸张自然投影（`box-shadow: 0 -6px 22px rgba(0,0,0,0.09)`），保持底层网格纸隐约可见，营造“便签叠在书桌上”的透气层次感；
   - **分类网格邮票方连化**：4×2 分类网格内部采用 `1px dotted border-(--rule-hairline)` 十字点线虚线分割，彻底去除四周边框，形成如同未撕开邮票方连的纸质齿孔感；选中项通过 `bg-(--paper-sunken)` 实心底块与微印章高亮；
   - **可点击标签浅底微胶囊**：抽屉内的账户、时间、报销、凭证及时间面板中的快捷标签，统一采用主题自适应底色（`bg-(--paper-sunken) rounded-[3px]`，严禁硬编码色值），强化物理可点击暗示；
   - **3 列机械滚轮拨盘时间选择器**：
     - 彻底移除原生的日期与时间输入框，杜绝各端原生控件风格割裂；
     - 展开时间托盘后，顶部保留快捷纯文本标签联动；
     - 下方采用无外框 3 列机械滚轮拨盘（第 1 列日期占宽 2 份，如 `11-13 周五`；第 2 列小时占宽 1 份 `00`~`23`；第 3 列分钟占宽 1 份 `00`~`59`）；
     - 每列固定项高 `h-8`（32px），容器高 `h-24`（96px），上下加占位空项保证对齐；配合 CSS 渐隐遮罩营造滚轮弧度；中央读数窗口以两条虚线标出，时分中间固定等宽冒号，当前项等宽字体加粗高亮显示。
5. **全站手帐页眉规范与统一英文衬线刊头**：
   - 针对移动端中文在西文衬线字体下易回退至普通黑体、导致视觉风格割裂的问题，全站主导航页面顶部大标题强制统一使用西文文学衬线刊头（`Instrument Serif`，`text-2xl sm:text-[28px]`，非斜体，`text-(--ink-solid)`）：
     - 账本页：动态西文月份大标题（如 `November 2026`）；
     - 统计页：`Statistics`（右侧保留 `周 / 月 / 年` 切换）；
     - 物品页：`Owned Items`（右侧保留 `+ 新建` 按钮）；
     - 资产页：`Assets`（右侧保留设置微按钮与 `+ 新建` 按钮）；
     - 设置子页：`Settings`（左侧保留返回键）；
   - 统计页周期标题同样采用英文衬线体展示（如 `November 2026` / `Year 2026`），彻底杜绝中英混排字体割裂；
   - 统一页眉固定高度（`h-14` / `px-4.5 pt-2.5 pb-2`）、背景轻度高斯模糊与底部分割发丝线；
   - 补全页眉右侧操作区：账本页左右翻月按钮、统计页周期文字下划线切换、资产页设置微按钮与新建按钮。
6. **多主题与暗色模式卡片语义变量规范**：
   - **严禁任何硬编码色值**：所有小票卡片、统计卡片、资产卡片以及锯齿毛边（`.paper-deckle-bottom` / `.paper-sawtooth-top`）彻底移除硬编码色彩；
   - **主题语义变量统一绑定**：卡片底色统一使用 `bg-(--paper-sheet)` 或 `var(--paper-sheet)`，浅底微胶囊与空状态内嵌框统一使用 `bg-(--paper-sunken)`，在 10 套深浅特种纸主题下自动映射对应的自然纸品明暗层级；
   - **资产页顶部净资产小票存根**：将净资产总额与往来借贷待收聚合进同一张小票存根（顶部和纸胶带、底部物理微锯齿毛边 `paper-deckle-bottom`，中间以虚线分隔）；
   - **账户列表单张小票化**：拆除各账户的独立方框，聚合进单张小票容器内；账户间以虚线区隔，移除右侧冗余的箭头符号；
   - **主题与设置去框化**：主题 10 个选项移除矩形边框与粗黑边框，改为圆形纸样色卡与极简品名，选中项以印章勾选角标与浅底块高亮；设置项统一收进纸质卡片，列表行之间采用虚线区隔。
7. **边框使用原则：外框拟物、内部去框**：
   - 禁止在表单内部嵌套多层实线矩形边框；
   - 内部层级划分优先采用自然留白、小票风格虚线、手帐本单条下划线输入框（`border-b 1px dashed`）以及浅色实心底色块；
   - 金额数字彻底剥离外围矩形边框，以纯粹等宽大字号自然展示；
   - 分类项去除外框，选中态采用浅色底块配合微倾斜的复古印章底纹高亮。
8. **端正对齐与分类图标微标**：
   - 右下角新增按钮必须严格正向对齐，严禁歪斜旋转；
   - 账单数据行统一陈列方形低饱和分类图标微标（26×26px），配合时间戳、纯文字事由与会计红粉基准线整齐对齐。
9. **排版双轴**：
   - 财务度量与对账数据：强制采用 `Geist Mono` 等宽数字（`tabular-nums`）。
   - 存根与月份大标题：引入文学西文衬线体 `Instrument Serif`，形成书卷文学气与严谨财务度量的张力。
10. **实体拟物印章**：状态徽标（如“待报销/已报销/已结清/AA抵扣”）采用双线框印泥戳印，带有微飞白油墨渗透质感。
11. **生产级极简文案规范**：
    - 所有界面文字必须以最终真实上线产品为准，杜绝工程说明式、括号补充式、调试式文案；
    - 绝对杜绝冗余修饰与过度细化：
      - “主题”直接写为“主题”；
      - “金额”直接写为“金额”；
      - “分类”直接写为“分类”；
      - “账户”直接写为“账户”；
      - “时间”直接写为“时间”；
      - “微调日期与时分”直接写为“调整时间”；
      - “深浅色系切换”直接写为“深色模式”；
      - “添加备注”直接写为“添加备注...”；
      - “浅色”与“深色”简洁明了；
      - “物品清单核算”直接写为“物品总览”；
      - “往来借贷与报销代收”直接写为“借贷与报销”；
      - “周期流水明细”直接写为“周期账单”；
      - “搜索流水备注、分类、账户”直接写为“搜索备注、分类、账户”；
      - “生命周期流水”直接写为“关联账单”；
      - “账户明细流水”直接写为“账户流水”。
    - 功能入口收敛与标题去噪原则：顶栏彻底摒弃生硬繁琐的修饰标签，回归极简纯粹大标题；账本顶栏不设多余图标；月结余存根聚焦实物结余印章与三项收支等式。
12. **统一图标规范**：禁止使用 Emoji 充当用户界面图标，分类、状态、操作统一使用 `lucide-react` 线条图标（`strokeWidth={1.75} ~ 2`）。
13. **首屏手帐小票骨架屏**：首屏从本地存储异步加载全量流水期间，严禁直接展示“暂无流水”空状态卡片造成视觉跳闪，采用自适应主题的手帐小票骨架屏平滑过渡。
14. **嵌套小票全站对齐规范**：当流水列表在已有外层边距的容器内渲染时（如统计页），必须启用 `contained` 模式，移除内部自带的外边距，确保与上方卡片保持像素级对齐。
15. **模块化插件系统与持有物品标准插件**：
    - 全站采用基于基类与独立 SDK 契约的微内核扩展架构，支持界面自由追加、核心组件替换覆写、业务中间件拦截以及底部一级导航动态注册；
    - **持有物品**作为首个标准参考插件：
      - 注册独立“物品”一级导航 Tab，启用后呈现“账本 · 统计 · 物品 · 资产”四栏均分布局，停用后自动干净卸载恢复三栏；
      - 采用英文衬线刊头 `Owned Items`，右侧配备复古微型新建按钮；
      - 支出态一键将支出记为新物品或绑定为配件保养；收入态关联物品售出回血并流转为已售出状态；
      - 物品存根小票顶贴和纸胶带、底裁撕纸毛边，突出展示日均成本与保值率；
      - 主题与设置整体剥离为独立子页 `SettingsSubPage`，由资产页顶栏右侧齿轮微按钮滑入打开。
16. **AA 分摊与收入抵扣支出机制**：
    - 真实会计统计口径：
      - 剔除虚增收入：计算总收入及趋势时，严格过滤掉所有带有 `offsetTransactionId` 的抵扣型收入流水；
      - 净支出冲减统计：计算总支出、分类构成环形图与周期趋势时，每笔支出的有效金额为冲减抵扣后的净支出；
      - 跨周期抵扣：基于全量流水构建抵扣映射表，确保月末垫付、次月收款能准确冲减原月份支出与结余；
      - 报销回款统一口径：报销结清入账流水自动关联原垫付支出并冲减净额；
      - 账户余额保持真实一致：各资金账户余额严格遵循真实资金流出与流入；删除原支出时自动清空关联收入的抵扣引用。
    - 手帐交互与实体印章：
      - 记账抽屉在收入模式下提供快捷抵扣支出胶囊与快选托盘；
      - 原支出行展示实付金额或已全额抵扣微印章；抵扣收入行展示抵扣事由微印章。

---

### 3.2 纸品调色板体系与 10 套深浅主题

系统内置 5 套浅色与 5 套深色主题，浅色默认采用浅绿色 **🌿 竹青素笺**：

#### 浅色主题
1. **🌿 竹青素笺 (`theme-sage`，默认浅色)**：薄荷微暖浅竹青桌面底纸（`--paper-base: #EEF4ED`）搭配纯白纸质小票（`--paper-sheet: #FFFFFF`），松柏绿会计线与印章；
2. **📄 特种米白 (`theme-cotton`)**：经典暖调手帐米白棉纸桌面（`--paper-base: #F5F2EA`）搭配纯白存根（`--paper-sheet: #FFFFFF`）；
3. **📜 复古牛皮 (`theme-kraft`)**：暖黄牛皮纸与羊皮纸桌面（`--paper-base: #EFE5D4`）搭配纯白便签小票（`--paper-sheet: #FFFFFF`），带暖赭石墨线；
4. **🌊 雾霭蓝卡 (`theme-mist`)**：沉静灰蓝水彩卡纸桌面（`--paper-base: #E7EFF5`）搭配纯白小票（`--paper-sheet: #FFFFFF`），黛蓝印线；
5. **🌸 樱落绯灰 (`theme-cherry`)**：柔和绯灰笺纸桌面（`--paper-base: #F6ECEE`）搭配纯白存根（`--paper-sheet: #FFFFFF`），枯粉色会计对齐线。

#### 深色主题
1. **🌑 复写碳纸 (`theme-carbon`，默认深色)**：暖碳调深黑底纸（`--paper-base: #141311`）搭配微升起的暖碳纸小票（`--paper-sheet: #22211D`），层级清晰且温和护眼；
2. **🌌 古法靛蓝 (`theme-indigo`)**：深邃雅致的黛蓝染纸桌面（`--paper-base: #0E131C`）搭配午夜蓝小票（`--paper-sheet: #1A2434`），冰蓝印线；
3. **☕ 深焙浓缩 (`theme-espresso`)**：深焙咖啡豆暗岩底纸（`--paper-base: #14100D`）搭配暖褐浓缩纸卡（`--paper-sheet: #251E19`）；
4. **🏛️ 黑曜石金 (`theme-obsidian`)**：极简哑光墨黑桌面（`--paper-base: #0B0B0B`）搭配炭黑石板小票（`--paper-sheet: #1C1C1C`）与黄铜金印线；
5. **🌲 幽林松柏 (`theme-pine`)**：暗夜松林深墨绿底纸（`--paper-base: #0C140E`）搭配幽深松柏纸卡（`--paper-sheet: #19271E`）。

#### 核心 CSS 变量 Token 定义：
```css
:root {
  --grid-line: rgba(155, 148, 135, 0.12);
  --grid-size: 24px;

  --rule-hairline: #E2DBD0;
  --rule-strong: #CEC6B7;
  --rule-double: #B5AD9E;
  --rule-margin: rgba(206, 110, 92, 0.24);

  --color-income: #2E6E4E;
  --color-income-bg: rgba(46, 110, 78, 0.08);
  --color-expense: #B34432;
  --color-expense-bg: rgba(179, 68, 50, 0.08);
  --color-accent: #78634B;
  --color-accent-bg: rgba(120, 99, 75, 0.09);

  --cat-food: #BA6E38;
  --cat-transit: #3D7299;
  --cat-shop: #54884B;
  --cat-home: #91644A;
  --cat-fun: #83549E;
  --cat-comm: #2F7C7C;
  --cat-health: #AC495E;
  --cat-edu: #525892;

  --brass-metal: #B5935A;
  --brass-shadow: #73592E;
  --stamp-red: #B83426;

  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 9999px;

  --nav-height: 52px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

---

## 4. 目录结构规范

```
src/
├── main.tsx                          # 应用挂载入口
├── App.tsx                           # 根布局与路由挂载
├── sw.ts                             # Service Worker 离线缓存
├── index.css                         # 全局样式、设计变量、Tailwind
├── vite-env.d.ts                     # 环境类型声明
│
├── components/                       # 界面组件库
│   ├── ui/                           # 纸感通用基础组件
│   │   ├── DotGrid.tsx               # 点阵方格背景层
│   │   ├── PaperCard.tsx             # 纸质卡片容器
│   │   ├── PaperButton.tsx           # 纸感按钮
│   │   ├── PaperInput.tsx            # 纸感输入框
│   │   ├── PaperModal.tsx            # 便签式抽屉与弹窗
│   │   ├── SegToggle.tsx             # 分段切换器
│   │   ├── PaperBadge.tsx            # 状态徽标胶囊
│   │   └── PaperKeypad.tsx           # 一体化四则运算键盘
│   │
│   ├── layout/                       # 布局结构组件
│   │   ├── AppShell.tsx              # 移动端优先容器（430px 居中）
│   │   ├── PageHeader.tsx            # 统一衬线刊头导航
│   │   └── BottomNav.tsx             # 底部自适应导航栏与记账悬浮钮
│   │
│   ├── ledger/                       # 账本业务组件
│   │   ├── BalanceSummaryCard.tsx    # 收支结余概览存根卡
│   │   ├── TransactionGroup.tsx      # 按日成张小票流水列表
│   │   ├── TransactionItem.tsx       # 单笔流水明细行
│   │   ├── SearchFilterBar.tsx       # 流水搜索与快捷筛选
│   │   ├── DrumWheelPicker.tsx       # 三列机械滚轮时间选择器
│   │   └── AddTransactionModal.tsx   # 便签式记账抽屉
│   │
│   ├── stats/                        # 统计业务组件
│   │   ├── DonutChart.tsx            # 分类支出环形图
│   │   ├── CategoryLegend.tsx        # 分类色块图例
│   │   ├── MonthlyTrendBar.tsx       # 周期柱状趋势图
│   │   └── SpendingRankList.tsx      # 支出排行列表
│   │
│   ├── assets/                       # 资产业务组件
│   │   ├── NetWorthHeader.tsx        # 净资产存根卡
│   │   ├── LoanChainModal.tsx        # 借贷与报销核销结算中心
│   │   ├── AccountList.tsx           # 账户聚合小票列表
│   │   ├── AccountDetailSubPage.tsx  # 账户专属详情滑动子页
│   │   ├── ReconcileModal.tsx        # 账户平账校准弹窗
│   │   ├── SettingsCard.tsx          # 设置选项聚合卡
│   │   ├── SettingsSubPage.tsx       # 独立设置子页
│   │   └── ImportSubPage.tsx         # 数据导入向导子页
│   │
│   └── shared/                       # 跨模块通用组件
│       ├── PWAUpdatePrompt.tsx       # 离线更新提示
│       └── EmptyState.tsx            # 纸感空状态
│
├── core/                             # 核心持久化与微内核层
│   ├── plugin/                       # 插件微内核
│   ├── adapters/                     # 存储适配器驱动（IndexedDB / Memory）
│   ├── repositories/                 # 领域数据仓储
│   └── db/                           # 数据库结构与初始化预置数据
│
├── plugin-sdk/                       # 插件独立契约层
├── plugins/                          # 模块化插件集合（持有物品等）
├── domain/                           # 纯业务逻辑层（财务计算、核销链、导入导出）
├── stores/                           # Zustand 状态切片
├── types/                            # 全局 TypeScript 类型定义
├── hooks/                            # 自定义 React Hooks
└── utils/                            # 金额、日期、ID 纯函数工具
```

---

## 5. 数据核心类型与适配器

### 5.1 数据模型（`src/types/`）

所有金额均以**整数分（1 元 = 100 分）**为标准存储单位。

```typescript
export type TransactionType = 'income' | 'expense' | 'transfer' | 'loan' | 'reconcile';
export type LoanRole = 'origin' | 'repayment';
export type LoanStatus = 'pending' | 'partially_repaid' | 'settled';
export type ReimburseStatus = 'pending' | 'settled';

export interface VoucherAttachment {
  name: string;
  size: string;
  title?: string;
  itemName?: string;
  party?: string;
  date?: string;
  account?: string;
  amount?: number;
  stamp?: string;
  fileUrl?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  loanParty?: string;
  loanDirection?: 'lend' | 'borrow';
  loanRole?: LoanRole;
  relatedLoanId?: string;
  loanStatus?: LoanStatus;
  reconcileDiff?: number;
  isReimbursable?: boolean;
  reimburseTarget?: string;
  reimburseStatus?: ReimburseStatus;
  offsetTransactionId?: string;
  voucher?: VoucherAttachment;
  ext?: Record<string, unknown>;
  date: string;
  note?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'ewallet' | 'credit' | 'investment' | 'other';
  balance: number;
  currency: string;
  icon: string;
  color?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  parentId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 存储适配器规范与数据迁移准则

1. **业务层与视图层零污染**：
   - 严禁在业务逻辑、状态管理与组件内部硬编码历史版本向下兼容分支；
   - 业务逻辑层与视图层必须永远只面向最新、最规范的数据协议编写。
2. **独立数据迁移小模块原则**：
   - 当底层存储结构或数据字段升级时，必须在迁移目录编写独立的迁移脚本；
   - 迁移模块通过标准化接口接入存储初始化阶段，一次性完成数据升级并记录版本。

---

## 6. 工程规范与质量守则

本项目坚持严格的高质量工程准则，所有开发者与 AI 必须严格遵守以下规范：

### 6.1 代码自解释与严禁解释性注释
- **代码即文档**：优秀的代码通过清晰的变量命名、纯粹的函数职责和自解释的结构表达意图。
- **严禁冗余注释**：
  - 严禁在代码中编写叙事性、分块横幅注释（如 `// ====`、`// Keypad Handlers`、`{/* 模态遮罩 */}` 等）；
  - 严禁对已有类型、已有函数名做同义反复的解释性注释；
  - 仅在涉及复杂数学算子边界、浏览器特殊兼容性或 TypeScript 三斜杠指令（如 `/// <reference ...>`）时允许必要说明。

### 6.2 ESLint 零警告零错误标准
- **警告即阻断**：所有 ESLint 警告视同错误处理，提交前必须保证 `pnpm lint` 完全 0 错误 0 警告；
- **类型安全**：严禁使用 `any` 类型，未定类型统一使用 `unknown` 或精确泛型；
- **规范原子类**：严格遵循 Tailwind CSS 标准类名推荐（例如使用 `stroke-2` 代替 `stroke-[2]`）。

### 6.3 文档语言规范
- **禁止机械中英文混杂**：所有面向用户与开发者的 Markdown 文档，必须使用地道自然、简洁人类可读的纯中文；
- **杜绝括号英译堆砌**：禁止在中文标题和正文后面以括号形式罗列英文单词；代码变量名、CSS 类名和专有名词使用反引号标识。

### 6.4 提交与交付硬门禁
任何代码提交或任务完成前，必须同时通过：
1. `pnpm lint`：零错误，零警告；
2. `pnpm test`：100% 单元测试与契约测试通过；
3. `pnpm build`：零类型错误，生产构建成功。
