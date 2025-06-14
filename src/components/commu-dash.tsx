'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Event {
  id: string
  title: string
  description: string
  photo?: string
  start_time: string
  end_time: string
  community_id: string
}

interface Community {
  id: string
  name: string
  username: string
  password: string
  tel_no: string
  mail: string
}

export default function CommunityDashboard() {
  const { user, logout } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [showCommunityForm, setShowCommunityForm] = useState(false)
  const [showCommunityInfoForm, setShowCommunityInfoForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'events' | 'settings'>('events')
  const [communityData, setCommunityData] = useState<Community | null>(null)
  
  // Community info state
  const [communityInfo, setCommunityInfo] = useState({
    description: 'Welcome to our vibrant community! We host various events and activities for all members.',
    logo: ''
  })
  
  // Event form state
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    photo: ''
  })
    // Community form state
  const [communityFormData, setCommunityFormData] = useState({
    description: '',
    logo: ''
  })

  // Community data form state
  const [communityDataFormData, setCommunityDataFormData] = useState({
    name: '',
    username: '',
    password: '',
    tel_no: '',
    mail: ''
  })

  useEffect(() => {
    if (user?.type === 'community') {
      fetchEvents()
      fetchCommunityInfo()
      fetchCommunityData()
    }
  }, [user])
  const fetchCommunityInfo = async () => {
    try {
      // Real Supabase call to fetch community info
      const { data, error } = await supabase
        .from('communities')
        .select('description, logo')
        .eq('id', user?.id)
        .single()

      if (error) {
        console.error('Supabase error (communities):', error)
        // If no record found, keep default values
        if (error.code === 'PGRST013') {
          console.log('No community record found, using default values')
        }
      } else if (data) {
        setCommunityInfo({
          description: data.description || 'Welcome to our vibrant community! We host various events and activities for all members.',
          logo: data.logo || ''
        })
      }    } catch (error) {
      console.error('Error fetching community info:', error)
    }
  }

  const fetchCommunityData = async () => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('id, name, username, password, tel_no, mail')
        .eq('id', user?.id)
        .single()

      if (error) {
        console.error('Error fetching community data:', error)
      } else {
        setCommunityData(data)
      }
    } catch (error) {
      console.error('Error fetching community data:', error)
    }
  }
  const fetchEvents = async () => {
    try {
      setLoading(true)
      
      // Real Supabase call to fetch events
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('community_id', user?.id)
        .order('start_time', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        // If table doesn't exist, show mock data as fallback
        if (error.code === 'PGRST116') {
          console.log('Events table not found, using mock data')
          const mockEvents: Event[] = [
            {
              id: '1',
              title: 'Welcome Event',
              description: 'Welcome to our community!',
              start_time: '2025-06-15T10:00:00',
              end_time: '2025-06-15T12:00:00',
              community_id: user?.id || '',
              photo: ''
            }
          ]
          setEvents(mockEvents)
        } else {
          throw error
        }
      } else {
        setEvents(data || [])
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching events:', error)
      setLoading(false)
    }
  }
  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const eventData = {
        ...eventFormData,
        community_id: user?.id
      }

      if (editingEvent) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEvent.id)

        if (error) throw error
        alert('Event updated successfully!')
      } else {
        // Add new event
        const { error } = await supabase
          .from('events')
          .insert([eventData])

        if (error) throw error
        alert('Event created successfully!')
      }

      // Reset form and refresh data
      setEventFormData({ title: '', description: '', start_time: '', end_time: '', photo: '' })
      setShowEventForm(false)
      setEditingEvent(null)
      fetchEvents()
      
    } catch (error) {
      console.error('Error saving event:', error)
      alert('Error saving event. Make sure the events table exists in Supabase.')
    }
  }

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event)
    setEventFormData({
      title: event.title,
      description: event.description,
      start_time: event.start_time,
      end_time: event.end_time,
      photo: event.photo || ''
    })
    setShowEventForm(true)
  }
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
      
      alert('Event deleted successfully!')
      fetchEvents() // Refresh the events list
      
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Error deleting event. Make sure the events table exists in Supabase.')
    }
  }
  const cancelEventForm = () => {
    setShowEventForm(false)
    setEditingEvent(null)
    setEventFormData({ title: '', description: '', start_time: '', end_time: '', photo: '' })
  }

  const handleCommunityInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Only update description and logo fields
      const { error } = await supabase
        .from('communities')
        .update({
          description: communityFormData.description,
          logo: communityFormData.logo
        })
        .eq('id', user?.id)

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      // Update local state
      setCommunityInfo({
        description: communityFormData.description,
        logo: communityFormData.logo
      })
      
      alert('Community information updated successfully!')
      setShowCommunityForm(false)
      
    } catch (error) {
      console.error('Error updating community info:', error)
      alert('Error updating community information: ' + (error as Error).message)
    }
  }

  const handleEditCommunityInfo = () => {
    setCommunityFormData({
      description: communityInfo.description,
      logo: communityInfo.logo
    })
    setShowCommunityForm(true)
  }
  const cancelCommunityForm = () => {
    setShowCommunityForm(false)
    setCommunityFormData({ description: '', logo: '' })
  }

  const handleCommunityDataSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from('communities')
        .update({
          name: communityDataFormData.name,
          username: communityDataFormData.username,
          password: communityDataFormData.password,
          tel_no: communityDataFormData.tel_no,
          mail: communityDataFormData.mail
        })
        .eq('id', user?.id)

      if (error) throw error

      // Update local state
      setCommunityData({
        ...communityData!,
        name: communityDataFormData.name,
        username: communityDataFormData.username,
        password: communityDataFormData.password,
        tel_no: communityDataFormData.tel_no,
        mail: communityDataFormData.mail
      })
      
      alert('Community information updated successfully!')
      setShowCommunityInfoForm(false)
      
    } catch (error) {
      console.error('Error updating community information:', error)
      alert('Error updating community information: ' + (error as Error).message)
    }
  }

  const handleEditCommunityData = () => {
    if (communityData) {
      setCommunityDataFormData({
        name: communityData.name,
        username: communityData.username,
        password: communityData.password,
        tel_no: communityData.tel_no,
        mail: communityData.mail
      })
      setShowCommunityInfoForm(true)
    } else {
      fetchCommunityData()
      alert('Community information is loading. Please try again in a moment.')
    }
  }

  const cancelCommunityDataForm = () => {
    setShowCommunityInfoForm(false)
    setCommunityDataFormData({ name: '', username: '', password: '', tel_no: '', mail: '' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              {communityInfo.logo && (
                <img 
                  src={communityInfo.logo} 
                  alt="Community Logo" 
                  className="h-12 w-12 rounded-full object-cover"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Community Dashboard</h1>
                <p className="text-gray-600">Welcome, {user?.name}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('events')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'events'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Event Management
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Community Settings
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'events' && (
          <>
        {/* Community Info Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold text-black">Community Information</h2>
            <button
              onClick={handleEditCommunityInfo}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Edit Info
            </button>
          </div>
          <p className="text-gray-700 leading-relaxed">{communityInfo.description}</p>
        </div>

        {/* Action Buttons */}
        <div className="mb-8">
          <button
            onClick={() => setShowEventForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create Event
          </button>
        </div>

        {/* Events Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-black">Events</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-black">{event.title}</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditEvent(event)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 mb-4">{event.description}</p>
                <div className="text-sm text-gray-500">
                  <p>Start: {new Date(event.start_time).toLocaleString()}</p>
                  <p>End: {new Date(event.end_time).toLocaleString()}</p>
                </div>
                {event.photo && (
                  <img 
                    src={event.photo} 
                    alt={event.title}
                    className="mt-4 w-full h-48 object-cover rounded-lg"
                  />
                )}
              </div>
            ))}
          </div>
          {events.length === 0 && (
            <p className="text-gray-500 text-center py-8">No events yet. Create your first event!</p>
          )}
        </div>        {/* Event Form */}
        {showEventForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 text-black">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h3>
              <form onSubmit={handleEventSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={eventFormData.title}
                    onChange={(e) => setEventFormData({...eventFormData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    required
                    value={eventFormData.description}
                    onChange={(e) => setEventFormData({...eventFormData, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={eventFormData.start_time}
                    onChange={(e) => setEventFormData({...eventFormData, start_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={eventFormData.end_time}
                    onChange={(e) => setEventFormData({...eventFormData, end_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Photo URL (optional)
                  </label>
                  <input
                    type="url"
                    value={eventFormData.photo}
                    onChange={(e) => setEventFormData({...eventFormData, photo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    {editingEvent ? 'Update' : 'Create'} Event
                  </button>
                  <button
                    type="button"
                    onClick={cancelEventForm}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Community Form */}
        {showCommunityForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 text-black">
                Update Community Information
              </h3>
              <form onSubmit={handleCommunityInfoSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Community Description
                  </label>
                  <textarea
                    required
                    value={communityFormData.description}
                    onChange={(e) => setCommunityFormData({...communityFormData, description: e.target.value})}
                    rows={4}
                    placeholder="Tell people about your community..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Community Logo URL (optional)
                  </label>
                  <input
                    type="url"
                    value={communityFormData.logo}
                    onChange={(e) => setCommunityFormData({...communityFormData, logo: e.target.value})}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  {communityFormData.logo && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 mb-2">Logo Preview:</p>
                      <img 
                        src={communityFormData.logo} 
                        alt="Logo Preview" 
                        className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Update Community
                  </button>
                  <button
                    type="button"
                    onClick={cancelCommunityForm}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>            </div>
          </div>
        )}
          </>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            {communityData ? (
              <div>
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Community Information</h3>
                  <button
                    onClick={handleEditCommunityData}
                    disabled={!communityData}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      communityData 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Edit Information
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Basic Information</h4>
                    <div className="space-y-2">
                      <p className="text-black"><span className="font-medium">Name:</span> {communityData.name}</p>
                      <p className="text-black"><span className="font-medium">Username:</span> {communityData.username}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
                    <div className="space-y-2">
                      <p className="text-black"><span className="font-medium">Phone:</span> {communityData.tel_no}</p>
                      <p className="text-black"><span className="font-medium">Email:</span> {communityData.mail}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Loading community information...</p>
              </div>
            )}
          </div>
        )}

        {/* Community Data Form Modal - Outside tab sections */}
        {showCommunityInfoForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 text-black">
                Update Community Information
              </h3>
              <form onSubmit={handleCommunityDataSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Community Name
                    </label>
                    <input
                      type="text"
                      required
                      value={communityDataFormData.name}
                      onChange={(e) => setCommunityDataFormData({...communityDataFormData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={communityDataFormData.username}
                      onChange={(e) => setCommunityDataFormData({...communityDataFormData, username: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={communityDataFormData.password}
                    onChange={(e) => setCommunityDataFormData({...communityDataFormData, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={communityDataFormData.tel_no}
                      onChange={(e) => setCommunityDataFormData({...communityDataFormData, tel_no: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={communityDataFormData.mail}
                      onChange={(e) => setCommunityDataFormData({...communityDataFormData, mail: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Update Community
                  </button>
                  <button
                    type="button"
                    onClick={cancelCommunityDataForm}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}