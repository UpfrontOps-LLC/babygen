export const metadata = { title: "Privacy Policy — See Our Baby" };

export default function Privacy() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 prose prose-sm text-gray-700">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-gray-500">Last updated: June 2026</p>

      <h2 className="font-semibold mt-6">The short version</h2>
      <p>
        See Our Baby (operated by UpfrontOps LLC) lets you upload two photos so our AI can imagine a baby image.
        We use your photos only to create your result, and we do <strong>not</strong> retain them or any facial/biometric
        data after your images are generated.
      </p>

      <h2 className="font-semibold mt-6">Photos &amp; facial data</h2>
      <ul className="list-disc pl-5">
        <li>The two photos you upload are sent to our AI image provider solely to generate your baby image.</li>
        <li>We do not build, store, or sell facial recognition templates or biometric identifiers.</li>
        <li>Uploaded photos are deleted after your result is produced; generated images are tied to your order.</li>
        <li>By uploading, you confirm you have the right to use the photos and consent to this processing.</li>
      </ul>

      <h2 className="font-semibold mt-6">Payment</h2>
      <p>Payments are processed by Stripe. We never see or store your card details.</p>

      <h2 className="font-semibold mt-6">What we collect</h2>
      <p>Order info and basic analytics. We do not sell personal information.</p>

      <h2 className="font-semibold mt-6">Your choices</h2>
      <p>
        To request deletion of any data associated with your order, email{" "}
        <a className="underline" href="mailto:support@seeourbaby.com">support@seeourbaby.com</a>.
      </p>

      <h2 className="font-semibold mt-6">Disclaimer</h2>
      <p>Results are AI-generated for entertainment and are not a medical or genetic prediction.</p>

      <p className="mt-8"><a className="underline text-rose-500" href="/">← Back</a></p>
    </main>
  );
}
