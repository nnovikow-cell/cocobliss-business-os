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
      app_settings: {
        Row: {
          id: string
          is_singleton: boolean
          tax_rate: number
          updated_at: string
        }
        Insert: {
          id?: string
          is_singleton?: boolean
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          id?: string
          is_singleton?: boolean
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      demographic_options: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      paleta_flavor_upgrades: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
          upgrade_price: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          upgrade_price?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          upgrade_price?: number
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          applies_tax: boolean
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          applies_tax?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          applies_tax?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          name: string
          price: number
          sort_order: number
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name: string
          price?: number
          sort_order?: number
          type: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          price?: number
          sort_order?: number
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accent_color: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_demographics: {
        Row: {
          created_at: string
          customer_index: number
          demographic_option_id: string
          id: string
          sale_id: string
        }
        Insert: {
          created_at?: string
          customer_index?: number
          demographic_option_id: string
          id?: string
          sale_id: string
        }
        Update: {
          created_at?: string
          customer_index?: number
          demographic_option_id?: string
          id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_demographics_demographic_option_id_fkey"
            columns: ["demographic_option_id"]
            isOneToOne: false
            referencedRelation: "demographic_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_demographics_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          base_price_snapshot: number
          created_at: string
          customer_index: number
          deleted_at: string | null
          flavor_name_snapshot: string | null
          flavor_upgrade_id: string | null
          id: string
          line_total: number
          product_id: string | null
          product_name_snapshot: string
          product_type_snapshot: Database["public"]["Enums"]["product_type"]
          quantity: number
          sale_id: string
          updated_at: string
          upgrade_price_snapshot: number
        }
        Insert: {
          base_price_snapshot?: number
          created_at?: string
          customer_index?: number
          deleted_at?: string | null
          flavor_name_snapshot?: string | null
          flavor_upgrade_id?: string | null
          id?: string
          line_total?: number
          product_id?: string | null
          product_name_snapshot: string
          product_type_snapshot: Database["public"]["Enums"]["product_type"]
          quantity?: number
          sale_id: string
          updated_at?: string
          upgrade_price_snapshot?: number
        }
        Update: {
          base_price_snapshot?: number
          created_at?: string
          customer_index?: number
          deleted_at?: string | null
          flavor_name_snapshot?: string | null
          flavor_upgrade_id?: string | null
          id?: string
          line_total?: number
          product_id?: string | null
          product_name_snapshot?: string
          product_type_snapshot?: Database["public"]["Enums"]["product_type"]
          quantity?: number
          sale_id?: string
          updated_at?: string
          upgrade_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_flavor_upgrade_id_fkey"
            columns: ["flavor_upgrade_id"]
            isOneToOne: false
            referencedRelation: "paleta_flavor_upgrades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          applies_tax_snapshot: boolean
          created_at: string
          deleted_at: string | null
          id: string
          logged_by: string
          note: string | null
          payment_method_id: string | null
          payment_method_name_snapshot: string
          sale_kind: Database["public"]["Enums"]["sale_kind"]
          session_id: string
          subtotal: number
          tax_amount: number
          tax_rate_snapshot: number
          total: number
          updated_at: string
        }
        Insert: {
          applies_tax_snapshot?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          logged_by: string
          note?: string | null
          payment_method_id?: string | null
          payment_method_name_snapshot: string
          sale_kind?: Database["public"]["Enums"]["sale_kind"]
          session_id: string
          subtotal?: number
          tax_amount?: number
          tax_rate_snapshot?: number
          total?: number
          updated_at?: string
        }
        Update: {
          applies_tax_snapshot?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          logged_by?: string
          note?: string | null
          payment_method_id?: string | null
          payment_method_name_snapshot?: string
          sale_kind?: Database["public"]["Enums"]["sale_kind"]
          session_id?: string
          subtotal?: number
          tax_amount?: number
          tax_rate_snapshot?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sales_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          opened_at: string
          opened_by: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      product_type: "shake" | "paleta"
      sale_kind: "single" | "group"
      session_status: "open" | "closed"
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
      app_role: ["admin", "staff"],
      product_type: ["shake", "paleta"],
      sale_kind: ["single", "group"],
      session_status: ["open", "closed"],
    },
  },
} as const
