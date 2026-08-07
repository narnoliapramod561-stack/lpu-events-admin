import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                {
                    error: 'UNAUTHORIZED',
                    message: 'Authentication required',
                },
                { status: 401 }
            );
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        const role = profile?.role || 'pending';

        if (role === 'super_admin' || role === 'admin') {
            const [
                totalStudentsResult,
                totalOrganizersResult,
                pendingApplicationsResult,
                totalEventsResult,
                publishedEventsResult,
                upcomingEventsResult,
                totalRegistrationsResult,
                totalRevenueResult,
                activeCategoriesResult,
            ] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id', { count: 'exact', head: true })
                    .eq('role', 'student')
                    .eq('is_active', true)
                    .is('deleted_at', null),

                supabase
                    .from('profiles')
                    .select('id', { count: 'exact', head: true })
                    .eq('role', 'organizer')
                    .eq('is_active', true)
                    .is('deleted_at', null),

                supabase
                    .from('organizer_applications')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'pending'),

                supabase
                    .from('events')
                    .select('id', { count: 'exact', head: true })
                    .is('deleted_at', null),

                supabase
                    .from('events')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'published')
                    .is('deleted_at', null),

                supabase
                    .from('events')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'published')
                    .gte('starts_at', new Date().toISOString())
                    .is('deleted_at', null),

                supabase
                    .from('registrations')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'confirmed'),

                supabase
                    .from('payments')
                    .select('amount')
                    .eq('status', 'captured'),

                supabase
                    .from('categories')
                    .select('id', { count: 'exact', head: true })
                    .eq('is_active', true)
                    .is('deleted_at', null),
            ]);

            const totalRevenue = totalRevenueResult.data?.reduce(
                (sum, payment) => sum + (Number(payment.amount) || 0),
                0
            ) || 0;

            const stats = {
                users: {
                    totalStudents: totalStudentsResult.count || 0,
                    totalOrganizers: totalOrganizersResult.count || 0,
                    pendingApplications: pendingApplicationsResult.count || 0,
                },
                events: {
                    total: totalEventsResult.count || 0,
                    published: publishedEventsResult.count || 0,
                    upcoming: upcomingEventsResult.count || 0,
                },
                bookings: {
                    totalRegistrations: totalRegistrationsResult.count || 0,
                    totalRevenue: totalRevenue,
                },
                categories: {
                    active: activeCategoriesResult.count || 0,
                },
            };

            return NextResponse.json(
                {
                    data: stats,
                    timestamp: new Date().toISOString(),
                },
                { status: 200 }
            );
        }

        if (role === 'organizer') {
            const [
                myEventsResult,
                myPublishedResult,
                myUpcomingResult,
                myRegistrationsResult,
                myRevenueResult,
            ] = await Promise.all([
                supabase
                    .from('events')
                    .select('id', { count: 'exact', head: true })
                    .eq('organizer_id', user.id)
                    .is('deleted_at', null),

                supabase
                    .from('events')
                    .select('id', { count: 'exact', head: true })
                    .eq('organizer_id', user.id)
                    .eq('status', 'published')
                    .is('deleted_at', null),

                supabase
                    .from('events')
                    .select('id', { count: 'exact', head: true })
                    .eq('organizer_id', user.id)
                    .eq('status', 'published')
                    .gte('starts_at', new Date().toISOString())
                    .is('deleted_at', null),

                supabase
                    .from('registrations')
                    .select('id, events!inner(organizer_id, deleted_at)', { count: 'exact', head: true })
                    .eq('status', 'confirmed')
                    .eq('events.organizer_id', user.id)
                    .is('events.deleted_at', null),

                supabase
                    .from('payments')
                    .select('amount, registrations!inner(events!inner(organizer_id, deleted_at))')
                    .eq('status', 'captured')
                    .eq('registrations.events.organizer_id', user.id)
                    .is('registrations.events.deleted_at', null),
            ]);

            const myRevenue = myRevenueResult.data?.reduce(
                (sum, payment) => sum + (Number(payment.amount) || 0),
                0
            ) || 0;

            const stats = {
                users: {
                    totalStudents: 0,
                    totalOrganizers: 0,
                    pendingApplications: 0,
                },
                events: {
                    total: myEventsResult.count || 0,
                    published: myPublishedResult.count || 0,
                    upcoming: myUpcomingResult.count || 0,
                },
                bookings: {
                    totalRegistrations: myRegistrationsResult.count || 0,
                    totalRevenue: myRevenue,
                },
                categories: {
                    active: 0,
                },
            };

            return NextResponse.json(
                {
                    data: stats,
                    timestamp: new Date().toISOString(),
                },
                { status: 200 }
            );
        }

        return NextResponse.json(
            {
                error: 'FORBIDDEN',
                message: 'Access denied.',
            },
            { status: 403 }
        );
    } catch {
        // Admin dashboard stats error handled
        return NextResponse.json(
            {
                error: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
            },
            { status: 500 }
        );
    }
}
