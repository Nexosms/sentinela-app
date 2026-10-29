"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { caminhoDoRelato, useEmpresaLembrada } from "@/lib/report/empresaLembrada";

/**
 * "Fazer um relato" da página inicial. Aponta para a empresa do link que a
 * pessoa já usou nesta aba (ver `empresaLembrada.ts`); sem isso, para `/relato`,
 * que pede o link da empresa. Nunca cai numa empresa por padrão.
 */
export default function RelatoLink({ className, children }: { className?: string; children: ReactNode }) {
  const slug = useEmpresaLembrada();
  return (
    <Link className={className} href={caminhoDoRelato(slug)}>
      {children}
    </Link>
  );
}
