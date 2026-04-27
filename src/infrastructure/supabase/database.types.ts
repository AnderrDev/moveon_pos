/**
 * Tipos generados automáticamente por Supabase CLI.
 * Regenerar con: pnpm db:types
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          tienda_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          tienda_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          tienda_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_documents: {
        Row: {
          attempts: number
          created_at: string
          cufe_or_cude: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["billing_doc_type"]
          id: string
          issued_at: string | null
          last_error: string | null
          pdf_url: string | null
          prefix: string | null
          provider: string
          provider_response: Json | null
          qr_url: string | null
          sale_id: string | null
          status: Database["public"]["Enums"]["billing_doc_status"]
          tienda_id: string
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          cufe_or_cude?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["billing_doc_type"]
          id?: string
          issued_at?: string | null
          last_error?: string | null
          pdf_url?: string | null
          prefix?: string | null
          provider: string
          provider_response?: Json | null
          qr_url?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["billing_doc_status"]
          tienda_id: string
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          cufe_or_cude?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["billing_doc_type"]
          id?: string
          issued_at?: string | null
          last_error?: string | null
          pdf_url?: string | null
          prefix?: string | null
          provider?: string
          provider_response?: Json | null
          qr_url?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["billing_doc_status"]
          tienda_id?: string
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_documents_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_billing_documents_sale"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          billing_document_id: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          provider_request: Json | null
          provider_response: Json | null
        }
        Insert: {
          billing_document_id: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          provider_request?: Json | null
          provider_response?: Json | null
        }
        Update: {
          billing_document_id?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          provider_request?: Json | null
          provider_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_billing_document_id_fkey"
            columns: ["billing_document_id"]
            isOneToOne: false
            referencedRelation: "billing_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_session_id: string
          created_at: string
          created_by: string
          id: string
          motivo: string
          tipo: Database["public"]["Enums"]["cash_movement_type"]
        }
        Insert: {
          amount: number
          cash_session_id: string
          created_at?: string
          created_by: string
          id?: string
          motivo: string
          tipo: Database["public"]["Enums"]["cash_movement_type"]
        }
        Update: {
          amount?: number
          cash_session_id?: string
          created_at?: string
          created_by?: string
          id?: string
          motivo?: string
          tipo?: Database["public"]["Enums"]["cash_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          actual_cash_amount: number | null
          closed_at: string | null
          closed_by: string | null
          difference: number | null
          expected_cash_amount: number | null
          id: string
          notas_cierre: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: Database["public"]["Enums"]["cash_session_status"]
          tienda_id: string
        }
        Insert: {
          actual_cash_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          difference?: number | null
          expected_cash_amount?: number | null
          id?: string
          notas_cierre?: string | null
          opened_at?: string
          opened_by: string
          opening_amount: number
          status?: Database["public"]["Enums"]["cash_session_status"]
          tienda_id: string
        }
        Update: {
          actual_cash_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          difference?: number | null
          expected_cash_amount?: number | null
          id?: string
          notas_cierre?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          status?: Database["public"]["Enums"]["cash_session_status"]
          tienda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nombre: string
          orden: number
          tienda_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre: string
          orden?: number
          tienda_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre?: string
          orden?: number
          tienda_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nombre: string
          numero_documento: string | null
          telefono: string | null
          tienda_id: string
          tipo_documento: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          numero_documento?: string | null
          telefono?: string | null
          tienda_id: string
          tipo_documento?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          numero_documento?: string | null
          telefono?: string | null
          tienda_id?: string
          tipo_documento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          cantidad: number
          costo_unitario: number | null
          created_at: string
          created_by: string
          id: string
          motivo: string | null
          producto_id: string
          referencia_id: string | null
          referencia_tipo: string | null
          tienda_id: string
          tipo: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Insert: {
          cantidad: number
          costo_unitario?: number | null
          created_at?: string
          created_by: string
          id?: string
          motivo?: string | null
          producto_id: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tienda_id: string
          tipo: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Update: {
          cantidad?: number
          costo_unitario?: number | null
          created_at?: string
          created_by?: string
          id?: string
          motivo?: string | null
          producto_id?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tienda_id?: string
          tipo?: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          metodo: Database["public"]["Enums"]["payment_method"]
          referencia: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metodo: Database["public"]["Enums"]["payment_method"]
          referencia?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metodo?: Database["public"]["Enums"]["payment_method"]
          referencia?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          categoria_id: string | null
          codigo_barras: string | null
          costo: number | null
          created_at: string
          id: string
          is_active: boolean
          iva_tasa: number
          nombre: string
          precio_venta: number
          sku: string | null
          stock_minimo: number
          tienda_id: string
          tipo: Database["public"]["Enums"]["product_type"]
          unidad: string
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          codigo_barras?: string | null
          costo?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          iva_tasa?: number
          nombre: string
          precio_venta: number
          sku?: string | null
          stock_minimo?: number
          tienda_id: string
          tipo?: Database["public"]["Enums"]["product_type"]
          unidad?: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          codigo_barras?: string | null
          costo?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          iva_tasa?: number
          nombre?: string
          precio_venta?: number
          sku?: string | null
          stock_minimo?: number
          tienda_id?: string
          tipo?: Database["public"]["Enums"]["product_type"]
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          discount_amount: number
          id: string
          producto_id: string
          producto_nombre: string
          producto_sku: string | null
          quantity: number
          sale_id: string
          tax_amount: number
          tax_rate: number
          total: number
          unit_price: number
        }
        Insert: {
          discount_amount?: number
          id?: string
          producto_id: string
          producto_nombre: string
          producto_sku?: string | null
          quantity: number
          sale_id: string
          tax_amount?: number
          tax_rate?: number
          total: number
          unit_price: number
        }
        Update: {
          discount_amount?: number
          id?: string
          producto_id?: string
          producto_nombre?: string
          producto_sku?: string | null
          quantity?: number
          sale_id?: string
          tax_amount?: number
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
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
          billing_document_id: string | null
          billing_status: Database["public"]["Enums"]["billing_status"]
          cash_session_id: string
          cashier_id: string
          cliente_id: string | null
          created_at: string
          discount_total: number
          id: string
          idempotency_key: string
          sale_number: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tax_total: number
          tienda_id: string
          total: number
          updated_at: string
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          billing_document_id?: string | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          cash_session_id: string
          cashier_id: string
          cliente_id?: string | null
          created_at?: string
          discount_total?: number
          id?: string
          idempotency_key: string
          sale_number: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tax_total?: number
          tienda_id: string
          total: number
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          billing_document_id?: string | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          cash_session_id?: string
          cashier_id?: string
          cliente_id?: string | null
          created_at?: string
          discount_total?: number
          id?: string
          idempotency_key?: string
          sale_number?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_total?: number
          tienda_id?: string
          total?: number
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_billing_document_id_fkey"
            columns: ["billing_document_id"]
            isOneToOne: false
            referencedRelation: "billing_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          data: Json
          id: string
          tienda_id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          tienda_id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          tienda_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: true
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      tiendas: {
        Row: {
          ciudad: string | null
          created_at: string
          direccion: string | null
          id: string
          is_active: boolean
          nit: string | null
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          ciudad?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          is_active?: boolean
          nit?: string | null
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          ciudad?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          is_active?: boolean
          nit?: string | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_tiendas: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          rol: Database["public"]["Enums"]["user_role"]
          tienda_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          rol?: Database["public"]["Enums"]["user_role"]
          tienda_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          rol?: Database["public"]["Enums"]["user_role"]
          tienda_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tiendas_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_stock: {
        Args: { p_producto_id: string; p_tienda_id: string }
        Returns: number
      }
      get_user_tiendas: { Args: never; Returns: string[] }
    }
    Enums: {
      billing_doc_status:
        | "pending"
        | "sent"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "failed"
      billing_doc_type: "invoice" | "pos_document" | "credit_note"
      billing_status:
        | "not_required"
        | "pending"
        | "sent"
        | "accepted"
        | "rejected"
        | "failed"
      cash_movement_type: "cash_in" | "cash_out" | "expense" | "correction"
      cash_session_status: "open" | "closed"
      inventory_movement_type:
        | "entry"
        | "sale_exit"
        | "adjustment"
        | "void_return"
      payment_method:
        | "cash"
        | "card"
        | "nequi"
        | "daviplata"
        | "transfer"
        | "other"
      product_type: "simple" | "prepared" | "ingredient"
      sale_status: "completed" | "voided"
      user_role: "admin" | "cajero"
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
      billing_doc_status: ["pending", "sent", "accepted", "rejected", "cancelled", "failed"],
      billing_doc_type: ["invoice", "pos_document", "credit_note"],
      billing_status: ["not_required", "pending", "sent", "accepted", "rejected", "failed"],
      cash_movement_type: ["cash_in", "cash_out", "expense", "correction"],
      cash_session_status: ["open", "closed"],
      inventory_movement_type: ["entry", "sale_exit", "adjustment", "void_return"],
      payment_method: ["cash", "card", "nequi", "daviplata", "transfer", "other"],
      product_type: ["simple", "prepared", "ingredient"],
      sale_status: ["completed", "voided"],
      user_role: ["admin", "cajero"],
    },
  },
} as const
