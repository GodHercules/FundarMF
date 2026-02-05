"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MasterLogin() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return <div className="p-8 text-sm text-slate">Redirecionando para o login...</div>;
}
