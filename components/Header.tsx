import HeaderTopBar from "./HeaderTopBar";
import HeaderMain from "./HeaderMain";
import HeaderCategoryNav from "./HeaderCategoryNav";
import type { HeaderProps } from "@/types/uiType";

function Header(props: HeaderProps) {
  return (
    <header className="w-full border-b border-border bg-background">
      <HeaderTopBar {...props} />
      <HeaderMain
        categories={props.categories}
        categoriesLoading={props.categoriesLoading}
        categoriesError={props.categoriesError}
      />
      <HeaderCategoryNav categories={props.categories} />
    </header>
  );
}

export default Header;
