import { ChevronDown, Search } from 'lucide-react';
import React from 'react'
import { Input } from '../ui/input';

function SearchBar() {
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="flex h-12 flex-1 items-center rounded-full border-2 border-neutral-800 bg-white">
        {/* Search icon */}
        <div className="flex items-center pl-4">
          <Search size={20} strokeWidth={1.7} className="text-neutral-600" />
        </div>

        {/* Input */}
        <Input
          type="text"
          placeholder="Search for anything"
          className="
            h-full flex-1 bg-transparent px-3
            text-sm text-neutral-900
            outline-none
            placeholder:text-neutral-400
          "
        />

        {/* Divider */}
        <div className="h-6 w-px bg-neutral-200" />

        {/* Category */}
        <button
          type="button"
          className="
            flex h-full items-center gap-2
            px-5 text-sm text-neutral-700
            transition-colors hover:text-black
          "
        >
          All Categories
          <ChevronDown size={16} strokeWidth={1.8} />
        </button>
      </div>

      {/* Search button */}
      <button
        type="button"
        className="
          h-12 rounded-full bg-orange-600
          px-9 text-sm font-semibold text-white
          transition-colors hover:bg-orange-700
        "
      >
        Search
      </button>

      {/* Advanced */}
      <button
        type="button"
        className="
          whitespace-nowrap text-xs
          text-neutral-600 hover:text-black
        "
      >
        Advanced
      </button>
    </div>
  );
}

export default SearchBar
