export default function Loading() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#050507_0%,#0a0b10_50%,#050507_100%)] px-5 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-8">
        <div className="h-16 rounded-3xl bg-white/6" />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="h-4 w-40 rounded-full bg-white/8" />
            <div className="h-16 rounded-3xl bg-white/8" />
            <div className="h-5 w-2/3 rounded-full bg-white/8" />
          </div>
          <div className="h-14 rounded-full bg-white/8" />
        </div>
        <div className="h-[540px] rounded-[36px] bg-white/6" />
        <div className="h-[420px] rounded-[32px] bg-white/6" />
        <div className="h-28 rounded-[32px] bg-white/6" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-[430px] rounded-[28px] bg-white/6" key={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
