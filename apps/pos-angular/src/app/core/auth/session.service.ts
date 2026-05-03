import { inject, Injectable, signal } from '@angular/core'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { SupabaseClientService } from '../supabase/supabase-client.service'
import type { Role } from '@/shared/types'

export interface AngularAuthContext {
  userId: string
  tiendaId: string
  rol: Role
  email: string | null
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly supabaseClient = inject(SupabaseClientService)
  readonly user = signal<User | null>(null)

  constructor() {
    void this.refreshUser()
    this.supabaseClient.supabase.auth.onAuthStateChange((_event, session) => {
      this.user.set(session?.user ?? null)
    })
  }

  async getSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await this.supabaseClient.supabase.auth.getSession()
    this.user.set(session?.user ?? null)
    return session
  }

  async getAuthContext(): Promise<AngularAuthContext | null> {
    const session = await this.getSession()
    const user = session?.user
    if (!user) return null

    const { data, error } = await this.supabaseClient.supabase
      .from('user_tiendas')
      .select('tienda_id, rol')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .returns<{ tienda_id: string; rol: string }[]>()

    if (error || !data?.length) return null

    return {
      userId: user.id,
      tiendaId: data[0].tienda_id,
      rol: data[0].rol as Role,
      email: user.email ?? null,
    }
  }

  async signIn(email: string, password: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabaseClient.supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (!error) await this.refreshUser()
    return { error }
  }

  async signOut(): Promise<void> {
    await this.supabaseClient.supabase.auth.signOut()
    this.user.set(null)
  }

  private async refreshUser(): Promise<void> {
    const session = await this.getSession()
    this.user.set(session?.user ?? null)
  }
}
