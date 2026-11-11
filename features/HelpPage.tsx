import Link from "next/link";
import { ArrowLeft, CreditCard, Package, ShieldCheck, Store } from "lucide-react";

const helpTopics = [
  { id: "orders", title: "Orders & payments", icon: CreditCard, text: "Review your items and delivery address at checkout. Pay using the bank transfer instructions shown for your order. Your payment status updates automatically after confirmation.", href: "/orders", action: "View my orders" },
  { id: "shipping", title: "Shipping & returns", icon: Package, text: "Delivery availability and shipping charges appear at checkout when a quote is available. Open your order to see its status or cancel an eligible unpaid order. For a return, keep your order number and contact your seller.", href: "/orders", action: "Find an order" },
  { id: "sellers", title: "Selling on Nexus", icon: Store, text: "Product listings show their available variants, prices and seller information. Sellers manage product images and availability through their seller account. Check the listing details before placing an order.", href: "/search", action: "Explore the marketplace" },
  { id: "privacy", title: "Your account & privacy", icon: ShieldCheck, text: "Manage your personal information from your profile. Sign out when using a shared device and use the account security settings to manage your password. Never share bank transfer instructions or account credentials with an unknown sender.", href: "/profile", action: "Manage my account" },
];

function HelpPage() {
  return <div className="mx-auto max-w-[1248px] px-4 py-8 sm:px-6">
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16} aria-hidden="true" /> Back to shopping</Link>
    <h1 className="mt-4 text-3xl font-semibold tracking-tight">How can we help?</h1>
    <p className="mt-3 max-w-2xl text-muted-foreground">Find your order, review delivery information, or manage your Nexus account.</p>
    <div className="mt-8 grid gap-5 md:grid-cols-2">{helpTopics.map(({id,title,icon:Icon,text,href,action})=><section key={id} id={id} className="scroll-mt-6 rounded-md border border-border bg-card p-6">
      <Icon className="mb-4 text-primary" size={24} aria-hidden="true" /><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p><Link href={href} className="mt-4 inline-flex min-h-11 items-center font-medium text-primary hover:underline">{action}</Link>
    </section>)}</div>
    <section className="mt-8 rounded-md border border-border bg-muted p-6"><h2 className="text-lg font-semibold">Explore the shopping experience</h2><p className="mt-2 text-sm text-muted-foreground">Try the sample cart and checkout, or preview how a paid or unpaid order looks. Sample actions do not place an order.</p><nav aria-label="Shopping previews" className="mt-4 flex flex-wrap gap-3">{[{href:"/cart/preview",label:"Sample cart"},{href:"/checkout/preview",label:"Sample checkout"},{href:"/checkout/result/preview?state=paid",label:"Paid order preview"},{href:"/checkout/result/preview?state=unpaid",label:"Unpaid order preview"}].map(({href,label})=><Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-sm border border-border bg-background px-4 text-sm font-medium hover:text-primary">{label}</Link>)}</nav></section>
  </div>;
}

export default HelpPage;
