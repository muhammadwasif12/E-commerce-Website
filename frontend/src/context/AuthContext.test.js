import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import axios from 'axios';

// Mock axios
jest.mock('axios');

// A test component to consume the context
const TestComponent = () => {
  const { user, token, loading, login, register, logout } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading...' : 'Ready'}</div>
      <div data-testid="token">{token || 'No Token'}</div>
      <div data-testid="user">{user ? user.name : 'No User'}</div>
      
      <button onClick={() => login('test@example.com', 'password123')}>Login</button>
      <button onClick={() => register('John Doe', 'test@example.com', 'password123')}>Register</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('provides initial state correctly without token', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initial loading state
    expect(screen.getByTestId('loading')).toHaveTextContent('Ready');
    expect(screen.getByTestId('token')).toHaveTextContent('No Token');
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
  });

  it('handles login successfully', async () => {
    // We are simulating the dummy token creation in AuthContext since our AuthContext currently just logs in directly without waiting for axios.
    // However, if we were making an axios call, we would mock it like:
    // axios.post.mockResolvedValueOnce({ data: { token: 'dummy_token' } });
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    const userEventObj = userEvent.setup();

    const loginButton = screen.getByText('Login');
    await userEventObj.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('token')).toHaveTextContent('dummy_token');
      expect(screen.getByTestId('user')).toHaveTextContent('Jane Doe');
    });
  });

  it('handles register successfully', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    const userEventObj = userEvent.setup();

    const registerButton = screen.getByText('Register');
    await userEventObj.click(registerButton);

    await waitFor(() => {
      expect(screen.getByTestId('token')).toHaveTextContent('dummy_token_reg');
      expect(screen.getByTestId('user')).toHaveTextContent('John Doe');
    });
  });

  it('handles logout successfully', async () => {
    // Set initial token to simulate logged in state
    localStorage.setItem('token', 'existing_token');

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    const userEventObj = userEvent.setup();
    
    // AuthContext currently sets a user internally when initialized with token
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Ready');
      expect(screen.getByTestId('token')).toHaveTextContent('existing_token');
    });

    const logoutButton = screen.getByText('Logout');
    await userEventObj.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByTestId('token')).toHaveTextContent('No Token');
      expect(screen.getByTestId('user')).toHaveTextContent('No User');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
});
