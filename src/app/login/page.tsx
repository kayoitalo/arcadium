import { redirect } from "next/navigation";
import { authConfigured, currentSession } from "@/lib/security/session";
import { LoginForm } from "./login-form";
import { LoginStory } from "./login-story";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar · Arcadium" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await currentSession()) redirect("/overview");
  const expired = (await searchParams).expired === "1";
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.wordmark}>arcadium</p>
        <p className={styles.headerNote}>um amigo obcecado por música.</p>
      </header>

      <div className={styles.layout}>
        <LoginStory />

        <section className={styles.entry} aria-labelledby="entry-title">
          <div className={styles.entryHeading}>
            <span className={styles.entryIndex} aria-hidden="true">↳</span>
            <p className={styles.entryLabel}>tua sala de escuta</p>
          </div>
          <h2 id="entry-title" className={styles.entryTitle}>Bora continuar?</h2>
          <p className={styles.entryIntro}>Entra. Tem coisa boa no teu histórico<br className={styles.desktopBreak} /> pra gente trocar uma ideia.</p>
          {expired && <p role="status" className={styles.status}>Sua sessão terminou. Entra de novo pra continuar.</p>}
          {authConfigured() ? <LoginForm /> : (
            <p role="status" className={styles.status}>O proprietário ainda precisa configurar o acesso para abrir a sala.</p>
          )}
          <p className={styles.privateNote}><span aria-hidden="true">◇</span> Acesso pessoal. Teu histórico fica do lado de dentro.</p>
        </section>
      </div>

      <footer className={styles.footer}>
        <p>teu histórico. outro jeito de ouvir.</p>
        <p>Last.fm no começo. Música em todo o resto.</p>
      </footer>
    </main>
  );
}
