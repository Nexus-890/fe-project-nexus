import { Bell, ChevronDown, MapPin, ShoppingCart } from 'lucide-react';
import React from 'react'

function HeaderTopBar() {
  return (
    <div className="border-b border-neutral-200">
      <div
        className="
          mx-auto flex h-9 max-w-[1440px]
          items-center justify-between
          px-6
          text-xs text-neutral-700
        "
      >
        {/* LEFT */}
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-1 hover:text-black">
            Hi Lan!
            <ChevronDown size={12} />
          </button>

          <a href="#" className="hover:text-black">
            Daily Deals
          </a>

          <a href="#" className="hover:text-black">
            Vouchers
          </a>

          <a href="#" className="hover:text-black">
            Live Auctions
          </a>

          <a href="#" className="hover:text-black">
            Help & Contact
          </a>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-5">
          <button className="flex items-center gap-1 hover:text-black">
            <MapPin size={13} />
            Ship to HCMC
          </button>

          <a href="#" className="hover:text-black">
            Sell
          </a>

          <button className="flex items-center gap-1 hover:text-black">
            Watchlist
            <ChevronDown size={12} />
          </button>

          <button className="flex items-center gap-1 hover:text-black">
            My Nexus
            <ChevronDown size={12} />
          </button>

          {/* Notification */}
          <button type="button" className="relative">
            <Bell size={18} />
            <span
              className="
                absolute -right-1 -top-1
                h-2 w-2 rounded-full
                bg-red-500
              "
            />
          </button>

          {/* Cart */}
          <button type="button" className="relative">
            <ShoppingCart size={20} />

            <span
              className="
                absolute -right-3 -top-2
                flex h-4 min-w-4 items-center justify-center
                rounded-full bg-orange-600
                px-1 text-[10px] font-semibold text-white
              "
            >
              3
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default HeaderTopBar
