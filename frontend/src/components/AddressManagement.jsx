import React, { useState } from 'react';
import { Plus, MapPin, Edit2, Trash2, Home, Briefcase, Check } from 'lucide-react';

const AddressManagement = () => {
  const [addresses, setAddresses] = useState([
    {
      id: 1,
      type: 'Home',
      name: 'Jane Doe',
      street: '123 Main St, Apt 4B',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      phone: '(555) 123-4567',
      isDefault: true,
    },
    {
      id: 2,
      type: 'Work',
      name: 'Jane Doe',
      street: '456 Tech Park, Suite 100',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      phone: '(555) 987-6543',
      isDefault: false,
    }
  ]);

  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleDelete = (id) => {
    setAddresses(addresses.filter(addr => addr.id !== id));
  };

  const setAsDefault = (id) => {
    setAddresses(addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id
    })));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Addresses</h1>
          <p className="text-slate-500 mt-1">Add, update, or remove your shipping addresses.</p>
        </div>
        <button 
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          {isAddingNew ? 'Cancel' : (
            <>
              <Plus className="w-5 h-5 mr-2" />
              Add New Address
            </>
          )}
        </button>
      </div>

      {isAddingNew && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Add a new address</h3>
          <form className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input type="tel" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="(555) 000-0000" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Street Address</label>
              <input type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="123 Example St, Apt 1" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="City" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="State" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ZIP Code</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="ZIP" />
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="addressType" className="text-indigo-600 focus:ring-indigo-500" defaultChecked />
                <span className="text-sm text-slate-700 font-medium">Home</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="addressType" className="text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-slate-700 font-medium">Work</span>
              </label>
            </div>

            <div className="flex items-center mt-2">
              <input type="checkbox" id="default" className="text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
              <label htmlFor="default" className="ml-2 text-sm text-slate-700">Set as default shipping address</label>
            </div>

            <div className="pt-4 flex justify-end space-x-3">
              <button 
                type="button" 
                onClick={() => setIsAddingNew(false)}
                className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                type="button"
                className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
              >
                Save Address
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {addresses.map((address) => (
          <div 
            key={address.id} 
            className={`relative rounded-2xl border p-6 transition-all ${
              address.isDefault 
                ? 'border-indigo-500 shadow-md bg-indigo-50/30' 
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            {address.isDefault && (
              <span className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl flex items-center">
                <Check className="w-3 h-3 mr-1" /> Default
              </span>
            )}
            
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-lg ${address.isDefault ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                  {address.type === 'Home' ? <Home className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{address.type}</h3>
                  <p className="text-sm font-medium text-slate-700">{address.name}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-slate-600 text-sm mb-6">
              <p>{address.street}</p>
              <p>{address.city}, {address.state} {address.zip}</p>
              <p className="pt-2">{address.phone}</p>
            </div>

            <div className="flex items-center space-x-3 pt-4 border-t border-slate-100">
              <button className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center transition-colors">
                <Edit2 className="w-4 h-4 mr-1" /> Edit
              </button>
              <button 
                onClick={() => handleDelete(address.id)}
                className="text-sm font-medium text-red-500 hover:text-red-700 flex items-center transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remove
              </button>
              
              {!address.isDefault && (
                <button 
                  onClick={() => setAsDefault(address.id)}
                  className="ml-auto text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  Set as default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AddressManagement;
