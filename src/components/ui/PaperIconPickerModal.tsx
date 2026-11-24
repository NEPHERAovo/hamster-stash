import React, { useState, useMemo } from 'react';
import { MagnifyingGlassIcon as Search } from '@phosphor-icons/react';
import { PaperModal } from './PaperModal';
import { PaperIconButton } from './PaperIconButton';
import { PaperInput } from './PaperInput';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { cn } from '../../utils/cn';

interface IconDefinition {
  name: string;
  label: string;
  keywords: string[];
}

interface IconGroup {
  id: string;
  title: string;
  icons: IconDefinition[];
}

const ALL_ICON_GROUPS: IconGroup[] = [
  {
    id: 'digital',
    title: '数码硬件',
    icons: [
      { name: 'smartphone', label: '手机', keywords: ['手机', '数码', '电话', 'phone', 'iphone'] },
      { name: 'laptop', label: '电脑', keywords: ['电脑', '笔记本', 'macbook', 'pc', '主机'] },
      { name: 'camera', label: '相机', keywords: ['相机', '摄影', '单反', '镜头', '微单'] },
      { name: 'headphones', label: '耳机', keywords: ['耳机', '音频', '耳麦', 'airpods'] },
      { name: 'gamepad', label: '游戏机', keywords: ['游戏', '手柄', '主机', 'switch', 'ps5'] },
      { name: 'watch', label: '手表', keywords: ['手表', '手环', 'iwatch', '表'] },
      { name: 'tv', label: '电视', keywords: ['电视', '屏幕', '显示器', '显示屏'] },
      { name: 'cloud', label: '云服务', keywords: ['云盘', '网盘', '存储', 'icloud', '服务'] },
      { name: 'sparkles', label: '会员', keywords: ['会员', '软件', '订阅', 'ai', 'vip'] },
    ],
  },
  {
    id: 'living',
    title: '居家日用',
    icons: [
      { name: 'armchair', label: '家具', keywords: ['沙发', '家具', '家居', '椅子'] },
      { name: 'house', label: '房屋', keywords: ['房租', '房屋', '住宿', '物业'] },
      { name: 'bed', label: '床品', keywords: ['床', '床品', '卧室', '酒店'] },
      { name: 'shirt', label: '服饰', keywords: ['衣服', '服饰', '衬衫', '短袖', '穿搭'] },
      { name: 'bag', label: '箱包', keywords: ['包', '背包', '皮包', '钱包', '行李箱'] },
      { name: 'box', label: '收纳', keywords: ['盒子', '箱子', '包裹', '快递', '收纳'] },
      { name: 'gift', label: '礼物', keywords: ['礼物', '礼品', '转赠', '送礼'] },
      { name: 'wrench', label: '维修', keywords: ['工具', '维修', '修理', '五金'] },
      { name: 'magic-wand', label: '美妆', keywords: ['美妆', '护肤', '化妆品', '理发'] },
      { name: 'spray-bottle', label: '洗护', keywords: ['清洁', '洗护', '日化', '消毒'] },
      { name: 'lightning', label: '电力', keywords: ['电费', '充电', '能源', '电'] },
      { name: 'water', label: '水费', keywords: ['水费', '饮水', '矿泉水'] },
    ],
  },
  {
    id: 'transport',
    title: '交通出行',
    icons: [
      { name: 'car', label: '汽车', keywords: ['汽车', '车', '养车', '自驾'] },
      { name: 'bike', label: '单车', keywords: ['自行车', '骑行', '单车', '电瓶车'] },
      { name: 'airplane', label: '机票', keywords: ['飞机', '机票', '航空', '出差', '旅行'] },
      { name: 'train-front', label: '火车', keywords: ['火车', '高铁', '动车', '地铁'] },
      { name: 'bus', label: '公交', keywords: ['公交', '巴士', '公交车'] },
      { name: 'taxi', label: '打车', keywords: ['打车', '出租车', '网约车', '滴滴'] },
      { name: 'fuel', label: '加油', keywords: ['加油', '油费', '油卡', '补能'] },
      { name: 'map-pin', label: '定位', keywords: ['位置', '门牌', '地点', '定位'] },
    ],
  },
  {
    id: 'food',
    title: '餐饮生鲜',
    icons: [
      { name: 'utensils', label: '堂食', keywords: ['美食', '餐厅', '午餐', '晚餐', '聚餐'] },
      { name: 'bowl-food', label: '简餐', keywords: ['快餐', '简餐', '外卖', '面条', '饭'] },
      { name: 'coffee', label: '咖啡', keywords: ['咖啡', '奶茶', '饮品', '下午茶'] },
      { name: 'wine', label: '酒水', keywords: ['酒', '啤酒', '红酒', '酒吧', '聚会'] },
      { name: 'orange-slice', label: '生鲜', keywords: ['水果', '生鲜', '果汁', '蔬菜'] },
      { name: 'shopping-cart', label: '超市', keywords: ['超市', '购物', '采购', '商场'] },
      { name: 'basket', label: '买菜', keywords: ['买菜', '菜市场', '食材'] },
    ],
  },
  {
    id: 'culture',
    title: '文娱生活',
    icons: [
      { name: 'clapperboard', label: '影视', keywords: ['电影', '影院', '电视剧', '剧场', 'netflix'] },
      { name: 'music-notes', label: '音乐', keywords: ['音乐', '网易云', 'spotify', '唱片'] },
      { name: 'book-open', label: '阅读', keywords: ['图书', '阅读', '书籍', '看书'] },
      { name: 'graduation-cap', label: '学习', keywords: ['学习', '教育', '课程', '考试'] },
      { name: 'barbell', label: '健身', keywords: ['健身', '运动', '器械', '瑜伽'] },
      { name: 'paw-print', label: '宠物', keywords: ['宠物', '猫', '狗', '猫粮', '兽医'] },
      { name: 'baby', label: '母婴', keywords: ['宝宝', '母婴', '儿童', '婴儿'] },
      { name: 'ticket', label: '门票', keywords: ['门票', '演出', '展览', '门票'] },
      { name: 'users', label: '人情', keywords: ['社交', '人情', '朋友', '同事'] },
    ],
  },
  {
    id: 'finance',
    title: '财务资产',
    icons: [
      { name: 'credit-card', label: '银行卡', keywords: ['信用卡', '银行卡', '扣费', '卡片'] },
      { name: 'wallet', label: '钱包', keywords: ['钱包', '现金', '余额'] },
      { name: 'coins', label: '零钱', keywords: ['硬币', '零钱', '现金'] },
      { name: 'receipt', label: '票据', keywords: ['小票', '发票', '收据', '账单'] },
      { name: 'shield-check', label: '保险', keywords: ['保险', '安全', '保障'] },
      { name: 'landmark', label: '机构', keywords: ['银行', '理财', '基金', '机构'] },
      { name: 'trophy', label: '收益', keywords: ['收益', '奖金', '分红', '奖励'] },
      { name: 'percent', label: '利率', keywords: ['利息', '折扣', '分期', '利率'] },
      { name: 'scale', label: '平账', keywords: ['资产', '平账', '校准'] },
      { name: 'briefcase', label: '商务', keywords: ['公事', '报销', '商务', '公积金'] },
    ],
  },
];

export interface PaperIconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIcon?: string;
  onSelect: (iconName: string) => void;
}

export const PaperIconPickerModal: React.FC<PaperIconPickerModalProps> = ({
  isOpen,
  onClose,
  selectedIcon,
  onSelect,
}) => {
  const [query, setQuery] = useState('');

  const trimmedQuery = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!trimmedQuery) return ALL_ICON_GROUPS;

    return ALL_ICON_GROUPS.map((group) => {
      const matchedIcons = group.icons.filter((ic) => {
        if (ic.name.toLowerCase().includes(trimmedQuery)) return true;
        if (ic.label.toLowerCase().includes(trimmedQuery)) return true;
        return ic.keywords.some((k) => k.toLowerCase().includes(trimmedQuery));
      });
      return {
        ...group,
        icons: matchedIcons,
      };
    }).filter((group) => group.icons.length > 0);
  }, [trimmedQuery]);

  const handleChoose = (name: string) => {
    onSelect(name);
    onClose();
  };

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title="选择图标"
      className="max-h-[85dvh]"
    >
      <div className="space-y-3 p-4 select-none">
        <div className="sticky top-0 z-10 -mx-4 -mt-4 bg-(--paper-sheet) px-4 pt-3 pb-2">
          <PaperInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索图标名称或类型..."
            leftIcon={<Search className="size-3.5 text-(--ink-tertiary)" />}
            clearable={Boolean(query)}
            onClear={() => setQuery('')}
            size="sm"
          />
        </div>

        <div className="space-y-4 pt-1">
          {filteredGroups.length === 0 ? (
            <div className="py-8 text-center font-mono text-xs text-(--ink-tertiary)">
              未找到匹配图标
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <div className="font-mono text-[10px] font-semibold tracking-wider text-(--ink-tertiary) uppercase">
                  {group.title}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {group.icons.map((ic) => {
                    const IconComp = getCategoryIcon(ic.name);
                    const isSelected = selectedIcon === ic.name;
                    return (
                      <PaperIconButton
                        key={ic.name}
                        icon={IconComp}
                        size="md"
                        variant={isSelected ? 'primary' : 'sunken'}
                        className={cn(
                          'flex aspect-square h-auto w-full items-center justify-center transition-all',
                          isSelected && 'ring-1 ring-(--color-income)'
                        )}
                        onClick={() => handleChoose(ic.name)}
                        title={ic.label}
                        aria-label={ic.label}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-2 pb-(--safe-bottom)">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken)/70 py-2 font-mono text-xs text-(--ink-secondary) hover:bg-(--paper-sunken)"
          >
            取消
          </button>
        </div>
      </div>
    </PaperModal>
  );
};
