import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/configs/routes";

const footerLinks = [
  { label: "Help Center", href: "/help" },
  { label: "Shipping & Returns", href: "/help#shipping" },
  { label: "Seller Terms", href: "/help#sellers" },
  { label: "Privacy", href: "/help#privacy" },
];

function AccountFooter() {
  return (
    <footer className="mt-12 border-t border-border sm:mt-16">
      <div className="mx-auto flex max-w-[1248px] flex-col gap-5 px-4 py-6 text-xs leading-5 text-gray-900 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-5">
          <Link href={ROUTES.home} aria-label="Nexus home" className="inline-flex min-h-11 items-center rounded-sm">
            <Image src="/Logo.svg" alt="" width={84} height={20} className="h-5 w-auto" />
          </Link>
          <span>© {new Date().getFullYear()} Nexus</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {footerLinks.map(({ label, href }) => <Link key={href} href={href} className="inline-flex min-h-11 min-w-11 items-center rounded-sm hover:text-primary">{label}</Link>)}
          <span className="border-l border-border pl-5">Prices in VND</span>
        </div>
      </div>
    </footer>
  );
}

export default AccountFooter;
