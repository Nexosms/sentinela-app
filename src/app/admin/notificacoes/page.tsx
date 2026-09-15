import type { Metadata } from "next";
import Link from "next/link";
import AdminTopbar from "@/components/admin/AdminTopbar";
import { formatDateTime } from "@/lib/admin/labels";
import {
  countUnreadNotifications,
  listNotifications,
  loadMeasurePlanIds,
  notificationHref,
} from "@/lib/admin/notifications";
import { marcarComoLidas } from "./actions";

export const metadata: Metadata = { title: "Notificações" };

// A caixa muda a cada evento; nada aqui pode vir de cache.
export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const [notificacoes, naoLidas] = await Promise.all([
    listNotifications(),
    countUnreadNotifications(),
  ]);
  const measurePlanIds = await loadMeasurePlanIds(notificacoes);

  return (
    <>
      <AdminTopbar eyebrow="CAIXA DE AVISOS" title="Notificações" unreadCount={naoLidas} />
      <div className="dashboard">
        {notificacoes.length === 0 ? (
          <div className="placeholder">
            <span>◇</span>
            <small>NADA POR AQUI</small>
            <h2>Nenhuma notificação.</h2>
            <p>
              Você é avisado quando um relato novo chega, quando alguém responde, quando um caso é
              atribuído a você e quando o risco ou o status mudam.
            </p>
          </div>
        ) : (
          <section className="priority-card">
            <div className="panel-title">
              <div>
                <small>AVISOS</small>
                <h2>
                  {naoLidas > 0
                    ? `${naoLidas} não lida${naoLidas > 1 ? "s" : ""}`
                    : "Tudo em dia"}
                </h2>
              </div>
              {naoLidas > 0 ? (
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    // A action segue a convenção `{ ok } | { error }`; o
                    // `action` de <form> exige void. Este invólucro evita ter
                    // de transformar a página num client component só para ler
                    // um retorno que a própria revalidação já mostra.
                    await marcarComoLidas(formData);
                  }}
                >
                  <button type="submit">Marcar todas como lidas</button>
                </form>
              ) : null}
            </div>

            {notificacoes.map(item => {
              const href = notificationHref(item, measurePlanIds);
              const corpo = (
                <>
                  <span className={item.read_at ? undefined : "status-pill"}>
                    {item.read_at ? "" : "Nova"}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.body ? `${item.body} · ` : ""}
                      {formatDateTime(item.created_at)}
                    </small>
                  </div>
                  <b>{href ? "abrir →" : ""}</b>
                </>
              );

              // Só vira link quando há um destino resolvido; caso contrário
              // continua um bloco de leitura, sem destino falso.
              return href ? (
                <Link className="priority-case" key={item.id} href={href}>
                  {corpo}
                </Link>
              ) : (
                <div className="priority-case" key={item.id}>
                  {corpo}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}
