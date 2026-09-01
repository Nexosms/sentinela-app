import Link from "next/link";
import { countUnreadNotifications } from "@/lib/admin/notifications";

/**
 * Server Component assíncrono: busca o próprio contador em vez de exigir que
 * cada página o passe adiante — era assim que todas acabavam mandando `0` e o
 * sino nunca acendia. `countUnreadNotifications` é `cache`, então várias
 * chamadas na mesma requisição custam uma consulta só.
 *
 * `unreadCount` continua aceito para o caso raro de uma página que já contou.
 *
 * O sino virou <Link> com a classe `.alert-button` intacta: o estilo vinha de
 * `.topbar-actions button`, mecanicamente trocado por `:is(button,a)` em
 * globals.css (mesma especificidade), como já se fez na sidebar.
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
    <header className="admin-topbar">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <button type="button" aria-label="Buscar">⌕</button>
        <Link
          className="alert-button"
          href="/admin/notificacoes"
          aria-label={unread > 0 ? `${unread} notificações não lidas` : "Sem notificações novas"}
        >
          ♢{unread > 0 ? <i /> : null}
        </Link>
        <button type="button" aria-label="Ajuda">?</button>
      </div>
    </header>
  );
}
