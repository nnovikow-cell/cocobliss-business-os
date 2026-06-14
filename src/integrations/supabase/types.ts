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
          shake_size_oz: number
          tax_rate: number
          updated_at: string
        }
        Insert: {
          id?: string
          is_singleton?: boolean
          shake_size_oz?: number
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          id?: string
          is_singleton?: boolean
          shake_size_oz?: number
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      attendants: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          first_name: string | null
          id: string
          is_archived: boolean
          last_name: string | null
          name: string
          role: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          id?: string
          is_archived?: boolean
          last_name?: string | null
          name: string
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          id?: string
          is_archived?: boolean
          last_name?: string | null
          name?: string
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      balance_accounts: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          type: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          type: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          type?: string
        }
        Relationships: []
      }
      balance_entries: {
        Row: {
          account_id: string
          balance: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          logged_at: string
          notes: string | null
        }
        Insert: {
          account_id: string
          balance: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          logged_at: string
          notes?: string | null
        }
        Update: {
          account_id?: string
          balance?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "balance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_categories: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
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
      checklist_items: {
        Row: {
          category_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          location_tag: string | null
          name: string
          owner_user_id: string | null
          size_tag: Database["public"]["Enums"]["checklist_item_size"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          location_tag?: string | null
          name: string
          owner_user_id?: string | null
          size_tag?: Database["public"]["Enums"]["checklist_item_size"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          location_tag?: string | null
          name?: string
          owner_user_id?: string | null
          size_tag?: Database["public"]["Enums"]["checklist_item_size"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_session_items: {
        Row: {
          category_color_snapshot: string | null
          category_id: string | null
          category_name_snapshot: string | null
          created_at: string
          id: string
          is_packed: boolean
          item_id: string | null
          item_name_snapshot: string
          location_snapshot: string | null
          owner_name_snapshot: string | null
          owner_user_id_snapshot: string | null
          packed_at: string | null
          packed_by: string | null
          session_id: string
          size_snapshot: Database["public"]["Enums"]["checklist_item_size"]
          updated_at: string
        }
        Insert: {
          category_color_snapshot?: string | null
          category_id?: string | null
          category_name_snapshot?: string | null
          created_at?: string
          id?: string
          is_packed?: boolean
          item_id?: string | null
          item_name_snapshot: string
          location_snapshot?: string | null
          owner_name_snapshot?: string | null
          owner_user_id_snapshot?: string | null
          packed_at?: string | null
          packed_by?: string | null
          session_id: string
          size_snapshot?: Database["public"]["Enums"]["checklist_item_size"]
          updated_at?: string
        }
        Update: {
          category_color_snapshot?: string | null
          category_id?: string | null
          category_name_snapshot?: string | null
          created_at?: string
          id?: string
          is_packed?: boolean
          item_id?: string | null
          item_name_snapshot?: string
          location_snapshot?: string | null
          owner_name_snapshot?: string | null
          owner_user_id_snapshot?: string | null
          packed_at?: string | null
          packed_by?: string | null
          session_id?: string
          size_snapshot?: Database["public"]["Enums"]["checklist_item_size"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "checklist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          deleted_at: string | null
          event_id: string | null
          event_instance_id: string | null
          event_location_snapshot: string | null
          event_name_snapshot: string
          id: string
          opened_at: string
          opened_by: string
          status: Database["public"]["Enums"]["checklist_session_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          event_id?: string | null
          event_instance_id?: string | null
          event_location_snapshot?: string | null
          event_name_snapshot: string
          id?: string
          opened_at?: string
          opened_by: string
          status?: Database["public"]["Enums"]["checklist_session_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          event_id?: string | null
          event_instance_id?: string | null
          event_location_snapshot?: string | null
          event_name_snapshot?: string
          id?: string
          opened_at?: string
          opened_by?: string
          status?: Database["public"]["Enums"]["checklist_session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_sessions_event_instance_id_fkey"
            columns: ["event_instance_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          password: string | null
          service_name: string
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          password?: string | null
          service_name: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          password?: string | null
          service_name?: string
          updated_at?: string
          url?: string | null
          username?: string | null
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
      discount_options: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          kind: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      disposable_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          name: string
          package_price: number
          package_qty: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name: string
          package_price: number
          package_qty: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          package_price?: number
          package_qty?: number
          updated_at?: string
        }
        Relationships: []
      }
      disposable_kit_items: {
        Row: {
          created_at: string
          disposable_item_id: string
          id: string
          kit_id: string
          qty: number
        }
        Insert: {
          created_at?: string
          disposable_item_id: string
          id?: string
          kit_id: string
          qty?: number
        }
        Update: {
          created_at?: string
          disposable_item_id?: string
          id?: string
          kit_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "disposable_kit_items_disposable_item_id_fkey"
            columns: ["disposable_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disposable_kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "disposable_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      disposable_kits: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          name: string
          target_size: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name: string
          target_size: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          target_size?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_instances: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          planned_staff_ids: string[]
          series_id: string
          status: Database["public"]["Enums"]["event_instance_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          deleted_at?: string | null
          id?: string
          planned_staff_ids?: string[]
          series_id: string
          status?: Database["public"]["Enums"]["event_instance_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          planned_staff_ids?: string[]
          series_id?: string
          status?: Database["public"]["Enums"]["event_instance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_instances_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          location: string | null
          name: string
          recurrence: Database["public"]["Enums"]["event_recurrence"]
          start_date: string
          status: Database["public"]["Enums"]["event_series_status"]
          tag_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          location?: string | null
          name: string
          recurrence?: Database["public"]["Enums"]["event_recurrence"]
          start_date: string
          status?: Database["public"]["Enums"]["event_series_status"]
          tag_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          location?: string | null
          name?: string
          recurrence?: Database["public"]["Enums"]["event_recurrence"]
          start_date?: string
          status?: Database["public"]["Enums"]["event_series_status"]
          tag_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "event_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tags: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
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
      events: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          location: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          location?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          location?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          created_at: string
          deleted_at: string | null
          density: number | null
          density_source: string | null
          description: string | null
          id: string
          is_archived: boolean
          item_size: number
          name: string
          package_price: number
          package_qty: number
          source_address: string | null
          source_url: string | null
          supplier_name: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          density?: number | null
          density_source?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          item_size: number
          name: string
          package_price: number
          package_qty: number
          source_address?: string | null
          source_url?: string | null
          supplier_name?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          density?: number | null
          density_source?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          item_size?: number
          name?: string
          package_price?: number
          package_qty?: number
          source_address?: string | null
          source_url?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"]
          category_v2: string | null
          cost_per_unit: number | null
          created_at: string
          created_by: string | null
          current_quantity: number
          deleted_at: string | null
          density: number | null
          density_source: string | null
          id: string
          is_active: boolean
          is_archived: boolean
          last_restocked_at: string | null
          library_code: string | null
          name: string
          notes: string | null
          package_qty: number | null
          package_size: number | null
          package_size_unit: string | null
          package_type: string | null
          par_level: number
          physical_location: string | null
          price: number | null
          price_updated_at: string | null
          purchase_url: string | null
          subcategory: string | null
          supplier_name: string | null
          unit: string
          updated_at: string
          workflow_tags: string[]
        }
        Insert: {
          category: Database["public"]["Enums"]["inventory_category"]
          category_v2?: string | null
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          deleted_at?: string | null
          density?: number | null
          density_source?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          last_restocked_at?: string | null
          library_code?: string | null
          name: string
          notes?: string | null
          package_qty?: number | null
          package_size?: number | null
          package_size_unit?: string | null
          package_type?: string | null
          par_level?: number
          physical_location?: string | null
          price?: number | null
          price_updated_at?: string | null
          purchase_url?: string | null
          subcategory?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
          workflow_tags?: string[]
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"]
          category_v2?: string | null
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          deleted_at?: string | null
          density?: number | null
          density_source?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          last_restocked_at?: string | null
          library_code?: string | null
          name?: string
          notes?: string | null
          package_qty?: number | null
          package_size?: number | null
          package_size_unit?: string | null
          package_type?: string | null
          par_level?: number
          physical_location?: string | null
          price?: number | null
          price_updated_at?: string | null
          purchase_url?: string | null
          subcategory?: string | null
          supplier_name?: string | null
          unit?: string
          updated_at?: string
          workflow_tags?: string[]
        }
        Relationships: []
      }
      inventory_log_batches: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          event_instance_id: string | null
          id: string
          kind: Database["public"]["Enums"]["inventory_log_kind"]
          logged_by: string | null
          note: string | null
          order_date: string | null
          order_number: string | null
          production_date: string | null
          projected_received_date: string | null
          projected_use_date: string | null
          received_at: string | null
          received_by: string | null
          shipping_cost: number | null
          status: string
          supplier_name: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          event_instance_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["inventory_log_kind"]
          logged_by?: string | null
          note?: string | null
          order_date?: string | null
          order_number?: string | null
          production_date?: string | null
          projected_received_date?: string | null
          projected_use_date?: string | null
          received_at?: string | null
          received_by?: string | null
          shipping_cost?: number | null
          status?: string
          supplier_name?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          event_instance_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["inventory_log_kind"]
          logged_by?: string | null
          note?: string | null
          order_date?: string | null
          order_number?: string | null
          production_date?: string | null
          projected_received_date?: string | null
          projected_use_date?: string | null
          received_at?: string | null
          received_by?: string | null
          shipping_cost?: number | null
          status?: string
          supplier_name?: string | null
        }
        Relationships: []
      }
      inventory_logs: {
        Row: {
          batch_id: string | null
          created_at: string
          event_instance_id: string | null
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["inventory_log_kind"]
          logged_by: string | null
          note: string | null
          production_date: string | null
          projected_use_date: string | null
          quantity: number
          quantity_after: number
          reverted_at: string | null
          reverted_by: string | null
          supplier_name_snapshot: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          event_instance_id?: string | null
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["inventory_log_kind"]
          logged_by?: string | null
          note?: string | null
          production_date?: string | null
          projected_use_date?: string | null
          quantity: number
          quantity_after: number
          reverted_at?: string | null
          reverted_by?: string | null
          supplier_name_snapshot?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          event_instance_id?: string | null
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["inventory_log_kind"]
          logged_by?: string | null
          note?: string | null
          production_date?: string | null
          projected_use_date?: string | null
          quantity?: number
          quantity_after?: number
          reverted_at?: string | null
          reverted_by?: string | null
          supplier_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_log_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_event_instance_id_fkey"
            columns: ["event_instance_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          cost_per_unit: number | null
          id: string
          item_id: string
          note: string | null
          package_size: number | null
          package_size_unit: string | null
          price: number | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          cost_per_unit?: number | null
          id?: string
          item_id: string
          note?: string | null
          package_size?: number | null
          package_size_unit?: string | null
          price?: number | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          cost_per_unit?: number | null
          id?: string
          item_id?: string
          note?: string | null
          package_size?: number | null
          package_size_unit?: string | null
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_date: string
          event_instance_id: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date: string
          event_instance_id?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string
          event_instance_id?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_event_instance_id_fkey"
            columns: ["event_instance_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          action_items: Json
          attendee_ids: string[]
          attendee_names_snapshot: string[]
          created_at: string
          created_by: string | null
          decisions: Json
          deleted_at: string | null
          id: string
          linked_event_id: string | null
          meeting_date: string
          next_meeting_topics: string | null
          notes: string | null
          topics: Json
          updated_at: string
        }
        Insert: {
          action_items?: Json
          attendee_ids?: string[]
          attendee_names_snapshot?: string[]
          created_at?: string
          created_by?: string | null
          decisions?: Json
          deleted_at?: string | null
          id?: string
          linked_event_id?: string | null
          meeting_date: string
          next_meeting_topics?: string | null
          notes?: string | null
          topics?: Json
          updated_at?: string
        }
        Update: {
          action_items?: Json
          attendee_ids?: string[]
          attendee_names_snapshot?: string[]
          created_at?: string
          created_by?: string | null
          decisions?: Json
          deleted_at?: string | null
          id?: string
          linked_event_id?: string | null
          meeting_date?: string
          next_meeting_topics?: string | null
          notes?: string | null
          topics?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "sales_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      recipe_formula_ingredients: {
        Row: {
          created_at: string
          formula_id: string
          id: string
          ingredient_id: string
          ratio: number
        }
        Insert: {
          created_at?: string
          formula_id: string
          id?: string
          ingredient_id: string
          ratio: number
        }
        Update: {
          created_at?: string
          formula_id?: string
          id?: string
          ingredient_id?: string
          ratio?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_formula_ingredients_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "recipe_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_formula_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_formulas: {
        Row: {
          batch_size: number
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          product_id: string
          updated_at: string
        }
        Insert: {
          batch_size: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          product_id: string
          updated_at?: string
        }
        Update: {
          batch_size?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_formulas_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "recipe_products"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_products: {
        Row: {
          active_formula_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_archived: boolean
          name: string
          updated_at: string
        }
        Insert: {
          active_formula_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          active_formula_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_serving_sizes: {
        Row: {
          created_at: string
          disposable_kit_id: string | null
          id: string
          product_id: string
          size_fl_oz: number
          syrup_fl_oz: number | null
          syrup_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          disposable_kit_id?: string | null
          id?: string
          product_id: string
          size_fl_oz: number
          syrup_fl_oz?: number | null
          syrup_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          disposable_kit_id?: string | null
          id?: string
          product_id?: string
          size_fl_oz?: number
          syrup_fl_oz?: number | null
          syrup_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_serving_sizes_disposable_kit_id_fkey"
            columns: ["disposable_kit_id"]
            isOneToOne: false
            referencedRelation: "disposable_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_serving_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "recipe_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_serving_sizes_syrup_id_fkey"
            columns: ["syrup_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_series: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          frequency: string
          id: string
          is_active: boolean
          note: string | null
          owner: string | null
          recurrence_day: number
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          note?: string | null
          owner?: string | null
          recurrence_day: number
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          note?: string | null
          owner?: string | null
          recurrence_day?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_series_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
        ]
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
          discount_amount: number
          discount_label_snapshot: string | null
          id: string
          is_sample: boolean
          logged_by: string
          note: string | null
          payment_method_id: string | null
          payment_method_name_snapshot: string
          sale_kind: Database["public"]["Enums"]["sale_kind"]
          session_id: string
          subtotal: number
          tax_amount: number
          tax_rate_snapshot: number
          tip_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          applies_tax_snapshot?: boolean
          created_at?: string
          deleted_at?: string | null
          discount_amount?: number
          discount_label_snapshot?: string | null
          id?: string
          is_sample?: boolean
          logged_by: string
          note?: string | null
          payment_method_id?: string | null
          payment_method_name_snapshot: string
          sale_kind?: Database["public"]["Enums"]["sale_kind"]
          session_id: string
          subtotal?: number
          tax_amount?: number
          tax_rate_snapshot?: number
          tip_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          applies_tax_snapshot?: boolean
          created_at?: string
          deleted_at?: string | null
          discount_amount?: number
          discount_label_snapshot?: string | null
          id?: string
          is_sample?: boolean
          logged_by?: string
          note?: string | null
          payment_method_id?: string | null
          payment_method_name_snapshot?: string
          sale_kind?: Database["public"]["Enums"]["sale_kind"]
          session_id?: string
          subtotal?: number
          tax_amount?: number
          tax_rate_snapshot?: number
          tip_amount?: number
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
          attendant_ids: string[]
          attendant_names_snapshot: string[]
          closed_at: string | null
          closed_by: string | null
          created_at: string
          deleted_at: string | null
          event_instance_id: string | null
          id: string
          linked_checklist_session_id: string | null
          location: string | null
          missed_paletas: number
          missed_shakes: number
          name: string
          notes: string | null
          opened_at: string
          opened_by: string
          paletas_brought: number
          shake_size_oz_snapshot: number
          shakes_quarts_brought: number
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
          weather_label_snapshot: string | null
          weather_option_id: string | null
        }
        Insert: {
          attendant_ids?: string[]
          attendant_names_snapshot?: string[]
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          event_instance_id?: string | null
          id?: string
          linked_checklist_session_id?: string | null
          location?: string | null
          missed_paletas?: number
          missed_shakes?: number
          name: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          paletas_brought?: number
          shake_size_oz_snapshot?: number
          shakes_quarts_brought?: number
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          weather_label_snapshot?: string | null
          weather_option_id?: string | null
        }
        Update: {
          attendant_ids?: string[]
          attendant_names_snapshot?: string[]
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          event_instance_id?: string | null
          id?: string
          linked_checklist_session_id?: string | null
          location?: string | null
          missed_paletas?: number
          missed_shakes?: number
          name?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          paletas_brought?: number
          shake_size_oz_snapshot?: number
          shakes_quarts_brought?: number
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          weather_label_snapshot?: string | null
          weather_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_sessions_event_instance_id_fkey"
            columns: ["event_instance_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      sops: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          steps: Json
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          steps?: Json
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          steps?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      syrups: {
        Row: {
          bottle_price: number
          bottle_size: number
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_archived: boolean
          name: string
          source_address: string | null
          source_url: string | null
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          bottle_price: number
          bottle_size: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          source_address?: string | null
          source_url?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          bottle_price?: number
          bottle_size?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          source_address?: string | null
          source_url?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_day: number
          assigned_week: string
          category: string
          completed_at: string | null
          completed_day: number | null
          created_at: string
          created_by: string | null
          id: string
          is_recurring: boolean
          note: string | null
          owner: string | null
          recurrence_day: number | null
          recurrence_id: string | null
          title: string
        }
        Insert: {
          assigned_day: number
          assigned_week: string
          category: string
          completed_at?: string | null
          completed_day?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_recurring?: boolean
          note?: string | null
          owner?: string | null
          recurrence_day?: number | null
          recurrence_id?: string | null
          title: string
        }
        Update: {
          assigned_day?: number
          assigned_week?: string
          category?: string
          completed_at?: string | null
          completed_day?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_recurring?: boolean
          note?: string | null
          owner?: string | null
          recurrence_day?: number | null
          recurrence_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrence_series"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_options: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          kind: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          label?: string
          sort_order?: number
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
      weather_options: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_event_instances: {
        Args: { p_series_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      prune_unlinked_future_instances: {
        Args: { p_cutoff_date: string; p_series_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      checklist_item_size: "S" | "M" | "L"
      checklist_session_status: "active" | "closed"
      event_instance_status: "confirmed" | "not_attending" | "cancelled"
      event_recurrence: "single" | "weekly" | "biweekly" | "monthly"
      event_series_status: "active" | "terminated"
      inventory_category: "consumable" | "disposable"
      inventory_log_kind: "use" | "restock" | "production_batch" | "event_use"
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
      checklist_item_size: ["S", "M", "L"],
      checklist_session_status: ["active", "closed"],
      event_instance_status: ["confirmed", "not_attending", "cancelled"],
      event_recurrence: ["single", "weekly", "biweekly", "monthly"],
      event_series_status: ["active", "terminated"],
      inventory_category: ["consumable", "disposable"],
      inventory_log_kind: ["use", "restock", "production_batch", "event_use"],
      product_type: ["shake", "paleta"],
      sale_kind: ["single", "group"],
      session_status: ["open", "closed"],
    },
  },
} as const
