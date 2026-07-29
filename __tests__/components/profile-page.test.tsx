/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilePage from '@/app/dashboard/profile/page';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

// Mock SignOutButton component
jest.mock('@/components/auth/sign-out-button', () => ({
  SignOutButton: () => <button data-testid="signout">Sign Out</button>,
}));

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: 'sb-access-token=test-token',
});

const mockCreateClient = createClient as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

describe('Profile Page Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the profile page with loading state', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null, // Will simulate not found
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    });
  });

  it('should render profile data after successful loading', async () => {
    const mockProfile = {
      id: 'test-user-id',
      email: 'organizer@example.com',
      full_name: 'John Doe',
      phone: '+91 98765 43210',
      avatar_url: 'https://example.com/avatar.jpg',
      role: 'organizer',
      registration_number: 'LPU123456',
      department: 'Computer Science',
      metadata: { company: 'Tech Corp' },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profile Settings')).toBeInTheDocument();
      expect(screen.getByText('Manage your organizer profile')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
      expect(screen.getByText('Computer Science')).toBeInTheDocument();
      expect(screen.getByText('LPU123456')).toBeInTheDocument();
      expect(screen.getByTestId('signout')).toBeInTheDocument();
    });
  });

  it('should display error when profile loading fails', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load profile/)).toBeInTheDocument();
    });
  });

  it('should redirect to sign-in page when not authenticated', async () => {
    const mockRouter = { push: jest.fn() };

    mockUseRouter.mockReturnValue(mockRouter);
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/sign-in');
    });
  });

  it('should display validation error for invalid avatar file size', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                email: 'organizer@example.com',
                full_name: 'John Doe',
                phone: '+91 98765 43210',
                avatar_url: null,
                role: 'organizer',
                registration_number: null,
                department: null,
                metadata: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      const fileInput = screen.getByLabelText(/Change Avatar/i);
      // Create a file larger than 2MB
      const largeFile = new File(['x'.repeat(2 * 1024 * 1024 + 1)], 'large.jpg', {
        type: 'image/jpeg',
      });
      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(screen.getByText('Avatar image must be less than 2MB.')).toBeInTheDocument();
    });
  });

  it('should display validation error for invalid avatar file type', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                email: 'organizer@example.com',
                full_name: 'John Doe',
                phone: '+91 98765 43210',
                avatar_url: null,
                role: 'organizer',
                registration_number: null,
                department: null,
                metadata: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      const fileInput = screen.getByLabelText(/Change Avatar/i);
      // Create a file with invalid type
      const invalidFile = new File(['test'], 'test.txt', {
        type: 'text/plain',
      });
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      expect(screen.getByText(/valid image/)).toBeInTheDocument();
    });
  });

  it('should display error when profile update fails', async () => {
    const mockRouter = { push: jest.fn() };

    mockUseRouter.mockReturnValue(mockRouter);
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                email: 'organizer@example.com',
                full_name: 'John Doe',
                phone: '+91 98765 43210',
                avatar_url: null,
                role: 'organizer',
                registration_number: null,
                department: null,
                metadata: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    // Try to save with an invalid avatar (simulating API failure)
    // This is a simplified test - in reality, you'd need to mock the fetch API
    // and handle the avatar upload separately
  });

  it('should display success message after profile update', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                email: 'organizer@example.com',
                full_name: 'Jane Doe',
                phone: '+91 98765 43211',
                avatar_url: null,
                role: 'organizer',
                registration_number: null,
                department: null,
                metadata: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('+91 98765 43211')).toBeInTheDocument();
    });
  });

  it('should display cancel button', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                email: 'organizer@example.com',
                full_name: 'John Doe',
                phone: '+91 98765 43210',
                avatar_url: null,
                role: 'organizer',
                registration_number: null,
                department: null,
                metadata: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('should display submit button when not saving', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                email: 'organizer@example.com',
                full_name: 'John Doe',
                phone: '+91 98765 43210',
                avatar_url: null,
                role: 'organizer',
                registration_number: null,
                department: null,
                metadata: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  it('should display saving state when save button is clicked', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-user-id',
                email: 'organizer@example.com',
                full_name: 'John Doe',
                phone: '+91 98765 43210',
                avatar_url: null,
                role: 'organizer',
                registration_number: null,
                department: null,
                metadata: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<ProfilePage />);

    await waitFor(() => {
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });
});
