import type { ReactNode } from "react";
import Link from "next/link";

import { formatDate, formatDateTime } from "@/lib/admin/labels";
import {
  MEETING_TABS,
  meetingStatusClass,
  meetingStatusLabel,
  meetingTabHref,
  type MeetingTab,
} from "@/lib/portal/portal";

/**
 * Cabeçalho e abas de uma reunião, no desenho do exemplo do portal: "← Voltar",
 * título com o selo de situação ao lado, e embaixo data e participantes. As
 * abas levam ícone e rótulo em caixa alta. Servem à visão do cliente e à gestão
 * da Nexo, para as duas telas terem a mesma cara — a gestão só acrescenta
 * selos (`extra`) e formulários.
 */
export function MeetingHeader({
  backHref,
  backLabel,
  title,
  status,
  meetingAt,
  participants,
  extra,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  status: string;
  meetingAt: string;
  participants: string[];
  extra?: ReactNode;
}) {
  return (
    <header className="portal-hero">
      <Link className="portal-back" href={backHref}>
        <span aria-hidden="true">←</span> {backLabel}
      </Link>
      <div className="portal-hero-card">
        <div className="portal-hero-title">
          <h1>{title}</h1>
          <span className={meetingStatusClass(status)}>{meetingStatusLabel(status)}</span>
          {extra}
        </div>
        <p className="portal-hero-meta">
          <span>
            <i aria-hidden="true">▦</i> <time dateTime={meetingAt}>{formatDateTime(meetingAt)}</time>
          </span>
          {participants.length > 0 ? (
            <>
              <span className="portal-sep" aria-hidden="true" />
              <span>
                Participantes: <strong>{participants.join(", ")}</strong>
              </span>
            </>
          ) : null}
        </p>
      </div>
    </header>
  );
}

export function MeetingTabs({
  base,
  active,
  counts,
}: {
  base: string;
  active: MeetingTab;
  counts?: Partial<Record<MeetingTab, number>>;
}) {
  return (
    <nav className="portal-tabs" aria-label="Seções da reunião">
      {MEETING_TABS.map(tab => {
        const total = counts?.[tab.key] ?? 0;
        return (
          <Link
            key={tab.key}
            href={meetingTabHref(base, tab.key)}
            className={active === tab.key ? "active" : ""}
            aria-current={active === tab.key ? "page" : undefined}
          >
            <i aria-hidden="true">{tab.icon}</i>
            {tab.label}
            {total > 0 ? <b>{total}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Painel do conteúdo da aba; o estado vazio fica centralizado dentro dele. */
export function PortalPanel({ children, empty }: { children?: ReactNode; empty?: string }) {
  return (
    <div className="portal-panel">
      {empty ? <p className="portal-empty">{empty}</p> : children}
    </div>
  );
}

/** Data curta usada na lista de reuniões. */
export function shortDate(iso: string): { day: string; month: string } {
  const full = formatDate(iso); // dd/mm/aaaa
  const [day, month] = full.split("/");
  const names = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return { day: day ?? "", month: names[Number(month) - 1] ?? "" };
}
