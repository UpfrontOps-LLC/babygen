export const metadata = { title: "Terms of Service — See Our Baby" };

export default function Terms() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 prose prose-sm text-gray-700">
      <h1 className="text-2xl font-bold mb-4">Terms of Service</h1>
      <p className="text-gray-500">Last updated: June 2026</p>

      <h2 className="font-semibold mt-6">What this is</h2>
      <p>
        See Our Baby (UpfrontOps LLC) is an entertainment service that uses AI to imagine a baby image from two
        uploaded photos. Results are <strong>AI-generated for fun and are not a real, medical, or genetic prediction</strong>
        of any actual child.
      </p>

      <h2 className="font-semibold mt-6">Your responsibilities</h2>
      <ul className="list-disc pl-5">
        <li>You must be 18+ and have the right to upload the photos you provide.</li>
        <li>No uploading photos of people without their permission, or any unlawful content.</li>
        <li>Outputs are for personal, non-commercial entertainment use.</li>
      </ul>

      <h2 className="font-semibold mt-6">Payments &amp; refunds</h2>
      <p>
        Purchases unlock AI-generated digital images delivered instantly. Because results are produced on demand and are
        inherently subjective, <strong>all sales are final</strong>. If you have a problem with your order, contact{" "}
        <a className="underline" href="mailto:support@seeourbaby.com">support@seeourbaby.com</a> and we&apos;ll make it right.
      </p>

      <h2 className="font-semibold mt-6">No warranty</h2>
      <p>The service is provided &quot;as is,&quot; without warranties. Results vary. Liability is limited to the amount you paid.</p>

      <h2 className="font-semibold mt-6">Contact</h2>
      <p>UpfrontOps LLC · <a className="underline" href="mailto:support@seeourbaby.com">support@seeourbaby.com</a></p>

      <p className="mt-8"><a className="underline text-rose-500" href="/">← Back</a></p>
    </main>
  );
}
