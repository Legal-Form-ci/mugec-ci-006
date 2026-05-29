import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: Page });

function Page() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Minimum 8 caractères");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) {
      console.error("reset password failed", error);
      return toast.error("Impossible de mettre à jour le mot de passe. Veuillez réessayer.");
    }
    toast.success("Mot de passe mis à jour");
    nav({ to: "/membre" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container mx-auto max-w-md px-4 py-16">
        <Card>
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="pwd">Mot de passe (8 caractères min.)</Label>
                <Input id="pwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Mise à jour…" : "Mettre à jour"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
      <SiteFooter />
    </div>
  );
}
