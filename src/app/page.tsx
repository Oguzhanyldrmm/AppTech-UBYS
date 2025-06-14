'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import RestaurantDashboard from '../components/rest_dash'
import CommunityDashboard from '../components/commu-dash'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showDashboard, setShowDashboard] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (user) {
        setShowDashboard(true)
      } else {
        router.push('/login')
      }
    }
  }, [user, loading, router])

  // Render appropriate dashboard based on user type
  if (showDashboard && user) {
    switch (user.type) {
      case 'restaurant':
        return <RestaurantDashboard />
      case 'community':
        return <CommunityDashboard />
      default:
        // If user is neither restaurant nor community, redirect to login
        router.push('/login')
        return null
    }
  }

  // Show loading screen
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Default loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Welcome to University Platform
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Connecting restaurants and communities
        </p>
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    </div>
  )
}
