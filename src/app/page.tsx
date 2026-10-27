import PublicHeader from "@/components/public/PublicHeader";
import Hero from "@/components/public/Hero";
import HowItWorks from "@/components/public/HowItWorks";
import PublicFooter from "@/components/public/PublicFooter";

import "./home.css";

export default function Home() {
  return (
    <main className="public-shell home">
      <PublicHeader />
      <Hero />
      <HowItWorks />
      <PublicFooter />
    </main>
  );
}
