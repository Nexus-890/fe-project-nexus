import React from 'react'
import HeaderTopBar from '../organisms/Header/HeaderTopBar';
import HeaderMain from '../organisms/Header/HeaderMain';
import HeaderCategoryNav from '../organisms/Header/HeaderCategoryNav';

function Header() {
  return (
    <header className="w-full bg-white">
        <HeaderTopBar />
        <HeaderMain />
      <HeaderCategoryNav />
    </header>
  );
}

export default Header
