import React from 'react';
import { ForkKnifeIcon as ForkKnife, CoffeeIcon as Coffee, BowlFoodIcon as BowlFood, TrainIcon as Train, GasPumpIcon as GasPump, ShoppingCartIcon as ShoppingCart, BasketIcon as Basket, BagIcon as Bag, TShirtIcon as TShirt, HouseIcon as House, FilmSlateIcon as FilmSlate, BookOpenIcon as BookOpen, DeviceMobileIcon as DeviceMobile, HeartbeatIcon as Heartbeat, FirstAidIcon as FirstAid, GraduationCapIcon as GraduationCap, WalletIcon as Wallet, CoinsIcon as Coins, TrendUpIcon as TrendUp, PlusCircleIcon as PlusCircle, BankIcon as Bank, MoneyIcon as Money, ArrowsLeftRightIcon as ArrowsLeftRight, ScalesIcon as Scales, CreditCardIcon as CreditCard, ArrowUpRightIcon as ArrowUpRight, ArrowDownLeftIcon as ArrowDownLeft, CheckCircleIcon as CheckCircle, ArrowElbowDownRightIcon as ArrowElbowDownRight, ReceiptIcon as Receipt, BriefcaseIcon as Briefcase, PaperclipIcon as Paperclip, MapPinIcon as MapPin, CalendarCheckIcon as CalendarCheck, LaptopIcon as Laptop, CameraIcon as Camera, HeadphonesIcon as Headphones, GameControllerIcon as GameController, WatchIcon as Watch, CarIcon as Car, BicycleIcon as Bicycle, TelevisionIcon as Television, PackageIcon as Package, ArmchairIcon as Armchair, PawPrintIcon as PawPrint, BabyIcon as Baby, AirplaneIcon as Airplane, TaxiIcon as Taxi, BusIcon as Bus, GiftIcon as Gift, MusicNotesIcon as MusicNotes, SparkleIcon as Sparkle, CloudIcon as Cloud, WrenchIcon as Wrench, LightningIcon as Lightning, DropIcon as Drop, BarbellIcon as Barbell, TicketIcon as Ticket, ShieldCheckIcon as ShieldCheck, UsersIcon as Users, QuestionIcon as Question, SprayBottleIcon as SprayBottle, WineIcon as Wine, OrangeSliceIcon as OrangeSlice, HandHeartIcon as HandHeart, BedIcon as Bed, TrophyIcon as Trophy, PercentIcon as Percent, MagicWandIcon as MagicWand, SquaresFourIcon as SquaresFour, GlobeIcon as Globe, type Icon as PhosphorIconType, type IconProps as PhosphorIconProps } from '@phosphor-icons/react';

export interface CategoryIconProps extends PhosphorIconProps {
  strokeWidth?: number;
}

function adapt(IconComp: PhosphorIconType): React.FC<CategoryIconProps> {
  return function AdaptedIcon({ weight = 'duotone', ...props }: CategoryIconProps) {
    return React.createElement(IconComp, { weight, ...props });
  };
}

const ICON_MAP: Record<string, React.FC<CategoryIconProps>> = {
  utensils: adapt(ForkKnife),
  food: adapt(ForkKnife),
  coffee: adapt(Coffee),
  wine: adapt(Wine),
  'bowl-food': adapt(BowlFood),
  dining: adapt(ForkKnife),

  'train-front': adapt(Train),
  train: adapt(Train),
  fuel: adapt(GasPump),
  car: adapt(Car),
  taxi: adapt(Taxi),
  bus: adapt(Bus),
  bike: adapt(Bicycle),
  bicycle: adapt(Bicycle),
  airplane: adapt(Airplane),
  plane: adapt(Airplane),

  'shopping-cart': adapt(ShoppingCart),
  cart: adapt(ShoppingCart),
  basket: adapt(Basket),
  supermarket: adapt(Basket),
  'orange-slice': adapt(OrangeSlice),
  fruit: adapt(OrangeSlice),
  bag: adapt(Bag),
  shirt: adapt(TShirt),
  clothes: adapt(TShirt),
  'magic-wand': adapt(MagicWand),
  beauty: adapt(MagicWand),
  'spray-bottle': adapt(SprayBottle),

  house: adapt(House),
  home: adapt(House),
  bed: adapt(Bed),
  hotel: adapt(Bed),
  lightning: adapt(Lightning),
  utilities: adapt(Lightning),
  water: adapt(Drop),
  wrench: adapt(Wrench),
  repair: adapt(Wrench),

  clapperboard: adapt(FilmSlate),
  movie: adapt(FilmSlate),
  music: adapt(MusicNotes),
  tv: adapt(Television),
  gamepad: adapt(GameController),
  'gamepad-2': adapt(GameController),
  laptop: adapt(Laptop),
  camera: adapt(Camera),
  headphones: adapt(Headphones),
  watch: adapt(Watch),
  sport: adapt(Barbell),
  fitness: adapt(Barbell),

  smartphone: adapt(DeviceMobile),
  phone: adapt(DeviceMobile),
  cloud: adapt(Cloud),
  globe: adapt(Globe),
  subscription: adapt(Sparkle),
  software: adapt(Sparkle),

  'heart-pulse': adapt(Heartbeat),
  medical: adapt(Heartbeat),
  'hand-heart': adapt(HandHeart),
  charity: adapt(HandHeart),
  donate: adapt(HandHeart),
  firstaid: adapt(FirstAid),
  'first-aid': adapt(FirstAid),
  'shield-check': adapt(ShieldCheck),
  insurance: adapt(ShieldCheck),

  'book-open': adapt(BookOpen),
  book: adapt(BookOpen),
  'graduation-cap': adapt(GraduationCap),
  education: adapt(GraduationCap),

  users: adapt(Users),
  social: adapt(Users),
  gift: adapt(Gift),
  baby: adapt(Baby),
  pet: adapt(PawPrint),
  'paw-print': adapt(PawPrint),
  ticket: adapt(Ticket),

  wallet: adapt(Wallet),
  coins: adapt(Coins),
  trophy: adapt(Trophy),
  bonus: adapt(Trophy),
  percent: adapt(Percent),
  interest: adapt(Percent),
  'trending-up': adapt(TrendUp),
  'plus-circle': adapt(PlusCircle),
  landmark: adapt(Bank),
  bank: adapt(Bank),
  banknote: adapt(Money),
  money: adapt(Money),
  'credit-card': adapt(CreditCard),
  scale: adapt(Scales),
  scales: adapt(Scales),
  'arrow-right-left': adapt(ArrowsLeftRight),
  'arrow-left-right': adapt(ArrowsLeftRight),
  'arrow-up-right': adapt(ArrowUpRight),
  'arrow-down-left': adapt(ArrowDownLeft),
  'check-circle-2': adapt(CheckCircle),
  'corner-down-right': adapt(ArrowElbowDownRight),
  'receipt-text': adapt(Receipt),
  receipt: adapt(Receipt),
  briefcase: adapt(Briefcase),
  paperclip: adapt(Paperclip),
  'map-pin': adapt(MapPin),
  'calendar-clock': adapt(CalendarCheck),
  box: adapt(Package),
  package: adapt(Package),
  'squares-four': adapt(SquaresFour),
  other: adapt(SquaresFour),
  armchair: adapt(Armchair),
  sofa: adapt(Armchair),
};

const DefaultQuestionIcon = adapt(Question);

export function getCategoryIcon(iconName: string): React.FC<CategoryIconProps> {
  return ICON_MAP[iconName] || DefaultQuestionIcon;
}
