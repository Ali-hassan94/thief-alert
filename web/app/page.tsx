// import { redirect } from "next/navigation";

// export default function Home() {
//   redirect("/dashboard");
// }

"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, [router]);
  return null;
}