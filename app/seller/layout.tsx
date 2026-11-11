import type { ReactNode } from "react";
import SellerLayout from "../../features/SellerLayout";

function Layout({ children }: { children: ReactNode }) { return <SellerLayout>{children}</SellerLayout>; }
export default Layout;
