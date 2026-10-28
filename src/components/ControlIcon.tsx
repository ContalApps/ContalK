import { GitBranch, GitPullRequest, CircleDot, Code2, BookOpen, Kanban, ListTodo, MapPin, GitCommit, Copy, SquareTerminal, FolderOpen, ArrowDown, Palette, User, Info, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, AudioLines, Bell, Calendar, ChartNoAxesColumn, Check, ChevronDown, ChevronRight, CircleHelp, Ellipsis, Hash, HeadphoneOff, Headphones, House, Image, Maximize2, MessageCircle, MessagesSquare, Mic, MicOff, Minimize2, Monitor, MonitorUp, Paperclip, PanelLeft, Pencil, PhoneOff, Pin, Plus, RefreshCw, Rocket, Search, Settings, Signal, Sparkles, SmilePlus, SquarePen, Trash2, TriangleAlert, Users, Video, VideoOff, Volume2, VolumeX, X, Megaphone, Download, Lock, GripVertical, Link as LinkIcon, Mail, Play, FileText, Globe, type LucideIcon } from 'lucide-react'

// Mesma família de ícones (Lucide, traço arredondado) usada no app Codex.
const icons = {
  mic: [Mic, MicOff], audio: [Headphones, HeadphoneOff], camera: [Video, VideoOff], screen: [MonitorUp, Monitor], disconnect: [PhoneOff],
  settings: [Settings], chevron: [ChevronDown], 'chevron-right': [ChevronRight], signal: [Signal], pin: [Pin], react: [SmilePlus], delete: [Trash2],
  poll: [ChartNoAxesColumn], thread: [MessagesSquare], event: [Calendar], priority: [Megaphone], speaker: [Volume2, VolumeX],
  home: [House], chat: [MessageCircle], friends: [Users], search: [Search], voice: [AudioLines], arrow: [ArrowUpRight], close: [X],
  send: [ArrowUp], hash: [Hash], plus: [Plus], back: [ArrowLeft], forward: [ArrowRight], help: [CircleHelp], bell: [Bell], check: [Check],
  ai: [Sparkles], compose: [SquarePen], sidebar: [PanelLeft], expand: [Maximize2], shrink: [Minimize2], refresh: [RefreshCw], warning: [TriangleAlert], alert: [TriangleAlert],
  terminal: [SquareTerminal], folder: [FolderOpen], rocket: [Rocket], up: [ArrowUp], down: [ArrowDown], palette: [Palette], user: [User], info: [Info], ear: [AudioLines], more: [Ellipsis], attach: [Paperclip], image: [Image], edit: [Pencil], download: [Download], copy: [Copy], clipboard: [Copy], 'git-branch': [GitBranch], git: [GitBranch], 'git-pr': [GitPullRequest], 'git-issue': [CircleDot], 'git-code': [Code2], 'git-wiki': [BookOpen], 'git-commit': [GitCommit], lock: [Lock], tasks: [ListTodo], overview: [Kanban], roadmap: [MapPin], docs: [BookOpen], grip: [GripVertical], link: [LinkIcon], mail: [Mail], play: [Play], file: [FileText], globe: [Globe]
} satisfies Record<string, LucideIcon[]>

export type ControlIconName = keyof typeof icons

export function ControlIcon({name,slashed=false,size=16}:{name:ControlIconName;slashed?:boolean;size?:number}) {
  const [Icon, Off] = icons[name] as [LucideIcon, LucideIcon?]
  const Glyph = slashed && Off ? Off : Icon
  return <Glyph size={size} strokeWidth={1.8} aria-hidden="true" className="ct-glyph"/>
}
