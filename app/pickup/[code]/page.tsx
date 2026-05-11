// app/pickup/[code]/page.tsx
import { redirect } from "next/navigation";

interface PageProps {
  params: {
    code: string;
  };
}

export default function PickupCodeRedirect({ params }: PageProps) {
  const code = params.code ? params.code.toUpperCase() : "";
  redirect(`/pickup?code=${code}`);
}
