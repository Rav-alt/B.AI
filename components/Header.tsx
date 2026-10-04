import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="shrink-0 border-b border-line bg-paper">
      <div className="mx-auto flex h-14 max-w-[640px] items-center justify-between px-4">
        <Logo />
        <Link href="/limitations" className="flex min-h-11 items-center rounded-sm px-1 text-sm font-semibold text-ink underline-offset-3 hover:underline">
          Limitations
        </Link>
      </div>
    </header>
  );
}
