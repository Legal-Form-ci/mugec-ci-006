import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Users, Wallet, Smartphone, FileBadge, Bell, ScanLine } from "lucide-react";
import logo from "@/assets/mugec-logo.png";

export const Route = createFileRoute("/")({
  component: Index,
});

const stats = [
  { label: "Membres potentiels", value: "50 000+" },
  { label: "Collectivités couvertes", value: "201" },
  { label: "Régions", value: "31" },
  { label: "Frais d’inscription", value: "5 000 F" },
];

const features = [
  { icon: Users, title: "Inscription 100% en ligne", desc: "Inscrivez-vous en 3 étapes, payez par mobile money et recevez votre validation automatiquement." },
  { icon: Wallet, title: "Vos cotisations simplifiées", desc: "Réglez vos cotisations via Orange Money, MTN MoMo, Wave ou Moov, en temps réel." },
  { icon: FileBadge, title: "Votre fiche & carte de membre", desc: "Téléchargez vos documents officiels au format PDF, signés par la MUGEC-CI." },
  { icon: ShieldCheck, title: "Un espace sécurisé", desc: "Vos données personnelles et vos documents sont protégés et chiffrés." },
  { icon: Bell, title: "Restez informé(e)", desc: "Recevez vos rappels et notifications par SMS, WhatsApp et e-mail." },
  { icon: Smartphone, title: "Accessible partout", desc: "Une plateforme responsive, consultable depuis votre téléphone, où que vous soyez." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-32 h-[400px] w-[400px] rounded-full bg-accent/10 blur-3xl"
        />
        <div className="container relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
          <div>
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Plateforme officielle
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
              La MUGEC-CI, <span className="text-primary">solidaire</span> et{" "}
              <span className="text-accent">numérique</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Bienvenue sur votre plateforme officielle. Inscrivez-vous en ligne, réglez vos
              cotisations, téléchargez votre carte de membre et restez connecté(e) à votre
              mutuelle, où que vous soyez.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/inscription">
                  M'inscrire en ligne <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">J'ai déjà un compte</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link to="/scanner">
                  <ScanLine className="mr-2 h-4 w-4" /> Scanner un QR Code
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl border bg-card p-8 shadow-xl">
              <img src={logo} alt="MUGEC-CI" className="mx-auto h-32 w-auto" />
              <p className="mt-6 text-center text-sm italic text-muted-foreground">
                « Mutuelle Générale du Personnel des Collectivités Territoriales de Côte d'Ivoire »
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-lg bg-secondary/60 p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto max-w-7xl px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Tous vos services en un seul espace
          </h2>
          <p className="mt-3 text-muted-foreground">
            La MUGEC-CI met à votre disposition une plateforme moderne, conçue pour vous, agents
            des collectivités territoriales.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto max-w-7xl px-4 pb-20">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-accent p-10 text-center text-white md:p-16">
          <h2 className="text-3xl font-bold md:text-4xl">Inscrivez-vous dès maintenant à la MUGEC-CI</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/90">
            Frais d'inscription uniques de 5 000 FCFA, payables par mobile money. Inscription en
            moins de 5 minutes, sans déplacement.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/inscription">M'inscrire en ligne</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
