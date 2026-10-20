import type { Metadata } from "next";

import AdminTopbar from "@/components/admin/AdminTopbar";
import MeetingList from "@/components/portal/MeetingList";

export const metadata: Metadata = { title: "Minhas Reuniões" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  return (
    <>
      <AdminTopbar eyebrow="PORTAL" title="Minhas Reuniões" />
      <MeetingList q={q} />
    </>
  );
}
