import Header from '@/components/templates/Header';
import React from 'react'

function layout({children} : Readonly<{children: React.ReactNode}>) {
  return (
    <>
      <Header />

      <main>{children}</main>
    </>
  );
}

export default layout
