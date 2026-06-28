export const metadata = { title: "Refund Policy, See Our Baby" };

export default function Refunds() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 prose prose-sm text-gray-700">
      <h1 className="text-2xl font-bold mb-4">Refund Policy</h1>
      <p className="text-gray-500">Last updated: June 2026</p>

      <p>
        See Our Baby (UpfrontOps LLC) sells <strong>digital, AI-generated</strong> images and videos that are created on
        demand and delivered instantly after payment. This policy explains when you can get a refund.
      </p>

      <h2 className="font-semibold mt-6">If your images don&apos;t generate, we make it right</h2>
      <p>
        Your purchase is meant to deliver AI-generated baby images (and any add-ons you chose). If a technical problem
        means your order <strong>failed to generate</strong> or you never received your results, contact us and we will{" "}
        <strong>re-run the generation at no cost or issue a full refund</strong>. Refresh the results page first, a
        successful retry won&apos;t charge you again.
      </p>

      <h2 className="font-semibold mt-6">Otherwise, sales are final</h2>
      <p>
        Because the product is a digital good produced on demand and delivered immediately, and because AI results are
        inherently subjective, completed orders are otherwise <strong>non-refundable</strong>. Results are AI-generated
        for entertainment and are not a real, medical, or genetic prediction of any actual child, please review the
        examples on our home page before purchasing.
      </p>

      <h2 className="font-semibold mt-6">How to request a refund</h2>
      <p>
        Email{" "}
        <a className="underline" href="mailto:support@seeourbaby.com">support@seeourbaby.com</a> within{" "}
        <strong>14 days</strong> of your purchase with the email you used at checkout. We respond within 2 business days.
      </p>

      <h2 className="font-semibold mt-6">Contact</h2>
      <p>UpfrontOps LLC · <a className="underline" href="mailto:support@seeourbaby.com">support@seeourbaby.com</a></p>

      <p className="mt-8"><a className="underline text-rose-500" href="/">← Back</a></p>
    </main>
  );
}
