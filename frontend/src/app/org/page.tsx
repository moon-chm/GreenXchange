"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrgRootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("org_token");
    if (token) {
      router.replace("/org/billing");
    } else {
      router.replace("/org/login");
    }
  }, [router]);

  return null;
}
