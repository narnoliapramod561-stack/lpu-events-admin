import { useState, useEffect, useCallback } from 'react';

interface DashboardStats {
    users: {
        totalStudents: number;
        totalOrganizers: number;
        pendingApplications: number;
    };
    events: {
        total: number;
        published: number;
        upcoming: number;
    };
    bookings: {
        totalRegistrations: number;
        totalRevenue: number;
    };
    categories: {
        active: number;
    };
}

interface UseDashboardStatsReturn {
    stats: DashboardStats | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useDashboardStats(): UseDashboardStatsReturn {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/dashboard/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data.data);
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to fetch dashboard stats');
            }
        } catch (err) {
            setError('Network error loading dashboard stats');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        (async () => {
            await fetchStats();
        })();

        // Auto-refresh every 2 minutes
        const interval = setInterval(fetchStats, 120000);

        return () => clearInterval(interval);
    }, [fetchStats]);

    return {
        stats,
        loading,
        error,
        refetch: fetchStats,
    };
}
