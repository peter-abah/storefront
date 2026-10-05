"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** One-shot thank-you: keep the server `isNew` first render, then strip `?new=1`. */
export function StripNewParam({ orderId }: { orderId: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/orders/${orderId}`, { scroll: false });
  }, [router, orderId]);
  return null;
}
