import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  component: Page,
});

const faq = [
  { q: "Qui peut s’inscrire à la MUGEC-CI ?", a: "Tout agent en activité ou à la retraite d'une collectivité territoriale ivoirienne (mairie, conseil régional, etc.)." },
  { q: "Combien coûte l’inscription ?", a: "Les frais d’inscription sont de 5 000 FCFA, payables une seule fois par mobile money." },
  { q: "Comment payer mes cotisations ?", a: "Via Orange Money, MTN MoMo, Wave ou Moov, directement depuis votre espace membre." },
  { q: "Comment obtenir ma carte de membre ?", a: "Après validation de votre dossier, votre carte est générée automatiquement et téléchargeable au format PDF." },
  { q: "Mes données sont-elles protégées ?", a: "Oui. La plateforme respecte les bonnes pratiques de sécurité (HTTPS, RGPD-like, accès cloisonné par rôle)." },
];

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Foire aux questions</h1>
        <Accordion type="single" collapsible className="mt-8">
          {faq.map((f, i) => (
            <AccordionItem key={i} value={`i${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <SiteFooter />
    </div>
  );
}
