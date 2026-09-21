/**
 * Drop-in replacements for the lucide icons the app used to import, all drawn
 * with the IDÆVIA icon language (see BrandIcon). Same prop shape: size, className, strokeWidth.
 */
import { BrandIcon, type BrandIconName } from "./BrandIcon";
import type { SVGProps } from "react";

type P = { size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name">;
const mk = (name: BrandIconName) => {
  const C = (p: P) => <BrandIcon name={name} {...p} />;
  C.displayName = `Icon(${name})`;
  return C;
};

export const AlertCircle = mk("alert");
export const ArrowLeft = mk("arrowLeft");
export const ArrowRight = mk("arrowRight");
export const Check = mk("check");
export const CheckCircle2 = mk("checkCircle");
export const Clock = mk("clock");
export const Copy = mk("copy");
export const Download = mk("download");
export const ExternalLink = mk("external");
export const Eye = mk("eye");
export const FileArchive = mk("archive");
export const FilePlus2 = mk("filePlus");
export const FolderPlus = mk("folderPlus");
export const Gift = mk("gift");
export const GitBranch = mk("branch");
export const Globe = mk("globe");
export const GraduationCap = mk("learn");
export const Image = mk("image");
export const LayoutDashboard = mk("dashboard");
export const LayoutTemplate = mk("templates");
export const Lightbulb = mk("bulb");
export const Link2 = mk("link");
export const Lock = mk("lock");
export const Maximize2 = mk("expand");
export const Menu = mk("menu");
export const MessageSquare = mk("message");
export const Monitor = mk("monitor");
export const Palette = mk("palette");
export const Pencil = mk("pencil");
export const Plus = mk("plus");
export const Rocket = mk("deployments");
export const Search = mk("search");
export const Send = mk("send");
export const Settings = mk("settings");
export const ShoppingBag = mk("bag");
export const Sparkle = mk("agent");
export const Sparkles = mk("prompts");
export const Trash2 = mk("trash");
export const Upload = mk("upload");
export const Users = mk("teams");
export const Wallet = mk("wallet");
export const X = mk("close");
export const Activity = mk("performance");
export const Tablet = mk("tablet");
export const Smartphone = mk("smartphone");
export const Code2 = mk("code");
export const History = mk("history");
export const TerminalSquare = mk("terminal");
export const AlertTriangle = mk("warning");
export const Play = mk("play");
export const RotateCcw = mk("rotate");
export const Save = mk("save");
export const FileCode2 = mk("file");
export const Folder = mk("folder");
export const ChevronRight = mk("chevronRight");
export const Share2 = mk("share");
