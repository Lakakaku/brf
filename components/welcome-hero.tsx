import React from 'react';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function WelcomeHero() {
  return (
    <div className='w-full max-w-4xl mx-auto space-y-8'>
      {/* Main Hero Section */}
      <div className='text-center space-y-4'>
        <h1 className='text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight' style={{ color: 'var(--text-primary)' }}>
          Välkommen till
          <span className='block mt-2 gradient-text' style={{ 
            background: 'linear-gradient(135deg, #4a8b3a 0%, #2b7a8c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>BRF Portal</span>
        </h1>
        <p className='text-xl sm:text-2xl max-w-2xl mx-auto' style={{ color: 'var(--text-secondary)' }}>
          Din digitala plattform för bostadsrättsföreningens administration och
          kommunikation
        </p>
      </div>

      {/* Feature Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mt-12'>
        <Card className='text-center card hover:scale-105 transition-transform duration-200'>
          <CardHeader>
            <div className='w-12 h-12 mx-auto mb-4 rounded-lg flex items-center justify-center' style={{ background: 'var(--forest-bg)' }}>
              <svg
                className='w-6 h-6'
                style={{ color: 'var(--forest-dark)' }}
                fill='none'
                strokeWidth='2'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                />
              </svg>
            </div>
            <CardTitle>Föreningsadministration</CardTitle>
            <CardDescription>
              Hantera medlemmar, ekonomi och beslut enkelt och säkert
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className='text-center card hover:scale-105 transition-transform duration-200'>
          <CardHeader>
            <div className='w-12 h-12 mx-auto mb-4 rounded-lg flex items-center justify-center' style={{ background: 'var(--ocean-bg)' }}>
              <svg
                className='w-6 h-6'
                style={{ color: 'var(--ocean-dark)' }}
                fill='none'
                strokeWidth='2'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                />
              </svg>
            </div>
            <CardTitle>Kommunikation</CardTitle>
            <CardDescription>
              Håll kontakt med grannar och styrelse genom säker
              meddelandefunktion
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className='text-center card hover:scale-105 transition-transform duration-200'>
          <CardHeader>
            <div className='w-12 h-12 mx-auto mb-4 rounded-lg flex items-center justify-center' style={{ background: 'var(--cyan-bg)' }}>
              <svg
                className='w-6 h-6'
                style={{ color: 'var(--cyan-vibrant)' }}
                fill='none'
                strokeWidth='2'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2M9 5a2 2 0 012 2v6a2 2 0 01-2 2M9 5h2.586a1 1 0 01.707.293L15 8M9 17h6a2 2 0 002-2V9.414a1 1 0 00-.293-.707L13 5.414a1 1 0 00-.707-.293H11'
                />
              </svg>
            </div>
            <CardTitle>Dokumenthantering</CardTitle>
            <CardDescription>
              Tillgång till viktiga dokument, protokoll och beslut dygnet runt
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Call to Action */}
      <div className='text-center space-y-6 pt-8'>
        <p style={{ color: 'var(--text-secondary)' }}>
          Logga in för att komma åt din förenings portal
        </p>
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <button className='btn-primary'>
            Logga in
          </button>
          <a href='/demo/upload' className='btn-secondary' style={{ textDecoration: 'none' }}>
            Se Upload System Demo
          </a>
        </div>
      </div>
    </div>
  );
}
