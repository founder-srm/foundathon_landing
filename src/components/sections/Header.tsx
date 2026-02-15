import Link from "next/link";
import Image from "next/image";
import { FnButton } from "@/components/ui/fn-button";
import { LineShadowText } from "@/components/ui/line-shadow-text"

const Header = () => {
  const navLinks = [
    { href: "/#overview", label: "Overview" },
    { href: "/#rules", label: "Rules" },
    { href: "/#release", label: "Release" },
    { href: "/#champion", label: "Goodies" },
  ];

  return (
    <div className="border-b border-foreground/10 shadow-sm p-4 font-semibold sticky top-0 z-50 bg-background/60 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="fncontainer flex items-center justify-between gap-4">
        <div className="absolute left-1 md:left-2 xl:left-3 2xl:left-5">
          <Image src="/logo.svg" alt="alt" width={40} height={40} className="h-8 w-auto" />
          </div>
        <Link
          href="/#overview"
          className="text-xl md:text-3xl ml-2 flex items-start gap-2 font-mono uppercase font-extrabold italic"
        >
          <LineShadowText>Foundathon</LineShadowText>{""}
          <LineShadowText>3.0</LineShadowText>
        </Link>

        <div className="flex flex-1 items-center justify-end gap-6">
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((item) => (
              <FnButton key={item.href} asChild kind="nav">
                <Link href={item.href}>{item.label}</Link>
              </FnButton>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <FnButton asChild tone="gray" className="hidden sm:inline-flex">
              <Link href="/problem-statements">Problem Statements</Link>
            </FnButton>
            <FnButton asChild tone="blue">
              <Link href="/register">Register Team</Link>
            </FnButton>
            <FnButton asChild tone="yellow">
              <Link href="/register">Sign In</Link>
            </FnButton>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Header;
