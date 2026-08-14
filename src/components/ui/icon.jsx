import {
  Activity,
  CalendarDays,
  Check,
  ChevronDown,
  Command,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Layers,
  Link2,
  Menu,
  Moon,
  MoreHorizontal,
  Search,
  Share2,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';

const ICONS = {
  calendar: CalendarDays,
  check: Check,
  chevronDown: ChevronDown,
  command: Command,
  copy: Copy,
  download: Download,
  external: ExternalLink,
  filter: Filter,
  layers: Layers,
  link: Link2,
  menu: Menu,
  moon: Moon,
  more: MoreHorizontal,
  search: Search,
  share: Share2,
  shield: ShieldCheck,
  sun: Sun,
  timeline: Activity,
  x: X,
};

export default function Icon({ name, size = 16, strokeWidth = 1.8, className, ...props }) {
  const IconComponent = ICONS[name] || MoreHorizontal;

  return (
    <IconComponent
      aria-hidden="true"
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}
