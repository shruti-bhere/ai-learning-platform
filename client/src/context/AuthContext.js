import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [socket, setSocket] = useState(null);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/user/profile');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      // Clear auth state on profile fetch failure
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserProfile();
      
      // Initialize socket connection for active user tracking
      const socketConnection = io('http://localhost:5000');
      setSocket(socketConnection);
      
      return () => {
        socketConnection.disconnect();
      };
    } else {
      setLoading(false);
    }
  }, [token, fetchUserProfile]);

  useEffect(() => {
    if (socket && user) {
      // Emit user active event
      socket.emit('user-active', user.id);
      
      // Emit periodically to keep user active
      const interval = setInterval(() => {
        socket.emit('user-active', user.id);
      }, 60000); // Every minute
      
      return () => clearInterval(interval);
    }
  }, [socket, user]);

  const login = async (username, password) => {
    try {
      if (!username || !password) {
        return {
          success: false,
          error: 'Username and password are required'
        };
      }

      const response = await axios.post('http://localhost:5000/api/auth/login', {
        username: username.trim(),
        password: password
      });
      
      const { token, user } = response.data;
      
      if (!token || !user) {
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return { success: true, redirect: '/courses' };
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Login failed. Please check your credentials.';
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        username,
        email,
        password
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return { success: true, redirect: '/courses' };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = async () => {
    try {
      // Inform backend to close active session (if still authenticated)
      await axios.post('http://localhost:5000/api/auth/logout');
    } catch (error) {
      // Ignore errors here; we'll still clear local state
      console.error('Logout tracking error:', error?.response?.data || error.message);
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, fetchUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

