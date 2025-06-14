'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type UserType = 'restaurant' | 'community'

interface AuthUser {
  id: string
  email: string
  name: string
  type: UserType
  userData: any
}

interface AuthContextType {
  user: AuthUser | null
  login: (email: string, password: string, type: UserType) => Promise<boolean>
  logout: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in from localStorage
    const checkAuth = () => {
      const savedUser = localStorage.getItem('auth_user')
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string, type: UserType): Promise<boolean> => {
    try {
      setLoading(true)
      
      let userData = null
      let tableName = ''
        switch (type) {
        case 'restaurant':
          tableName = 'restaurants'
          const { data: restRes } = await supabase
            .from('restaurants')
            .select('*')
            .eq('mail', email)
            .eq('password', password)
            .single()
          userData = restRes
          break
          
        case 'community':
          tableName = 'communities'
          const { data: commRes } = await supabase
            .from('communities')
            .select('*')
            .eq('mail', email)
            .eq('password', password)
            .single()
          userData = commRes
          break
      }

      if (userData) {
        const authUser: AuthUser = {
          id: userData.id,
          email: userData.mail,
          name: userData.name,
          type,
          userData
        }
        
        setUser(authUser)
        localStorage.setItem('auth_user', JSON.stringify(authUser))
        return true
      }
      
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setUser(null)
    localStorage.removeItem('auth_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
