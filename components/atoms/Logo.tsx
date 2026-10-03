"use client";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";
import { useNavigate } from "storybook/internal/router";

function Logo() {
  //   const  router = useRouter();
  //   const handleClick = () => {
  //     router.push("/")
  //   }

  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center">
        <span className="text-2xl font-black text-orange-600">N</span>
      </div>

      <span className="text-2xl font-bold tracking-tight text-black">
        nexus
      </span>
    </Link>
  );
}

export default Logo;
