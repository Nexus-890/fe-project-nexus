import HeaderTopBar from "../organisms/Header/HeaderTopBar";
import HeaderMain from "../organisms/Header/HeaderMain";
import HeaderCategoryNav from "../organisms/Header/HeaderCategoryNav";
import type { HeaderProps } from "@/types/ui/type";

export default function Header(props: HeaderProps) {
  return (
    <header className="w-full border-b border-border bg-background">
      <HeaderTopBar {...props} />
      <HeaderMain
        categories={props.categories}
        categoriesLoading={props.categoriesLoading}
        categoriesError={props.categoriesError}
      />
      <HeaderCategoryNav
        categories={props.categories}
      />
    </header>
  );
}
