import NavLink from '@/components/atoms/NavLink';
import React from 'react'

const categories = [
  "Nexus Live",
  "Saved",
  "Electronics",
  "Cameras",
  "Watches",
  "Fashion",
  "Sneakers",
  "Collectibles",
  "Home & Garden",
  "Deals",
  "Refurbished",
];

function HeaderCategoryNav() {
  return (
    <div className="border-b border-neutral-200">
      <nav
        className="
          mx-auto flex h-10
          max-w-[1100px]
          items-center justify-center
          gap-7 px-6
        "
      >
        {categories.map((category, index) => (
          <NavLink key={category} active={index === 0}>
            {category}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default HeaderCategoryNav
