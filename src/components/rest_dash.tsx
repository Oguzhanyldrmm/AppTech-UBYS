'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface MenuItem {
  id: string
  name: string
  price: number
  description: string
  calories?: number
  category_id: string
}

interface Category {
  id: string
  name: string
}

interface Restaurant {
  id: string
  name: string
  description: string
  password: string
  username: string
  open_time: string
  close_time: string
  tel_no: string
  mail: string
  location: string
  delivery_time: number
}

interface Announcement {
  id: string
  restaurant_id: string
  title: string
  content: string
  posted_at: string
  start_date?: string
  end_date?: string
}

interface Order {
  id: string
  message?: string
  status: string
  order_time: string
  user_id: string
  restaurant_id: string
  payment_method_id?: string
  address_id?: string
  users?: {
    name: string
    st_id: string
  }
  addresses?: {
    location: string
    description?: string
  }
  payment_methods?: {
    name: string
    type: string  }
}

export default function RestaurantDashboard() {
  const { user, logout } = useAuth()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [restaurantInfo, setRestaurantInfo] = useState<Restaurant | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [showRestaurantForm, setShowRestaurantForm] = useState(false)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'announcements' | 'settings'>('menu')
  
  // Menu form state
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    calories: '',
    category_id: ''
  })
    // Restaurant form state
  const [restaurantFormData, setRestaurantFormData] = useState({
    name: '',
    description: '',
    username: '',
    password: '',
    open_time: '',
    close_time: '',
    tel_no: '',
    mail: '',
    location: '',
    delivery_time: ''
  })

  // Announcement form state
  const [announcementFormData, setAnnouncementFormData] = useState({
    title: '',
    content: '',
    start_date: '',
    end_date: ''
  })

  useEffect(() => {
    if (user?.type === 'restaurant') {
      fetchMenuItems()
      fetchCategories()
      fetchOrders()
      fetchRestaurantInfo()
      fetchAnnouncements()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .eq('restaurant_id', user?.id)
        .order('name')

      if (error) throw error
      setMenuItems(data || [])
    } catch (error) {
      console.error('Error fetching menu items:', error)
    } finally {
      setLoading(false)
    }
  }
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }
  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          users (
            name,
            st_id
          ),
          addresses (
            location,
            description
          ),
          payment_methods (
            name,
            type
          )
        `)
        .eq('restaurant_id', user?.id)
        .order('order_time', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
    }
  }
  const fetchRestaurantInfo = async () => {
    try {
      console.log('Fetching restaurant info for user ID:', user?.id)
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      if (data) {
        console.log('Restaurant info fetched successfully:', data)
        setRestaurantInfo(data)
      } else {
        console.log('No restaurant data found')
      }    } catch (error) {
      console.error('Error fetching restaurant info:', error)
    }
  }

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('restaurant_id', user?.id)
        .order('posted_at', { ascending: false })

      if (error) throw error
      setAnnouncements(data || [])
    } catch (error) {
      console.error('Error fetching announcements:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const menuItemData = {
        name: formData.name,
        price: parseFloat(formData.price),
        description: formData.description,
        calories: formData.calories ? parseInt(formData.calories) : null,
        category_id: formData.category_id,
        restaurant_id: user?.id
      }

      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from('menu_items')
          .update(menuItemData)
          .eq('id', editingItem.id)

        if (error) throw error
      } else {
        // Add new item
        const { error } = await supabase
          .from('menu_items')
          .insert([menuItemData])

        if (error) throw error
      }

      // Reset form and refresh data
      setFormData({ name: '', price: '', description: '', calories: '', category_id: '' })
      setShowAddForm(false)
      setEditingItem(null)
      fetchMenuItems()
    } catch (error) {
      console.error('Error saving menu item:', error)
      alert('Error saving menu item')
    }
  }

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) throw error
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ))
      
      alert('Order status updated successfully!')    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Error updating order status')
    }
  }

  const handleRestaurantInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const restaurantData = {
        name: restaurantFormData.name,
        description: restaurantFormData.description,
        username: restaurantFormData.username,
        password: restaurantFormData.password,
        open_time: restaurantFormData.open_time,
        close_time: restaurantFormData.close_time,
        tel_no: restaurantFormData.tel_no,
        mail: restaurantFormData.mail,
        location: restaurantFormData.location,
        delivery_time: parseInt(restaurantFormData.delivery_time)
      }

      const { error } = await supabase
        .from('restaurants')
        .update(restaurantData)
        .eq('id', user?.id)

      if (error) throw error
      
      // Update local state
      setRestaurantInfo(prev => prev ? { ...prev, ...restaurantData } : null)
      
      alert('Restaurant information updated successfully!')
      setShowRestaurantForm(false)
      
    } catch (error) {
      console.error('Error updating restaurant info:', error)
      alert('Error updating restaurant information: ' + (error as Error).message)
    }
  }

  const handleEditRestaurantInfo = useCallback(() => {
    if (restaurantInfo) {
      const formData = {
        name: restaurantInfo.name,
        description: restaurantInfo.description,
        username: restaurantInfo.username,
        password: restaurantInfo.password,
        open_time: restaurantInfo.open_time,
        close_time: restaurantInfo.close_time,
        tel_no: restaurantInfo.tel_no,
        mail: restaurantInfo.mail,
        location: restaurantInfo.location,
        delivery_time: restaurantInfo.delivery_time.toString()
      }
      
      setRestaurantFormData(formData)
      setShowRestaurantForm(true)
    } else {      fetchRestaurantInfo()
      alert('Restaurant information is loading. Please try again in a moment.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantInfo])

  const cancelRestaurantForm = () => {
    setShowRestaurantForm(false)
    setRestaurantFormData({
      name: '',
      description: '',
      username: '',
      password: '',
      open_time: '',
      close_time: '',
      tel_no: '',
      mail: '',      location: '',
      delivery_time: ''
    })
  }

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const announcementData = {
        ...announcementFormData,
        restaurant_id: user?.id,
        start_date: announcementFormData.start_date || null,
        end_date: announcementFormData.end_date || null
      }

      if (editingAnnouncement) {
        // Update existing announcement
        const { error } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', editingAnnouncement.id)

        if (error) throw error
        alert('Announcement updated successfully!')
      } else {
        // Add new announcement
        const { error } = await supabase
          .from('announcements')
          .insert([announcementData])

        if (error) throw error
        alert('Announcement created successfully!')
      }

      // Reset form and refresh data
      setAnnouncementFormData({ title: '', content: '', start_date: '', end_date: '' })
      setShowAnnouncementForm(false)
      setEditingAnnouncement(null)
      fetchAnnouncements()
      
    } catch (error) {
      console.error('Error saving announcement:', error)
      alert('Error saving announcement: ' + (error as Error).message)
    }
  }

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setAnnouncementFormData({
      title: announcement.title,
      content: announcement.content,
      start_date: announcement.start_date ? announcement.start_date.split('T')[0] : '',
      end_date: announcement.end_date ? announcement.end_date.split('T')[0] : ''
    })
    setShowAnnouncementForm(true)
  }

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      alert('Announcement deleted successfully!')
      fetchAnnouncements()
    } catch (error) {
      console.error('Error deleting announcement:', error)
      alert('Error deleting announcement: ' + (error as Error).message)
    }
  }

  const cancelAnnouncementForm = () => {
    setShowAnnouncementForm(false)
    setEditingAnnouncement(null)
    setAnnouncementFormData({ title: '', content: '', start_date: '', end_date: '' })
  }

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      price: item.price.toString(),
      description: item.description,
      calories: item.calories?.toString() || '',
      category_id: item.category_id
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this menu item?')) {
      try {
        const { error } = await supabase
          .from('menu_items')
          .delete()
          .eq('id', id)

        if (error) throw error
        fetchMenuItems()
      } catch (error) {
        console.error('Error deleting menu item:', error)
        alert('Error deleting menu item')
      }
    }
  }

  const cancelForm = () => {
    setShowAddForm(false)
    setEditingItem(null)
    setFormData({ name: '', price: '', description: '', calories: '', category_id: '' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.userData?.name} - Restaurant Dashboard
              </h1>
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
          <div className="border-b border-gray-200">            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('menu')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'menu'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Menu Management
              </button>              <button
                onClick={() => setActiveTab('orders')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('announcements')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'announcements'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Announcements ({announcements.length})
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Restaurant Settings
              </button>
            </nav>
          </div>
        </div>        {/* Tab Content */}
        {activeTab === 'menu' && (
          <>
            {/* Add Menu Item Button */}
            <div className="mb-8">
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Add New Menu Item
              </button>
            </div>

        {/* Add/Edit Form */}        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4 text-black">
                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Calories (optional)
                  </label>                  <input
                    type="number"
                    value={formData.calories}
                    onChange={(e) => setFormData({...formData, calories: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    {editingItem ? 'Update' : 'Add'} Menu Item
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>                </div>
              </form>
            </div>
          </div>
        )}

        {/* Menu Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow-md p-6">                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                    <span className="text-lg font-bold text-green-600">₺{item.price}</span>
                  </div>
                  
                  <p className="text-gray-600 mb-3">{item.description}</p>
                  
                  {item.calories && (
                    <p className="text-sm text-gray-500 mb-3">{item.calories} calories</p>
                  )}
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-3 rounded text-sm transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>            {menuItems.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No menu items yet. Add your first menu item!</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'orders' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Restaurant Orders</h2>
            
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No orders yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Order #{order.id.slice(-8)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Customer: {order.users?.name} ({order.users?.st_id})
                        </p>
                        <p className="text-sm text-gray-600">
                          Time: {new Date(order.order_time).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'ready' ? 'bg-green-100 text-green-800' :
                          order.status === 'delivered' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {order.message && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700">Message:</p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{order.message}</p>
                      </div>
                    )}

                    {order.addresses && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700">Delivery Address:</p>
                        <p className="text-sm text-gray-600">{order.addresses.location}</p>
                        {order.addresses.description && (
                          <p className="text-sm text-gray-500">{order.addresses.description}</p>
                        )}
                      </div>
                    )}

                    {order.payment_methods && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700">Payment Method:</p>
                        <p className="text-sm text-gray-600">{order.payment_methods.name} ({order.payment_methods.type})</p>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                      >
                        <option value="pending">Pending</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>                ))}
              </div>
            )}
          </div>        )}

        {activeTab === 'announcements' && (
          <>
            {/* Add Announcement Button */}
            <div className="mb-8">
              <button
                onClick={() => setShowAnnouncementForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Add New Announcement
              </button>
            </div>

            {/* Announcements List */}
            <div className="space-y-6">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{announcement.title}</h3>
                      <p className="text-gray-600 mb-4">{announcement.content}</p>
                      <div className="text-sm text-gray-500">
                        <p><span className="font-medium">Posted:</span> {new Date(announcement.posted_at).toLocaleString()}</p>
                        {announcement.start_date && (
                          <p><span className="font-medium">Start Date:</span> {new Date(announcement.start_date).toLocaleDateString()}</p>
                        )}
                        {announcement.end_date && (
                          <p><span className="font-medium">End Date:</span> {new Date(announcement.end_date).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleEditAnnouncement(announcement)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No announcements yet. Create your first announcement!</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Restaurant Settings</h2>
            
            {restaurantInfo ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Restaurant Information</h3>                  <button
                    onClick={handleEditRestaurantInfo}
                    disabled={!restaurantInfo}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      restaurantInfo 
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
                      <p className="text-black"><span className="font-medium">Name:</span> {restaurantInfo.name}</p>
                      <p className="text-black"><span className="font-medium">Description:</span> {restaurantInfo.description}</p>
                      <p className="text-black"><span className="font-medium">Username:</span> {restaurantInfo.username}</p>
                      <p className="text-black"><span className="font-medium">Location:</span> {restaurantInfo.location}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Contact & Operations</h4>
                    <div className="space-y-2">
                      <p className="text-black"><span className="font-medium">Phone:</span> {restaurantInfo.tel_no}</p>
                      <p className="text-black"><span className="font-medium">Email:</span> {restaurantInfo.mail}</p>
                      <p className="text-black"><span className="font-medium">Open Time:</span> {restaurantInfo.open_time}</p>
                      <p className="text-black"><span className="font-medium">Close Time:</span> {restaurantInfo.close_time}</p>
                      <p className="text-black"><span className="font-medium">Delivery Time:</span> {restaurantInfo.delivery_time} minutes</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Loading restaurant information...</p>
              </div>
            )}
          </div>        )}      </main>

      {/* Announcement Form Modal - Outside tab sections */}
      {showAnnouncementForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 text-black">
              {editingAnnouncement ? 'Edit Announcement' : 'Add New Announcement'}
            </h3>
            <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={announcementFormData.title}
                  onChange={(e) => setAnnouncementFormData({...announcementFormData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  required
                  rows={4}
                  value={announcementFormData.content}
                  onChange={(e) => setAnnouncementFormData({...announcementFormData, content: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={announcementFormData.start_date}
                    onChange={(e) => setAnnouncementFormData({...announcementFormData, start_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={announcementFormData.end_date}
                    onChange={(e) => setAnnouncementFormData({...announcementFormData, end_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  {editingAnnouncement ? 'Update' : 'Create'} Announcement
                </button>
                <button
                  type="button"
                  onClick={cancelAnnouncementForm}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restaurant Form Modal - Outside tab sections */}
      {showRestaurantForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 text-black">
              Update Restaurant Information
            </h3>
            <form onSubmit={handleRestaurantInfoSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    required
                    value={restaurantFormData.name}
                    onChange={(e) => setRestaurantFormData({...restaurantFormData, name: e.target.value})}
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
                    value={restaurantFormData.username}
                    onChange={(e) => setRestaurantFormData({...restaurantFormData, username: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  required
                  value={restaurantFormData.description}
                  onChange={(e) => setRestaurantFormData({...restaurantFormData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={restaurantFormData.password}
                  onChange={(e) => setRestaurantFormData({...restaurantFormData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Open Time
                  </label>
                  <input
                    type="time"
                    required
                    value={restaurantFormData.open_time}
                    onChange={(e) => setRestaurantFormData({...restaurantFormData, open_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Close Time
                  </label>
                  <input
                    type="time"
                    required
                    value={restaurantFormData.close_time}
                    onChange={(e) => setRestaurantFormData({...restaurantFormData, close_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={restaurantFormData.tel_no}
                    onChange={(e) => setRestaurantFormData({...restaurantFormData, tel_no: e.target.value})}
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
                    value={restaurantFormData.mail}
                    onChange={(e) => setRestaurantFormData({...restaurantFormData, mail: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    required
                    value={restaurantFormData.location}
                    onChange={(e) => setRestaurantFormData({...restaurantFormData, location: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Time (minutes)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={restaurantFormData.delivery_time}
                    onChange={(e) => setRestaurantFormData({...restaurantFormData, delivery_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Update Restaurant
                </button>
                <button
                  type="button"
                  onClick={cancelRestaurantForm}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
