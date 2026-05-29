export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          nom: string
          sujet: string | null
          telephone: string | null
          traite: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          nom: string
          sujet?: string | null
          telephone?: string | null
          traite?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          nom?: string
          sujet?: string | null
          telephone?: string | null
          traite?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      cotisations: {
        Row: {
          created_at: string
          id: string
          member_id: string
          methode: string | null
          montant: number
          paye_le: string | null
          periode: string
          reference: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          methode?: string | null
          montant: number
          paye_le?: string | null
          periode: string
          reference?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          methode?: string | null
          montant?: number
          paye_le?: string | null
          periode?: string
          reference?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotisations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_jobs_log: {
        Row: {
          details: Json
          executed_at: string
          id: string
          job_name: string
          statut: string
        }
        Insert: {
          details?: Json
          executed_at?: string
          id?: string
          job_name: string
          statut?: string
        }
        Update: {
          details?: Json
          executed_at?: string
          id?: string
          job_name?: string
          statut?: string
        }
        Relationships: []
      }
      dependants: {
        Row: {
          created_at: string
          date_naissance: string | null
          extrait_url: string | null
          id: string
          member_id: string
          nom: string
          prenoms: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_naissance?: string | null
          extrait_url?: string | null
          id?: string
          member_id: string
          nom: string
          prenoms?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_naissance?: string | null
          extrait_url?: string | null
          id?: string
          member_id?: string
          nom?: string
          prenoms?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          member_id: string
          mime_type: string | null
          offline_available: boolean
          title: string | null
          type: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          member_id: string
          mime_type?: string | null
          offline_available?: boolean
          title?: string | null
          type: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          member_id?: string
          mime_type?: string | null
          offline_available?: boolean
          title?: string | null
          type?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          topic_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          topic_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_messages_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_topics: {
        Row: {
          author_id: string
          closed: boolean
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          closed?: boolean
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          closed?: boolean
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_documents: {
        Row: {
          created_at: string
          draft_id: string | null
          file_name: string | null
          id: string
          member_id: string | null
          mime_type: string | null
          offline_available: boolean
          rejection_reason: string | null
          size_bytes: number | null
          type: string
          uploaded_at: string
          url: string
          validated: boolean
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          draft_id?: string | null
          file_name?: string | null
          id?: string
          member_id?: string | null
          mime_type?: string | null
          offline_available?: boolean
          rejection_reason?: string | null
          size_bytes?: number | null
          type: string
          uploaded_at?: string
          url: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          draft_id?: string | null
          file_name?: string | null
          id?: string
          member_id?: string | null
          mime_type?: string | null
          offline_available?: boolean
          rejection_reason?: string | null
          size_bytes?: number | null
          type?: string
          uploaded_at?: string
          url?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_documents_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "registration_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          adresse: string | null
          ayants_droit: string | null
          cni: string | null
          collectivite: string | null
          created_at: string
          date_embauche: string | null
          date_inscription: string | null
          date_naissance: string | null
          direction: string | null
          droits_ouverts_le: string | null
          email: string | null
          fonction: string | null
          frais_paye: boolean
          id: string
          is_legacy: boolean
          last_cotisation_at: string | null
          lieu_naissance: string | null
          matricule: string | null
          matricule_pro: string | null
          nom: string
          paiement_methode: string | null
          payment_confirmed_at: string | null
          payment_reference: string | null
          photo_required: boolean
          photo_url: string | null
          prenoms: string
          qr_code: string | null
          region: string | null
          sexe: string | null
          source: string
          statut: string
          step_completed: number
          suspended_reason: string | null
          telephone: string | null
          type_membre: string
          updated_at: string
          user_id: string
          validation_mode: string
        }
        Insert: {
          adresse?: string | null
          ayants_droit?: string | null
          cni?: string | null
          collectivite?: string | null
          created_at?: string
          date_embauche?: string | null
          date_inscription?: string | null
          date_naissance?: string | null
          direction?: string | null
          droits_ouverts_le?: string | null
          email?: string | null
          fonction?: string | null
          frais_paye?: boolean
          id?: string
          is_legacy?: boolean
          last_cotisation_at?: string | null
          lieu_naissance?: string | null
          matricule?: string | null
          matricule_pro?: string | null
          nom: string
          paiement_methode?: string | null
          payment_confirmed_at?: string | null
          payment_reference?: string | null
          photo_required?: boolean
          photo_url?: string | null
          prenoms: string
          qr_code?: string | null
          region?: string | null
          sexe?: string | null
          source?: string
          statut?: string
          step_completed?: number
          suspended_reason?: string | null
          telephone?: string | null
          type_membre?: string
          updated_at?: string
          user_id: string
          validation_mode?: string
        }
        Update: {
          adresse?: string | null
          ayants_droit?: string | null
          cni?: string | null
          collectivite?: string | null
          created_at?: string
          date_embauche?: string | null
          date_inscription?: string | null
          date_naissance?: string | null
          direction?: string | null
          droits_ouverts_le?: string | null
          email?: string | null
          fonction?: string | null
          frais_paye?: boolean
          id?: string
          is_legacy?: boolean
          last_cotisation_at?: string | null
          lieu_naissance?: string | null
          matricule?: string | null
          matricule_pro?: string | null
          nom?: string
          paiement_methode?: string | null
          payment_confirmed_at?: string | null
          payment_reference?: string | null
          photo_required?: boolean
          photo_url?: string | null
          prenoms?: string
          qr_code?: string | null
          region?: string | null
          sexe?: string | null
          source?: string
          statut?: string
          step_completed?: number
          suspended_reason?: string | null
          telephone?: string | null
          type_membre?: string
          updated_at?: string
          user_id?: string
          validation_mode?: string
        }
        Relationships: []
      }
      news: {
        Row: {
          author_id: string | null
          body: string
          cover_url: string | null
          created_at: string
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          cover_url?: string | null
          created_at?: string
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          active: boolean
          body: string
          channel: string
          created_at: string
          event: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          channel: string
          created_at?: string
          event: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          event?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications_log: {
        Row: {
          canal: string
          contenu: string
          created_at: string
          error_message: string | null
          event: string
          id: string
          member_id: string | null
          provider: string | null
          provider_reference: string | null
          sent_at: string | null
          statut: string
          user_id: string | null
        }
        Insert: {
          canal: string
          contenu: string
          created_at?: string
          error_message?: string | null
          event: string
          id?: string
          member_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          sent_at?: string | null
          statut?: string
          user_id?: string | null
        }
        Update: {
          canal?: string
          contenu?: string
          created_at?: string
          error_message?: string | null
          event?: string
          id?: string
          member_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          sent_at?: string | null
          statut?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunites: {
        Row: {
          created_at: string
          date_limite: string | null
          description: string
          id: string
          lieu: string | null
          published: boolean
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_limite?: string | null
          description: string
          id?: string
          lieu?: string | null
          published?: boolean
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_limite?: string | null
          description?: string
          id?: string
          lieu?: string | null
          published?: boolean
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_sessions: {
        Row: {
          confirmed_at: string | null
          created_at: string
          draft_id: string | null
          expires_at: string
          id: string
          member_id: string | null
          montant_total: number
          operateur: string
          part_miprojet: number
          part_mutuelle: number
          provider_payload: Json
          reference: string | null
          statut: string
          telephone: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          draft_id?: string | null
          expires_at?: string
          id?: string
          member_id?: string | null
          montant_total: number
          operateur: string
          part_miprojet?: number
          part_mutuelle?: number
          provider_payload?: Json
          reference?: string | null
          statut?: string
          telephone: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          draft_id?: string | null
          expires_at?: string
          id?: string
          member_id?: string | null
          montant_total?: number
          operateur?: string
          part_miprojet?: number
          part_mutuelle?: number
          provider_payload?: Json
          reference?: string | null
          statut?: string
          telephone?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_sessions_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "registration_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      prestation_requests: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          member_id: string
          montant_applicable: number
          motif_rejet: string | null
          pj_urls: Json
          statut_global: string
          step_validation: number
          submitted_at: string
          type_evenement: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          member_id: string
          montant_applicable?: number
          motif_rejet?: string | null
          pj_urls?: Json
          statut_global?: string
          step_validation?: number
          submitted_at?: string
          type_evenement: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          member_id?: string
          montant_applicable?: number
          motif_rejet?: string | null
          pj_urls?: Json
          statut_global?: string
          step_validation?: number
          submitted_at?: string
          type_evenement?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestation_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      prestation_validations: {
        Row: {
          action: string
          id: string
          metadata: Json
          motif: string | null
          niveau: number
          request_id: string
          role_requis: string
          validated_at: string
          validateur_id: string
        }
        Insert: {
          action: string
          id?: string
          metadata?: Json
          motif?: string | null
          niveau: number
          request_id: string
          role_requis: string
          validated_at?: string
          validateur_id: string
        }
        Update: {
          action?: string
          id?: string
          metadata?: Json
          motif?: string | null
          niveau?: number
          request_id?: string
          role_requis?: string
          validated_at?: string
          validateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestation_validations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "prestation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_drafts: {
        Row: {
          created_at: string
          data: Json
          device_fingerprint: string | null
          email: string
          expires_at: string
          id: string
          last_seen: string
          nom: string | null
          prenoms: string | null
          step: number
          telephone: string | null
          updated_at: string
          uploaded_documents: Json
        }
        Insert: {
          created_at?: string
          data?: Json
          device_fingerprint?: string | null
          email: string
          expires_at?: string
          id?: string
          last_seen?: string
          nom?: string | null
          prenoms?: string | null
          step?: number
          telephone?: string | null
          updated_at?: string
          uploaded_documents?: Json
        }
        Update: {
          created_at?: string
          data?: Json
          device_fingerprint?: string | null
          email?: string
          expires_at?: string
          id?: string
          last_seen?: string
          nom?: string | null
          prenoms?: string | null
          step?: number
          telephone?: string | null
          updated_at?: string
          uploaded_documents?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          member_id: string
          montant_total: number
          operateur: string | null
          paid_at: string | null
          part_miprojet: number
          part_mutuelle: number
          periode: string | null
          reference_transaction: string | null
          statut_paiement: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          montant_total: number
          operateur?: string | null
          paid_at?: string | null
          part_miprojet?: number
          part_mutuelle?: number
          periode?: string | null
          reference_transaction?: string | null
          statut_paiement?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          montant_total?: number
          operateur?: string | null
          paid_at?: string | null
          part_miprojet?: number
          part_mutuelle?: number
          periode?: string | null
          reference_transaction?: string | null
          statut_paiement?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_miprojet: {
        Row: {
          created_at: string
          date_virement: string | null
          id: string
          montant: number
          reference: string | null
          statut: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          date_virement?: string | null
          id?: string
          montant: number
          reference?: string | null
          statut?: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          date_virement?: string | null
          id?: string
          montant?: number
          reference?: string | null
          statut?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_miprojet_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "finance_revenue_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_miprojet_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          collectivite: string | null
          created_at: string
          id: string
          region: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          collectivite?: string | null
          created_at?: string
          id?: string
          region?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          collectivite?: string | null
          created_at?: string
          id?: string
          region?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      finance_revenue_summary: {
        Row: {
          categorie: string | null
          created_at: string | null
          date_operation: string | null
          id: string | null
          member_id: string | null
          montant_total: number | null
          operateur: string | null
          part_miprojet: number | null
          part_mutuelle: number | null
          periode: string | null
          reference_transaction: string | null
          statut_paiement: string | null
          type: string | null
        }
        Insert: {
          categorie?: never
          created_at?: string | null
          date_operation?: never
          id?: string | null
          member_id?: string | null
          montant_total?: number | null
          operateur?: string | null
          part_miprojet?: number | null
          part_mutuelle?: number | null
          periode?: string | null
          reference_transaction?: string | null
          statut_paiement?: string | null
          type?: string | null
        }
        Update: {
          categorie?: never
          created_at?: string | null
          date_operation?: never
          id?: string | null
          member_id?: string | null
          montant_total?: number | null
          operateur?: string | null
          part_miprojet?: number | null
          part_mutuelle?: number | null
          periode?: string | null
          reference_transaction?: string | null
          statut_paiement?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_dashboard_stats: { Args: never; Returns: Json }
      calculate_prestation_amount: {
        Args: { _date_inscription?: string; _type: string }
        Returns: number
      }
      can_manage_payments: { Args: { _user_id: string }; Returns: boolean }
      current_user_dashboard_path: { Args: never; Returns: string }
      dashboard_path_for: { Args: { _user_id: string }; Returns: string }
      dashboard_sync_health: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      lookup_member_email_by_phone: {
        Args: { p_phone: string }
        Returns: string
      }
      member_public_info: { Args: { p_matricule: string }; Returns: Json }
      miprojet_dashboard_stats: { Args: never; Returns: Json }
      open_member_rights_after_90_days: { Args: never; Returns: number }
      resolve_login_email: { Args: { p_identifier: string }; Returns: string }
      role_for_prestation_step: { Args: { _step: number }; Returns: string }
      validate_prestation_step: {
        Args: { _action: string; _motif?: string; _request_id: string }
        Returns: {
          closed_at: string | null
          created_at: string
          id: string
          member_id: string
          montant_applicable: number
          motif_rejet: string | null
          pj_urls: Json
          statut_global: string
          step_validation: number
          submitted_at: string
          type_evenement: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "prestation_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin_national"
        | "admin_regional"
        | "admin_local"
        | "agent_saisie"
        | "membre"
        | "president"
        | "secretaire_general"
        | "tresorier_national"
        | "commissaire_comptes"
        | "secretaire_regional"
        | "tresorier_regional"
        | "member"
        | "directeur_executif"
        | "comite_controle"
        | "conseil_sages"
        | "delegue_section"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin_national",
        "admin_regional",
        "admin_local",
        "agent_saisie",
        "membre",
        "president",
        "secretaire_general",
        "tresorier_national",
        "commissaire_comptes",
        "secretaire_regional",
        "tresorier_regional",
        "member",
        "directeur_executif",
        "comite_controle",
        "conseil_sages",
        "delegue_section",
      ],
    },
  },
} as const
