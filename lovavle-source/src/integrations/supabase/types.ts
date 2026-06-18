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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academy_bundle_courses: {
        Row: {
          bundle_id: string
          course_id: string
        }
        Insert: {
          bundle_id: string
          course_id: string
        }
        Update: {
          bundle_id?: string
          course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_bundle_courses_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "academy_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_bundle_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_bundles: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          portal_id: string
          price_usd: number
          product_id: string | null
          status: string
          thumbnail_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          portal_id: string
          price_usd?: number
          product_id?: string | null
          status?: string
          thumbnail_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          portal_id?: string
          price_usd?: number
          product_id?: string | null
          status?: string
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_bundles_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          portal_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          portal_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          portal_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      academy_certificates: {
        Row: {
          certificate_code: string
          course_id: string
          id: string
          issued_at: string | null
          partner_user_id: string
        }
        Insert: {
          certificate_code?: string
          course_id: string
          id?: string
          issued_at?: string | null
          partner_user_id: string
        }
        Update: {
          certificate_code?: string
          course_id?: string
          id?: string
          issued_at?: string | null
          partner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_certificates_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_courses: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          is_free: boolean | null
          portal_id: string
          price_usd: number | null
          required_tiers: string[] | null
          status: string
          thumbnail_path: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_free?: boolean | null
          portal_id: string
          price_usd?: number | null
          required_tiers?: string[] | null
          status?: string
          thumbnail_path?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_free?: boolean | null
          portal_id?: string
          price_usd?: number | null
          required_tiers?: string[] | null
          status?: string
          thumbnail_path?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "academy_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_courses_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string | null
          granted_by: string | null
          id: string
          partner_user_id: string
          tx_hash: string | null
        }
        Insert: {
          course_id: string
          enrolled_at?: string | null
          granted_by?: string | null
          id?: string
          partner_user_id: string
          tx_hash?: string | null
        }
        Update: {
          course_id?: string
          enrolled_at?: string | null
          granted_by?: string | null
          id?: string
          partner_user_id?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_enrollments_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lesson_attachments: {
        Row: {
          created_at: string
          display_order: number
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          is_primary: boolean
          lesson_id: string
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          is_primary?: boolean
          lesson_id: string
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          display_order?: number
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          is_primary?: boolean
          lesson_id?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_lesson_attachments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lessons: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          duration_seconds: number | null
          id: string
          lesson_type: string
          module_id: string
          mux_asset_id: string | null
          mux_duration_seconds: number | null
          mux_error_message: string | null
          mux_playback_id: string | null
          mux_status: Database["public"]["Enums"]["academy_mux_status"] | null
          mux_upload_id: string | null
          thumbnail_path: string | null
          title: string
          video_path: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          id?: string
          lesson_type?: string
          module_id: string
          mux_asset_id?: string | null
          mux_duration_seconds?: number | null
          mux_error_message?: string | null
          mux_playback_id?: string | null
          mux_status?: Database["public"]["Enums"]["academy_mux_status"] | null
          mux_upload_id?: string | null
          thumbnail_path?: string | null
          title: string
          video_path?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          id?: string
          lesson_type?: string
          module_id?: string
          mux_asset_id?: string | null
          mux_duration_seconds?: number | null
          mux_error_message?: string | null
          mux_playback_id?: string | null
          mux_status?: Database["public"]["Enums"]["academy_mux_status"] | null
          mux_upload_id?: string | null
          thumbnail_path?: string | null
          title?: string
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_modules: {
        Row: {
          course_id: string
          created_at: string | null
          display_order: number | null
          id: string
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string
          partner_user_id: string
          watch_time_seconds: number | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id: string
          partner_user_id: string
          watch_time_seconds?: number | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string
          partner_user_id?: string
          watch_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_progress_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_ai_insights: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          anomalies: Json
          generated_at: string
          id: string
          kpis: Json
          model: string | null
          period_end: string
          period_start: string
          recommendations: Json
          summary: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          anomalies?: Json
          generated_at?: string
          id?: string
          kpis?: Json
          model?: string | null
          period_end: string
          period_start: string
          recommendations?: Json
          summary: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          anomalies?: Json
          generated_at?: string
          id?: string
          kpis?: Json
          model?: string | null
          period_end?: string
          period_start?: string
          recommendations?: Json
          summary?: string
        }
        Relationships: []
      }
      accounting_anomalies: {
        Row: {
          anomaly_type: string
          description: string | null
          detected_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          anomaly_type: string
          description?: string | null
          detected_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          anomaly_type?: string
          description?: string | null
          detected_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      accounting_ar_customers: {
        Row: {
          country_code: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      accounting_ar_invoices: {
        Row: {
          amount: number
          amount_usd: number
          cost_center_id: string | null
          created_at: string
          created_by: string
          currency: string
          customer_id: string
          due_date: string
          fx_rate: number
          geography_id: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_at: string | null
          revenue_category_id: string | null
          revenue_source_id: string | null
          status: string
          tax_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          amount_usd: number
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          currency: string
          customer_id: string
          due_date: string
          fx_rate?: number
          geography_id?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          notes?: string | null
          paid_at?: string | null
          revenue_category_id?: string | null
          revenue_source_id?: string | null
          status?: string
          tax_amount?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_usd?: number
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string
          due_date?: string
          fx_rate?: number
          geography_id?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          revenue_category_id?: string | null
          revenue_source_id?: string | null
          status?: string
          tax_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_ar_invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_ar_invoices_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "accounting_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounting_ar_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "accounting_ar_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_ar_invoices_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "accounting_geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_ar_invoices_revenue_category_id_fkey"
            columns: ["revenue_category_id"]
            isOneToOne: false
            referencedRelation: "accounting_revenue_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_ar_invoices_revenue_source_id_fkey"
            columns: ["revenue_source_id"]
            isOneToOne: false
            referencedRelation: "accounting_revenue_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_assets: {
        Row: {
          acquisition_cost_original: number
          acquisition_cost_usd: number
          acquisition_date: string
          asset_type: string
          created_at: string
          created_by: string | null
          currency_original: string
          description: string | null
          disposal_date: string | null
          disposal_value_usd: number | null
          entity_id: string | null
          expense_id: string | null
          fx_rate_to_usd: number
          id: string
          name: string
          salvage_value_usd: number
          status: string
          updated_at: string
          useful_life_months: number
        }
        Insert: {
          acquisition_cost_original: number
          acquisition_cost_usd: number
          acquisition_date: string
          asset_type?: string
          created_at?: string
          created_by?: string | null
          currency_original?: string
          description?: string | null
          disposal_date?: string | null
          disposal_value_usd?: number | null
          entity_id?: string | null
          expense_id?: string | null
          fx_rate_to_usd?: number
          id?: string
          name: string
          salvage_value_usd?: number
          status?: string
          updated_at?: string
          useful_life_months?: number
        }
        Update: {
          acquisition_cost_original?: number
          acquisition_cost_usd?: number
          acquisition_date?: string
          asset_type?: string
          created_at?: string
          created_by?: string | null
          currency_original?: string
          description?: string | null
          disposal_date?: string | null
          disposal_value_usd?: number | null
          entity_id?: string | null
          expense_id?: string | null
          fx_rate_to_usd?: number
          id?: string
          name?: string
          salvage_value_usd?: number
          status?: string
          updated_at?: string
          useful_life_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounting_assets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "accounting_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_assets_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "accounting_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      accounting_bank_statement_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          direction: string
          id: string
          match_status: string
          matched_id: string | null
          matched_type: string | null
          notes: string | null
          reference: string | null
          statement_id: string
          txn_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          direction: string
          id?: string
          match_status?: string
          matched_id?: string | null
          matched_type?: string | null
          notes?: string | null
          reference?: string | null
          statement_id: string
          txn_date: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          direction?: string
          id?: string
          match_status?: string
          matched_id?: string | null
          matched_type?: string | null
          notes?: string | null
          reference?: string | null
          statement_id?: string
          txn_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_bank_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "accounting_bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_bank_statements: {
        Row: {
          closing_balance: number
          created_at: string
          currency: string
          file_name: string | null
          id: string
          opening_balance: number
          payment_method_id: string
          period_end: string
          period_start: string
          status: string
          uploaded_by: string
        }
        Insert: {
          closing_balance?: number
          created_at?: string
          currency: string
          file_name?: string | null
          id?: string
          opening_balance?: number
          payment_method_id: string
          period_end: string
          period_start: string
          status?: string
          uploaded_by: string
        }
        Update: {
          closing_balance?: number
          created_at?: string
          currency?: string
          file_name?: string | null
          id?: string
          opening_balance?: number
          payment_method_id?: string
          period_end?: string
          period_start?: string
          status?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_bank_statements_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "accounting_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounting_bank_statements_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "accounting_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_budget_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_usd: number | null
          budget_line_id: string
          created_at: string
          id: string
          message: string
          period_label: string
          planned_usd: number | null
          severity: string
          variance_pct: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_usd?: number | null
          budget_line_id: string
          created_at?: string
          id?: string
          message: string
          period_label: string
          planned_usd?: number | null
          severity: string
          variance_pct?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_usd?: number | null
          budget_line_id?: string
          created_at?: string
          id?: string
          message?: string
          period_label?: string
          planned_usd?: number | null
          severity?: string
          variance_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_budget_alerts_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_budget_lines: {
        Row: {
          amount_planned_usd: number
          budget_id: string
          category_id: string | null
          cost_center_id: string | null
          created_at: string
          geography_id: string | null
          id: string
          notes: string | null
          period_granularity: string
        }
        Insert: {
          amount_planned_usd: number
          budget_id: string
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          geography_id?: string | null
          id?: string
          notes?: string | null
          period_granularity?: string
        }
        Update: {
          amount_planned_usd?: number
          budget_id?: string
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          geography_id?: string | null
          id?: string
          notes?: string | null
          period_granularity?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "accounting_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_budget_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "accounting_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_budget_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_budget_lines_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "accounting_geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_budgets: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          id: string
          name: string
          notes: string | null
          period_end: string
          period_start: string
          scope: string
          scope_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          name: string
          notes?: string | null
          period_end: string
          period_start: string
          scope?: string
          scope_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          name?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          scope?: string
          scope_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_budgets_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "accounting_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      accounting_cards: {
        Row: {
          alias: string
          bank: string | null
          brand: string
          card_type: string
          created_at: string
          created_by: string | null
          credit_limit: number | null
          currency: string
          id: string
          is_active: boolean
          last4: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alias: string
          bank?: string | null
          brand?: string
          card_type: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency?: string
          id?: string
          is_active?: boolean
          last4: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alias?: string
          bank?: string | null
          brand?: string
          card_type?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          currency?: string
          id?: string
          is_active?: boolean
          last4?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      accounting_chat_messages: {
        Row: {
          content: string
          context: Json | null
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          context?: Json | null
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          context?: Json | null
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      accounting_cost_centers: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      accounting_currencies: {
        Row: {
          code: string
          created_at: string
          decimal_places: number
          is_active: boolean
          is_functional: boolean
          name: string
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string
          decimal_places?: number
          is_active?: boolean
          is_functional?: boolean
          name: string
          symbol: string
        }
        Update: {
          code?: string
          created_at?: string
          decimal_places?: number
          is_active?: boolean
          is_functional?: boolean
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      accounting_depreciation_entries: {
        Row: {
          accumulated_usd: number
          amount_usd: number
          asset_id: string
          book_value_usd: number
          created_at: string
          id: string
          period_month: number
          period_year: number
        }
        Insert: {
          accumulated_usd: number
          amount_usd: number
          asset_id: string
          book_value_usd: number
          created_at?: string
          id?: string
          period_month: number
          period_year: number
        }
        Update: {
          accumulated_usd?: number
          amount_usd?: number
          asset_id?: string
          book_value_usd?: number
          created_at?: string
          id?: string
          period_month?: number
          period_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounting_depreciation_entries_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "accounting_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_entities: {
        Row: {
          base_currency: string
          country_code: string | null
          created_at: string
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          notes: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          base_currency?: string
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          notes?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          base_currency?: string
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          notes?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      accounting_expense_categories: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounting_expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_expenses: {
        Row: {
          amount_original: number
          amount_usd: number | null
          attachments: Json | null
          card_id: string | null
          category_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          currency_original: string
          description: string
          entity_id: string | null
          expense_date: string
          funding_source: string | null
          fx_rate_to_usd: number | null
          geography_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method_id: string | null
          reimbursed_at: string | null
          reimbursed_by: string | null
          reimbursement_status: string
          status: string
          updated_at: string
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          amount_original: number
          amount_usd?: number | null
          attachments?: Json | null
          card_id?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          currency_original: string
          description: string
          entity_id?: string | null
          expense_date: string
          funding_source?: string | null
          fx_rate_to_usd?: number | null
          geography_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method_id?: string | null
          reimbursed_at?: string | null
          reimbursed_by?: string | null
          reimbursement_status?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount_original?: number
          amount_usd?: number | null
          attachments?: Json | null
          card_id?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          currency_original?: string
          description?: string
          entity_id?: string | null
          expense_date?: string
          funding_source?: string | null
          fx_rate_to_usd?: number | null
          geography_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method_id?: string | null
          reimbursed_at?: string | null
          reimbursed_by?: string | null
          reimbursement_status?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_expenses_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "accounting_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "accounting_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_expenses_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_expenses_currency_original_fkey"
            columns: ["currency_original"]
            isOneToOne: false
            referencedRelation: "accounting_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounting_expenses_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "accounting_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_expenses_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "accounting_geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "accounting_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_expenses_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "accounting_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "accounting_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_fiscal_periods: {
        Row: {
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          name: string
          notes: string | null
          period_end: string
          period_start: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          name: string
          notes?: string | null
          period_end: string
          period_start: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          name?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: string
        }
        Relationships: []
      }
      accounting_fx_rates: {
        Row: {
          created_at: string
          currency_from: string
          currency_to: string
          id: string
          rate: number
          rate_date: string
          source: string
        }
        Insert: {
          created_at?: string
          currency_from: string
          currency_to: string
          id?: string
          rate: number
          rate_date: string
          source?: string
        }
        Update: {
          created_at?: string
          currency_from?: string
          currency_to?: string
          id?: string
          rate?: number
          rate_date?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_fx_rates_currency_from_fkey"
            columns: ["currency_from"]
            isOneToOne: false
            referencedRelation: "accounting_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounting_fx_rates_currency_to_fkey"
            columns: ["currency_to"]
            isOneToOne: false
            referencedRelation: "accounting_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      accounting_geographies: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      accounting_invoices: {
        Row: {
          amount_original: number | null
          card_id: string | null
          created_at: string
          currency_original: string | null
          due_date: string | null
          file_name: string | null
          file_url: string
          id: string
          invoice_number: string | null
          issue_date: string | null
          notes: string | null
          ocr_confidence: number | null
          ocr_raw: Json | null
          paid_at: string | null
          payment_method_id: string | null
          payment_status: string
          rejected_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tax_amount: number | null
          updated_at: string
          uploaded_by: string
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount_original?: number | null
          card_id?: string | null
          created_at?: string
          currency_original?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          notes?: string | null
          ocr_confidence?: number | null
          ocr_raw?: Json | null
          paid_at?: string | null
          payment_method_id?: string | null
          payment_status?: string
          rejected_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tax_amount?: number | null
          updated_at?: string
          uploaded_by: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount_original?: number | null
          card_id?: string | null
          created_at?: string
          currency_original?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          notes?: string | null
          ocr_confidence?: number | null
          ocr_raw?: Json | null
          paid_at?: string | null
          payment_method_id?: string | null
          payment_status?: string
          rejected_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tax_amount?: number | null
          updated_at?: string
          uploaded_by?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_invoices_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "accounting_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_currency_original_fkey"
            columns: ["currency_original"]
            isOneToOne: false
            referencedRelation: "accounting_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounting_invoices_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "accounting_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "accounting_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          metadata: Json
          notification_type: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json
          notification_type: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json
          notification_type?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      accounting_payment_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
        }
        Relationships: []
      }
      accounting_revenue_categories: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      accounting_revenue_sources: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          source_type: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          source_type: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          source_type?: string
        }
        Relationships: []
      }
      accounting_revenues: {
        Row: {
          amount_original: number
          amount_usd: number | null
          attachments: Json | null
          category_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          currency_original: string
          description: string
          entity_id: string | null
          external_ref: string | null
          fx_rate_to_usd: number | null
          geography_id: string | null
          id: string
          notes: string | null
          revenue_date: string
          source_id: string | null
          updated_at: string
        }
        Insert: {
          amount_original: number
          amount_usd?: number | null
          attachments?: Json | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          currency_original: string
          description: string
          entity_id?: string | null
          external_ref?: string | null
          fx_rate_to_usd?: number | null
          geography_id?: string | null
          id?: string
          notes?: string | null
          revenue_date: string
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_original?: number
          amount_usd?: number | null
          attachments?: Json | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          currency_original?: string
          description?: string
          entity_id?: string | null
          external_ref?: string | null
          fx_rate_to_usd?: number | null
          geography_id?: string | null
          id?: string
          notes?: string | null
          revenue_date?: string
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_revenues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "accounting_revenue_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_revenues_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_revenues_currency_original_fkey"
            columns: ["currency_original"]
            isOneToOne: false
            referencedRelation: "accounting_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounting_revenues_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "accounting_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_revenues_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "accounting_geographies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_revenues_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "accounting_revenue_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_tax_rates: {
        Row: {
          created_at: string
          geography_id: string | null
          id: string
          is_active: boolean
          name: string
          rate_pct: number
        }
        Insert: {
          created_at?: string
          geography_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate_pct: number
        }
        Update: {
          created_at?: string
          geography_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounting_tax_rates_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "accounting_geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_tournament_sync_log: {
        Row: {
          amount_usd: number | null
          expense_id: string | null
          id: string
          notes: string | null
          revenue_id: string | null
          synced_at: string
          tournament_order_id: string
        }
        Insert: {
          amount_usd?: number | null
          expense_id?: string | null
          id?: string
          notes?: string | null
          revenue_id?: string | null
          synced_at?: string
          tournament_order_id: string
        }
        Update: {
          amount_usd?: number | null
          expense_id?: string | null
          id?: string
          notes?: string | null
          revenue_id?: string | null
          synced_at?: string
          tournament_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_tournament_sync_log_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "accounting_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_tournament_sync_log_revenue_id_fkey"
            columns: ["revenue_id"]
            isOneToOne: false
            referencedRelation: "accounting_revenues"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_treasury_transfer_expenses: {
        Row: {
          amount_applied_usd: number
          applied_by: string
          created_at: string
          expense_id: string
          id: string
          transfer_id: string
        }
        Insert: {
          amount_applied_usd: number
          applied_by: string
          created_at?: string
          expense_id: string
          id?: string
          transfer_id: string
        }
        Update: {
          amount_applied_usd?: number
          applied_by?: string
          created_at?: string
          expense_id?: string
          id?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_treasury_transfer_expenses_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "accounting_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_treasury_transfer_expenses_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "accounting_treasury_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_treasury_transfer_notes: {
        Row: {
          attachment_url: string | null
          author_user_id: string
          created_at: string
          id: string
          note: string
          transfer_id: string
        }
        Insert: {
          attachment_url?: string | null
          author_user_id: string
          created_at?: string
          id?: string
          note: string
          transfer_id: string
        }
        Update: {
          attachment_url?: string | null
          author_user_id?: string
          created_at?: string
          id?: string
          note?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_treasury_transfer_notes_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "accounting_treasury_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_treasury_transfers: {
        Row: {
          amount_justified_usd: number
          amount_original: number
          amount_usd: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          currency_original: string
          due_days: number | null
          entity_id: string | null
          expected_category_id: string | null
          fx_rate_to_usd: number | null
          geography_id: string | null
          id: string
          method: string | null
          purpose: string
          recipient_acknowledged_at: string | null
          recipient_user_id: string
          sender_proof_uploaded_at: string | null
          sender_proof_url: string | null
          sender_user_id: string
          status: string
          transfer_date: string
          updated_at: string
        }
        Insert: {
          amount_justified_usd?: number
          amount_original: number
          amount_usd?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          currency_original: string
          due_days?: number | null
          entity_id?: string | null
          expected_category_id?: string | null
          fx_rate_to_usd?: number | null
          geography_id?: string | null
          id?: string
          method?: string | null
          purpose: string
          recipient_acknowledged_at?: string | null
          recipient_user_id: string
          sender_proof_uploaded_at?: string | null
          sender_proof_url?: string | null
          sender_user_id: string
          status?: string
          transfer_date: string
          updated_at?: string
        }
        Update: {
          amount_justified_usd?: number
          amount_original?: number
          amount_usd?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          currency_original?: string
          due_days?: number | null
          entity_id?: string | null
          expected_category_id?: string | null
          fx_rate_to_usd?: number | null
          geography_id?: string | null
          id?: string
          method?: string | null
          purpose?: string
          recipient_acknowledged_at?: string | null
          recipient_user_id?: string
          sender_proof_uploaded_at?: string | null
          sender_proof_url?: string | null
          sender_user_id?: string
          status?: string
          transfer_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_treasury_transfers_currency_original_fkey"
            columns: ["currency_original"]
            isOneToOne: false
            referencedRelation: "accounting_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounting_treasury_transfers_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "accounting_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_treasury_transfers_expected_category_id_fkey"
            columns: ["expected_category_id"]
            isOneToOne: false
            referencedRelation: "accounting_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_treasury_transfers_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "accounting_geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_vendors: {
        Row: {
          created_at: string
          email: string | null
          geography_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          geography_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          geography_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_vendors_geography_id_fkey"
            columns: ["geography_id"]
            isOneToOne: false
            referencedRelation: "accounting_geographies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_learning_log: {
        Row: {
          agent_name: string
          context_data: Json | null
          created_at: string
          edition_id: string | null
          id: string
          lesson_learned: string | null
          metric_type: string
          metric_value: number | null
        }
        Insert: {
          agent_name: string
          context_data?: Json | null
          created_at?: string
          edition_id?: string | null
          id?: string
          lesson_learned?: string | null
          metric_type: string
          metric_value?: number | null
        }
        Update: {
          agent_name?: string
          context_data?: Json | null
          created_at?: string
          edition_id?: string | null
          id?: string
          lesson_learned?: string | null
          metric_type?: string
          metric_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_learning_log_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bce_call_flows: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          objetivo: string
          tipo_lead: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          objetivo: string
          tipo_lead: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          objetivo?: string
          tipo_lead?: string
        }
        Relationships: []
      }
      bce_call_sessions: {
        Row: {
          bd_id: string
          capital: string | null
          created_at: string
          ended_at: string | null
          experiencia: string | null
          fase_actual: string | null
          flow_id: string | null
          id: string
          interes: string | null
          is_training: boolean | null
          medallas: string[] | null
          notas: string | null
          objeciones_detectadas: string[] | null
          objeciones_manejadas: number | null
          probabilidad_cierre: number | null
          respuestas_usadas: number | null
          resultado: string | null
          score: number | null
          started_at: string
          temperatura: string | null
        }
        Insert: {
          bd_id: string
          capital?: string | null
          created_at?: string
          ended_at?: string | null
          experiencia?: string | null
          fase_actual?: string | null
          flow_id?: string | null
          id?: string
          interes?: string | null
          is_training?: boolean | null
          medallas?: string[] | null
          notas?: string | null
          objeciones_detectadas?: string[] | null
          objeciones_manejadas?: number | null
          probabilidad_cierre?: number | null
          respuestas_usadas?: number | null
          resultado?: string | null
          score?: number | null
          started_at?: string
          temperatura?: string | null
        }
        Update: {
          bd_id?: string
          capital?: string | null
          created_at?: string
          ended_at?: string | null
          experiencia?: string | null
          fase_actual?: string | null
          flow_id?: string | null
          id?: string
          interes?: string | null
          is_training?: boolean | null
          medallas?: string[] | null
          notas?: string | null
          objeciones_detectadas?: string[] | null
          objeciones_manejadas?: number | null
          probabilidad_cierre?: number | null
          respuestas_usadas?: number | null
          resultado?: string | null
          score?: number | null
          started_at?: string
          temperatura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bce_call_sessions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "bce_call_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      bce_objections: {
        Row: {
          categoria: string | null
          cierre_sugerido: string
          contra_pregunta: string
          created_at: string
          id: string
          reframe: string
          respuesta_emocional: string
          respuesta_logica: string
          source: string | null
          texto_objecion: string
        }
        Insert: {
          categoria?: string | null
          cierre_sugerido: string
          contra_pregunta: string
          created_at?: string
          id?: string
          reframe: string
          respuesta_emocional: string
          respuesta_logica: string
          source?: string | null
          texto_objecion: string
        }
        Update: {
          categoria?: string | null
          cierre_sugerido?: string
          contra_pregunta?: string
          created_at?: string
          id?: string
          reframe?: string
          respuesta_emocional?: string
          respuesta_logica?: string
          source?: string | null
          texto_objecion?: string
        }
        Relationships: []
      }
      bce_scripts: {
        Row: {
          created_at: string
          fase: string
          flow_id: string
          id: string
          orden: number
          texto_corto: string
        }
        Insert: {
          created_at?: string
          fase: string
          flow_id: string
          id?: string
          orden?: number
          texto_corto: string
        }
        Update: {
          created_at?: string
          fase?: string
          flow_id?: string
          id?: string
          orden?: number
          texto_corto?: string
        }
        Relationships: [
          {
            foreignKeyName: "bce_scripts_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "bce_call_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_prospects: {
        Row: {
          bd_user_id: string
          correo: string | null
          created_at: string
          empresa: string | null
          id: string
          nombre: string
          notas: string | null
          opportunity_score: number
          pais: string | null
          pipeline_stage_id: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          bd_user_id: string
          correo?: string | null
          created_at?: string
          empresa?: string | null
          id?: string
          nombre: string
          notas?: string | null
          opportunity_score?: number
          pais?: string | null
          pipeline_stage_id?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          bd_user_id?: string
          correo?: string | null
          created_at?: string
          empresa?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          opportunity_score?: number
          pais?: string | null
          pipeline_stage_id?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_prospects_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_analysis_history: {
        Row: {
          agent_count: number | null
          analysis_data: Json
          asset_type: string
          campaign_name: string
          consensus_score: number | null
          copy_text: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          viral_potential: string | null
        }
        Insert: {
          agent_count?: number | null
          analysis_data: Json
          asset_type?: string
          campaign_name?: string
          consensus_score?: number | null
          copy_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          viral_potential?: string | null
        }
        Update: {
          agent_count?: number | null
          analysis_data?: Json
          asset_type?: string
          campaign_name?: string
          consensus_score?: number | null
          copy_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          viral_potential?: string | null
        }
        Relationships: []
      }
      breaking_news: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string
          headline: string
          id: string
          proposed_by: string
          proposed_by_emoji: string | null
          raw_data: Json | null
          sent_at: string | null
          source: string
          source_url: string | null
          status: string
          summary: string
          updated_at: string
          urgency_score: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          headline: string
          id?: string
          proposed_by: string
          proposed_by_emoji?: string | null
          raw_data?: Json | null
          sent_at?: string | null
          source: string
          source_url?: string | null
          status?: string
          summary: string
          updated_at?: string
          urgency_score?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          headline?: string
          id?: string
          proposed_by?: string
          proposed_by_emoji?: string | null
          raw_data?: Json | null
          sent_at?: string | null
          source?: string
          source_url?: string | null
          status?: string
          summary?: string
          updated_at?: string
          urgency_score?: number
        }
        Relationships: []
      }
      bridge_account_snapshot: {
        Row: {
          account_id: string
          balance: number | null
          bridge_login: string
          created_at: string
          equity: number | null
          fetch_error: string | null
          free_margin: number | null
          margin: number | null
          open_positions: Json
          partner_user_id: string
          payload_hash: string | null
          portal_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          balance?: number | null
          bridge_login: string
          created_at?: string
          equity?: number | null
          fetch_error?: string | null
          free_margin?: number | null
          margin?: number | null
          open_positions?: Json
          partner_user_id: string
          payload_hash?: string | null
          portal_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          balance?: number | null
          bridge_login?: string
          created_at?: string
          equity?: number | null
          fetch_error?: string | null
          free_margin?: number | null
          margin?: number | null
          open_positions?: Json
          partner_user_id?: string
          payload_hash?: string | null
          portal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bridge_account_snapshot_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "trading_room_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_prop_settings: {
        Row: {
          created_at: string
          ganancia_broker: number
          id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          ganancia_broker?: number
          id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          ganancia_broker?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      broker_symbols: {
        Row: {
          base_currency: string | null
          category: string | null
          contract_size: number | null
          created_at: string
          description: string | null
          digits: number | null
          enabled: boolean
          id: string
          last_synced_at: string
          max_volume: number | null
          min_volume: number | null
          quote_currency: string | null
          raw_data: Json | null
          symbol: string
          tick_size: number | null
          tick_value: number | null
          updated_at: string
          volume_step: number | null
        }
        Insert: {
          base_currency?: string | null
          category?: string | null
          contract_size?: number | null
          created_at?: string
          description?: string | null
          digits?: number | null
          enabled?: boolean
          id?: string
          last_synced_at?: string
          max_volume?: number | null
          min_volume?: number | null
          quote_currency?: string | null
          raw_data?: Json | null
          symbol: string
          tick_size?: number | null
          tick_value?: number | null
          updated_at?: string
          volume_step?: number | null
        }
        Update: {
          base_currency?: string | null
          category?: string | null
          contract_size?: number | null
          created_at?: string
          description?: string | null
          digits?: number | null
          enabled?: boolean
          id?: string
          last_synced_at?: string
          max_volume?: number | null
          min_volume?: number | null
          quote_currency?: string | null
          raw_data?: Json | null
          symbol?: string
          tick_size?: number | null
          tick_value?: number | null
          updated_at?: string
          volume_step?: number | null
        }
        Relationships: []
      }
      broker_symbols_sync_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          inserted_count: number | null
          status: string
          symbols_count: number | null
          triggered_by: string | null
          updated_count: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          inserted_count?: number | null
          status: string
          symbols_count?: number | null
          triggered_by?: string | null
          updated_count?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          inserted_count?: number | null
          status?: string
          symbols_count?: number | null
          triggered_by?: string | null
          updated_count?: number | null
        }
        Relationships: []
      }
      bullfy_family_room_members: {
        Row: {
          created_at: string
          id: string
          notified_at: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified_at?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notified_at?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bullfy_family_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events_log: {
        Row: {
          connection_id: string | null
          created_at: string
          delivery_method: string
          description: string | null
          ends_at: string
          error_message: string | null
          google_event_id: string | null
          google_event_link: string | null
          id: string
          last_action: string | null
          recipient_email: string | null
          source_id: string | null
          source_type: string
          starts_at: string
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          delivery_method?: string
          description?: string | null
          ends_at: string
          error_message?: string | null
          google_event_id?: string | null
          google_event_link?: string | null
          id?: string
          last_action?: string | null
          recipient_email?: string | null
          source_id?: string | null
          source_type: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          delivery_method?: string
          description?: string | null
          ends_at?: string
          error_message?: string | null
          google_event_id?: string | null
          google_event_link?: string | null
          id?: string
          last_action?: string | null
          recipient_email?: string | null
          source_id?: string | null
          source_type?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_analyses: {
        Row: {
          analyzed_by: string | null
          asset_name: string | null
          asset_type: string
          asset_url: string
          copy_text: string | null
          created_at: string
          id: string
          impact_score: number | null
          raw_analysis: string | null
          segment_analysis: Json | null
          suggestions: Json | null
          updated_at: string
        }
        Insert: {
          analyzed_by?: string | null
          asset_name?: string | null
          asset_type?: string
          asset_url: string
          copy_text?: string | null
          created_at?: string
          id?: string
          impact_score?: number | null
          raw_analysis?: string | null
          segment_analysis?: Json | null
          suggestions?: Json | null
          updated_at?: string
        }
        Update: {
          analyzed_by?: string | null
          asset_name?: string | null
          asset_type?: string
          asset_url?: string
          copy_text?: string | null
          created_at?: string
          id?: string
          impact_score?: number | null
          raw_analysis?: string | null
          segment_analysis?: Json | null
          suggestions?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      campaign_ib_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          campaign_id: string
          ib_id: string
          id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          campaign_id: string
          ib_id: string
          id?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          campaign_id?: string
          ib_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_ib_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_presentations: {
        Row: {
          analysis_data: Json
          campaign_name: string
          copy_text: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          slug: string
        }
        Insert: {
          analysis_data: Json
          campaign_name?: string
          copy_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          slug: string
        }
        Update: {
          analysis_data?: Json
          campaign_name?: string
          copy_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          slug?: string
        }
        Relationships: []
      }
      campaign_task_completions: {
        Row: {
          assignment_id: string
          completed_at: string
          id: string
          task_id: string
        }
        Insert: {
          assignment_id: string
          completed_at?: string
          id?: string
          task_id: string
        }
        Update: {
          assignment_id?: string
          completed_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_task_completions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "campaign_ib_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "campaign_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_tasks: {
        Row: {
          campaign_id: string
          content_type: string
          created_at: string
          day_number: number
          display_order: number
          file_urls: string[] | null
          id: string
          instruction: string
          title: string
        }
        Insert: {
          campaign_id: string
          content_type?: string
          created_at?: string
          day_number?: number
          display_order?: number
          file_urls?: string[] | null
          id?: string
          instruction: string
          title: string
        }
        Update: {
          campaign_id?: string
          content_type?: string
          created_at?: string
          day_number?: number
          display_order?: number
          file_urls?: string[] | null
          id?: string
          instruction?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      clip_carousels: {
        Row: {
          caption: string | null
          cards: Json
          clip_id: string | null
          created_at: string
          created_by: string | null
          id: string
          status: string
          title: string | null
        }
        Insert: {
          caption?: string | null
          cards?: Json
          clip_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          title?: string | null
        }
        Update: {
          caption?: string | null
          cards?: Json
          clip_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clip_carousels_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "video_clips"
            referencedColumns: ["id"]
          },
        ]
      }
      clip_variants: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          hook_offset_seconds: number
          id: string
          metrics: Json | null
          output_url: string | null
          parent_clip_id: string
          render_status: string
          shotstack_render_id: string | null
          updated_at: string
          variant_label: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          hook_offset_seconds?: number
          id?: string
          metrics?: Json | null
          output_url?: string | null
          parent_clip_id: string
          render_status?: string
          shotstack_render_id?: string | null
          updated_at?: string
          variant_label: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          hook_offset_seconds?: number
          id?: string
          metrics?: Json | null
          output_url?: string | null
          parent_clip_id?: string
          render_status?: string
          shotstack_render_id?: string | null
          updated_at?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "clip_variants_parent_clip_id_fkey"
            columns: ["parent_clip_id"]
            isOneToOne: false
            referencedRelation: "video_clips"
            referencedColumns: ["id"]
          },
        ]
      }
      clip_voiceovers: {
        Row: {
          audio_url: string | null
          clip_id: string
          created_at: string
          created_by: string | null
          id: string
          language: string
          output_video_url: string | null
          shotstack_render_id: string | null
          status: string
          text_used: string
          voice_id: string
          voice_name: string | null
        }
        Insert: {
          audio_url?: string | null
          clip_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          output_video_url?: string | null
          shotstack_render_id?: string | null
          status?: string
          text_used: string
          voice_id: string
          voice_name?: string | null
        }
        Update: {
          audio_url?: string | null
          clip_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          output_video_url?: string | null
          shotstack_render_id?: string | null
          status?: string
          text_used?: string
          voice_id?: string
          voice_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clip_voiceovers_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "video_clips"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_community_assignments: {
        Row: {
          assigned_by: string | null
          closer_user_id: string
          created_at: string
          id: string
          portal_id: string
        }
        Insert: {
          assigned_by?: string | null
          closer_user_id: string
          created_at?: string
          id?: string
          portal_id: string
        }
        Update: {
          assigned_by?: string | null
          closer_user_id?: string
          created_at?: string
          id?: string
          portal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closer_community_assignments_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      cta_file_downloads: {
        Row: {
          cta_file_id: string
          downloaded_at: string
          host_id: string | null
          id: string
          room_id: string | null
          user_agent: string | null
          viewer_email: string | null
          viewer_id: string | null
          viewer_name: string | null
        }
        Insert: {
          cta_file_id: string
          downloaded_at?: string
          host_id?: string | null
          id?: string
          room_id?: string | null
          user_agent?: string | null
          viewer_email?: string | null
          viewer_id?: string | null
          viewer_name?: string | null
        }
        Update: {
          cta_file_id?: string
          downloaded_at?: string
          host_id?: string | null
          id?: string
          room_id?: string | null
          user_agent?: string | null
          viewer_email?: string | null
          viewer_id?: string | null
          viewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cta_file_downloads_cta_file_id_fkey"
            columns: ["cta_file_id"]
            isOneToOne: false
            referencedRelation: "host_cta_files"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          archivo_path: string
          created_at: string
          id: string
          nombre: string
          uploaded_by: string
        }
        Insert: {
          archivo_path: string
          created_at?: string
          id?: string
          nombre: string
          uploaded_by: string
        }
        Update: {
          archivo_path?: string
          created_at?: string
          id?: string
          nombre?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      experience_lead_history: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          lead_id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          lead_id: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          lead_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experience_lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "experience_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_leads: {
        Row: {
          assigned_at: string | null
          assigned_bd: string | null
          assigned_by: string | null
          badges: string[] | null
          comentario: string | null
          converted_at: string | null
          correo: string | null
          created_at: string
          discarded_at: string | null
          empresa: string | null
          id: string
          interes: string | null
          level: string | null
          nombre: string | null
          notas_bd: string | null
          opportunity_score: number | null
          pais: string | null
          progress_stage: number | null
          session_id: string
          status: string
          tamano_comunidad: string | null
          telefono: string | null
          tools_used: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_bd?: string | null
          assigned_by?: string | null
          badges?: string[] | null
          comentario?: string | null
          converted_at?: string | null
          correo?: string | null
          created_at?: string
          discarded_at?: string | null
          empresa?: string | null
          id?: string
          interes?: string | null
          level?: string | null
          nombre?: string | null
          notas_bd?: string | null
          opportunity_score?: number | null
          pais?: string | null
          progress_stage?: number | null
          session_id: string
          status?: string
          tamano_comunidad?: string | null
          telefono?: string | null
          tools_used?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_bd?: string | null
          assigned_by?: string | null
          badges?: string[] | null
          comentario?: string | null
          converted_at?: string | null
          correo?: string | null
          created_at?: string
          discarded_at?: string | null
          empresa?: string | null
          id?: string
          interes?: string | null
          level?: string | null
          nombre?: string | null
          notas_bd?: string | null
          opportunity_score?: number | null
          pais?: string | null
          progress_stage?: number | null
          session_id?: string
          status?: string
          tamano_comunidad?: string | null
          telefono?: string | null
          tools_used?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      experience_simulations: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          lead_id: string | null
          results: Json
          session_id: string
          tool_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs?: Json
          lead_id?: string | null
          results?: Json
          session_id: string
          tool_name: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          lead_id?: string | null
          results?: Json
          session_id?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_simulations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "experience_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          error_message: string | null
          event_type: string
          function_name: string
          gateway: string | null
          id: string
          occurred_at: string
          order_id: string | null
          partner_user_id: string | null
          payload: Json | null
          portal_id: string | null
          result: string
          withdrawal_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_type: string
          function_name: string
          gateway?: string | null
          id?: string
          occurred_at?: string
          order_id?: string | null
          partner_user_id?: string | null
          payload?: Json | null
          portal_id?: string | null
          result?: string
          withdrawal_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_type?: string
          function_name?: string
          gateway?: string | null
          id?: string
          occurred_at?: string
          order_id?: string | null
          partner_user_id?: string | null
          payload?: Json | null
          portal_id?: string | null
          result?: string
          withdrawal_id?: string | null
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          account_type: string
          active: boolean
          calendar_id: string
          created_at: string
          google_email: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          refresh_token: string
          scopes: string[]
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_type: string
          active?: boolean
          calendar_id?: string
          created_at?: string
          google_email: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token: string
          scopes?: string[]
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_type?: string
          active?: boolean
          calendar_id?: string
          created_at?: string
          google_email?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token?: string
          scopes?: string[]
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      host_cta_files: {
        Row: {
          button_text: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          file_url: string
          id: string
          mime_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          button_text?: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number
          file_url: string
          id?: string
          mime_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          button_text?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_url?: string
          id?: string
          mime_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ib_bd_history: {
        Row: {
          bd_anterior_id: string | null
          bd_anterior_nombre: string
          bd_nuevo_id: string | null
          bd_nuevo_nombre: string
          created_at: string
          ib_id: string
          id: string
          reasignado_por: string | null
        }
        Insert: {
          bd_anterior_id?: string | null
          bd_anterior_nombre: string
          bd_nuevo_id?: string | null
          bd_nuevo_nombre: string
          created_at?: string
          ib_id: string
          id?: string
          reasignado_por?: string | null
        }
        Update: {
          bd_anterior_id?: string | null
          bd_anterior_nombre?: string
          bd_nuevo_id?: string | null
          bd_nuevo_nombre?: string
          created_at?: string
          ib_id?: string
          id?: string
          reasignado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ib_bd_history_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      ib_cpa_config: {
        Row: {
          cpa_pagar: number
          created_at: string
          ib_id: string
          id: string
          rango_deposito: string
        }
        Insert: {
          cpa_pagar: number
          created_at?: string
          ib_id: string
          id?: string
          rango_deposito: string
        }
        Update: {
          cpa_pagar?: number
          created_at?: string
          ib_id?: string
          id?: string
          rango_deposito?: string
        }
        Relationships: [
          {
            foreignKeyName: "ib_cpa_config_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      ib_cpa_distribution: {
        Row: {
          correo: string
          created_at: string
          dolares_asignados: number
          es_sub_ib: boolean | null
          ib_id: string
          id: string
          nombre: string
          sub_ib_id: string | null
        }
        Insert: {
          correo: string
          created_at?: string
          dolares_asignados: number
          es_sub_ib?: boolean | null
          ib_id: string
          id?: string
          nombre: string
          sub_ib_id?: string | null
        }
        Update: {
          correo?: string
          created_at?: string
          dolares_asignados?: number
          es_sub_ib?: boolean | null
          ib_id?: string
          id?: string
          nombre?: string
          sub_ib_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ib_cpa_distribution_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ib_cpa_distribution_sub_ib_id_fkey"
            columns: ["sub_ib_id"]
            isOneToOne: false
            referencedRelation: "sub_ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      ib_external_request_history: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          performed_by: string | null
          request_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string | null
          request_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ib_external_request_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ib_external_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ib_external_requests: {
        Row: {
          attachments: Json
          bd_approved_at: string | null
          bd_approved_by: string | null
          bd_rejection_reason: string | null
          compensation_data: Json
          created_at: string
          dolares_por_lote_sub_ib: number
          ib_id: string
          id: string
          notes: string | null
          ops_assigned_to: string | null
          ops_completed_at: string | null
          ops_taken_at: string | null
          request_type: string
          requested_by: string
          status: string
          sub_ib_correo: string
          sub_ib_exists_in_system: boolean
          sub_ib_id_documento: string
          sub_ib_kyc_completed: boolean
          sub_ib_nombre: string
          sub_ib_tipo_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          bd_approved_at?: string | null
          bd_approved_by?: string | null
          bd_rejection_reason?: string | null
          compensation_data?: Json
          created_at?: string
          dolares_por_lote_sub_ib?: number
          ib_id: string
          id?: string
          notes?: string | null
          ops_assigned_to?: string | null
          ops_completed_at?: string | null
          ops_taken_at?: string | null
          request_type?: string
          requested_by: string
          status?: string
          sub_ib_correo: string
          sub_ib_exists_in_system?: boolean
          sub_ib_id_documento?: string
          sub_ib_kyc_completed?: boolean
          sub_ib_nombre: string
          sub_ib_tipo_id?: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          bd_approved_at?: string | null
          bd_approved_by?: string | null
          bd_rejection_reason?: string | null
          compensation_data?: Json
          created_at?: string
          dolares_por_lote_sub_ib?: number
          ib_id?: string
          id?: string
          notes?: string | null
          ops_assigned_to?: string | null
          ops_completed_at?: string | null
          ops_taken_at?: string | null
          request_type?: string
          requested_by?: string
          status?: string
          sub_ib_correo?: string
          sub_ib_exists_in_system?: boolean
          sub_ib_id_documento?: string
          sub_ib_kyc_completed?: boolean
          sub_ib_nombre?: string
          sub_ib_tipo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ib_external_requests_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      ib_hybrid_config: {
        Row: {
          cpa_pagar: number
          created_at: string
          dolares_por_lote: number
          ib_id: string
          id: string
          rango_deposito: string
        }
        Insert: {
          cpa_pagar: number
          created_at?: string
          dolares_por_lote: number
          ib_id: string
          id?: string
          rango_deposito: string
        }
        Update: {
          cpa_pagar?: number
          created_at?: string
          dolares_por_lote?: number
          ib_id?: string
          id?: string
          rango_deposito?: string
        }
        Relationships: [
          {
            foreignKeyName: "ib_hybrid_config_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      ib_portal_promotions: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          cta_text: string | null
          cta_url: string | null
          description: string
          display_order: number
          file_url: string | null
          id: string
          image_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          description: string
          display_order?: number
          file_url?: string | null
          id?: string
          image_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          description?: string
          display_order?: number
          file_url?: string | null
          id?: string
          image_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ib_propfirm_config: {
        Row: {
          created_at: string
          ib_id: string
          id: string
          porcentaje_comision: number
          rango_ventas: string
        }
        Insert: {
          created_at?: string
          ib_id: string
          id?: string
          porcentaje_comision: number
          rango_ventas: string
        }
        Update: {
          created_at?: string
          ib_id?: string
          id?: string
          porcentaje_comision?: number
          rango_ventas?: string
        }
        Relationships: [
          {
            foreignKeyName: "ib_propfirm_config_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      ib_spread_config: {
        Row: {
          created_at: string
          diferencia: number | null
          dolares_ib_original: number
          ib_id: string
          id: string
          nuevo_dolar_ib: number | null
          nuevo_spread_cliente: number | null
          raw: number
          spread_estandar: number
          symbol: string
        }
        Insert: {
          created_at?: string
          diferencia?: number | null
          dolares_ib_original: number
          ib_id: string
          id?: string
          nuevo_dolar_ib?: number | null
          nuevo_spread_cliente?: number | null
          raw: number
          spread_estandar: number
          symbol: string
        }
        Update: {
          created_at?: string
          diferencia?: number | null
          dolares_ib_original?: number
          ib_id?: string
          id?: string
          nuevo_dolar_ib?: number | null
          nuevo_spread_cliente?: number | null
          raw?: number
          spread_estandar?: number
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "ib_spread_config_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      ibs: {
        Row: {
          alias: string | null
          clientes_por_mes: number | null
          codigo_descuento: string | null
          comision_dolares_por_lote: number | null
          contacto_corporativo: string | null
          correo_ib: string
          created_at: string
          created_by: string | null
          cuentas_fondeo_vendidas: number | null
          cuentas_marketing_balance: number | null
          cuentas_marketing_cantidad: number | null
          cuentas_marketing_tipo: string | null
          depositos_por_mes: number | null
          direccion_empresa: string | null
          fondeo_especial_balance: number | null
          fondeo_regalo_balance: number | null
          fondeo_regalo_cantidad: number | null
          id: string
          id_ib: string
          id_representante: string | null
          kickoff_video_path: string | null
          lotes_por_mes: number | null
          lugar_operacion: string
          modelo_negocio: string
          negociaciones_especiales: string | null
          nombre_bd: string
          nombre_comunidad: string | null
          nombre_ib: string
          porcentaje_descuento: number | null
          preferred_timezone: string
          representante_legal: string | null
          status: string
          tiene_codigo_descuento: boolean | null
          tiene_comision_por_lote: boolean | null
          tiene_fondeo_especial: boolean | null
          tiene_fondeo_regalo: boolean | null
          tiene_sub_ibs: boolean
          tipo_acuerdo_brokeraje: string | null
          tipo_cuenta_fondeo: string | null
          tipo_grupo_cuentas: string | null
          tipo_id: string
          tipo_id_representante: string | null
          tipo_persona: string
          updated_at: string
          version: number
        }
        Insert: {
          alias?: string | null
          clientes_por_mes?: number | null
          codigo_descuento?: string | null
          comision_dolares_por_lote?: number | null
          contacto_corporativo?: string | null
          correo_ib: string
          created_at?: string
          created_by?: string | null
          cuentas_fondeo_vendidas?: number | null
          cuentas_marketing_balance?: number | null
          cuentas_marketing_cantidad?: number | null
          cuentas_marketing_tipo?: string | null
          depositos_por_mes?: number | null
          direccion_empresa?: string | null
          fondeo_especial_balance?: number | null
          fondeo_regalo_balance?: number | null
          fondeo_regalo_cantidad?: number | null
          id?: string
          id_ib: string
          id_representante?: string | null
          kickoff_video_path?: string | null
          lotes_por_mes?: number | null
          lugar_operacion: string
          modelo_negocio: string
          negociaciones_especiales?: string | null
          nombre_bd: string
          nombre_comunidad?: string | null
          nombre_ib: string
          porcentaje_descuento?: number | null
          preferred_timezone?: string
          representante_legal?: string | null
          status?: string
          tiene_codigo_descuento?: boolean | null
          tiene_comision_por_lote?: boolean | null
          tiene_fondeo_especial?: boolean | null
          tiene_fondeo_regalo?: boolean | null
          tiene_sub_ibs?: boolean
          tipo_acuerdo_brokeraje?: string | null
          tipo_cuenta_fondeo?: string | null
          tipo_grupo_cuentas?: string | null
          tipo_id: string
          tipo_id_representante?: string | null
          tipo_persona?: string
          updated_at?: string
          version?: number
        }
        Update: {
          alias?: string | null
          clientes_por_mes?: number | null
          codigo_descuento?: string | null
          comision_dolares_por_lote?: number | null
          contacto_corporativo?: string | null
          correo_ib?: string
          created_at?: string
          created_by?: string | null
          cuentas_fondeo_vendidas?: number | null
          cuentas_marketing_balance?: number | null
          cuentas_marketing_cantidad?: number | null
          cuentas_marketing_tipo?: string | null
          depositos_por_mes?: number | null
          direccion_empresa?: string | null
          fondeo_especial_balance?: number | null
          fondeo_regalo_balance?: number | null
          fondeo_regalo_cantidad?: number | null
          id?: string
          id_ib?: string
          id_representante?: string | null
          kickoff_video_path?: string | null
          lotes_por_mes?: number | null
          lugar_operacion?: string
          modelo_negocio?: string
          negociaciones_especiales?: string | null
          nombre_bd?: string
          nombre_comunidad?: string | null
          nombre_ib?: string
          porcentaje_descuento?: number | null
          preferred_timezone?: string
          representante_legal?: string | null
          status?: string
          tiene_codigo_descuento?: boolean | null
          tiene_comision_por_lote?: boolean | null
          tiene_fondeo_especial?: boolean | null
          tiene_fondeo_regalo?: boolean | null
          tiene_sub_ibs?: boolean
          tipo_acuerdo_brokeraje?: string | null
          tipo_cuenta_fondeo?: string | null
          tipo_grupo_cuentas?: string | null
          tipo_id?: string
          tipo_id_representante?: string | null
          tipo_persona?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          service_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          service_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          service_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          details: string | null
          id: string
          lead_id: string
          performed_by: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          details?: string | null
          id?: string
          lead_id: string
          performed_by?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          details?: string | null
          id?: string
          lead_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          accepted_at: string | null
          agent_id: string
          assigned_by: string | null
          assignment_type: string
          completed_at: string | null
          created_at: string
          expired_at: string | null
          id: string
          lead_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agent_id: string
          assigned_by?: string | null
          assignment_type?: string
          completed_at?: string | null
          created_at?: string
          expired_at?: string | null
          id?: string
          lead_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agent_id?: string
          assigned_by?: string | null
          assignment_type?: string
          completed_at?: string | null
          created_at?: string
          expired_at?: string | null
          id?: string
          lead_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_call_analysis: {
        Row: {
          agent_id: string
          analysis_model: string | null
          call_id: string
          coaching_notes: string | null
          created_at: string
          error_message: string | null
          id: string
          improvement_suggestions: string[] | null
          keywords: string[] | null
          lead_id: string
          objections_detected: string[] | null
          objections_handled: string[] | null
          processing_status: string | null
          sales_phase_reached: string | null
          sentiment: string | null
          success_score: number | null
          summary: string | null
          transcription: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          analysis_model?: string | null
          call_id: string
          coaching_notes?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          improvement_suggestions?: string[] | null
          keywords?: string[] | null
          lead_id: string
          objections_detected?: string[] | null
          objections_handled?: string[] | null
          processing_status?: string | null
          sales_phase_reached?: string | null
          sentiment?: string | null
          success_score?: number | null
          summary?: string | null
          transcription?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          analysis_model?: string | null
          call_id?: string
          coaching_notes?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          improvement_suggestions?: string[] | null
          keywords?: string[] | null
          lead_id?: string
          objections_detected?: string[] | null
          objections_handled?: string[] | null
          processing_status?: string | null
          sales_phase_reached?: string | null
          sentiment?: string | null
          success_score?: number | null
          summary?: string | null
          transcription?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_call_analysis_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "lead_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_call_analysis_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_calls: {
        Row: {
          agent_id: string
          call_mode: string
          created_at: string
          disposition: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string
          notes: string | null
          recording_sid: string | null
          recording_url: string | null
          started_at: string
          status: string
          twilio_call_sid: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          call_mode?: string
          created_at?: string
          disposition?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          call_mode?: string
          created_at?: string
          disposition?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_closer_coaching: {
        Row: {
          closer_user_id: string
          created_at: string
          id: string
          metrics: Json
          model: string | null
          recommendations: string[] | null
          strengths: string[] | null
          summary: string | null
          weaknesses: string[] | null
          week_start: string
        }
        Insert: {
          closer_user_id: string
          created_at?: string
          id?: string
          metrics?: Json
          model?: string | null
          recommendations?: string[] | null
          strengths?: string[] | null
          summary?: string | null
          weaknesses?: string[] | null
          week_start: string
        }
        Update: {
          closer_user_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          model?: string | null
          recommendations?: string[] | null
          strengths?: string[] | null
          summary?: string | null
          weaknesses?: string[] | null
          week_start?: string
        }
        Relationships: []
      }
      lead_conversion_predictions: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          model: string | null
          predicted_close_date: string | null
          probability_close: number
          raw_response: Json | null
          recommended_action: string | null
          risk_factors: string[] | null
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          model?: string | null
          predicted_close_date?: string | null
          probability_close?: number
          raw_response?: Json | null
          recommended_action?: string | null
          risk_factors?: string[] | null
          snapshot_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          model?: string | null
          predicted_close_date?: string | null
          probability_close?: number
          raw_response?: Json | null
          recommended_action?: string | null
          risk_factors?: string[] | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversion_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_enrichment: {
        Row: {
          created_at: string
          detected_country_code: string | null
          detected_currency: string | null
          detected_language: string | null
          detected_timezone: string | null
          detection_source: string | null
          id: string
          lead_id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          detected_country_code?: string | null
          detected_currency?: string | null
          detected_language?: string | null
          detected_timezone?: string | null
          detection_source?: string | null
          id?: string
          lead_id: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          detected_country_code?: string | null
          detected_currency?: string | null
          detected_language?: string | null
          detected_timezone?: string | null
          detection_source?: string | null
          id?: string
          lead_id?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_enrichment_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_metrics_daily: {
        Row: {
          avg_first_contact_minutes: number | null
          closer_id: string | null
          contacted_leads: number
          conversion_rate: number
          created_at: string
          id: string
          lost_leads: number
          new_leads: number
          sla_violations: number
          snapshot_date: string
          won_leads: number
        }
        Insert: {
          avg_first_contact_minutes?: number | null
          closer_id?: string | null
          contacted_leads?: number
          conversion_rate?: number
          created_at?: string
          id?: string
          lost_leads?: number
          new_leads?: number
          sla_violations?: number
          snapshot_date: string
          won_leads?: number
        }
        Update: {
          avg_first_contact_minutes?: number | null
          closer_id?: string | null
          contacted_leads?: number
          conversion_rate?: number
          created_at?: string
          id?: string
          lost_leads?: number
          new_leads?: number
          sla_violations?: number
          snapshot_date?: string
          won_leads?: number
        }
        Relationships: []
      }
      lead_monthly_reports: {
        Row: {
          created_at: string
          id: string
          payload: Json
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          author_name: string
          category: string
          content: string
          created_at: string
          id: string
          lead_id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          category?: string
          content: string
          created_at?: string
          id?: string
          lead_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          category?: string
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notifications: {
        Row: {
          channel: string
          content: string | null
          created_at: string
          error: string | null
          id: string
          lead_id: string
          metadata: Json
          notification_type: string
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          channel?: string
          content?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id: string
          metadata?: Json
          notification_type: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          channel?: string
          content?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string
          metadata?: Json
          notification_type?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_nurturing_enrollments: {
        Row: {
          completed_at: string | null
          current_step: number
          enrolled_at: string
          id: string
          lead_id: string
          metadata: Json | null
          next_run_at: string | null
          sequence_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          current_step?: number
          enrolled_at?: string
          id?: string
          lead_id: string
          metadata?: Json | null
          next_run_at?: string | null
          sequence_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          current_step?: number
          enrolled_at?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          next_run_at?: string | null
          sequence_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_nurturing_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_nurturing_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "lead_nurturing_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_nurturing_sequences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_nurturing_steps: {
        Row: {
          channel: string
          content: string
          created_at: string
          day_offset: number
          id: string
          is_active: boolean
          sequence_id: string
          step_order: number
          subject: string | null
        }
        Insert: {
          channel?: string
          content: string
          created_at?: string
          day_offset?: number
          id?: string
          is_active?: boolean
          sequence_id: string
          step_order: number
          subject?: string | null
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          day_offset?: number
          id?: string
          is_active?: boolean
          sequence_id?: string
          step_order?: number
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_nurturing_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "lead_nurturing_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_pipeline_stages: {
        Row: {
          color: string
          created_at: string
          display_order: number
          id: string
          is_closed: boolean
          is_default: boolean
          is_won: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_closed?: boolean
          is_default?: boolean
          is_won?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_closed?: boolean
          is_default?: boolean
          is_won?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_sla_config: {
        Row: {
          auto_escalate: boolean
          created_at: string
          escalate_to_role: string | null
          first_contact_minutes: number
          follow_up_hours: number
          id: string
          is_active: boolean
          max_days_in_stage: number
          notify_admin: boolean
          notify_closer: boolean
          pipeline_stage_id: string | null
          updated_at: string
        }
        Insert: {
          auto_escalate?: boolean
          created_at?: string
          escalate_to_role?: string | null
          first_contact_minutes?: number
          follow_up_hours?: number
          id?: string
          is_active?: boolean
          max_days_in_stage?: number
          notify_admin?: boolean
          notify_closer?: boolean
          pipeline_stage_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_escalate?: boolean
          created_at?: string
          escalate_to_role?: string | null
          first_contact_minutes?: number
          follow_up_hours?: number
          id?: string
          is_active?: boolean
          max_days_in_stage?: number
          notify_admin?: boolean
          notify_closer?: boolean
          pipeline_stage_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sla_config_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: true
            referencedRelation: "lead_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sla_violations: {
        Row: {
          closer_id: string | null
          created_at: string
          details: Json | null
          detected_at: string
          id: string
          lead_id: string
          pipeline_stage_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          violation_type: string
        }
        Insert: {
          closer_id?: string | null
          created_at?: string
          details?: Json | null
          detected_at?: string
          id?: string
          lead_id: string
          pipeline_stage_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          violation_type: string
        }
        Update: {
          closer_id?: string | null
          created_at?: string
          details?: Json | null
          detected_at?: string
          id?: string
          lead_id?: string
          pipeline_stage_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sla_violations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sla_violations_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          event: string
          id: string
          last_error: string | null
          lead_id: string | null
          next_attempt_at: string
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
          webhook_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event: string
          id?: string
          last_error?: string | null
          lead_id?: string | null
          next_attempt_at?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event?: string
          id?: string
          last_error?: string | null
          lead_id?: string | null
          next_attempt_at?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_webhook_deliveries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "lead_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_webhooks: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          owner_id: string | null
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          owner_id?: string | null
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          owner_id?: string | null
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      lead_whatsapp_messages: {
        Row: {
          agent_id: string | null
          body: string | null
          created_at: string
          direction: string
          error_code: string | null
          error_message: string | null
          from_phone: string | null
          id: string
          lead_id: string
          media_content_type: string | null
          media_url: string | null
          metadata: Json | null
          status: string
          template_id: string | null
          template_variables: Json | null
          to_phone: string | null
          twilio_message_sid: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          body?: string | null
          created_at?: string
          direction: string
          error_code?: string | null
          error_message?: string | null
          from_phone?: string | null
          id?: string
          lead_id: string
          media_content_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          status?: string
          template_id?: string | null
          template_variables?: Json | null
          to_phone?: string | null
          twilio_message_sid?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          body?: string | null
          created_at?: string
          direction?: string
          error_code?: string | null
          error_message?: string | null
          from_phone?: string | null
          id?: string
          lead_id?: string
          media_content_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          status?: string
          template_id?: string | null
          template_variables?: Json | null
          to_phone?: string | null
          twilio_message_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_whatsapp_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      live_ad_campaigns: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          cta_url: string | null
          duration_seconds: number
          frequency_seconds: number
          id: string
          image_path: string
          name: string
          portal_ids: string[] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cta_url?: string | null
          duration_seconds?: number
          frequency_seconds?: number
          id?: string
          image_path: string
          name: string
          portal_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cta_url?: string | null
          duration_seconds?: number
          frequency_seconds?: number
          id?: string
          image_path?: string
          name?: string
          portal_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      live_alert_keywords: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          keyword: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          keyword: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          keyword?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_breakout_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          breakout_room_id: string
          id: string
          parent_room_id: string
          participant_identity: string
          participant_name: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          breakout_room_id: string
          id?: string
          parent_room_id: string
          participant_identity: string
          participant_name?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          breakout_room_id?: string
          id?: string
          parent_room_id?: string
          participant_identity?: string
          participant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_breakout_assignments_breakout_room_id_fkey"
            columns: ["breakout_room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_breakout_assignments_parent_room_id_fkey"
            columns: ["parent_room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_fake_streams: {
        Row: {
          chat_messages: Json | null
          created_at: string
          created_by: string
          cta_text: string | null
          cta_url: string | null
          fake_viewer_max: number
          fake_viewer_min: number
          id: string
          is_active: boolean
          portal_id: string | null
          recording_id: string | null
          slug: string
          title: string
          updated_at: string
          video_path: string
          video_source: string
        }
        Insert: {
          chat_messages?: Json | null
          created_at?: string
          created_by: string
          cta_text?: string | null
          cta_url?: string | null
          fake_viewer_max?: number
          fake_viewer_min?: number
          id?: string
          is_active?: boolean
          portal_id?: string | null
          recording_id?: string | null
          slug: string
          title: string
          updated_at?: string
          video_path: string
          video_source?: string
        }
        Update: {
          chat_messages?: Json | null
          created_at?: string
          created_by?: string
          cta_text?: string | null
          cta_url?: string | null
          fake_viewer_max?: number
          fake_viewer_min?: number
          id?: string
          is_active?: boolean
          portal_id?: string | null
          recording_id?: string | null
          slug?: string
          title?: string
          updated_at?: string
          video_path?: string
          video_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_fake_streams_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_fake_streams_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "live_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      live_feature_access: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          granted_by: string | null
          id: string
          notes: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      live_host_waiting_preferences: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
          waiting_bg_path: string | null
          waiting_bg_type: string | null
          waiting_mode: string
          waiting_subtitle: string | null
          waiting_template_id: string | null
          waiting_title: string | null
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
          waiting_bg_path?: string | null
          waiting_bg_type?: string | null
          waiting_mode?: string
          waiting_subtitle?: string | null
          waiting_template_id?: string | null
          waiting_title?: string | null
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
          waiting_bg_path?: string | null
          waiting_bg_type?: string | null
          waiting_mode?: string
          waiting_subtitle?: string | null
          waiting_template_id?: string | null
          waiting_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_host_waiting_preferences_waiting_template_id_fkey"
            columns: ["waiting_template_id"]
            isOneToOne: false
            referencedRelation: "live_waiting_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      live_invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_public: boolean
          room_id: string
          used_at: string | null
          used_by_name: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_public?: boolean
          room_id: string
          used_at?: string | null
          used_by_name?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_public?: boolean
          room_id?: string
          used_at?: string | null
          used_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_invite_codes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_keyword_alerts: {
        Row: {
          detected_at: string
          host_id: string
          id: string
          keyword_id: string | null
          keyword_text: string
          room_id: string | null
          transcript_excerpt: string | null
        }
        Insert: {
          detected_at?: string
          host_id: string
          id?: string
          keyword_id?: string | null
          keyword_text: string
          room_id?: string | null
          transcript_excerpt?: string | null
        }
        Update: {
          detected_at?: string
          host_id?: string
          id?: string
          keyword_id?: string | null
          keyword_text?: string
          room_id?: string | null
          transcript_excerpt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_keyword_alerts_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "live_alert_keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_keyword_alerts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_meeting_polls: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          options: Json
          question: string
          room_id: string
          votes: Json
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          options?: Json
          question: string
          room_id: string
          votes?: Json
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          options?: Json
          question?: string
          room_id?: string
          votes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "live_meeting_polls_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_monetization_config: {
        Row: {
          active: boolean
          bono_interacciones_monto: number
          bono_interacciones_umbral: number
          bono_streams_monto: number
          bono_streams_umbral: number
          bono_visualizaciones_monto: number
          bono_visualizaciones_umbral: number
          bono_votacion_monto: number
          bono_votacion_umbral: number
          created_at: string
          dolares_por_lead: number
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bono_interacciones_monto?: number
          bono_interacciones_umbral?: number
          bono_streams_monto?: number
          bono_streams_umbral?: number
          bono_visualizaciones_monto?: number
          bono_visualizaciones_umbral?: number
          bono_votacion_monto?: number
          bono_votacion_umbral?: number
          created_at?: string
          dolares_por_lead?: number
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bono_interacciones_monto?: number
          bono_interacciones_umbral?: number
          bono_streams_monto?: number
          bono_streams_umbral?: number
          bono_visualizaciones_monto?: number
          bono_visualizaciones_umbral?: number
          bono_votacion_monto?: number
          bono_votacion_umbral?: number
          created_at?: string
          dolares_por_lead?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_overlay_assets: {
        Row: {
          asset_type: string
          created_at: string
          duration_seconds: number | null
          file_path: string
          id: string
          name: string
          thumbnail_path: string | null
          uploaded_by: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          duration_seconds?: number | null
          file_path: string
          id?: string
          name: string
          thumbnail_path?: string | null
          uploaded_by: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          duration_seconds?: number | null
          file_path?: string
          id?: string
          name?: string
          thumbnail_path?: string | null
          uploaded_by?: string
        }
        Relationships: []
      }
      live_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          reaction_type: string
          room_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          reaction_type?: string
          room_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          reaction_type?: string
          room_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_recordings: {
        Row: {
          academy_lesson_id: string | null
          created_at: string
          duration_seconds: number | null
          file_path: string
          file_size: number | null
          id: string
          recorded_by: string
          room_id: string
        }
        Insert: {
          academy_lesson_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_path: string
          file_size?: number | null
          id?: string
          recorded_by: string
          room_id: string
        }
        Update: {
          academy_lesson_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_path?: string
          file_size?: number | null
          id?: string
          recorded_by?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_recordings_academy_lesson_id_fkey"
            columns: ["academy_lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_recordings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_room_invitations: {
        Row: {
          email_sent_at: string | null
          id: string
          invited_at: string
          invited_by: string | null
          invited_user_id: string
          room_id: string
        }
        Insert: {
          email_sent_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          invited_user_id: string
          room_id: string
        }
        Update: {
          email_sent_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          invited_user_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_room_invitations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_room_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          requester_email: string | null
          requester_name: string
          requester_session_id: string
          room_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          requester_email?: string | null
          requester_name: string
          requester_session_id: string
          room_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          requester_email?: string | null
          requester_name?: string
          requester_session_id?: string
          room_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_room_join_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_rooms: {
        Row: {
          allow_anyone_with_link: boolean
          auto_approve_join_requests: boolean
          auto_close_disabled: boolean
          breakout_parent_id: string | null
          created_at: string
          description: string | null
          egress_id: string | null
          ended_at: string | null
          host_id: string
          id: string
          is_public_stream: boolean
          livekit_room_name: string
          max_participants: number
          max_viewers: number
          peak_viewers: number | null
          portal_id: string | null
          recording_enabled: boolean
          required_tier: string
          required_tiers: string[] | null
          room_type: string
          scheduled_at: string | null
          slug: string | null
          started_at: string | null
          status: string
          title: string
          total_likes: number | null
          total_reactions: number | null
          updated_at: string
          viewer_count: number
          waiting_bg_path: string | null
          waiting_bg_type: string | null
          waiting_countdown_to: string | null
          waiting_mode: string
          waiting_subtitle: string | null
          waiting_template_id: string | null
          waiting_title: string | null
        }
        Insert: {
          allow_anyone_with_link?: boolean
          auto_approve_join_requests?: boolean
          auto_close_disabled?: boolean
          breakout_parent_id?: string | null
          created_at?: string
          description?: string | null
          egress_id?: string | null
          ended_at?: string | null
          host_id: string
          id?: string
          is_public_stream?: boolean
          livekit_room_name: string
          max_participants?: number
          max_viewers?: number
          peak_viewers?: number | null
          portal_id?: string | null
          recording_enabled?: boolean
          required_tier?: string
          required_tiers?: string[] | null
          room_type?: string
          scheduled_at?: string | null
          slug?: string | null
          started_at?: string | null
          status?: string
          title: string
          total_likes?: number | null
          total_reactions?: number | null
          updated_at?: string
          viewer_count?: number
          waiting_bg_path?: string | null
          waiting_bg_type?: string | null
          waiting_countdown_to?: string | null
          waiting_mode?: string
          waiting_subtitle?: string | null
          waiting_template_id?: string | null
          waiting_title?: string | null
        }
        Update: {
          allow_anyone_with_link?: boolean
          auto_approve_join_requests?: boolean
          auto_close_disabled?: boolean
          breakout_parent_id?: string | null
          created_at?: string
          description?: string | null
          egress_id?: string | null
          ended_at?: string | null
          host_id?: string
          id?: string
          is_public_stream?: boolean
          livekit_room_name?: string
          max_participants?: number
          max_viewers?: number
          peak_viewers?: number | null
          portal_id?: string | null
          recording_enabled?: boolean
          required_tier?: string
          required_tiers?: string[] | null
          room_type?: string
          scheduled_at?: string | null
          slug?: string | null
          started_at?: string | null
          status?: string
          title?: string
          total_likes?: number | null
          total_reactions?: number | null
          updated_at?: string
          viewer_count?: number
          waiting_bg_path?: string | null
          waiting_bg_type?: string | null
          waiting_countdown_to?: string | null
          waiting_mode?: string
          waiting_subtitle?: string | null
          waiting_template_id?: string | null
          waiting_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_rooms_breakout_parent_id_fkey"
            columns: ["breakout_parent_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_rooms_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_rooms_waiting_template_id_fkey"
            columns: ["waiting_template_id"]
            isOneToOne: false
            referencedRelation: "live_waiting_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      live_saved_ctas: {
        Row: {
          button_text: string | null
          created_at: string | null
          display_mode: string
          id: string
          image_only: boolean | null
          image_path: string | null
          title: string
          updated_at: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          button_text?: string | null
          created_at?: string | null
          display_mode?: string
          id?: string
          image_only?: boolean | null
          image_path?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          button_text?: string | null
          created_at?: string | null
          display_mode?: string
          id?: string
          image_only?: boolean | null
          image_path?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      live_stream_analysis: {
        Row: {
          created_at: string
          error_message: string | null
          faqs: string[] | null
          host_id: string
          id: string
          objections: string[] | null
          processing_status: string
          products_mentioned: string[] | null
          room_id: string
          summary: string | null
          topics: string[] | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          faqs?: string[] | null
          host_id: string
          id?: string
          objections?: string[] | null
          processing_status?: string
          products_mentioned?: string[] | null
          room_id: string
          summary?: string | null
          topics?: string[] | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          faqs?: string[] | null
          host_id?: string
          id?: string
          objections?: string[] | null
          processing_status?: string
          products_mentioned?: string[] | null
          room_id?: string
          summary?: string | null
          topics?: string[] | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_analysis_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_votes: {
        Row: {
          created_at: string
          id: string
          rating: number
          room_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating?: number
          room_id: string
          user_id: string
          user_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          room_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_votes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streamer_earnings: {
        Row: {
          avg_rating: number
          bonus_details: Json
          created_at: string
          earnings_bonuses: number
          earnings_leads: number
          earnings_total: number
          host_id: string
          id: string
          period_end: string
          period_start: string
          status: string
          total_interactions: number
          total_leads: number
          total_streams: number
          total_viewers: number
          updated_at: string
          wallet_credited_at: string | null
        }
        Insert: {
          avg_rating?: number
          bonus_details?: Json
          created_at?: string
          earnings_bonuses?: number
          earnings_leads?: number
          earnings_total?: number
          host_id: string
          id?: string
          period_end: string
          period_start: string
          status?: string
          total_interactions?: number
          total_leads?: number
          total_streams?: number
          total_viewers?: number
          updated_at?: string
          wallet_credited_at?: string | null
        }
        Update: {
          avg_rating?: number
          bonus_details?: Json
          created_at?: string
          earnings_bonuses?: number
          earnings_leads?: number
          earnings_total?: number
          host_id?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: string
          total_interactions?: number
          total_leads?: number
          total_streams?: number
          total_viewers?: number
          updated_at?: string
          wallet_credited_at?: string | null
        }
        Relationships: []
      }
      live_streamer_monetization: {
        Row: {
          created_at: string
          custom_bono_interacciones_monto: number | null
          custom_bono_streams_monto: number | null
          custom_bono_visualizaciones_monto: number | null
          custom_bono_votacion_monto: number | null
          custom_dolares_por_lead: number | null
          enabled: boolean
          host_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_bono_interacciones_monto?: number | null
          custom_bono_streams_monto?: number | null
          custom_bono_visualizaciones_monto?: number | null
          custom_bono_votacion_monto?: number | null
          custom_dolares_por_lead?: number | null
          enabled?: boolean
          host_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_bono_interacciones_monto?: number | null
          custom_bono_streams_monto?: number | null
          custom_bono_visualizaciones_monto?: number | null
          custom_bono_votacion_monto?: number | null
          custom_dolares_por_lead?: number | null
          enabled?: boolean
          host_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      live_translation_segments: {
        Row: {
          created_at: string
          host_id: string
          id: string
          original_text: string
          room_id: string
          segment_index: number
          source_lang: string
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          original_text: string
          room_id: string
          segment_index?: number
          source_lang?: string
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          original_text?: string
          room_id?: string
          segment_index?: number
          source_lang?: string
        }
        Relationships: []
      }
      live_viewer_presence: {
        Row: {
          correo: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          joined_at: string
          left_at: string | null
          room_id: string
          stream_lead_id: string | null
          telefono: string | null
          user_name: string
        }
        Insert: {
          correo?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          joined_at?: string
          left_at?: string | null
          room_id: string
          stream_lead_id?: string | null
          telefono?: string | null
          user_name?: string
        }
        Update: {
          correo?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          joined_at?: string
          left_at?: string | null
          room_id?: string
          stream_lead_id?: string | null
          telefono?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_viewer_presence_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_viewer_presence_stream_lead_id_fkey"
            columns: ["stream_lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      live_virtual_backgrounds: {
        Row: {
          bg_type: string
          created_at: string
          file_path: string
          id: string
          is_default: boolean
          name: string
          uploaded_by: string
        }
        Insert: {
          bg_type?: string
          created_at?: string
          file_path: string
          id?: string
          is_default?: boolean
          name: string
          uploaded_by: string
        }
        Update: {
          bg_type?: string
          created_at?: string
          file_path?: string
          id?: string
          is_default?: boolean
          name?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      live_waiting_templates: {
        Row: {
          bg_path: string | null
          bg_type: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          show_countdown: boolean
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bg_path?: string | null
          bg_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          show_countdown?: boolean
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          bg_path?: string | null
          bg_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          show_countdown?: boolean
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_sections: {
        Row: {
          category: string
          content: string
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_new: boolean | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          content?: string
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_new?: boolean | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_new?: boolean | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          benefits: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          manual_recipients: string[] | null
          name: string
          notify_user_id: string | null
          operative_hours_end: number
          operative_hours_start: number
          promo_code: string | null
          recipient_mode: string
          reminder_hour: number
          start_date: string
          status: string
          stop_reason: string | null
          updated_at: string
        }
        Insert: {
          benefits?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          manual_recipients?: string[] | null
          name: string
          notify_user_id?: string | null
          operative_hours_end?: number
          operative_hours_start?: number
          promo_code?: string | null
          recipient_mode?: string
          reminder_hour?: number
          start_date: string
          status?: string
          stop_reason?: string | null
          updated_at?: string
        }
        Update: {
          benefits?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          manual_recipients?: string[] | null
          name?: string
          notify_user_id?: string | null
          operative_hours_end?: number
          operative_hours_start?: number
          promo_code?: string | null
          recipient_mode?: string
          reminder_hour?: number
          start_date?: string
          status?: string
          stop_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_agent_logs: {
        Row: {
          action: string
          agent_emoji: string | null
          agent_name: string
          agent_role: string
          created_at: string
          edition_id: string
          id: string
          input_summary: string | null
          iteration_number: number | null
          output_summary: string | null
          revision_notes: string | null
          revision_requested_by: string | null
        }
        Insert: {
          action: string
          agent_emoji?: string | null
          agent_name: string
          agent_role: string
          created_at?: string
          edition_id: string
          id?: string
          input_summary?: string | null
          iteration_number?: number | null
          output_summary?: string | null
          revision_notes?: string | null
          revision_requested_by?: string | null
        }
        Update: {
          action?: string
          agent_emoji?: string | null
          agent_name?: string
          agent_role?: string
          created_at?: string
          edition_id?: string
          id?: string
          input_summary?: string | null
          iteration_number?: number | null
          output_summary?: string | null
          revision_notes?: string | null
          revision_requested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_agent_logs_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_editions: {
        Row: {
          campaign_name: string
          content_json: Json | null
          copywriter_style: string
          created_at: string
          created_by: string | null
          environment: string
          frequency: string
          gossip_mode: boolean | null
          id: string
          prediction_correct_answer: string | null
          prediction_options: Json | null
          prediction_question: string | null
          sent_at: string | null
          sent_count: number | null
          status: string
          target_roles: string[]
          updated_at: string
          verification_evidence: Json | null
          verified_at: string | null
        }
        Insert: {
          campaign_name: string
          content_json?: Json | null
          copywriter_style?: string
          created_at?: string
          created_by?: string | null
          environment?: string
          frequency?: string
          gossip_mode?: boolean | null
          id?: string
          prediction_correct_answer?: string | null
          prediction_options?: Json | null
          prediction_question?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          target_roles?: string[]
          updated_at?: string
          verification_evidence?: Json | null
          verified_at?: string | null
        }
        Update: {
          campaign_name?: string
          content_json?: Json | null
          copywriter_style?: string
          created_at?: string
          created_by?: string | null
          environment?: string
          frequency?: string
          gossip_mode?: boolean | null
          id?: string
          prediction_correct_answer?: string | null
          prediction_options?: Json | null
          prediction_question?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          target_roles?: string[]
          updated_at?: string
          verification_evidence?: Json | null
          verified_at?: string | null
        }
        Relationships: []
      }
      newsletter_prediction_results: {
        Row: {
          correct_answer: string
          created_at: string
          edition_id: string
          evidence_summary: string
          evidence_urls: string[] | null
          id: string
          option_distribution: Json | null
          total_responses: number | null
          verified_by_agent_at: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          edition_id: string
          evidence_summary: string
          evidence_urls?: string[] | null
          id?: string
          option_distribution?: Json | null
          total_responses?: number | null
          verified_by_agent_at?: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          edition_id?: string
          evidence_summary?: string
          evidence_urls?: string[] | null
          id?: string
          option_distribution?: Json | null
          total_responses?: number | null
          verified_by_agent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_prediction_results_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: true
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_predictions: {
        Row: {
          answered_at: string
          edition_id: string
          id: string
          is_correct: boolean | null
          points_earned: number | null
          selected_option: string
          user_email: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          answered_at?: string
          edition_id: string
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          selected_option: string
          user_email: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          answered_at?: string
          edition_id?: string
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          selected_option?: string
          user_email?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_predictions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      nowpayments_payments: {
        Row: {
          actually_paid: number | null
          created_at: string
          environment: string
          id: string
          invoice_id: string | null
          invoice_url: string | null
          order_description: string | null
          order_id: string | null
          pay_address: string | null
          pay_amount: number | null
          pay_currency: string | null
          payment_id: string | null
          portal_id: string | null
          price_amount: number | null
          price_currency: string | null
          purpose: string | null
          raw_payload: Json | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actually_paid?: number | null
          created_at?: string
          environment?: string
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          order_description?: string | null
          order_id?: string | null
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id?: string | null
          portal_id?: string | null
          price_amount?: number | null
          price_currency?: string | null
          purpose?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actually_paid?: number | null
          created_at?: string
          environment?: string
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          order_description?: string | null
          order_id?: string | null
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id?: string | null
          portal_id?: string | null
          price_amount?: number | null
          price_currency?: string | null
          purpose?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ops_checklist: {
        Row: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          ib_id: string
          id: string
          label: string
          ops_queue_id: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          ib_id: string
          id?: string
          label: string
          ops_queue_id: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          ib_id?: string
          id?: string
          label?: string
          ops_queue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_checklist_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_checklist_ops_queue_id_fkey"
            columns: ["ops_queue_id"]
            isOneToOne: false
            referencedRelation: "ops_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_queue: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          ib_id: string
          id: string
          notes: string | null
          rejection_reason: string | null
          status: string
          taken_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          ib_id: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          taken_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          ib_id?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_queue_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: true
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_requests: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string
          ib_id: string | null
          id: string
          notes: string | null
          rejection_reason: string | null
          status: string
          taken_at: string | null
          taken_by: string | null
          target_department: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description: string
          ib_id?: string | null
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          taken_at?: string | null
          taken_by?: string | null
          target_department?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          ib_id?: string | null
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          taken_at?: string | null
          taken_by?: string | null
          target_department?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_requests_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          phone: string | null
          portal_id: string | null
          purpose: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          phone?: string | null
          portal_id?: string | null
          purpose?: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          phone?: string | null
          portal_id?: string | null
          purpose?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_otp_codes_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          portal_id: string
          token: string
          used: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          portal_id: string
          token?: string
          used?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          portal_id?: string
          token?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_password_reset_tokens_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_portal_branding: {
        Row: {
          accent_color: string
          card_color: string | null
          created_at: string
          display_name_override: string | null
          id: string
          login_bg_color: string | null
          login_bg_image_path: string | null
          logo_path: string | null
          portal_id: string
          primary_color: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          card_color?: string | null
          created_at?: string
          display_name_override?: string | null
          id?: string
          login_bg_color?: string | null
          login_bg_image_path?: string | null
          logo_path?: string | null
          portal_id: string
          primary_color?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          card_color?: string | null
          created_at?: string
          display_name_override?: string | null
          id?: string
          login_bg_color?: string | null
          login_bg_image_path?: string | null
          logo_path?: string | null
          portal_id?: string
          primary_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_portal_branding_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: true
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_portals: {
        Row: {
          bullfy_referral_link: string | null
          created_at: string
          display_name: string
          email_from_address: string | null
          email_from_name: string | null
          enabled_by: string | null
          ib_id: string
          id: string
          nombre_portal: string
          platform_fee_percentage: number
          recording_to_class_enabled: boolean
          status: string
          sub_ib_id: string | null
          tickers_enabled: boolean
          tier_streams_enabled: boolean
          updated_at: string
          video_studio_enabled: boolean
        }
        Insert: {
          bullfy_referral_link?: string | null
          created_at?: string
          display_name: string
          email_from_address?: string | null
          email_from_name?: string | null
          enabled_by?: string | null
          ib_id: string
          id?: string
          nombre_portal: string
          platform_fee_percentage?: number
          recording_to_class_enabled?: boolean
          status?: string
          sub_ib_id?: string | null
          tickers_enabled?: boolean
          tier_streams_enabled?: boolean
          updated_at?: string
          video_studio_enabled?: boolean
        }
        Update: {
          bullfy_referral_link?: string | null
          created_at?: string
          display_name?: string
          email_from_address?: string | null
          email_from_name?: string | null
          enabled_by?: string | null
          ib_id?: string
          id?: string
          nombre_portal?: string
          platform_fee_percentage?: number
          recording_to_class_enabled?: boolean
          status?: string
          sub_ib_id?: string | null
          tickers_enabled?: boolean
          tier_streams_enabled?: boolean
          updated_at?: string
          video_studio_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_portals_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_portals_sub_ib_id_fkey"
            columns: ["sub_ib_id"]
            isOneToOne: false
            referencedRelation: "sub_ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_tier_config: {
        Row: {
          active: boolean
          created_at: string
          crypto_address: string | null
          crypto_network: string | null
          description: string | null
          id: string
          portal_id: string
          precio_upgrade: number
          tier_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          crypto_address?: string | null
          crypto_network?: string | null
          description?: string | null
          id?: string
          portal_id: string
          precio_upgrade?: number
          tier_name?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          crypto_address?: string | null
          crypto_network?: string | null
          description?: string | null
          id?: string
          portal_id?: string
          precio_upgrade?: number
          tier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_tier_config_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_tier_upgrades: {
        Row: {
          created_at: string
          id: string
          new_tier: string
          old_tier: string
          partner_user_id: string
          performed_by: string | null
          portal_id: string
          tx_hash: string | null
          upgrade_method: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_tier: string
          old_tier?: string
          partner_user_id: string
          performed_by?: string | null
          portal_id: string
          tx_hash?: string | null
          upgrade_method?: string
        }
        Update: {
          created_at?: string
          id?: string
          new_tier?: string
          old_tier?: string
          partner_user_id?: string
          performed_by?: string | null
          portal_id?: string
          tx_hash?: string | null
          upgrade_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_tier_upgrades_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_tier_upgrades_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_tiers: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          portal_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          portal_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          portal_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_tiers_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_users: {
        Row: {
          avatar_url: string | null
          can_be_business_partner: boolean
          created_at: string
          email: string
          id: string
          is_host: boolean
          mlm_enabled: boolean
          nombre: string
          password_hash: string
          portal_id: string
          referred_at: string | null
          referred_by: string | null
          status: string
          telefono: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          can_be_business_partner?: boolean
          created_at?: string
          email: string
          id?: string
          is_host?: boolean
          mlm_enabled?: boolean
          nombre: string
          password_hash: string
          portal_id: string
          referred_at?: string | null
          referred_by?: string | null
          status?: string
          telefono?: string | null
          tier?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          can_be_business_partner?: boolean
          created_at?: string
          email?: string
          id?: string
          is_host?: boolean
          mlm_enabled?: boolean
          nombre?: string
          password_hash?: string
          portal_id?: string
          referred_at?: string | null
          referred_by?: string | null
          status?: string
          telefono?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_users_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_users_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_broll_library: {
        Row: {
          asset_type: string
          asset_url: string
          created_at: string
          id: string
          label: string | null
          portal_id: string | null
          tags: string[] | null
          uploaded_by: string | null
        }
        Insert: {
          asset_type?: string
          asset_url: string
          created_at?: string
          id?: string
          label?: string | null
          portal_id?: string | null
          tags?: string[] | null
          uploaded_by?: string | null
        }
        Update: {
          asset_type?: string
          asset_url?: string
          created_at?: string
          id?: string
          label?: string | null
          portal_id?: string | null
          tags?: string[] | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      portal_business_partners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          notes: string | null
          partner_user_id: string
          percentage: number
          portal_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          partner_user_id: string
          percentage: number
          portal_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          partner_user_id?: string
          percentage?: number
          portal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_business_partners_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_business_partners_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_cart_items: {
        Row: {
          added_at: string
          id: string
          partner_user_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          added_at?: string
          id?: string
          partner_user_id: string
          product_id: string
          quantity?: number
        }
        Update: {
          added_at?: string
          id?: string
          partner_user_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_cart_items_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "portal_products"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_class_registrations: {
        Row: {
          class_id: string
          id: string
          partner_user_id: string
          registered_at: string
        }
        Insert: {
          class_id: string
          id?: string
          partner_user_id: string
          registered_at?: string
        }
        Update: {
          class_id?: string
          id?: string
          partner_user_id?: string
          registered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_class_registrations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "portal_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_class_registrations_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_classes: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          location_type: string
          location_url: string | null
          portal_id: string
          required_tiers: string[] | null
          starts_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location_type?: string
          location_url?: string | null
          portal_id: string
          required_tiers?: string[] | null
          starts_at: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location_type?: string
          location_url?: string | null
          portal_id?: string
          required_tiers?: string[] | null
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_classes_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_commerce_access: {
        Row: {
          created_at: string
          enabled: boolean
          ib_id: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          ib_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          ib_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_commerce_access_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: true
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_commission_lines: {
        Row: {
          account_kind: string
          amount: number
          base_amount: number
          beneficiary_type: string
          beneficiary_user_id: string | null
          created_at: string
          id: string
          level_number: number | null
          method: string
          order_id: string
          percentage: number | null
          portal_id: string
          source_user_id: string | null
          status: string
        }
        Insert: {
          account_kind?: string
          amount: number
          base_amount: number
          beneficiary_type: string
          beneficiary_user_id?: string | null
          created_at?: string
          id?: string
          level_number?: number | null
          method: string
          order_id: string
          percentage?: number | null
          portal_id: string
          source_user_id?: string | null
          status: string
        }
        Update: {
          account_kind?: string
          amount?: number
          base_amount?: number
          beneficiary_type?: string
          beneficiary_user_id?: string | null
          created_at?: string
          id?: string
          level_number?: number | null
          method?: string
          order_id?: string
          percentage?: number | null
          portal_id?: string
          source_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_commission_lines_beneficiary_user_id_fkey"
            columns: ["beneficiary_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_commission_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "portal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_commission_lines_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_commissions: {
        Row: {
          account_kind: string
          amount: number
          beneficiary_id: string | null
          beneficiary_type: string
          created_at: string
          id: string
          order_id: string
          paid_at: string | null
          pending_credited_at: string | null
          portal_id: string
          status: string
          updated_at: string
        }
        Insert: {
          account_kind?: string
          amount: number
          beneficiary_id?: string | null
          beneficiary_type: string
          created_at?: string
          id?: string
          order_id: string
          paid_at?: string | null
          pending_credited_at?: string | null
          portal_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_kind?: string
          amount?: number
          beneficiary_id?: string | null
          beneficiary_type?: string
          created_at?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          pending_credited_at?: string | null
          portal_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "portal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_commissions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_demo_fund_grants: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          description: string | null
          granted_by: string | null
          id: string
          portal_id: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          granted_by?: string | null
          id?: string
          portal_id: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          granted_by?: string | null
          id?: string
          portal_id?: string
          user_id?: string
        }
        Relationships: []
      }
      portal_event_registrations: {
        Row: {
          event_id: string
          granted_by: string
          id: string
          partner_user_id: string
          registered_at: string
        }
        Insert: {
          event_id: string
          granted_by?: string
          id?: string
          partner_user_id: string
          registered_at?: string
        }
        Update: {
          event_id?: string
          granted_by?: string
          id?: string
          partner_user_id?: string
          registered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "portal_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_event_registrations_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_events: {
        Row: {
          capacity: number | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          event_type: string
          id: string
          is_free: boolean
          location_type: string
          location_url: string | null
          media_type: string
          mux_asset_id: string | null
          mux_error_message: string | null
          mux_playback_id: string | null
          mux_status: string | null
          mux_upload_id: string | null
          portal_id: string
          price_usd: number
          required_tiers: string[] | null
          starts_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
          video_thumbnail_path: string | null
        }
        Insert: {
          capacity?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          is_free?: boolean
          location_type?: string
          location_url?: string | null
          media_type?: string
          mux_asset_id?: string | null
          mux_error_message?: string | null
          mux_playback_id?: string | null
          mux_status?: string | null
          mux_upload_id?: string | null
          portal_id: string
          price_usd?: number
          required_tiers?: string[] | null
          starts_at: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
          video_thumbnail_path?: string | null
        }
        Update: {
          capacity?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          is_free?: boolean
          location_type?: string
          location_url?: string | null
          media_type?: string
          mux_asset_id?: string | null
          mux_error_message?: string | null
          mux_playback_id?: string | null
          mux_status?: string | null
          mux_upload_id?: string | null
          portal_id?: string
          price_usd?: number
          required_tiers?: string[] | null
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          video_thumbnail_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_ledger: {
        Row: {
          account_kind: string
          amount: number
          balance_after: number
          counterpart_id: string | null
          created_at: string
          currency: string
          description: string | null
          entry_type: string
          id: string
          order_id: string | null
          portal_id: string
        }
        Insert: {
          account_kind?: string
          amount: number
          balance_after?: number
          counterpart_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          entry_type: string
          id?: string
          order_id?: string | null
          portal_id: string
        }
        Update: {
          account_kind?: string
          amount?: number
          balance_after?: number
          counterpart_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          entry_type?: string
          id?: string
          order_id?: string | null
          portal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "portal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_ledger_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_membership_reminder_campaigns: {
        Row: {
          active: boolean
          created_at: string
          days_before: number
          id: string
          message: string
          name: string
          portal_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_before?: number
          id?: string
          message: string
          name: string
          portal_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_before?: number
          id?: string
          message?: string
          name?: string
          portal_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_membership_reminder_campaigns_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_membership_reminder_log: {
        Row: {
          campaign_id: string
          email: string | null
          id: string
          sent_at: string
          user_membership_id: string
        }
        Insert: {
          campaign_id: string
          email?: string | null
          id?: string
          sent_at?: string
          user_membership_id: string
        }
        Update: {
          campaign_id?: string
          email?: string | null
          id?: string
          sent_at?: string
          user_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_membership_reminder_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "portal_membership_reminder_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_membership_reminder_log_user_membership_id_fkey"
            columns: ["user_membership_id"]
            isOneToOne: false
            referencedRelation: "portal_user_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_mlm_commissions: {
        Row: {
          account_kind: string
          available_at: string | null
          base_amount: number
          beneficiary_type: string
          beneficiary_user_id: string | null
          commission_amount: number
          created_at: string
          currency: string
          id: string
          level_number: number | null
          order_id: string | null
          paid_at: string | null
          percentage: number
          portal_id: string
          reversed_reason: string | null
          source_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_kind?: string
          available_at?: string | null
          base_amount: number
          beneficiary_type: string
          beneficiary_user_id?: string | null
          commission_amount: number
          created_at?: string
          currency?: string
          id?: string
          level_number?: number | null
          order_id?: string | null
          paid_at?: string | null
          percentage: number
          portal_id: string
          reversed_reason?: string | null
          source_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_kind?: string
          available_at?: string | null
          base_amount?: number
          beneficiary_type?: string
          beneficiary_user_id?: string | null
          commission_amount?: number
          created_at?: string
          currency?: string
          id?: string
          level_number?: number | null
          order_id?: string | null
          paid_at?: string | null
          percentage?: number
          portal_id?: string
          reversed_reason?: string | null
          source_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_mlm_commissions_beneficiary_user_id_fkey"
            columns: ["beneficiary_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_mlm_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "portal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_mlm_commissions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_mlm_commissions_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_mlm_config: {
        Row: {
          active_levels: number
          business_partners_enabled: boolean
          commission_mode: string
          created_at: string
          enabled: boolean
          id: string
          min_withdrawal_usdt: number
          mlm_pool_percentage: number
          orphan_policy: string
          portal_id: string
          refund_window_days: number
          updated_at: string
          withdrawal_fee_usdt: number
        }
        Insert: {
          active_levels?: number
          business_partners_enabled?: boolean
          commission_mode?: string
          created_at?: string
          enabled?: boolean
          id?: string
          min_withdrawal_usdt?: number
          mlm_pool_percentage?: number
          orphan_policy?: string
          portal_id: string
          refund_window_days?: number
          updated_at?: string
          withdrawal_fee_usdt?: number
        }
        Update: {
          active_levels?: number
          business_partners_enabled?: boolean
          commission_mode?: string
          created_at?: string
          enabled?: boolean
          id?: string
          min_withdrawal_usdt?: number
          mlm_pool_percentage?: number
          orphan_policy?: string
          portal_id?: string
          refund_window_days?: number
          updated_at?: string
          withdrawal_fee_usdt?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_mlm_config_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: true
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_mlm_levels: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          level_number: number
          percentage: number
          portal_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          level_number: number
          percentage: number
          portal_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          level_number?: number
          percentage?: number
          portal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_mlm_levels_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_mlm_referrals: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          portal_id: string
          sponsor_id: string | null
          updated_at: string
          upline_chain: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          portal_id: string
          sponsor_id?: string | null
          updated_at?: string
          upline_chain?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          portal_id?: string
          sponsor_id?: string | null
          updated_at?: string
          upline_chain?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_mlm_referrals_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_mlm_referrals_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_mlm_referrals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_notification_log: {
        Row: {
          created_at: string
          event: string
          id: string
          ref_key: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          ref_key: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          ref_key?: string
        }
        Relationships: []
      }
      portal_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "portal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "portal_products"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_orders: {
        Row: {
          account_kind: string
          created_at: string
          event_id: string | null
          id: string
          order_number: string
          paid_at: string | null
          partner_user_id: string
          payment_gateway: string | null
          payment_reference: string | null
          payment_status: string
          portal_id: string
          total_usd: number
          updated_at: string
        }
        Insert: {
          account_kind?: string
          created_at?: string
          event_id?: string | null
          id?: string
          order_number: string
          paid_at?: string | null
          partner_user_id: string
          payment_gateway?: string | null
          payment_reference?: string | null
          payment_status?: string
          portal_id: string
          total_usd?: number
          updated_at?: string
        }
        Update: {
          account_kind?: string
          created_at?: string
          event_id?: string | null
          id?: string
          order_number?: string
          paid_at?: string | null
          partner_user_id?: string
          payment_gateway?: string | null
          payment_reference?: string | null
          payment_status?: string
          portal_id?: string
          total_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "portal_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_orders_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_orders_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_payment_transactions: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          error_message: string | null
          gateway: string
          gateway_action: string
          gateway_reference_id: string | null
          http_status: number | null
          id: string
          order_id: string | null
          partner_user_id: string | null
          portal_id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          gateway: string
          gateway_action: string
          gateway_reference_id?: string | null
          http_status?: number | null
          id?: string
          order_id?: string | null
          partner_user_id?: string | null
          portal_id: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          gateway?: string
          gateway_action?: string
          gateway_reference_id?: string | null
          http_status?: number | null
          id?: string
          order_id?: string | null
          partner_user_id?: string | null
          portal_id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "portal_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_product_commission_levels: {
        Row: {
          created_at: string
          id: string
          level_number: number
          percentage: number
          portal_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          level_number: number
          percentage: number
          portal_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          level_number?: number
          percentage?: number
          portal_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_product_commission_levels_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_product_commission_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "portal_products"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_products: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          membership_tier: string | null
          portal_id: string
          price_usd: number
          product_type: string
          reference_id: string | null
          status: string
          title: string
          updated_at: string
          validity_months: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          membership_tier?: string | null
          portal_id: string
          price_usd?: number
          product_type?: string
          reference_id?: string | null
          status?: string
          title: string
          updated_at?: string
          validity_months?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          membership_tier?: string | null
          portal_id?: string
          price_usd?: number
          product_type?: string
          reference_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          validity_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_products_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_revenue_splits: {
        Row: {
          created_at: string
          id: string
          percentage: number
          portal_id: string
          priority: number
          role_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          percentage: number
          portal_id: string
          priority?: number
          role_label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          percentage?: number
          portal_id?: string
          priority?: number
          role_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_revenue_splits_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_social_credentials: {
        Row: {
          access_token: string | null
          client_id: string | null
          client_secret: string | null
          connected_account_name: string | null
          created_at: string
          id: string
          platform: string
          portal_id: string
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          client_id?: string | null
          client_secret?: string | null
          connected_account_name?: string | null
          created_at?: string
          id?: string
          platform: string
          portal_id: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          client_id?: string | null
          client_secret?: string | null
          connected_account_name?: string | null
          created_at?: string
          id?: string
          platform?: string
          portal_id?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_social_credentials_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_user_memberships: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          partner_user_id: string
          portal_id: string
          product_id: string | null
          started_at: string
          status: string
          tier_slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          partner_user_id: string
          portal_id: string
          product_id?: string | null
          started_at?: string
          status?: string
          tier_slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          partner_user_id?: string
          portal_id?: string
          product_id?: string | null
          started_at?: string
          status?: string
          tier_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_user_memberships_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_user_memberships_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_user_memberships_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "portal_products"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_user_wallets: {
        Row: {
          account_kind: string
          available_balance: number
          created_at: string
          currency: string
          external_wallet_address: string | null
          external_wallet_verified_at: string | null
          id: string
          pending_balance: number
          portal_id: string
          stripe_destination: string | null
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_kind?: string
          available_balance?: number
          created_at?: string
          currency?: string
          external_wallet_address?: string | null
          external_wallet_verified_at?: string | null
          id?: string
          pending_balance?: number
          portal_id: string
          stripe_destination?: string | null
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_kind?: string
          available_balance?: number
          created_at?: string
          currency?: string
          external_wallet_address?: string | null
          external_wallet_verified_at?: string | null
          id?: string
          pending_balance?: number
          portal_id?: string
          stripe_destination?: string | null
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_user_wallets_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_user_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_video_brand_config: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          portal_id: string
          primary_color: string
          secondary_color: string
          subtitle_bg_color: string
          subtitle_color: string
          subtitle_font: string
          subtitle_font_size: number
          subtitle_position: string
          updated_at: string
          watermark_enabled: boolean
          watermark_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          portal_id: string
          primary_color?: string
          secondary_color?: string
          subtitle_bg_color?: string
          subtitle_color?: string
          subtitle_font?: string
          subtitle_font_size?: number
          subtitle_position?: string
          updated_at?: string
          watermark_enabled?: boolean
          watermark_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          portal_id?: string
          primary_color?: string
          secondary_color?: string
          subtitle_bg_color?: string
          subtitle_color?: string
          subtitle_font?: string
          subtitle_font_size?: number
          subtitle_position?: string
          updated_at?: string
          watermark_enabled?: boolean
          watermark_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_video_brand_config_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: true
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_wallet_balances: {
        Row: {
          available_balance: number
          created_at: string
          id: string
          method: string
          pending_balance: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
          wallet_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          id?: string
          method: string
          pending_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          wallet_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          id?: string
          method?: string
          pending_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_wallet_balances_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "portal_user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_wallet_transactions: {
        Row: {
          account_kind: string
          amount: number
          balance_after_available: number
          balance_after_pending: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          portal_id: string
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          account_kind?: string
          amount: number
          balance_after_available: number
          balance_after_pending: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          portal_id: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          account_kind?: string
          amount?: number
          balance_after_available?: number
          balance_after_pending?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          portal_id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_wallet_transactions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "portal_user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_withdrawal_requests: {
        Row: {
          account_kind: string
          amount_net: number
          amount_requested: number
          approved_at: string | null
          approved_by: string | null
          coinsbuy_payout_id: string | null
          coinsbuy_response: Json | null
          coinsbuy_tx_hash: string | null
          completed_at: string | null
          created_at: string
          currency: string
          destination_address: string | null
          failure_reason: string | null
          fee_amount: number
          id: string
          network: string | null
          nowpayments_payout_id: string | null
          nowpayments_response: Json | null
          payout_method: string
          portal_id: string
          processed_at: string | null
          request_number: string | null
          status: string
          stripe_destination: string | null
          stripe_response: Json | null
          stripe_transfer_id: string | null
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          account_kind?: string
          amount_net: number
          amount_requested: number
          approved_at?: string | null
          approved_by?: string | null
          coinsbuy_payout_id?: string | null
          coinsbuy_response?: Json | null
          coinsbuy_tx_hash?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          destination_address?: string | null
          failure_reason?: string | null
          fee_amount?: number
          id?: string
          network?: string | null
          nowpayments_payout_id?: string | null
          nowpayments_response?: Json | null
          payout_method?: string
          portal_id: string
          processed_at?: string | null
          request_number?: string | null
          status?: string
          stripe_destination?: string | null
          stripe_response?: Json | null
          stripe_transfer_id?: string | null
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          account_kind?: string
          amount_net?: number
          amount_requested?: number
          approved_at?: string | null
          approved_by?: string | null
          coinsbuy_payout_id?: string | null
          coinsbuy_response?: Json | null
          coinsbuy_tx_hash?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          destination_address?: string | null
          failure_reason?: string | null
          fee_amount?: number
          id?: string
          network?: string | null
          nowpayments_payout_id?: string | null
          nowpayments_response?: Json | null
          payout_method?: string
          portal_id?: string
          processed_at?: string | null
          request_number?: string | null
          status?: string
          stripe_destination?: string | null
          stripe_response?: Json | null
          stripe_transfer_id?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_withdrawal_requests_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_withdrawal_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "portal_user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          correo: string
          created_at: string
          ib_id: string | null
          id: string
          must_change_password: boolean
          nombre: string
          preferred_timezone: string
          status: string
          sub_ib_id: string | null
          updated_at: string
        }
        Insert: {
          correo: string
          created_at?: string
          ib_id?: string | null
          id: string
          must_change_password?: boolean
          nombre: string
          preferred_timezone?: string
          status?: string
          sub_ib_id?: string | null
          updated_at?: string
        }
        Update: {
          correo?: string
          created_at?: string
          ib_id?: string | null
          id?: string
          must_change_password?: boolean
          nombre?: string
          preferred_timezone?: string
          status?: string
          sub_ib_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_sub_ib_id_fkey"
            columns: ["sub_ib_id"]
            isOneToOne: false
            referencedRelation: "sub_ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ref_cpa_hibrido: {
        Row: {
          cpa_pagar: number
          dolares_por_lote: number
          id: string
          rango_deposito: string
        }
        Insert: {
          cpa_pagar: number
          dolares_por_lote?: number
          id?: string
          rango_deposito: string
        }
        Update: {
          cpa_pagar?: number
          dolares_por_lote?: number
          id?: string
          rango_deposito?: string
        }
        Relationships: []
      }
      ref_cpa_latam: {
        Row: {
          cpa_pagar: number
          id: string
          rango_deposito: string
        }
        Insert: {
          cpa_pagar: number
          id?: string
          rango_deposito: string
        }
        Update: {
          cpa_pagar?: number
          id?: string
          rango_deposito?: string
        }
        Relationships: []
      }
      ref_propfirm_comisiones: {
        Row: {
          id: string
          porcentaje_comision: number
          rango_ventas: string
        }
        Insert: {
          id?: string
          porcentaje_comision: number
          rango_ventas: string
        }
        Update: {
          id?: string
          porcentaje_comision?: number
          rango_ventas?: string
        }
        Relationships: []
      }
      ref_propfirm_cuentas: {
        Row: {
          balance: number
          id: string
          precio: number
          tipo: string
        }
        Insert: {
          balance: number
          id?: string
          precio: number
          tipo: string
        }
        Update: {
          balance?: number
          id?: string
          precio?: number
          tipo?: string
        }
        Relationships: []
      }
      ref_spreads: {
        Row: {
          ajuste_manual: number
          dolares_ib: number
          id: string
          raw: number
          spread_estandar: number
          symbol: string
        }
        Insert: {
          ajuste_manual?: number
          dolares_ib?: number
          id?: string
          raw: number
          spread_estandar: number
          symbol: string
        }
        Update: {
          ajuste_manual?: number
          dolares_ib?: number
          id?: string
          raw?: number
          spread_estandar?: number
          symbol?: string
        }
        Relationships: []
      }
      relevant_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          manual_recipients: string[] | null
          notification_sent_at: string | null
          recipient_mode: string
          relevance_score: number
          selected_reminders: number[]
          starts_at: string
          status: string
          timezone: string
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          manual_recipients?: string[] | null
          notification_sent_at?: string | null
          recipient_mode?: string
          relevance_score?: number
          selected_reminders?: number[]
          starts_at: string
          status?: string
          timezone?: string
          title: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          manual_recipients?: string[] | null
          notification_sent_at?: string | null
          recipient_mode?: string
          relevance_score?: number
          selected_reminders?: number[]
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          data: Json
          ib_id: string
          id: string
          nombre_bd: string
          nombre_ib: string
          report_number: string
          report_type: string
        }
        Insert: {
          created_at?: string
          data: Json
          ib_id: string
          id?: string
          nombre_bd: string
          nombre_ib: string
          report_number: string
          report_type: string
        }
        Update: {
          created_at?: string
          data?: Json
          ib_id?: string
          id?: string
          nombre_bd?: string
          nombre_ib?: string
          report_number?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sales_agent_status: {
        Row: {
          call_mode_preference: string
          capacity_max: number
          created_at: string
          current_lead_id: string | null
          daily_calls: number
          daily_duration_seconds: number
          daily_reset_date: string
          id: string
          last_status_change: string
          status: string
          telefono_trabajo: string | null
          updated_at: string
          user_id: string
          welcome_message: string | null
        }
        Insert: {
          call_mode_preference?: string
          capacity_max?: number
          created_at?: string
          current_lead_id?: string | null
          daily_calls?: number
          daily_duration_seconds?: number
          daily_reset_date?: string
          id?: string
          last_status_change?: string
          status?: string
          telefono_trabajo?: string | null
          updated_at?: string
          user_id: string
          welcome_message?: string | null
        }
        Update: {
          call_mode_preference?: string
          capacity_max?: number
          created_at?: string
          current_lead_id?: string | null
          daily_calls?: number
          daily_duration_seconds?: number
          daily_reset_date?: string
          id?: string
          last_status_change?: string
          status?: string
          telefono_trabajo?: string | null
          updated_at?: string
          user_id?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_agent_status_current_lead_id_fkey"
            columns: ["current_lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_snapshots: {
        Row: {
          ai_analysis: Json | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          inputs: Json
          results: Json
          simulation_type: string
        }
        Insert: {
          ai_analysis?: Json | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          inputs: Json
          results: Json
          simulation_type?: string
        }
        Update: {
          ai_analysis?: Json | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inputs?: Json
          results?: Json
          simulation_type?: string
        }
        Relationships: []
      }
      sms_phone_blocklist: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          id: string
          phone: string
          reason: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          phone: string
          reason?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          phone?: string
          reason?: string | null
        }
        Relationships: []
      }
      sms_rate_limit_config: {
        Row: {
          email_purpose_per_10min: number
          id: number
          phone_per_10min: number
          phone_per_24h: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          email_purpose_per_10min?: number
          id?: number
          phone_per_10min?: number
          phone_per_24h?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          email_purpose_per_10min?: number
          id?: number
          phone_per_10min?: number
          phone_per_24h?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      social_connections: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          expires_at: string | null
          id: string
          platform: string
          platform_user_id: string | null
          platform_username: string | null
          refresh_token_encrypted: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          platform: string
          platform_user_id?: string | null
          platform_username?: string | null
          refresh_token_encrypted?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          platform?: string
          platform_user_id?: string | null
          platform_username?: string | null
          refresh_token_encrypted?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_publications: {
        Row: {
          caption: string | null
          clip_id: string | null
          created_at: string
          created_by: string | null
          id: string
          metrics: Json | null
          platform: string
          post_id: string | null
          post_url: string | null
          published_at: string | null
          scheduled_at: string | null
          social_connection_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          clip_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metrics?: Json | null
          platform: string
          post_id?: string | null
          post_url?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          social_connection_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          clip_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metrics?: Json | null
          platform?: string
          post_id?: string | null
          post_url?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          social_connection_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_publications_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "video_clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_publications_social_connection_id_fkey"
            columns: ["social_connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_lead_participations: {
        Row: {
          duration_seconds: number | null
          id: string
          joined_at: string
          lead_id: string
          left_at: string | null
          room_id: string
        }
        Insert: {
          duration_seconds?: number | null
          id?: string
          joined_at?: string
          lead_id: string
          left_at?: string | null
          room_id: string
        }
        Update: {
          duration_seconds?: number | null
          id?: string
          joined_at?: string
          lead_id?: string
          left_at?: string | null
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_lead_participations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_lead_participations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_leads: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          auto_reassign_count: number
          bullfy_referral_link: string | null
          closed_at: string | null
          closed_by: string | null
          contact_attempts: number
          correo: string
          created_at: string
          duplicate_portal_ids: string[] | null
          id: string
          is_duplicate: boolean
          is_registered_partner: boolean
          language: string | null
          last_contact_at: string | null
          nombre: string
          notes: string | null
          opportunity_score: number
          partner_portal_id: string | null
          pipeline_stage_id: string | null
          source: string
          stream_count: number
          tags: string[]
          taken_at: string | null
          telefono: string | null
          telegram_chat_id: number | null
          telegram_last_seen_at: string | null
          telegram_linked_at: string | null
          telegram_user_id: number | null
          telegram_username: string | null
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          auto_reassign_count?: number
          bullfy_referral_link?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_attempts?: number
          correo: string
          created_at?: string
          duplicate_portal_ids?: string[] | null
          id?: string
          is_duplicate?: boolean
          is_registered_partner?: boolean
          language?: string | null
          last_contact_at?: string | null
          nombre: string
          notes?: string | null
          opportunity_score?: number
          partner_portal_id?: string | null
          pipeline_stage_id?: string | null
          source?: string
          stream_count?: number
          tags?: string[]
          taken_at?: string | null
          telefono?: string | null
          telegram_chat_id?: number | null
          telegram_last_seen_at?: string | null
          telegram_linked_at?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          auto_reassign_count?: number
          bullfy_referral_link?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_attempts?: number
          correo?: string
          created_at?: string
          duplicate_portal_ids?: string[] | null
          id?: string
          is_duplicate?: boolean
          is_registered_partner?: boolean
          language?: string | null
          last_contact_at?: string | null
          nombre?: string
          notes?: string | null
          opportunity_score?: number
          partner_portal_id?: string | null
          pipeline_stage_id?: string | null
          source?: string
          stream_count?: number
          tags?: string[]
          taken_at?: string | null
          telefono?: string | null
          telegram_chat_id?: number | null
          telegram_last_seen_at?: string | null
          telegram_linked_at?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_leads_partner_portal_id_fkey"
            columns: ["partner_portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_leads_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      streamer_wallets: {
        Row: {
          created_at: string
          currency: string
          host_id: string
          id: string
          network: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          currency?: string
          host_id: string
          id?: string
          network?: string
          updated_at?: string
          wallet_address?: string
        }
        Update: {
          created_at?: string
          currency?: string
          host_id?: string
          id?: string
          network?: string
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      sub_ibs: {
        Row: {
          alias: string | null
          correo: string
          created_at: string
          dolares_por_lote: number | null
          es_master_ib: boolean
          ib_id: string
          id: string
          id_documento: string
          master_ib_numero: number | null
          nombre: string
          parent_sub_ib_id: string | null
          preferred_timezone: string
          tipo_id: string
        }
        Insert: {
          alias?: string | null
          correo: string
          created_at?: string
          dolares_por_lote?: number | null
          es_master_ib?: boolean
          ib_id: string
          id?: string
          id_documento?: string
          master_ib_numero?: number | null
          nombre: string
          parent_sub_ib_id?: string | null
          preferred_timezone?: string
          tipo_id?: string
        }
        Update: {
          alias?: string | null
          correo?: string
          created_at?: string
          dolares_por_lote?: number | null
          es_master_ib?: boolean
          ib_id?: string
          id?: string
          id_documento?: string
          master_ib_numero?: number | null
          nombre?: string
          parent_sub_ib_id?: string | null
          preferred_timezone?: string
          tipo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_ibs_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_ibs_parent_sub_ib_id_fkey"
            columns: ["parent_sub_ib_id"]
            isOneToOne: false
            referencedRelation: "sub_ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      telegram_link_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          lead_email: string | null
          lead_id: string | null
          lead_phone: string | null
          token: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          lead_email?: string | null
          lead_id?: string | null
          lead_phone?: string | null
          token: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          lead_email?: string | null
          lead_id?: string | null
          lead_phone?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_tokens_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_messages: {
        Row: {
          body: string | null
          created_at: string
          direction: string
          id: string
          kind: string
          lead_id: string
          media_url: string | null
          sent_by: string | null
          tg_message_id: number | null
          tg_update_id: number | null
          voice_id_used: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          direction: string
          id?: string
          kind: string
          lead_id: string
          media_url?: string | null
          sent_by?: string | null
          tg_message_id?: number | null
          tg_update_id?: number | null
          voice_id_used?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          direction?: string
          id?: string
          kind?: string
          lead_id?: string
          media_url?: string | null
          sent_by?: string | null
          tg_message_id?: number | null
          tg_update_id?: number | null
          voice_id_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "stream_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_quick_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      tournament_achievements: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          reward_points: number
          rule: Json
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          reward_points?: number
          rule?: Json
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          reward_points?: number
          rule?: Json
          sort_order?: number
        }
        Relationships: []
      }
      tournament_admin_audit: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          payload: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      tournament_bmoney_topups: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_bmoney_topups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_bp_config: {
        Row: {
          daily_streak_base_points: number
          elite_entry_fee_threshold: number
          elite_multiplier: number
          id: number
          join_base_points: number
          paid_multiplier: number
          referral_first_deposit_points: number
          updated_at: string
          updated_by: string | null
          win_first_place_points: number
          win_second_place_points: number
          win_third_place_points: number
        }
        Insert: {
          daily_streak_base_points?: number
          elite_entry_fee_threshold?: number
          elite_multiplier?: number
          id?: number
          join_base_points?: number
          paid_multiplier?: number
          referral_first_deposit_points?: number
          updated_at?: string
          updated_by?: string | null
          win_first_place_points?: number
          win_second_place_points?: number
          win_third_place_points?: number
        }
        Update: {
          daily_streak_base_points?: number
          elite_entry_fee_threshold?: number
          elite_multiplier?: number
          id?: number
          join_base_points?: number
          paid_multiplier?: number
          referral_first_deposit_points?: number
          updated_at?: string
          updated_by?: string | null
          win_first_place_points?: number
          win_second_place_points?: number
          win_third_place_points?: number
        }
        Relationships: []
      }
      tournament_chat_messages: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          message: string
          metadata: Json
          reply_to_id: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          message: string
          metadata?: Json
          reply_to_id?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          message?: string
          metadata?: Json
          reply_to_id?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "tournament_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_chat_messages_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_chat_mutes: {
        Row: {
          created_at: string
          id: string
          muted_by: string | null
          muted_until: string | null
          reason: string | null
          tournament_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_by?: string | null
          muted_until?: string | null
          reason?: string | null
          tournament_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_by?: string | null
          muted_until?: string | null
          reason?: string | null
          tournament_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_chat_mutes_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_chat_mutes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_clan_members: {
        Row: {
          clan_id: string
          contribution_score: number
          id: string
          joined_at: string
          left_at: string | null
          role: string
          user_id: string
          wars_played: number
        }
        Insert: {
          clan_id: string
          contribution_score?: number
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id: string
          wars_played?: number
        }
        Update: {
          clan_id?: string
          contribution_score?: number
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id?: string
          wars_played?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "tournament_clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_clan_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_clan_rankings_cache: {
        Row: {
          avg_member_score: number
          clan_id: string
          computed_at: string
          id: string
          members_count: number
          rank: number
          rating: number
          wars_won: number
        }
        Insert: {
          avg_member_score?: number
          clan_id: string
          computed_at?: string
          id?: string
          members_count?: number
          rank: number
          rating?: number
          wars_won?: number
        }
        Update: {
          avg_member_score?: number
          clan_id?: string
          computed_at?: string
          id?: string
          members_count?: number
          rank?: number
          rating?: number
          wars_won?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_clan_rankings_cache_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "tournament_clans"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_clan_wars: {
        Row: {
          accept_deadline: string
          challenger_clan_id: string
          challenger_participants: number | null
          challenger_score: number | null
          created_at: string
          created_by_user_id: string
          defender_clan_id: string
          defender_participants: number | null
          defender_score: number | null
          ends_at: string | null
          id: string
          message: string | null
          metadata: Json
          min_participants: number
          stake_usd: number
          starts_at: string | null
          status: string
          tournament_id: string | null
          updated_at: string
          winner_clan_id: string | null
        }
        Insert: {
          accept_deadline?: string
          challenger_clan_id: string
          challenger_participants?: number | null
          challenger_score?: number | null
          created_at?: string
          created_by_user_id: string
          defender_clan_id: string
          defender_participants?: number | null
          defender_score?: number | null
          ends_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          min_participants?: number
          stake_usd?: number
          starts_at?: string | null
          status?: string
          tournament_id?: string | null
          updated_at?: string
          winner_clan_id?: string | null
        }
        Update: {
          accept_deadline?: string
          challenger_clan_id?: string
          challenger_participants?: number | null
          challenger_score?: number | null
          created_at?: string
          created_by_user_id?: string
          defender_clan_id?: string
          defender_participants?: number | null
          defender_score?: number | null
          ends_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          min_participants?: number
          stake_usd?: number
          starts_at?: string | null
          status?: string
          tournament_id?: string | null
          updated_at?: string
          winner_clan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_clan_wars_challenger_clan_id_fkey"
            columns: ["challenger_clan_id"]
            isOneToOne: false
            referencedRelation: "tournament_clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_clan_wars_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_clan_wars_defender_clan_id_fkey"
            columns: ["defender_clan_id"]
            isOneToOne: false
            referencedRelation: "tournament_clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_clan_wars_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_clan_wars_winner_clan_id_fkey"
            columns: ["winner_clan_id"]
            isOneToOne: false
            referencedRelation: "tournament_clans"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_clans: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          invite_code: string
          is_public: boolean
          is_verified: boolean
          logo_url: string | null
          members_count: number
          name: string
          owner_id: string
          rating: number
          tag: string
          total_score: number
          total_wars: number
          updated_at: string
          verified_at: string | null
          verified_payment_id: string | null
          wars_won: number
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invite_code: string
          is_public?: boolean
          is_verified?: boolean
          logo_url?: string | null
          members_count?: number
          name: string
          owner_id: string
          rating?: number
          tag: string
          total_score?: number
          total_wars?: number
          updated_at?: string
          verified_at?: string | null
          verified_payment_id?: string | null
          wars_won?: number
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_public?: boolean
          is_verified?: boolean
          logo_url?: string | null
          members_count?: number
          name?: string
          owner_id?: string
          rating?: number
          tag?: string
          total_score?: number
          total_wars?: number
          updated_at?: string
          verified_at?: string | null
          verified_payment_id?: string | null
          wars_won?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_clans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_deals_snapshot: {
        Row: {
          account_state: Json | null
          deals: Json | null
          id: string
          mt5_login: string | null
          participant_id: string
          positions: Json | null
          taken_at: string
          tournament_id: string
        }
        Insert: {
          account_state?: Json | null
          deals?: Json | null
          id?: string
          mt5_login?: string | null
          participant_id: string
          positions?: Json | null
          taken_at?: string
          tournament_id: string
        }
        Update: {
          account_state?: Json | null
          deals?: Json | null
          id?: string
          mt5_login?: string | null
          participant_id?: string
          positions?: Json | null
          taken_at?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_deals_snapshot_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "tournament_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_deals_snapshot_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_disputes: {
        Row: {
          admin_response: string | null
          category: string
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          tournament_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          category: string
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          tournament_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          category?: string
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          tournament_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_disputes_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_disputes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_equity_snapshots: {
        Row: {
          captured_at: string
          equity: number
          id: string
          participant_id: string
          profit_pct: number
          score: number
          tournament_id: string
        }
        Insert: {
          captured_at?: string
          equity?: number
          id?: string
          participant_id: string
          profit_pct?: number
          score?: number
          tournament_id: string
        }
        Update: {
          captured_at?: string
          equity?: number
          id?: string
          participant_id?: string
          profit_pct?: number
          score?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_equity_snapshots_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "tournament_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_equity_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_fraud_flags: {
        Row: {
          created_at: string
          description: string | null
          detected_at: string
          evidence: Json
          flag_type: string
          id: string
          participant_ids: string[]
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          tournament_id: string | null
          updated_at: string
          user_ids: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          detected_at?: string
          evidence?: Json
          flag_type: string
          id?: string
          participant_ids?: string[]
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          tournament_id?: string | null
          updated_at?: string
          user_ids?: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          detected_at?: string
          evidence?: Json
          flag_type?: string
          id?: string
          participant_ids?: string[]
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          tournament_id?: string | null
          updated_at?: string
          user_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "tournament_fraud_flags_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_global_config: {
        Row: {
          base_points_participation: number
          base_points_winner: Json
          bmoney_starting_balance: number
          bmoney_topup_amount: number
          bmoney_topup_cooldown_hours: number
          bmoney_topup_threshold: number
          bp_multiplier_bmoney: number
          bp_multiplier_elite: number
          default_advance_per_group: number
          default_group_size: number
          default_house_fee_pct: number
          default_prize_distribution: Json
          default_round_duration_minutes: number
          default_scoring_weights: Json
          default_starting_balance: number
          default_trading_rules: Json
          elite_kyc_required: boolean
          elite_min_deposit_usd: number
          free_max_participants: number
          free_max_per_user_per_week: number
          free_user_creation_enabled: boolean
          house_fee_pct_default: number
          id: number
          max_tournaments_per_user_per_day: number
          paid_user_creation_enabled: boolean
          points_per_usd_prize: number
          type_multiplier: Json
          updated_at: string
        }
        Insert: {
          base_points_participation?: number
          base_points_winner?: Json
          bmoney_starting_balance?: number
          bmoney_topup_amount?: number
          bmoney_topup_cooldown_hours?: number
          bmoney_topup_threshold?: number
          bp_multiplier_bmoney?: number
          bp_multiplier_elite?: number
          default_advance_per_group?: number
          default_group_size?: number
          default_house_fee_pct?: number
          default_prize_distribution?: Json
          default_round_duration_minutes?: number
          default_scoring_weights?: Json
          default_starting_balance?: number
          default_trading_rules?: Json
          elite_kyc_required?: boolean
          elite_min_deposit_usd?: number
          free_max_participants?: number
          free_max_per_user_per_week?: number
          free_user_creation_enabled?: boolean
          house_fee_pct_default?: number
          id?: number
          max_tournaments_per_user_per_day?: number
          paid_user_creation_enabled?: boolean
          points_per_usd_prize?: number
          type_multiplier?: Json
          updated_at?: string
        }
        Update: {
          base_points_participation?: number
          base_points_winner?: Json
          bmoney_starting_balance?: number
          bmoney_topup_amount?: number
          bmoney_topup_cooldown_hours?: number
          bmoney_topup_threshold?: number
          bp_multiplier_bmoney?: number
          bp_multiplier_elite?: number
          default_advance_per_group?: number
          default_group_size?: number
          default_house_fee_pct?: number
          default_prize_distribution?: Json
          default_round_duration_minutes?: number
          default_scoring_weights?: Json
          default_starting_balance?: number
          default_trading_rules?: Json
          elite_kyc_required?: boolean
          elite_min_deposit_usd?: number
          free_max_participants?: number
          free_max_per_user_per_week?: number
          free_user_creation_enabled?: boolean
          house_fee_pct_default?: number
          id?: number
          max_tournaments_per_user_per_day?: number
          paid_user_creation_enabled?: boolean
          points_per_usd_prize?: number
          type_multiplier?: Json
          updated_at?: string
        }
        Relationships: []
      }
      tournament_groups: {
        Row: {
          created_at: string
          ends_at: string | null
          group_number: number
          id: string
          round_number: number
          starts_at: string | null
          status: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          group_number: number
          id?: string
          round_number: number
          starts_at?: string | null
          status?: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          group_number?: number
          id?: string
          round_number?: number
          starts_at?: string | null
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_highlights: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          kind: string
          scenes_data: Json
          shotstack_render_id: string | null
          status: string
          thumbnail_url: string | null
          tournament_id: string
          updated_at: string
          user_id: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          scenes_data?: Json
          shotstack_render_id?: string | null
          status?: string
          thumbnail_url?: string | null
          tournament_id: string
          updated_at?: string
          user_id?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          scenes_data?: Json
          shotstack_render_id?: string | null
          status?: string
          thumbnail_url?: string | null
          tournament_id?: string
          updated_at?: string
          user_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_highlights_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_highlights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_house_ledger: {
        Row: {
          computed_at: string
          gross_pool_usd: number
          house_cut_usd: number
          id: string
          net_revenue_usd: number
          participants_count: number
          prizes_paid_usd: number
          tournament_id: string
        }
        Insert: {
          computed_at?: string
          gross_pool_usd?: number
          house_cut_usd?: number
          id?: string
          net_revenue_usd?: number
          participants_count?: number
          prizes_paid_usd?: number
          tournament_id: string
        }
        Update: {
          computed_at?: string
          gross_pool_usd?: number
          house_cut_usd?: number
          id?: string
          net_revenue_usd?: number
          participants_count?: number
          prizes_paid_usd?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_house_ledger_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_kyc_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_url: string
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_url: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_url?: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          phone: string | null
          purpose: Database["public"]["Enums"]["tournament_otp_purpose"]
          verified: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          purpose: Database["public"]["Enums"]["tournament_otp_purpose"]
          verified?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          phone?: string | null
          purpose?: Database["public"]["Enums"]["tournament_otp_purpose"]
          verified?: boolean
        }
        Relationships: []
      }
      tournament_participants: {
        Row: {
          closed_at: string | null
          created_at: string
          current_balance: number
          current_equity: number
          current_round: number
          current_score: number
          eliminated_at: string | null
          entry_currency: string
          entry_paid: number
          final_balance: number | null
          final_equity: number | null
          final_pnl: number | null
          final_pnl_pct: number | null
          final_rank: number | null
          group_id: string | null
          id: string
          initial_funded_equity_usd: number | null
          joined_at: string
          last_synced_at: string | null
          losing_trades: number
          max_drawdown_pct: number
          metadata: Json
          mt5_deleted_at: string | null
          mt5_kind: string
          mt5_login: string | null
          mt5_password: string | null
          mt5_server: string | null
          mt5_suspended: boolean
          points_won: number
          prize_won_usd: number
          profit_factor: number
          profit_pct: number
          sharpe: number
          starting_balance: number
          status: Database["public"]["Enums"]["tournament_participant_status"]
          tournament_id: string
          trades_count: number
          updated_at: string
          user_id: string
          winning_trades: number
          winrate: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          current_balance?: number
          current_equity?: number
          current_round?: number
          current_score?: number
          eliminated_at?: string | null
          entry_currency?: string
          entry_paid?: number
          final_balance?: number | null
          final_equity?: number | null
          final_pnl?: number | null
          final_pnl_pct?: number | null
          final_rank?: number | null
          group_id?: string | null
          id?: string
          initial_funded_equity_usd?: number | null
          joined_at?: string
          last_synced_at?: string | null
          losing_trades?: number
          max_drawdown_pct?: number
          metadata?: Json
          mt5_deleted_at?: string | null
          mt5_kind?: string
          mt5_login?: string | null
          mt5_password?: string | null
          mt5_server?: string | null
          mt5_suspended?: boolean
          points_won?: number
          prize_won_usd?: number
          profit_factor?: number
          profit_pct?: number
          sharpe?: number
          starting_balance: number
          status?: Database["public"]["Enums"]["tournament_participant_status"]
          tournament_id: string
          trades_count?: number
          updated_at?: string
          user_id: string
          winning_trades?: number
          winrate?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          current_balance?: number
          current_equity?: number
          current_round?: number
          current_score?: number
          eliminated_at?: string | null
          entry_currency?: string
          entry_paid?: number
          final_balance?: number | null
          final_equity?: number | null
          final_pnl?: number | null
          final_pnl_pct?: number | null
          final_rank?: number | null
          group_id?: string | null
          id?: string
          initial_funded_equity_usd?: number | null
          joined_at?: string
          last_synced_at?: string | null
          losing_trades?: number
          max_drawdown_pct?: number
          metadata?: Json
          mt5_deleted_at?: string | null
          mt5_kind?: string
          mt5_login?: string | null
          mt5_password?: string | null
          mt5_server?: string | null
          mt5_suspended?: boolean
          points_won?: number
          prize_won_usd?: number
          profit_factor?: number
          profit_pct?: number
          sharpe?: number
          starting_balance?: number
          status?: Database["public"]["Enums"]["tournament_participant_status"]
          tournament_id?: string
          trades_count?: number
          updated_at?: string
          user_id?: string
          winning_trades?: number
          winrate?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_tp_group"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tournament_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_payments: {
        Row: {
          amount_usd: number
          created_at: string
          currency: string
          expires_at: string | null
          gateway: string | null
          gateway_payment_url: string | null
          gateway_ref: string | null
          gateway_session_id: string | null
          id: string
          metadata: Json
          status: Database["public"]["Enums"]["tournament_payment_status"]
          tournament_id: string | null
          type: Database["public"]["Enums"]["tournament_payment_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          gateway?: string | null
          gateway_payment_url?: string | null
          gateway_ref?: string | null
          gateway_session_id?: string | null
          id?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["tournament_payment_status"]
          tournament_id?: string | null
          type: Database["public"]["Enums"]["tournament_payment_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          gateway?: string | null
          gateway_payment_url?: string | null
          gateway_ref?: string | null
          gateway_session_id?: string | null
          id?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["tournament_payment_status"]
          tournament_id?: string | null
          type?: Database["public"]["Enums"]["tournament_payment_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_payments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_points_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json
          reason: string
          redemption_code_id: string | null
          tournament_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          metadata?: Json
          reason: string
          redemption_code_id?: string | null
          tournament_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json
          reason?: string
          redemption_code_id?: string | null
          tournament_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_points_ledger_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_rankings_cache: {
        Row: {
          computed_at: string
          id: string
          period: string
          rank: number
          scope: string
          total_points: number
          total_winnings_usd: number
          tournaments_played: number
          tournaments_won: number
          user_id: string
        }
        Insert: {
          computed_at?: string
          id?: string
          period?: string
          rank: number
          scope: string
          total_points?: number
          total_winnings_usd?: number
          tournaments_played?: number
          tournaments_won?: number
          user_id: string
        }
        Update: {
          computed_at?: string
          id?: string
          period?: string
          rank?: number
          scope?: string
          total_points?: number
          total_winnings_usd?: number
          tournaments_played?: number
          tournaments_won?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_rankings_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_redemption_catalog: {
        Row: {
          active: boolean
          cost_points: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["tournament_redemption_kind"]
          name: string
          payload: Json
          stock: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_points: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["tournament_redemption_kind"]
          name: string
          payload?: Json
          stock?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_points?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["tournament_redemption_kind"]
          name?: string
          payload?: Json
          stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      tournament_redemption_codes: {
        Row: {
          catalog_id: string
          code: string
          cost_points: number
          created_at: string
          expires_at: string | null
          id: string
          payload: Json
          used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          catalog_id: string
          code: string
          cost_points: number
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          catalog_id?: string
          code?: string
          cost_points?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_redemption_codes_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "tournament_redemption_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_redemption_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_referrals: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          qualified_at: string | null
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          reward_points: number | null
          rewarded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          qualified_at?: string | null
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          reward_points?: number | null
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          qualified_at?: string | null
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          reward_points?: number | null
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_trades: {
        Row: {
          close_price: number | null
          close_time: string | null
          commission: number
          created_at: string
          id: string
          open_price: number | null
          open_time: string | null
          participant_id: string
          profit: number
          raw: Json | null
          swap: number
          symbol: string
          ticket: string
          type: string
          volume: number
        }
        Insert: {
          close_price?: number | null
          close_time?: string | null
          commission?: number
          created_at?: string
          id?: string
          open_price?: number | null
          open_time?: string | null
          participant_id: string
          profit?: number
          raw?: Json | null
          swap?: number
          symbol: string
          ticket: string
          type: string
          volume: number
        }
        Update: {
          close_price?: number | null
          close_time?: string | null
          commission?: number
          created_at?: string
          id?: string
          open_price?: number | null
          open_time?: string | null
          participant_id?: string
          profit?: number
          raw?: Json | null
          swap?: number
          symbol?: string
          ticket?: string
          type?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_trades_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "tournament_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_user_achievements: {
        Row: {
          achievement_id: string
          id: string
          metadata: Json
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          metadata?: Json
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          metadata?: Json
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "tournament_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_user_poses: {
        Row: {
          id: string
          pose_key: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          pose_key: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          pose_key?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_user_poses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          last_used_at: string
          token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          last_used_at?: string
          token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_used_at?: string
          token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_user_verifications: {
        Row: {
          created_at: string
          id: string
          id_back_url: string | null
          id_front_url: string | null
          payment_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          payment_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          payment_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_user_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_users: {
        Row: {
          avatar_3d_url: string | null
          avatar_config: Json | null
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          bio: string | null
          bullfy_points: number
          clan_change_available_at: string | null
          clan_id: string | null
          country: string | null
          created_at: string
          daily_streak: number
          email: string
          email_verified_at: string | null
          full_name: string
          id: string
          is_elite: boolean
          is_verified_user: boolean
          kyc_status: string
          kyc_submitted_at: string | null
          last_device_fingerprint: string | null
          last_login_ip: string | null
          last_streak_date: string | null
          lead_id: string | null
          lifetime_winnings_usd: number
          metadata: Json
          password_hash: string | null
          phone: string
          phone_verified_at: string | null
          preferred_pose: string
          public_profile: boolean
          referral_code: string | null
          referred_by_code: string | null
          signup_ip: string | null
          updated_at: string
          username: string | null
          verified_user_at: string | null
        }
        Insert: {
          avatar_3d_url?: string | null
          avatar_config?: Json | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          bullfy_points?: number
          clan_change_available_at?: string | null
          clan_id?: string | null
          country?: string | null
          created_at?: string
          daily_streak?: number
          email: string
          email_verified_at?: string | null
          full_name: string
          id?: string
          is_elite?: boolean
          is_verified_user?: boolean
          kyc_status?: string
          kyc_submitted_at?: string | null
          last_device_fingerprint?: string | null
          last_login_ip?: string | null
          last_streak_date?: string | null
          lead_id?: string | null
          lifetime_winnings_usd?: number
          metadata?: Json
          password_hash?: string | null
          phone: string
          phone_verified_at?: string | null
          preferred_pose?: string
          public_profile?: boolean
          referral_code?: string | null
          referred_by_code?: string | null
          signup_ip?: string | null
          updated_at?: string
          username?: string | null
          verified_user_at?: string | null
        }
        Update: {
          avatar_3d_url?: string | null
          avatar_config?: Json | null
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          bullfy_points?: number
          clan_change_available_at?: string | null
          clan_id?: string | null
          country?: string | null
          created_at?: string
          daily_streak?: number
          email?: string
          email_verified_at?: string | null
          full_name?: string
          id?: string
          is_elite?: boolean
          is_verified_user?: boolean
          kyc_status?: string
          kyc_submitted_at?: string | null
          last_device_fingerprint?: string | null
          last_login_ip?: string | null
          last_streak_date?: string | null
          lead_id?: string | null
          lifetime_winnings_usd?: number
          metadata?: Json
          password_hash?: string | null
          phone?: string
          phone_verified_at?: string | null
          preferred_pose?: string
          public_profile?: boolean
          referral_code?: string | null
          referred_by_code?: string | null
          signup_ip?: string | null
          updated_at?: string
          username?: string | null
          verified_user_at?: string | null
        }
        Relationships: []
      }
      tournament_versus: {
        Row: {
          accepted_at: string | null
          challenger_id: string
          challenger_score: number | null
          created_at: string
          duration_minutes: number
          ends_at: string | null
          expires_at: string
          id: string
          invite_token: string | null
          message: string | null
          opponent_email: string | null
          opponent_id: string | null
          opponent_score: number | null
          opponent_username_hint: string | null
          stake_usd: number
          starts_at: string | null
          status: string
          tournament_id: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          challenger_id: string
          challenger_score?: number | null
          created_at?: string
          duration_minutes?: number
          ends_at?: string | null
          expires_at?: string
          id?: string
          invite_token?: string | null
          message?: string | null
          opponent_email?: string | null
          opponent_id?: string | null
          opponent_score?: number | null
          opponent_username_hint?: string | null
          stake_usd?: number
          starts_at?: string | null
          status?: string
          tournament_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          challenger_id?: string
          challenger_score?: number | null
          created_at?: string
          duration_minutes?: number
          ends_at?: string | null
          expires_at?: string
          id?: string
          invite_token?: string | null
          message?: string | null
          opponent_email?: string | null
          opponent_id?: string | null
          opponent_score?: number | null
          opponent_username_hint?: string | null
          stake_usd?: number
          starts_at?: string | null
          status?: string
          tournament_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_versus_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_versus_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_versus_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_versus_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_wallets: {
        Row: {
          balance_usd: number
          bmoney_balance: number
          bmoney_locked: number
          created_at: string
          id: string
          last_bmoney_topup_at: string | null
          locked_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_usd?: number
          bmoney_balance?: number
          bmoney_locked?: number
          created_at?: string
          id?: string
          last_bmoney_topup_at?: string | null
          locked_usd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_usd?: number
          bmoney_balance?: number
          bmoney_locked?: number
          created_at?: string
          id?: string
          last_bmoney_topup_at?: string | null
          locked_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_withdrawals: {
        Row: {
          amount_usd: number
          created_at: string
          fee_usd: number
          id: string
          net_usd: number
          network: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          status: string
          tx_hash: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          fee_usd?: number
          id?: string
          net_usd: number
          network?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          fee_usd?: number
          id?: string
          net_usd?: number
          network?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          advance_per_group: number
          allows_funded_mt5: boolean
          approval_status: Database["public"]["Enums"]["tournament_approval_status"]
          approved_at: string | null
          approved_by: string | null
          banner_url: string | null
          bullfy_points_pool: number
          clan_war_id: string | null
          cleanup_at: string | null
          cleanup_done: boolean
          created_at: string
          created_by_admin_id: string | null
          created_by_user_id: string | null
          current_round: number
          current_round_ends_at: string | null
          description: string | null
          ends_at: string | null
          entry_fee_bmoney: number
          entry_fee_usd: number
          group_size: number
          house_fee_pct: number
          id: string
          is_private: boolean
          league: string
          max_participants: number
          metadata: Json
          min_funded_equity_usd: number | null
          min_participants: number
          modality: Database["public"]["Enums"]["tournament_modality"]
          name: string
          participants_count: number
          prize_distribution: Json
          prize_pool_usd: number
          registration_closes_at: string | null
          rejection_reason: string | null
          round_duration_minutes: number
          scoring_weights: Json
          slug: string
          starting_balance_usd: number
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          total_rounds: number | null
          trading_disabled_at: string | null
          trading_enabled_at: string | null
          trading_rules: Json
          type: Database["public"]["Enums"]["tournament_type"]
          updated_at: string
          versus_id: string | null
        }
        Insert: {
          advance_per_group?: number
          allows_funded_mt5?: boolean
          approval_status?: Database["public"]["Enums"]["tournament_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          banner_url?: string | null
          bullfy_points_pool?: number
          clan_war_id?: string | null
          cleanup_at?: string | null
          cleanup_done?: boolean
          created_at?: string
          created_by_admin_id?: string | null
          created_by_user_id?: string | null
          current_round?: number
          current_round_ends_at?: string | null
          description?: string | null
          ends_at?: string | null
          entry_fee_bmoney?: number
          entry_fee_usd?: number
          group_size?: number
          house_fee_pct?: number
          id?: string
          is_private?: boolean
          league?: string
          max_participants?: number
          metadata?: Json
          min_funded_equity_usd?: number | null
          min_participants?: number
          modality: Database["public"]["Enums"]["tournament_modality"]
          name: string
          participants_count?: number
          prize_distribution?: Json
          prize_pool_usd?: number
          registration_closes_at?: string | null
          rejection_reason?: string | null
          round_duration_minutes?: number
          scoring_weights?: Json
          slug: string
          starting_balance_usd?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          total_rounds?: number | null
          trading_disabled_at?: string | null
          trading_enabled_at?: string | null
          trading_rules?: Json
          type: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
          versus_id?: string | null
        }
        Update: {
          advance_per_group?: number
          allows_funded_mt5?: boolean
          approval_status?: Database["public"]["Enums"]["tournament_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          banner_url?: string | null
          bullfy_points_pool?: number
          clan_war_id?: string | null
          cleanup_at?: string | null
          cleanup_done?: boolean
          created_at?: string
          created_by_admin_id?: string | null
          created_by_user_id?: string | null
          current_round?: number
          current_round_ends_at?: string | null
          description?: string | null
          ends_at?: string | null
          entry_fee_bmoney?: number
          entry_fee_usd?: number
          group_size?: number
          house_fee_pct?: number
          id?: string
          is_private?: boolean
          league?: string
          max_participants?: number
          metadata?: Json
          min_funded_equity_usd?: number | null
          min_participants?: number
          modality?: Database["public"]["Enums"]["tournament_modality"]
          name?: string
          participants_count?: number
          prize_distribution?: Json
          prize_pool_usd?: number
          registration_closes_at?: string | null
          rejection_reason?: string | null
          round_duration_minutes?: number
          scoring_weights?: Json
          slug?: string
          starting_balance_usd?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          total_rounds?: number | null
          trading_disabled_at?: string | null
          trading_enabled_at?: string | null
          trading_rules?: Json
          type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
          versus_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_clan_war_id_fkey"
            columns: ["clan_war_id"]
            isOneToOne: false
            referencedRelation: "tournament_clan_wars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "tournament_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_versus_id_fkey"
            columns: ["versus_id"]
            isOneToOne: false
            referencedRelation: "tournament_versus"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_chart_layouts: {
        Row: {
          created_at: string
          drawings_json: Json
          id: string
          indicators_json: Json
          is_default: boolean
          symbol: string
          timeframe: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drawings_json?: Json
          id?: string
          indicators_json?: Json
          is_default?: boolean
          symbol: string
          timeframe?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drawings_json?: Json
          id?: string
          indicators_json?: Json
          is_default?: boolean
          symbol?: string
          timeframe?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_journal: {
        Row: {
          account_login: string | null
          action: string
          created_at: string
          id: string
          ok: boolean | null
          payload_json: Json | null
          result_json: Json | null
          user_id: string
        }
        Insert: {
          account_login?: string | null
          action: string
          created_at?: string
          id?: string
          ok?: boolean | null
          payload_json?: Json | null
          result_json?: Json | null
          user_id: string
        }
        Update: {
          account_login?: string | null
          action?: string
          created_at?: string
          id?: string
          ok?: boolean | null
          payload_json?: Json | null
          result_json?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      trading_platform_access: {
        Row: {
          enabled: boolean
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          enabled?: boolean
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          enabled?: boolean
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trading_room_accounts: {
        Row: {
          account_label: string | null
          ai_analysis_frequency: string
          bridge_login: string | null
          broker_server: string
          connection_status: string
          created_at: string
          deployment_mode: string | null
          ib_id: string
          id: string
          is_active_for_stream: boolean
          last_analysis_at: string | null
          last_snapshot_at: string | null
          metaapi_account_id: string | null
          mt_login: string | null
          notes: string | null
          partner_user_id: string
          portal_id: string
          provider: string
          refreshes_per_day: number
          selected_session_key: string | null
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          ai_analysis_frequency?: string
          bridge_login?: string | null
          broker_server?: string
          connection_status?: string
          created_at?: string
          deployment_mode?: string | null
          ib_id: string
          id?: string
          is_active_for_stream?: boolean
          last_analysis_at?: string | null
          last_snapshot_at?: string | null
          metaapi_account_id?: string | null
          mt_login?: string | null
          notes?: string | null
          partner_user_id: string
          portal_id: string
          provider?: string
          refreshes_per_day?: number
          selected_session_key?: string | null
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          ai_analysis_frequency?: string
          bridge_login?: string | null
          broker_server?: string
          connection_status?: string
          created_at?: string
          deployment_mode?: string | null
          ib_id?: string
          id?: string
          is_active_for_stream?: boolean
          last_analysis_at?: string | null
          last_snapshot_at?: string | null
          metaapi_account_id?: string | null
          mt_login?: string | null
          notes?: string | null
          partner_user_id?: string
          portal_id?: string
          provider?: string
          refreshes_per_day?: number
          selected_session_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_room_accounts_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_accounts_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_accounts_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_room_analysis_runs: {
        Row: {
          account_id: string
          analysis_type: string
          completed_at: string | null
          created_at: string
          id: string
          input_snapshot_ids: string[]
          partner_user_id: string
          recommendations: Json
          status: string
          summary: string | null
        }
        Insert: {
          account_id: string
          analysis_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          input_snapshot_ids?: string[]
          partner_user_id: string
          recommendations?: Json
          status?: string
          summary?: string | null
        }
        Update: {
          account_id?: string
          analysis_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          input_snapshot_ids?: string[]
          partner_user_id?: string
          recommendations?: Json
          status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trading_room_analysis_runs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trading_room_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_analysis_runs_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_room_favorite_symbols: {
        Row: {
          account_id: string | null
          created_at: string
          display_name: string | null
          id: string
          partner_user_id: string
          portal_id: string
          symbol: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          partner_user_id: string
          portal_id: string
          symbol: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          partner_user_id?: string
          portal_id?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_room_favorite_symbols_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trading_room_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_favorite_symbols_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_favorite_symbols_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_room_ib_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          enabled_by: string | null
          expires_at: string | null
          ib_id: string
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          enabled_by?: string | null
          expires_at?: string | null
          ib_id: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          enabled_by?: string | null
          expires_at?: string | null
          ib_id?: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_room_ib_overrides_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: true
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_room_order_intents: {
        Row: {
          account_id: string
          created_at: string
          executed_at: string | null
          execution_status: string
          failure_reason: string | null
          id: string
          lot_size: number
          metaapi_position_id: string | null
          partner_user_id: string
          portal_id: string
          requested_at: string
          room_id: string | null
          side: string
          source: string
          stop_loss: number | null
          symbol: string | null
          take_profit: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          executed_at?: string | null
          execution_status?: string
          failure_reason?: string | null
          id?: string
          lot_size: number
          metaapi_position_id?: string | null
          partner_user_id: string
          portal_id: string
          requested_at?: string
          room_id?: string | null
          side: string
          source?: string
          stop_loss?: number | null
          symbol?: string | null
          take_profit?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          executed_at?: string | null
          execution_status?: string
          failure_reason?: string | null
          id?: string
          lot_size?: number
          metaapi_position_id?: string | null
          partner_user_id?: string
          portal_id?: string
          requested_at?: string
          room_id?: string | null
          side?: string
          source?: string
          stop_loss?: number | null
          symbol?: string | null
          take_profit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_room_order_intents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trading_room_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_order_intents_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_order_intents_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_order_intents_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_room_plan_catalog: {
        Row: {
          active_hours_per_month: number
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          metaapi_cost_monthly: number
          mode: string
          notes: string | null
          plan_code: string
          session_key: string | null
          session_label: string | null
          sort_order: number
          target_margin_pct: number
          target_price_monthly: number
          updated_at: string
          window_end_utc: string | null
          window_start_utc: string | null
        }
        Insert: {
          active_hours_per_month?: number
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          metaapi_cost_monthly?: number
          mode: string
          notes?: string | null
          plan_code: string
          session_key?: string | null
          session_label?: string | null
          sort_order?: number
          target_margin_pct?: number
          target_price_monthly?: number
          updated_at?: string
          window_end_utc?: string | null
          window_start_utc?: string | null
        }
        Update: {
          active_hours_per_month?: number
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          metaapi_cost_monthly?: number
          mode?: string
          notes?: string | null
          plan_code?: string
          session_key?: string | null
          session_label?: string | null
          sort_order?: number
          target_margin_pct?: number
          target_price_monthly?: number
          updated_at?: string
          window_end_utc?: string | null
          window_start_utc?: string | null
        }
        Relationships: []
      }
      trading_room_snapshots: {
        Row: {
          account_id: string
          created_at: string
          id: string
          snapshot_data: Json
          snapshot_type: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          snapshot_data?: Json
          snapshot_type?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          snapshot_data?: Json
          snapshot_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_room_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trading_room_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_room_subscriptions: {
        Row: {
          access_status: string
          auto_renew: boolean
          billing_status: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          expired_at: string | null
          expiry_notified_at: string | null
          external_subscription_id: string | null
          ib_id: string
          id: string
          last_payment_id: string | null
          next_period_start: string | null
          partner_user_id: string
          payment_provider: string | null
          pending_invoice_id: string | null
          pending_invoice_url: string | null
          plan_id: string
          portal_id: string
          price_monthly: number
          renewal_due_at: string | null
          updated_at: string
        }
        Insert: {
          access_status?: string
          auto_renew?: boolean
          billing_status?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expired_at?: string | null
          expiry_notified_at?: string | null
          external_subscription_id?: string | null
          ib_id: string
          id?: string
          last_payment_id?: string | null
          next_period_start?: string | null
          partner_user_id: string
          payment_provider?: string | null
          pending_invoice_id?: string | null
          pending_invoice_url?: string | null
          plan_id: string
          portal_id: string
          price_monthly?: number
          renewal_due_at?: string | null
          updated_at?: string
        }
        Update: {
          access_status?: string
          auto_renew?: boolean
          billing_status?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          expired_at?: string | null
          expiry_notified_at?: string | null
          external_subscription_id?: string | null
          ib_id?: string
          id?: string
          last_payment_id?: string | null
          next_period_start?: string | null
          partner_user_id?: string
          payment_provider?: string | null
          pending_invoice_id?: string | null
          pending_invoice_url?: string | null
          plan_id?: string
          portal_id?: string
          price_monthly?: number
          renewal_due_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_room_subscriptions_ib_id_fkey"
            columns: ["ib_id"]
            isOneToOne: false
            referencedRelation: "ibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_subscriptions_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trading_room_plan_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trading_room_plan_catalog_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_subscriptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_room_test_plan_overrides: {
        Row: {
          always_active: boolean
          created_at: string
          enabled: boolean
          id: string
          notes: string | null
          partner_user_id: string
          plan_id: string
          portal_id: string
          updated_at: string
        }
        Insert: {
          always_active?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          partner_user_id: string
          plan_id: string
          portal_id: string
          updated_at?: string
        }
        Update: {
          always_active?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          partner_user_id?: string
          plan_id?: string
          portal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_room_test_plan_overrides_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "partner_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_test_plan_overrides_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trading_room_plan_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_test_plan_overrides_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trading_room_plan_catalog_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_room_test_plan_overrides_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "partner_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_watchlist: {
        Row: {
          created_at: string
          id: string
          order_index: number
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      unified_identities: {
        Row: {
          created_at: string
          display_name: string | null
          email_normalized: string
          id: string
          is_duplicate: boolean
          phone_normalized: string | null
          sources: Json
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email_normalized: string
          id?: string
          is_duplicate?: boolean
          phone_normalized?: string | null
          sources?: Json
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email_normalized?: string
          id?: string
          is_duplicate?: boolean
          phone_normalized?: string | null
          sources?: Json
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_clips: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: number
          format: string
          has_subtitles: boolean
          hook_reason: string | null
          hook_score: number | null
          id: string
          output_url: string | null
          render_status: string
          shotstack_render_id: string | null
          source_id: string | null
          source_type: string
          source_url: string
          start_time: number
          title: string | null
          transcript_segment: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: number
          format?: string
          has_subtitles?: boolean
          hook_reason?: string | null
          hook_score?: number | null
          id?: string
          output_url?: string | null
          render_status?: string
          shotstack_render_id?: string | null
          source_id?: string | null
          source_type?: string
          source_url: string
          start_time?: number
          title?: string | null
          transcript_segment?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: number
          format?: string
          has_subtitles?: boolean
          hook_reason?: string | null
          hook_score?: number | null
          id?: string
          output_url?: string | null
          render_status?: string
          shotstack_render_id?: string | null
          source_id?: string | null
          source_type?: string
          source_url?: string
          start_time?: number
          title?: string | null
          transcript_segment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      video_studio_access: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          can_auto_clip: boolean
          can_publish_social: boolean
          can_remove_branding: boolean
          created_at: string
          enabled: boolean
          host_auto_clip_opt_in: boolean
          id: string
          monthly_analysis_limit: number
          monthly_clip_limit: number
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          can_auto_clip?: boolean
          can_publish_social?: boolean
          can_remove_branding?: boolean
          created_at?: string
          enabled?: boolean
          host_auto_clip_opt_in?: boolean
          id?: string
          monthly_analysis_limit?: number
          monthly_clip_limit?: number
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          can_auto_clip?: boolean
          can_publish_social?: boolean
          can_remove_branding?: boolean
          created_at?: string
          enabled?: boolean
          host_auto_clip_opt_in?: boolean
          id?: string
          monthly_analysis_limit?: number
          monthly_clip_limit?: number
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_studio_usage_log: {
        Row: {
          action: string
          created_at: string
          credits_used: number
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits_used?: number
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credits_used?: number
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          active: boolean
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          language: string
          name: string
          status: string
          twilio_content_sid: string | null
          updated_at: string
          variables_count: number
        }
        Insert: {
          active?: boolean
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          name: string
          status?: string
          twilio_content_sid?: string | null
          updated_at?: string
          variables_count?: number
        }
        Update: {
          active?: boolean
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          name?: string
          status?: string
          twilio_content_sid?: string | null
          updated_at?: string
          variables_count?: number
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          currency: string
          host_id: string
          id: string
          network: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          host_id: string
          id?: string
          network?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          host_id?: string
          id?: string
          network?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      closer_metrics_daily: {
        Row: {
          avg_seconds_to_first_contact: number | null
          closer_id: string | null
          comunidades_trabajadas: number | null
          day: string | null
          leads_cerrados: number | null
          leads_contactados: number | null
          leads_tomados: number | null
          tasa_cierre_pct: number | null
          tasa_respuesta_pct: number | null
        }
        Relationships: []
      }
      trading_room_plan_catalog_public: {
        Row: {
          active_hours_per_month: number | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_active: boolean | null
          mode: string | null
          notes: string | null
          plan_code: string | null
          session_key: string | null
          session_label: string | null
          sort_order: number | null
          target_price_monthly: number | null
          updated_at: string | null
          window_end_utc: string | null
          window_start_utc: string | null
        }
        Insert: {
          active_hours_per_month?: number | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_active?: boolean | null
          mode?: string | null
          notes?: string | null
          plan_code?: string | null
          session_key?: string | null
          session_label?: string | null
          sort_order?: number | null
          target_price_monthly?: number | null
          updated_at?: string | null
          window_end_utc?: string | null
          window_start_utc?: string | null
        }
        Update: {
          active_hours_per_month?: number | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_active?: boolean | null
          mode?: string | null
          notes?: string | null
          plan_code?: string | null
          session_key?: string | null
          session_label?: string | null
          sort_order?: number | null
          target_price_monthly?: number | null
          updated_at?: string | null
          window_end_utc?: string | null
          window_start_utc?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_grant_demo_funds: {
        Args: {
          _amount: number
          _description?: string
          _portal_id: string
          _user_id: string
        }
        Returns: number
      }
      approve_and_credit_live_earnings: {
        Args: { _host_id: string }
        Returns: Json
      }
      approve_invoice_to_expense:
        | {
            Args: {
              p_category_id: string
              p_cost_center_id?: string
              p_description?: string
              p_entity_id?: string
              p_expense_date?: string
              p_funding_source?: string
              p_geography_id: string
              p_invoice_id: string
              p_user_id?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_card_id?: string
              p_category_id: string
              p_cost_center_id?: string
              p_description?: string
              p_entity_id?: string
              p_expense_date?: string
              p_funding_source?: string
              p_geography_id: string
              p_invoice_id: string
              p_payment_method_id?: string
              p_user_id?: string
            }
            Returns: string
          }
      assign_tournament_lead: { Args: { _lead_id: string }; Returns: string }
      auto_claim_stream_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: undefined
      }
      cleanup_cron_logs: { Args: never; Returns: string }
      cleanup_old_translation_segments: { Args: never; Returns: undefined }
      close_stale_rooms: { Args: never; Returns: undefined }
      closer_can_access_portal: {
        Args: { _portal: string; _user: string }
        Returns: boolean
      }
      complete_withdrawal: {
        Args: { _payout_id?: string; _tx_hash?: string; _withdrawal_id: string }
        Returns: string
      }
      create_withdrawal_request: {
        Args: {
          _account_kind?: string
          _amount: number
          _destination_address?: string
          _payout_method: string
          _portal_id: string
          _stripe_destination?: string
          _user_id: string
        }
        Returns: string
      }
      credit_commission_to_wallet: {
        Args: {
          _account_kind?: string
          _amount: number
          _description: string
          _metadata?: Json
          _portal_id: string
          _reference_id: string
          _txn_type: string
          _user_id: string
        }
        Returns: string
      }
      credit_wallet_method: {
        Args: {
          _account_kind: string
          _amount: number
          _availability: string
          _description: string
          _metadata?: Json
          _method: string
          _portal_id: string
          _reference_id: string
          _reference_type: string
          _user_id: string
        }
        Returns: undefined
      }
      debit_demo_wallet: {
        Args: {
          _amount: number
          _description?: string
          _order_id?: string
          _portal_id: string
          _user_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      distribute_order_commissions: {
        Args: { _order_id: string }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_due_memberships: { Args: never; Returns: undefined }
      generate_lead_monthly_report: {
        Args: { _period_start?: string }
        Returns: string
      }
      get_budget_variances: {
        Args: { _budget_id: string }
        Returns: {
          actual_usd: number
          budget_line_id: string
          category_id: string
          category_name: string
          cost_center_id: string
          geography_id: string
          planned_usd: number
          status: string
          variance_pct: number
          variance_usd: number
        }[]
      }
      get_fx_to_usd: {
        Args: { _currency: string; _date: string }
        Returns: number
      }
      get_or_create_user_wallet: {
        Args: { _account_kind?: string; _portal_id: string; _user_id: string }
        Returns: string
      }
      get_portal_host_user_id: { Args: { _portal_id: string }; Returns: string }
      get_portal_ledger_balance: {
        Args: { _portal_id: string }
        Returns: number
      }
      get_user_upline: {
        Args: { _max_levels?: number; _portal_id: string; _user_id: string }
        Returns: {
          level_number: number
          upline_user_id: string
        }[]
      }
      has_live_feature_access: {
        Args: { _feature_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_global_admin: { Args: never; Returns: boolean }
      is_internal_staff: { Args: { _user_id: string }; Returns: boolean }
      is_portal_admin: { Args: { _portal_id: string }; Returns: boolean }
      is_portal_owner: { Args: { _portal_id: string }; Returns: boolean }
      lead_enrichment_recompute: { Args: never; Returns: number }
      lead_metrics_aggregate: { Args: { target_date?: string }; Returns: Json }
      lead_scoring_recompute: { Args: never; Returns: Json }
      lead_sla_check_run: { Args: never; Returns: Json }
      lead_system_alerts_tick: { Args: never; Returns: Json }
      lead_system_tick: { Args: never; Returns: Json }
      lead_top_performers: {
        Args: { period_days?: number }
        Returns: {
          avg_first_contact_minutes: number
          closer_id: string
          conversion_rate: number
          lost_leads: number
          new_leads: number
          sla_violations: number
          won_leads: number
        }[]
      }
      lead_webhook_enqueue: {
        Args: { p_event: string; p_lead_id: string; p_payload: Json }
        Returns: number
      }
      log_tournament_admin_action: {
        Args: {
          _action: string
          _payload?: Json
          _target_id: string
          _target_type: string
        }
        Returns: string
      }
      mark_expense_reimbursed: {
        Args: { p_expense_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      portal_commerce_enabled: {
        Args: { _portal_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reconcile_unprocessed_paid_orders: { Args: never; Returns: number }
      refresh_closer_metrics_daily: { Args: never; Returns: undefined }
      refund_withdrawal: {
        Args: { _reason: string; _withdrawal_id: string }
        Returns: string
      }
      release_commission: { Args: { _commission_id: string }; Returns: string }
      release_due_portal_owner_commissions: { Args: never; Returns: number }
      release_inactive_leads: { Args: never; Returns: undefined }
      resolve_live_host_to_portal_and_user: {
        Args: { _host_id: string }
        Returns: {
          host_partner_user_id: string
          portal_id: string
        }[]
      }
      save_portal_mlm_settings: {
        Args: {
          _active_levels: number
          _business_partners_enabled: boolean
          _commission_mode: string
          _enabled: boolean
          _levels?: Json
          _mlm_pool_percentage: number
          _orphan_policy: string
          _portal_id: string
          _refund_window_days: number
        }
        Returns: {
          active_levels: number
          business_partners_enabled: boolean
          commission_mode: string
          created_at: string
          enabled: boolean
          id: string
          min_withdrawal_usdt: number
          mlm_pool_percentage: number
          orphan_policy: string
          portal_id: string
          refund_window_days: number
          updated_at: string
          withdrawal_fee_usdt: number
        }
        SetofOptions: {
          from: "*"
          to: "portal_mlm_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_revenue_splits: {
        Args: { _portal_id: string; _splits: Json }
        Returns: undefined
      }
      set_partner_wallet_destination: {
        Args: {
          _account_kind?: string
          _portal_id: string
          _stripe_destination?: string
          _usdt_address?: string
          _user_id: string
        }
        Returns: undefined
      }
      tournament_award_points: {
        Args: {
          _amount: number
          _metadata?: Json
          _multiplier?: number
          _reason: string
          _ref_id?: string
          _ref_type?: string
          _user_id: string
        }
        Returns: string
      }
      tournament_check_daily_streak: {
        Args: { _user_id: string }
        Returns: Json
      }
      tournament_clan_create_atomic: {
        Args: {
          p_banner_url: string
          p_description: string
          p_invite_code: string
          p_is_public: boolean
          p_logo_url: string
          p_name: string
          p_owner_id: string
          p_tag: string
        }
        Returns: Json
      }
      tournament_clan_transfer_owner: {
        Args: {
          p_clan_id: string
          p_new_owner_id: string
          p_old_owner_id: string
        }
        Returns: boolean
      }
      tournament_detect_ip_collisions: {
        Args: never
        Returns: {
          ip: string
          participant_ids: string[]
          tournament_id: string
          user_ids: string[]
        }[]
      }
      tournament_generate_slug: { Args: { _name: string }; Returns: string }
      tournament_increment_participants: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      tournament_join_atomic: {
        Args: {
          p_chosen_kind: string
          p_entry_currency: string
          p_entry_paid: number
          p_fee_bmoney: number
          p_fee_usd: number
          p_initial_funded_equity: number
          p_starting_balance: number
          p_tournament_id: string
          p_user_id: string
        }
        Returns: Json
      }
      tournament_notify: {
        Args: {
          _link?: string
          _message: string
          _ref_id?: string
          _ref_type?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      tournament_redeem_atomic: {
        Args: {
          p_catalog_id: string
          p_code: string
          p_expires_at: string
          p_user_id: string
        }
        Returns: Json
      }
      tournament_settle_participant: {
        Args: {
          p_bp: number
          p_is_bmoney: boolean
          p_league: string
          p_participant_id: string
          p_prize_usd: number
          p_rank: number
          p_tournament_id: string
          p_user_id: string
        }
        Returns: Json
      }
      tournament_settle_topup: {
        Args: { p_gateway_ref: string; p_metadata?: Json; p_payment_id: string }
        Returns: Json
      }
      tournament_unlock_achievement: {
        Args: { _code: string; _metadata?: Json; _user_id: string }
        Returns: boolean
      }
      tournament_wallet_consume_locked: {
        Args: { p_usd: number; p_user_id: string }
        Returns: boolean
      }
      tournament_wallet_credit: {
        Args: { p_bmoney?: number; p_usd?: number; p_user_id: string }
        Returns: undefined
      }
      tournament_wallet_debit: {
        Args: {
          p_bmoney?: number
          p_lock_bmoney?: boolean
          p_lock_usd?: boolean
          p_usd?: number
          p_user_id: string
        }
        Returns: boolean
      }
      tournament_wallet_unlock: {
        Args: { p_usd: number; p_user_id: string }
        Returns: boolean
      }
      update_partner_user_avatar: {
        Args: { p_avatar_url: string; p_user_id: string }
        Returns: undefined
      }
      upsert_unified_identity: {
        Args: {
          _display_name: string
          _email: string
          _module: string
          _phone: string
          _source_id: string
          _tag?: string
        }
        Returns: string
      }
    }
    Enums: {
      academy_mux_status: "preparing" | "ready" | "errored"
      app_role:
        | "admin"
        | "user"
        | "global_admin"
        | "bd"
        | "operaciones"
        | "admin_operaciones"
        | "admin_bd"
        | "ib_externo"
        | "marketing"
        | "ventas"
        | "admin_ventas"
        | "dealing"
        | "bullfy_family"
        | "accountant"
        | "treasurer"
        | "directivo"
        | "accounting_user"
      tournament_approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "auto_approved"
      tournament_modality: "pro" | "standard"
      tournament_otp_purpose:
        | "registration_email"
        | "registration_sms"
        | "password_reset"
        | "email_change"
      tournament_participant_status:
        | "registered"
        | "active"
        | "eliminated"
        | "qualified"
        | "winner"
        | "disqualified"
      tournament_payment_status:
        | "pending"
        | "completed"
        | "failed"
        | "cancelled"
      tournament_payment_type:
        | "entry_fee"
        | "prize_payout"
        | "wallet_topup"
        | "wallet_withdrawal"
        | "refund"
        | "clan_verify"
        | "user_verify"
      tournament_redemption_kind:
        | "funded_account"
        | "promo_discount"
        | "entry_voucher"
        | "custom"
      tournament_status:
        | "draft"
        | "scheduled"
        | "registration_open"
        | "running"
        | "finished"
        | "settled"
        | "cancelled"
      tournament_type: "free" | "paid" | "elite" | "clan_war" | "versus"
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
      academy_mux_status: ["preparing", "ready", "errored"],
      app_role: [
        "admin",
        "user",
        "global_admin",
        "bd",
        "operaciones",
        "admin_operaciones",
        "admin_bd",
        "ib_externo",
        "marketing",
        "ventas",
        "admin_ventas",
        "dealing",
        "bullfy_family",
        "accountant",
        "treasurer",
        "directivo",
        "accounting_user",
      ],
      tournament_approval_status: [
        "pending",
        "approved",
        "rejected",
        "auto_approved",
      ],
      tournament_modality: ["pro", "standard"],
      tournament_otp_purpose: [
        "registration_email",
        "registration_sms",
        "password_reset",
        "email_change",
      ],
      tournament_participant_status: [
        "registered",
        "active",
        "eliminated",
        "qualified",
        "winner",
        "disqualified",
      ],
      tournament_payment_status: [
        "pending",
        "completed",
        "failed",
        "cancelled",
      ],
      tournament_payment_type: [
        "entry_fee",
        "prize_payout",
        "wallet_topup",
        "wallet_withdrawal",
        "refund",
        "clan_verify",
        "user_verify",
      ],
      tournament_redemption_kind: [
        "funded_account",
        "promo_discount",
        "entry_voucher",
        "custom",
      ],
      tournament_status: [
        "draft",
        "scheduled",
        "registration_open",
        "running",
        "finished",
        "settled",
        "cancelled",
      ],
      tournament_type: ["free", "paid", "elite", "clan_war", "versus"],
    },
  },
} as const
