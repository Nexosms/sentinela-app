import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import MeetingDetail from "@/components/portal/MeetingDetail";
import MeetingShell from "@/components/portal/MeetingShell";
import { parseMeetingTab } from "@/lib/portal/portal";

export const metadata: Metadata = { title: "Minhas Reuniões" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const aba = parseMeetingTab((await searchParams).aba);

  return (
    <>
      <AdminTopbar eyebrow="PORTAL" title="Minhas Reuniões" />
      <MeetingShell selectedId={id} detail={<MeetingDetail id={id} aba={aba} />} />
    </>
  );
}
