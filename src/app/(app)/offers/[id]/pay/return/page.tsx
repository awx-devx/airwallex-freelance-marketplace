import { PayReturnScreen } from "@/components/screens/pay-return-screen";

export default async function PayReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayReturnScreen id={id} />;
}
