import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface User {
  id: string
  name: string
  dept: string
  mail: string
  pp?: string
  bio?: string
  is_valid: boolean
  st_id: string
  tel_no?: string
  password?: string
}

export interface Restaurant {
  id: string
  name: string
  description: string
  username: string
  password: string
  open_time: string
  close_time: string
  tel_no: string
  mail: string
  location: string
  delivery_time: number
}

export interface Community {
  id: string
  name: string
  username: string
  password: string
  tel_no: string
  mail: string
  description: string
  logo?: string
}

export interface Event {
  id: string
  title: string
  description: string
  photo?: string
  community_id: string
  start_time: string
  end_time: string
}

export interface MenuItem {
  id: string
  name: string
  price: number
  description: string
  calories?: number
  restaurant_id: string
  category_id: string
}

export interface Category {
  id: string
  name: string
}

export interface UserPost {
  id: string
  context: string
  image?: string
  user_id: string
  post_date: string
  is_anonymous: boolean
  like_count: number
  dislike_count: number
}
