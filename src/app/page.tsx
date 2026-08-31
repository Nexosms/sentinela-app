import PublicHeader from "@/components/public/PublicHeader";
import Hero from "@/components/public/Hero";
import HowItWorks from "@/components/public/HowItWorks";
import PublicFooter from "@/components/public/PublicFooter";

export default function Home() {
  return (
    <main className="public-shell">
      <PublicHeader />
      <Hero />
      <HowItWorks />
      <PublicFooter />
    </main>
  );
}
