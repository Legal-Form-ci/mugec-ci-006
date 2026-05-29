import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const memberSchema = z.object({
  nom: z.string().trim().min(2).max(100),
  prenoms: z.string().trim().min(2).max(150),
  date_naissance: z.string().min(1),
  lieu_naissance: z.string().trim().min(2).max(100),
  sexe: z.enum(["M", "F"]),
  email: z.string().email().max(255),
  telephone: z.string().trim().min(8).max(20),
  cni: z.string().trim().min(4).max(30),
  adresse: z.string().trim().min(2).max(255),
  collectivite: z.string().trim().min(2).max(150),
  region: z.string().trim().max(100).optional().nullable(),
  direction: z.string().trim().max(150).optional().nullable(),
  fonction: z.string().trim().max(150).optional().nullable(),
  matricule_pro: z.string().trim().max(50).optional().nullable(),
  date_embauche: z.string().optional().nullable(),
  ayants_droit: z.string().max(4000).optional().nullable(),
  photo_url: z
    .string()
    .max(500)
    .regex(/^[A-Za-z0-9._\-/]+$/, "Chemin photo invalide")
    .refine((v) => !v.startsWith("data:") && !/^https?:\/\//i.test(v), "Chemin photo invalide")
    .optional()
    .nullable(),
  paiement_methode: z.enum(["orange", "mtn", "wave", "moov"]),
  payment_reference: z.string().min(3).max(80),
  // Consentements expressément acceptés à l'inscription
  consent_reglement: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter le Règlement intérieur." }),
  }),
  consent_prelevement: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter l'autorisation de prélèvement." }),
  }),
  consent_confidentialite: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter la clause de confidentialité." }),
  }),
});



/**
 * Crée le membre et la souscription d'inscription en statut "en_attente".
 * Aucun privilège n'est ouvert tant que le webhook du PSP (CinetPay / FedaPay)
 * n'a pas confirmé le paiement. Les droits sont ouverts par le job
 * `open_member_rights_after_90_days` une fois le paiement validé.
 */
export const finalizeRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => memberSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 1) Membre — création en attente de paiement réel
    const { data: member, error: memberErr } = await supabaseAdmin
      .from("members")
      .insert({
        user_id: userId,
        nom: data.nom,
        prenoms: data.prenoms,
        date_naissance: data.date_naissance,
        lieu_naissance: data.lieu_naissance,
        sexe: data.sexe,
        email: data.email,
        telephone: data.telephone,
        cni: data.cni,
        adresse: data.adresse,
        collectivite: data.collectivite,
        region: data.region,
        direction: data.direction,
        fonction: data.fonction,
        matricule_pro: data.matricule_pro,
        date_embauche: data.date_embauche || null,
        ayants_droit: data.ayants_droit,
        photo_url: data.photo_url ?? null,
        statut: "en_attente",
        paiement_methode: data.paiement_methode,
        frais_paye: false,
        payment_reference: data.payment_reference,
        payment_confirmed_at: null,
        droits_ouverts_le: null,
        validation_mode: "automatique",
      })
      .select()
      .single();
    if (memberErr) {
      console.error("finalizeRegistration: member insert failed", memberErr);
      throw new Error("Échec de la création du compte. Veuillez réessayer.");
    }

    // 2) Souscription d'inscription — en attente de confirmation PSP
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        member_id: member.id,
        type: "inscription",
        montant_total: 5000,
        part_mutuelle: 4000,
        part_miprojet: 1000,
        statut_paiement: "en_attente",
        operateur: data.paiement_methode,
        reference_transaction: data.payment_reference,
        paid_at: null,
      })
      .select()
      .single();
    if (subErr) {
      console.error("finalizeRegistration: subscription insert failed", subErr);
      throw new Error("Échec de l'enregistrement du paiement. Veuillez réessayer.");
    }

    // 3) Audit
    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      action: "registration.pending_payment",
      entity: "members",
      entity_id: member.id,
      metadata: { reference: data.payment_reference, operateur: data.paiement_methode },
    });

    return { member, subscription: sub };
  });

