import {motion} from "framer-motion";
import {Construction} from "lucide-react";

export default function ModulePlaceholder({title, description}) {
  return <motion.section initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} className="rounded-2xl border border-[#eee7dc] bg-white px-6 py-14 text-center shadow-[0_5px_20px_rgba(70,50,33,.035)] sm:px-10 sm:py-20">
    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f5efdf] text-[#947039]"><Construction size={25}/></span>
    <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.2em] text-[#a17d42]">Not connected yet</p>
    <h2 className="mt-2 font-display text-2xl font-semibold text-[#30252a]">{title}</h2>
    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">{description}</p>
    <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-[#eee7dc] bg-[#fdfbf7] px-3 py-1.5 text-[10px] text-stone-500"><span className="h-1.5 w-1.5 rounded-full bg-[#c69b52]"/> Waiting for secure shop data connection</div>
  </motion.section>;
}
