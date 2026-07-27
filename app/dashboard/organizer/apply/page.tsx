import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/auth/sign-out-button';

export const dynamic = 'force-dynamic';

export default async function OrganizerApplyPage() {
  const profile = await getUserProfile();

  if (!profile) {
    redirect('/auth/sign-in');
  }

  // Fetch the latest pending application for this user
  const supabase = await createClient();
  const { data: pendingApp } = await supabase
    .from('organizer_applications')
    .select('*')
    .eq('user_id', profile.id)
    .eq('status', 'pending')
    .maybeSingle();

  // If already organizer or admin, redirect back to dashboard
  if (profile.role === 'organizer' || profile.role === 'super_admin' || profile.role === 'admin') {
    redirect('/dashboard');
  }

  // Handle Form Submission Server Action
  async function handleApply(formData: FormData) {
    'use server';

    const organizationName = formData.get('organization_name') as string;
    const description = formData.get('description') as string;
    const registrationNumber = formData.get('registration_number') as string;

    if (!organizationName || organizationName.length < 2 || organizationName.length > 200) {
      return redirect('/dashboard/organizer/apply?error=organization_name_invalid');
    }

    if (!description || description.length < 10 || description.length > 5000) {
      return redirect('/dashboard/organizer/apply?error=description_invalid');
    }

    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return redirect('/auth/sign-in');
    }

    // Check if there is already a pending application
    const { data: checkPending } = await client
      .from('organizer_applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (checkPending) {
      return redirect('/dashboard/organizer/apply?error=already_pending');
    }

    // Update user profile with registration number and department
    await client
      .from('profiles')
      .update({
        registration_number: registrationNumber || null,
        department: organizationName,
      })
      .eq('id', user.id);

    // Insert organizer application
    const { error: insertError } = await client.from('organizer_applications').insert({
      user_id: user.id,
      organization_name: organizationName,
      description: description,
      status: 'pending',
    });

    if (insertError) {
      return redirect(`/dashboard/organizer/apply?error=${encodeURIComponent(insertError.message)}`);
    }

    return redirect('/dashboard/organizer/apply?success=true');
  }

  return (
    <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#ff914d]/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[560px] z-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#ff914d]/20 border border-[#ff914d]/30 flex items-center justify-center text-[#ff914d] font-bold text-2xl mx-auto select-none font-display">
            LPU
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display mt-4">
            Organizer Application
          </h1>
          <p className="text-sm text-white/60">
            Apply to gain privileges to create and manage events on the LPU Events platform.
          </p>
        </div>

        {pendingApp ? (
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Pending Review
              </span>
              <h3 className="text-xl font-bold text-white mt-2 font-display">
                Application Under Review
              </h3>
              <p className="text-sm text-white/60">
                You already have a pending application for <strong>{pendingApp.organization_name}</strong>.
              </p>
            </div>

            <div className="h-px bg-white/10" />

            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold">Justification</p>
                <p className="text-sm text-white/80 mt-1 bg-white/2 p-4 rounded-xl border border-white/5">
                  {pendingApp.description}
                </p>
              </div>
              <p className="text-xs text-white/40 italic">
                Submitted on {new Date(pendingApp.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="pt-2 flex justify-between items-center gap-4">
              <div className="flex-1">
                <SignOutButton />
              </div>
            </div>
          </div>
        ) : (
          <form action={handleApply} className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">
                Organization / Department Name
              </label>
              <input
                type="text"
                name="organization_name"
                required
                placeholder="e.g. Robotics Club, CSE Department"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">
                Registration / Roll Number
              </label>
              <input
                type="text"
                name="registration_number"
                placeholder="e.g. 12019482"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">
                Why do you want to become an organizer?
              </label>
              <textarea
                name="description"
                required
                rows={5}
                placeholder="Describe your organization and the kinds of events you plan to organize..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all resize-none"
              />
            </div>

            <div className="pt-4 flex justify-between items-center gap-4">
              <button
                type="submit"
                className="flex-grow inline-flex h-12 items-center justify-center rounded-xl bg-[#ff914d] hover:bg-[#e07530] text-sm font-semibold text-[#050507] transition shadow-[0_0_15px_rgba(255,145,77,0.3)]"
              >
                Submit Application
              </button>
              <div className="flex-shrink-0">
                <SignOutButton />
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
