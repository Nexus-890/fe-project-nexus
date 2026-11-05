import Link from "next/link";
import Image from "next/image";

function Logo() {
  return (
    <Link
      href="/"
      aria-label="Nexus home"
      className="inline-flex min-h-11 lg:min-h-9 shrink-0 items-center gap-2 rounded-sm px-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Image
        src="/Logo.svg"
        alt=""
        width={105}
        height={25}
        priority
        className="h-[25px] w-auto"
      />
    </Link>
  );
}

export default Logo;
