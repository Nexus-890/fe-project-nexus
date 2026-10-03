import Logo from '@/components/atoms/Logo';
import SearchBar from '@/components/molecules/SearchBar';
import { ChevronDown } from 'lucide-react';
import React from 'react'

function HeaderMain() {
  return (
    <div>
      <div
        className="
          mx-auto flex h-[68px]
          max-w-[1440px]
          items-center gap-7 px-6
        "
      >
        {/* Logo */}
        <Logo />

        {/* Shop category */}
        <button
          type="button"
          className="
            flex min-w-[110px] items-center
            gap-2 text-left text-xs
            text-neutral-600
          "
        >
          <span>
            Shop by
            <br />
            category
          </span>

          <ChevronDown size={14} />
        </button>

        {/* Search */}
        <SearchBar />
      </div>
    </div>
  );
}

export default HeaderMain
