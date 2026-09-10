"use client";

import { usePathname } from "next/navigation";
import { Spine } from "@/components/ui/editorial";
import { sectionFor } from "@/components/layout/sections";

/** A lombada mostra em que ficha do arquivo você está. */
export function CurrentSpine() {
  return <Spine label={sectionFor(usePathname()).spine} />;
}
