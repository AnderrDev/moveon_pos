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
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          tienda_id: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          tienda_id?: string | null
          user_email?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          tienda_id?: string | null
          user_email?: string
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
          status: Database["public"]["Enums"]["cash_movement_status"]
          tipo: Database["public"]["Enums"]["cash_movement_type"]
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          amount: number
          cash_session_id: string
          created_at?: string
          created_by: string
          id?: string
          motivo: string
          status?: Database["public"]["Enums"]["cash_movement_status"]
          tipo: Database["public"]["Enums"]["cash_movement_type"]
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          amount?: number
          cash_session_id?: string
          created_at?: string
          created_by?: string
          id?: string
          motivo?: string
          status?: Database["public"]["Enums"]["cash_movement_status"]
          tipo?: Database["public"]["Enums"]["cash_movement_type"]
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
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
          actual_sales_amount: number | null
          closed_at: string | null
          closed_by: string | null
          difference: number | null
          expected_cash_amount: number | null
          expected_sales_amount: number | null
          id: string
          notas_cierre: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          payment_closure: Json
          sales_difference: number | null
          status: Database["public"]["Enums"]["cash_session_status"]
          tienda_id: string
        }
        Insert: {
          actual_cash_amount?: number | null
          actual_sales_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          difference?: number | null
          expected_cash_amount?: number | null
          expected_sales_amount?: number | null
          id?: string
          notas_cierre?: string | null
          opened_at?: string
          opened_by: string
          opening_amount: number
          payment_closure?: Json
          sales_difference?: number | null
          status?: Database["public"]["Enums"]["cash_session_status"]
          tienda_id: string
        }
        Update: {
          actual_cash_amount?: number | null
          actual_sales_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          difference?: number | null
          expected_cash_amount?: number | null
          expected_sales_amount?: number | null
          id?: string
          notas_cierre?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          payment_closure?: Json
          sales_difference?: number | null
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
      combos_semana: {
        Row: {
          created_at: string
          descripcion: string | null
          etiqueta: string | null
          id: string
          is_active: boolean
          items: string[]
          nombre: string
          orden: number
          precio: number
          precio_original: number | null
          tienda_id: string
          updated_at: string
          vigente_hasta: string | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          etiqueta?: string | null
          id?: string
          is_active?: boolean
          items?: string[]
          nombre: string
          orden?: number
          precio: number
          precio_original?: number | null
          tienda_id: string
          updated_at?: string
          vigente_hasta?: string | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          etiqueta?: string | null
          id?: string
          is_active?: boolean
          items?: string[]
          nombre?: string
          orden?: number
          precio?: number
          precio_original?: number | null
          tienda_id?: string
          updated_at?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combos_semana_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          cargo: string | null
          created_at: string
          id: string
          is_active: boolean
          nombre: string
          salario_mensual: number
          tienda_id: string
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          nombre: string
          salario_mensual?: number
          tienda_id: string
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          nombre?: string
          salario_mensual?: number
          tienda_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleados_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nombre: string
          slug: string
          tienda_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre: string
          slug: string
          tienda_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre?: string
          slug?: string
          tienda_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_templates: {
        Row: {
          category_id: string
          concepto: string
          created_at: string
          empleado_id: string | null
          frecuencia: string
          id: string
          is_active: boolean
          monto_sugerido: number
          tienda_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          concepto: string
          created_at?: string
          empleado_id?: string | null
          frecuencia?: string
          id?: string
          is_active?: boolean
          monto_sugerido: number
          tienda_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          concepto?: string
          created_at?: string
          empleado_id?: string | null
          frecuencia?: string
          id?: string
          is_active?: boolean
          monto_sugerido?: number
          tienda_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_templates_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_templates_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          cash_movement_id: string | null
          category_id: string
          concepto: string
          created_at: string
          created_by: string
          empleado_id: string | null
          fecha_gasto: string
          id: string
          metodo_pago: string
          monto: number
          notas: string | null
          periodo: string | null
          status: string
          tienda_id: string
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          cash_movement_id?: string | null
          category_id: string
          concepto: string
          created_at?: string
          created_by: string
          empleado_id?: string | null
          fecha_gasto?: string
          id?: string
          metodo_pago: string
          monto: number
          notas?: string | null
          periodo?: string | null
          status?: string
          tienda_id: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          cash_movement_id?: string | null
          category_id?: string
          concepto?: string
          created_at?: string
          created_by?: string
          empleado_id?: string | null
          fecha_gasto?: string
          id?: string
          metodo_pago?: string
          monto?: number
          notas?: string | null
          periodo?: string | null
          status?: string
          tienda_id?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_cash_movement_id_fkey"
            columns: ["cash_movement_id"]
            isOneToOne: false
            referencedRelation: "cash_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tienda_id_fkey"
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
          ubicacion: Database["public"]["Enums"]["inventory_location"]
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
          ubicacion?: Database["public"]["Enums"]["inventory_location"]
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
          ubicacion?: Database["public"]["Enums"]["inventory_location"]
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
      product_components: {
        Row: {
          cantidad: number
          componente_id: string
          id: string
          producto_id: string
          tienda_id: string
        }
        Insert: {
          cantidad?: number
          componente_id: string
          id?: string
          producto_id: string
          tienda_id: string
        }
        Update: {
          cantidad?: number
          componente_id?: string
          id?: string
          producto_id?: string
          tienda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_components_componente_id_fkey"
            columns: ["componente_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
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
          deleted_at: string | null
          etiqueta: string | null
          id: string
          image_url: string | null
          is_active: boolean
          iva_tasa: number
          marca: string | null
          nombre: string
          para_que_sirve: string | null
          precio_venta: number
          proveedor: string | null
          recomendado_para: string | null
          recommended_audience: string | null
          sku: string | null
          stock_minimo: number
          tienda_id: string
          tipo: Database["public"]["Enums"]["product_type"]
          unidad: string
          updated_at: string
          usage_guidance: string | null
        }
        Insert: {
          categoria_id?: string | null
          codigo_barras?: string | null
          costo?: number | null
          created_at?: string
          deleted_at?: string | null
          etiqueta?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          iva_tasa?: number
          marca?: string | null
          nombre: string
          para_que_sirve?: string | null
          precio_venta: number
          proveedor?: string | null
          recomendado_para?: string | null
          recommended_audience?: string | null
          sku?: string | null
          stock_minimo?: number
          tienda_id: string
          tipo?: Database["public"]["Enums"]["product_type"]
          unidad?: string
          updated_at?: string
          usage_guidance?: string | null
        }
        Update: {
          categoria_id?: string | null
          codigo_barras?: string | null
          costo?: number | null
          created_at?: string
          deleted_at?: string | null
          etiqueta?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          iva_tasa?: number
          marca?: string | null
          nombre?: string
          para_que_sirve?: string | null
          precio_venta?: number
          proveedor?: string | null
          recomendado_para?: string | null
          recommended_audience?: string | null
          sku?: string | null
          stock_minimo?: number
          tienda_id?: string
          tipo?: Database["public"]["Enums"]["product_type"]
          unidad?: string
          updated_at?: string
          usage_guidance?: string | null
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
      reinvestment_fund_settings: {
        Row: {
          created_at: string
          fecha_inicio: string
          saldo_inicial: number
          tienda_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fecha_inicio: string
          saldo_inicial?: number
          tienda_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fecha_inicio?: string
          saldo_inicial?: number
          tienda_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reinvestment_fund_settings_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: true
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_counters: {
        Row: {
          last_number: number
          tienda_id: string
        }
        Insert: {
          last_number?: number
          tienda_id: string
        }
        Update: {
          last_number?: number
          tienda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_counters_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: true
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          discount_amount: number
          global_discount_amount: number
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
          global_discount_amount?: number
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
          global_discount_amount?: number
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
          cashier_email: string | null
          cashier_id: string
          cliente_id: string | null
          created_at: string
          discount_approved_by: string | null
          discount_reason: string | null
          discount_total: number
          global_discount_total: number
          id: string
          idempotency_key: string
          item_discount_total: number
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
          cashier_email?: string | null
          cashier_id: string
          cliente_id?: string | null
          created_at?: string
          discount_approved_by?: string | null
          discount_reason?: string | null
          discount_total?: number
          global_discount_total?: number
          id?: string
          idempotency_key: string
          item_discount_total?: number
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
          cashier_email?: string | null
          cashier_id?: string
          cliente_id?: string | null
          created_at?: string
          discount_approved_by?: string | null
          discount_reason?: string | null
          discount_total?: number
          global_discount_total?: number
          id?: string
          idempotency_key?: string
          item_discount_total?: number
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
      storefront_contact_settings: {
        Row: {
          created_at: string
          instagram_handle: string
          instagram_url: string
          is_active: boolean
          tienda_id: string
          updated_at: string
          whatsapp_display: string
          whatsapp_number: string
        }
        Insert: {
          created_at?: string
          instagram_handle: string
          instagram_url: string
          is_active?: boolean
          tienda_id: string
          updated_at?: string
          whatsapp_display: string
          whatsapp_number: string
        }
        Update: {
          created_at?: string
          instagram_handle?: string
          instagram_url?: string
          is_active?: boolean
          tienda_id?: string
          updated_at?: string
          whatsapp_display?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_contact_settings_tienda_id_fkey"
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
          timezone: string
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
          timezone?: string
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
          timezone?: string
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
      storefront_productos_publicos: {
        Row: {
          categoria_id: string | null
          categoria_nombre: string | null
          categoria_orden: number | null
          etiqueta: string | null
          id: string
          image_url: string | null
          marca: string | null
          nombre: string
          para_que_sirve: string | null
          tipo: Database["public"]["Enums"]["product_type"]
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      close_cash_session_atomic: {
        Args: {
          p_actual_cash: number
          p_actual_payments: Json
          p_closed_by: string
          p_notas_cierre?: string
          p_session_id: string
          p_tienda_id: string
        }
        Returns: string
      }
      correct_cash_session_opening_atomic: {
        Args: {
          p_corrected_by: string
          p_new_amount: number
          p_reason: string
          p_session_id: string
          p_tienda_id: string
        }
        Returns: string
      }
      correct_payment_atomic: {
        Args: {
          p_corrected_by: string
          p_new_metodo: Database["public"]["Enums"]["payment_method"]
          p_payment_id: string
          p_reason: string
          p_tienda_id: string
        }
        Returns: undefined
      }
      create_product_with_initial_stock: {
        Args: {
          p_categoria_id: string
          p_codigo_barras: string
          p_costo: number
          p_image_url?: string
          p_initial_location: Database["public"]["Enums"]["inventory_location"]
          p_initial_stock: number
          p_is_active: boolean
          p_iva_tasa: number
          p_nombre: string
          p_para_que_sirve: string
          p_precio_venta: number
          p_proveedor?: string
          p_recomendado_para: string
          p_sku: string
          p_stock_minimo: number
          p_tienda_id: string
          p_tipo: Database["public"]["Enums"]["product_type"]
          p_unidad: string
        }
        Returns: string
      }
      create_sale_atomic:
        | {
            Args: {
              p_cash_session_id: string
              p_cashier_id: string
              p_cliente_id: string
              p_discount_total: number
              p_idempotency_key: string
              p_items: Json
              p_payments: Json
              p_sale_number: string
              p_subtotal: number
              p_tax_total: number
              p_tienda_id: string
              p_total: number
            }
            Returns: string
          }
        | {
            Args: {
              p_cash_session_id: string
              p_cashier_id: string
              p_cliente_id: string
              p_discount_reason: string
              p_discount_total: number
              p_global_discount_total: number
              p_idempotency_key: string
              p_items: Json
              p_payments: Json
              p_sale_number: string
              p_subtotal: number
              p_tax_total: number
              p_tienda_id: string
              p_total: number
            }
            Returns: string
          }
      get_reinvestment_fund_totals: {
        Args: {
          p_desde: string
          p_mes_desde: string
          p_mes_hasta: string
          p_tienda_id: string
        }
        Returns: {
          cogs_acumulado: number
          cogs_mes: number
          compras_acumuladas: number
          compras_mes: number
          ventas_sin_costo: number
          entradas_sin_costo: number
        }[]
      }
      get_stock: {
        Args: {
          p_producto_id: string
          p_tienda_id: string
          p_ubicacion?: Database["public"]["Enums"]["inventory_location"]
        }
        Returns: number
      }
      get_user_tiendas: { Args: never; Returns: string[] }
      register_expense_atomic: {
        Args: {
          p_category_id: string
          p_concepto: string
          p_empleado_id?: string
          p_fecha_gasto?: string
          p_metodo_pago: string
          p_monto: number
          p_notas?: string
          p_periodo?: string
          p_tienda_id: string
        }
        Returns: {
          cash_movement_id: string | null
          category_id: string
          concepto: string
          created_at: string
          created_by: string
          empleado_id: string | null
          fecha_gasto: string
          id: string
          metodo_pago: string
          monto: number
          notas: string | null
          periodo: string | null
          status: string
          tienda_id: string
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_stock_atomic: {
        Args: {
          p_cantidad: number
          p_created_by: string
          p_from_ubicacion: Database["public"]["Enums"]["inventory_location"]
          p_motivo: string
          p_producto_id: string
          p_tienda_id: string
          p_to_ubicacion: Database["public"]["Enums"]["inventory_location"]
        }
        Returns: string
      }
      void_cash_movement_atomic: {
        Args: {
          p_movement_id: string
          p_tienda_id: string
          p_voided_by: string
          p_voided_reason: string
        }
        Returns: string
      }
      void_sale_atomic: {
        Args: {
          p_sale_id: string
          p_tienda_id: string
          p_voided_by: string
          p_voided_reason: string
        }
        Returns: string
      }
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
      cash_movement_status: "active" | "voided"
      cash_movement_type: "cash_in" | "cash_out" | "expense" | "correction"
      cash_session_status: "open" | "closed"
      inventory_location: "punto_venta" | "bodega"
      inventory_movement_type:
        | "entry"
        | "sale_exit"
        | "adjustment"
        | "void_return"
        | "transfer_out"
        | "transfer_in"
      payment_method: "cash" | "card" | "transfer" | "other"
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
      billing_doc_status: [
        "pending",
        "sent",
        "accepted",
        "rejected",
        "cancelled",
        "failed",
      ],
      billing_doc_type: ["invoice", "pos_document", "credit_note"],
      billing_status: [
        "not_required",
        "pending",
        "sent",
        "accepted",
        "rejected",
        "failed",
      ],
      cash_movement_status: ["active", "voided"],
      cash_movement_type: ["cash_in", "cash_out", "expense", "correction"],
      cash_session_status: ["open", "closed"],
      inventory_location: ["punto_venta", "bodega"],
      inventory_movement_type: [
        "entry",
        "sale_exit",
        "adjustment",
        "void_return",
        "transfer_out",
        "transfer_in",
      ],
      payment_method: ["cash", "card", "transfer", "other"],
      product_type: ["simple", "prepared", "ingredient"],
      sale_status: ["completed", "voided"],
      user_role: ["admin", "cajero"],
    },
  },
} as const
