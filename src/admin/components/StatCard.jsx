import {motion} from "framer-motion";
import {ArrowDownRight, ArrowUpRight} from "lucide-react";

export default function StatCard({label, value, note, icon: Icon, trend, tone = "burgundy", index = 0}) {
  const tones = {
    burgundy: "bg-[#f5e9ec] text-[#641c32]",
    gold: "bg-[#f5efdf] text-[#947039]",
    green: "bg-[#eaf1e9] text-[#54704e]",
    blue: "bg-[#eaf0f3] text-[#547080]",
  };
  return <motion.article initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} transition={{duration: .35, delay: index * .06}} className="rounded-2xl border border-[#eee7dc] bg-white p-5 shadow-[0_5px_20px_rgba(70,50,33,.035)] sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-medium text-stone-500">{label}</p><p className="mt-3 font-display text-3xl font-semibold tracking-tight text-[#30252a]">{value}</p></div>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tones[tone]}`}><Icon size={20} strokeWidth={1.8}/></span>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px]">
      {trend && <span className={`inline-flex items-center gap-0.5 font-semibold ${trend.startsWith("+") ? "text-[#54704e]" : "text-[#9b6549]"}`}>{trend.startsWith("+") ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {trend}</span>}
      <span className="text-stone-400">{note}</span>
    </div>
  </motion.article>;
}
