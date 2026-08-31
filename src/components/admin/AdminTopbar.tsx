export default function AdminTopbar({
  eyebrow,
  title,
  unreadCount,
}: {
  eyebrow: string;
  title: string;
  unreadCount: number;
}) {
  return (
    <header className="admin-topbar">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <button type="button" aria-label="Buscar">⌕</button>
        <button
          className="alert-button"
          type="button"
          aria-label={
            unreadCount > 0 ? `${unreadCount} notificações não lidas` : "Sem notificações novas"
          }
        >
          ♢{unreadCount > 0 ? <i /> : null}
        </button>
        <button type="button" aria-label="Ajuda">?</button>
      </div>
    </header>
  );
}
