import Link from "next/link";

import { countUnreadNotifications } from "@/lib/admin/notifications";

import { IconBell, IconHelp, IconSearch } from "./shell/AdminIcons";
import AdminMenuButton from "./shell/AdminMenuButton";

/**
 * Server Component assíncrono: busca o próprio contador em vez de exigir que cada página o passe
 * adiante — era assim que todas acabavam mandando `0` e o sino nunca acendia.
 * `countUnreadNotifications` é `cache`, então várias chamadas na mesma requisição custam uma consulta.
 *
 * `unreadCount` continua aceito para o caso raro de uma página que já contou.
 *
 * Busca e ajuda ainda não fazem nada (já era assim); seguem como botões de ícone até ganharem função.
 */
export default async function AdminTopbar({
  eyebrow,
  title,
  unreadCount,
}: {
  eyebrow: string;
  title: string;
  unreadCount?: number;
}) {
  const unread = unreadCount ?? (await countUnreadNotifications());

  return (
    <header className="ad-topbar">
      <div className="ad-topbar-title">
        <AdminMenuButton />
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="ad-topbar-actions">
        <button type="button" className="ad-ib" aria-label="Buscar">
          <IconSearch />
        </button>
        <Link
          className="ad-ib"
          href="/admin/notificacoes"
          aria-label={unread > 0 ? `${unread} notificações não lidas` : "Sem notificações novas"}
        >
          <IconBell />
          {unread > 0 ? <i className="ad-ib-dot" /> : null}
        </Link>
        <button type="button" className="ad-ib" aria-label="Ajuda">
          <IconHelp />
        </button>
      </div>
    </header>
  );
}
