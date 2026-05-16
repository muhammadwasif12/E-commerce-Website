import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom';
import { 
  User, 
  Package, 
  Heart, 
  MapPin, 
  LogOut, 
  Settings, 
  CreditCard,
  ShoppingBag,
  Bell
} from 'lucide-react';

const UserDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Profile Overview', path: '/dashboard', icon: User, exact: true },
    { name: 'My Orders', path: '/dashboard/orders', icon: Package },
    { name: 'Addresses', path: '/dashboard/addresses', icon: MapPin },
    { name: 'Payment Methods', path: '/dashboard/payments', icon: CreditCard },
    { name: 'Wishlist', path: '/dashboard/wishlist', icon: Heart },
    { name: 'Notifications', path: '/dashboard/notifications', icon: Bell },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header / Navbar replacement for demo */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <ShoppingBag className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-bold text-slate-900 tracking-tight">CartWish</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600 font-medium hidden sm:block">
                Hello, {user?.name || 'User'}
              </span>
              <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                {user?.name?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-md">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{user?.name || 'User'}</h3>
                    <p className="text-sm text-slate-500">{user?.email || 'user@example.com'}</p>
                  </div>
                </div>
              </div>
              
              <nav className="p-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = item.exact 
                    ? location.pathname === item.path 
                    : location.pathname.startsWith(item.path);
                    
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
              
              <div className="p-4 border-t border-slate-100 mt-auto">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center px-4 py-3 text-sm font-medium text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                >
                  <LogOut className="mr-3 h-5 w-5 text-red-500" />
                  Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[500px] p-6 lg:p-8">
              {/* If no outlet routes match, we show a default welcome or if they do match we show Outlet */}
              {location.pathname === '/dashboard' ? (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
                    <p className="text-slate-500 mt-1">Manage your account settings and track your orders.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                      <div className="relative z-10">
                        <Package className="h-8 w-8 mb-4 opacity-80" />
                        <h3 className="text-xl font-bold">12</h3>
                        <p className="text-indigo-100 text-sm">Total Orders</p>
                      </div>
                      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                      <div className="relative z-10">
                        <Heart className="h-8 w-8 mb-4 opacity-80" />
                        <h3 className="text-xl font-bold">24</h3>
                        <p className="text-cyan-100 text-sm">Wishlist Items</p>
                      </div>
                      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                      <div className="relative z-10">
                        <MapPin className="h-8 w-8 mb-4 opacity-80" />
                        <h3 className="text-xl font-bold">3</h3>
                        <p className="text-emerald-100 text-sm">Saved Addresses</p>
                      </div>
                      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h2>
                    <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-100 border-dashed">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-500 mb-4">
                        <Package className="h-8 w-8" />
                      </div>
                      <h3 className="text-slate-900 font-medium">No recent orders</h3>
                      <p className="text-slate-500 mt-1 mb-4 max-w-sm mx-auto">Looks like you haven't made any purchases recently. Explore our products and start shopping.</p>
                      <button className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                        Start Shopping
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <Outlet />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
