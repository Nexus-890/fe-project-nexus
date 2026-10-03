import Link from "next/link";
import React from "react";

type NavLinkProps = {
  href?: string;
  children: React.ReactNode;
  active?: boolean;
};

function NavLink({ href = "#", children, active = false }: NavLinkProps) {

  return (
    <Link
      href={href}
      className={`
        relative whitespace-nowrap text-sm transition-colors
        ${
          active
            ? "font-medium text-black"
            : "text-neutral-600 hover:text-black"
        }
      `}
    >
      {active && (
        <span className="absolute -left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-red-500" />
      )}

      {children}
    </Link>
  );
}

export default NavLink;
