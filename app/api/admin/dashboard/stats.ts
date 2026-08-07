import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const [{ data: usersData, error: usersError }, { data: eventsData, error: eventsError }, { data: bookingsData, error: bookingsError }, { data: categoriesData, error: categoriesError }] = await Promise.all([
      supabaseAdmin.from('users').select('role'),
      supabaseAdmin.from('events').select('status'),
      supabaseAdmin.from('bookings').select('amount'),
      supabaseAdmin.from('categories').select('*'),
    ]);

    if (usersError || eventsError || bookingsError || categoriesError) {
      throw new Error(usersError?.message || eventsError?.message || bookingsError?.message || categoriesError?.message);
    }

    const totalStudents = usersData?.filter(user => user.role === 'student').length || 0;
    const totalOrganizers = usersData?.filter(user => user.role === 'organizer').length || 0;
    const pendingApplications = usersData?.filter(user => user.role === 'pending').length || 0;
    const totalEvents = eventsData?.length || 0;
    const publishedEvents = eventsData?.filter(event => event.status === 'published').length || 0;
    const upcomingEvents = eventsData?.filter(event => event.status === 'upcoming').length || 0;
    const totalRegistrations = bookingsData?.length || 0;
    const totalRevenue = bookingsData?.reduce((sum, booking) => sum + booking.amount, 0) || 0;
    const activeCategories = categoriesData?.filter(category => category.active).length || 0;

    const stats = {
      users: {
        totalStudents,
        totalOrganizers,
        pendingApplications,
      },
      events: {
        total: totalEvents,
        published: publishedEvents,
        upcoming: upcomingEvents,
      },
      bookings: {
        totalRegistrations,
        totalRevenue,
      },
      categories: {
        active: activeCategories,
      },
    };

    return res.status(200).json({ data: stats });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}