import WelcomeHero from '@/components/welcome-hero';

export default function Home() {
  return (
    <div className='min-h-screen bg-background'>
      <main className='container mx-auto px-4 py-16 sm:py-24'>
        <WelcomeHero />
      </main>

      <footer className='border-t mt-16'>
        <div className='container mx-auto px-4 py-8'>
          <div className='flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground'>
            <p>&copy; 2024 BRF Portal. Alla rättigheter förbehållna.</p>
            <div className='flex gap-6'>
              <a href='#' className='hover:text-foreground transition-colors'>
                Integritetspolicy
              </a>
              <a href='#' className='hover:text-foreground transition-colors'>
                Användarvillkor
              </a>
              <a href='#' className='hover:text-foreground transition-colors'>
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
