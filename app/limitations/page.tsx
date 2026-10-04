import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { FooterCredit } from "@/components/FooterCredit";

export const metadata: Metadata = { title: "Limitations — B.AI" };

const ITEMS: { title: string; body: string }[] = [
  {
    title: "Luma na ang ilang ruta",
    body: "Galing ang data sa DOTC GTFS feed ng Philippine Transit App Challenge (2015). Maraming ruta ang nagbago dahil sa PUV modernization at route rationalization, kaya may ruta na wala na o kulang. Laging magtanong sa driver, barker o konduktor bago sumakay.",
  },
  {
    title: "Walang real-time na info",
    body: "Hindi ko alam ang traffic, sira ng tren, haba ng pila, o kung may masasakyan ngayon. Tantya lang ang oras.",
  },
  {
    title: "Walang fixed na hintuan ang jeep",
    body: "Ang sakayan at babaan na sinasabi ko ay malapit-lapit lang. Pumara kung saan ligtas at pinapayagan.",
  },
  {
    title: "Puwedeng mamali ang paghahanap ng lugar",
    body: "Minsan mali ang basa sa lokal na pangalan (\"Lawton\", \"Rotonda\"). Kung may pagpipilian, tatanungin kita kung alin.",
  },
  {
    title: "Ruta lang",
    body: "Walang pamasahe, schedule, booking, o lugar sa labas ng Metro Manila.",
  },
  {
    title: "Privacy",
    body: "Huwag mag-type ng personal na impormasyon. Ang tanong mo ay pinapadala sa Google Gemini (free tier) para basahin. Ang lokasyon mo ay ginagamit lang sa tanong na iyon at hindi sine-save.",
  },
];

export default function LimitationsPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Header />
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 py-6">
        <h1 className="font-display text-[34px] leading-none tracking-[-0.5px]">Limitations</h1>
        <ul className="flex flex-col">
          {ITEMS.map((it) => (
            <li key={it.title} className="flex flex-col gap-1 border-t border-line-soft py-4">
              <h2 className="text-base font-bold">{it.title}</h2>
              <p className="text-text-2">{it.body}</p>
            </li>
          ))}
        </ul>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center self-start rounded-md border-[1.5px] border-ink bg-paper px-5 text-[15px] font-bold transition-[color,background-color,border-color] duration-150 hover:bg-surface motion-reduce:transition-none"
        >
          Bumalik sa chat
        </Link>
      </main>
      <footer className="mx-auto w-full max-w-[640px] px-4 pb-4">
        <FooterCredit />
      </footer>
    </div>
  );
}
