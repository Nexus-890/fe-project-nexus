import Link from "next/link";

function HelpPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6" aria-labelledby="help-title">
    <h1 id="help-title" className="text-heading-32">Account & seller help</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Find your account information and understand which actions are available in the seller workspace.</p>
    <div className="mt-8 divide-y divide-border rounded-sm border border-border px-5">
      <details className="py-5"><summary className="cursor-pointer font-medium">Where can I follow an order?</summary><p className="mt-3 text-sm leading-6">Open <Link href="/orders" className="text-primary underline">your orders</Link> and select an order to view its details and status history. Sign in with the account that placed the order.</p></details>
      <details className="py-5"><summary className="cursor-pointer font-medium">How do sample screens work?</summary><p className="mt-3 text-sm leading-6">Screens marked Sample preview contain example data. Your selections stay in the current preview session; they do not save products, book shipments or submit ratings. Use the live workspace for server actions.</p></details>
      <details className="py-5"><summary className="cursor-pointer font-medium">How do I manage my products?</summary><p className="mt-3 text-sm leading-6">Open the <Link href="/seller/products" className="text-primary underline">seller product list</Link> with a seller account. Product actions use your account permissions. A failed request displays an error and can be retried.</p></details>
      <details className="py-5"><summary className="cursor-pointer font-medium">Where can I edit my account?</summary><p className="mt-3 text-sm leading-6">Update supported personal information on your <Link href="/profile" className="text-primary underline">profile</Link>. Features marked unavailable or preview do not change your account on the server.</p></details>
    </div>
  </section>;
}

export default HelpPage;
