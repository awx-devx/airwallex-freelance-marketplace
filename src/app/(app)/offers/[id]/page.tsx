import { OfferScreen } from "@/components/screens/offer-screen";

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OfferScreen id={id} />;
}
