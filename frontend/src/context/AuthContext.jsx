import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        // Mocking an API call for user validation since backend isn't provided
        // const response = await axios.get('http://localhost:5000/api/auth/me');
        // setUser(response.data.user);
        
        // Simulating backend response
        setUser((prev) => prev || {
          id: '1',
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          role: 'customer'
        });
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    try {
      // Simulate API call
      // const response = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      // setToken(response.data.token);
      
      console.log('Logging in with:', email, password);
      // Dummy token
      const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token';
      setToken(dummyToken);
      setUser({
        id: '1',
        name: 'Jane Doe',
        email,
        role: 'customer'
      });
      return true;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (name, email, password) => {
    try {
      // Simulate API call
      // const response = await axios.post('http://localhost:5000/api/auth/register', { name, email, password });
      // setToken(response.data.token);

      console.log('Registering:', name, email, password);
      const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_reg';
      setToken(dummyToken);
      setUser({
        id: '2',
        name,
        email,
        role: 'customer'
      });
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
