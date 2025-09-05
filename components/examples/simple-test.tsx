'use client';

import React from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from '@/components/ui';

export default function SimpleTest() {
  return (
    <div className='p-8 space-y-4'>
      <h1 className='text-2xl font-bold'>BRF Component Test</h1>

      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p>
            This is a test to ensure all Radix UI components are working
            correctly.
          </p>
          <div className='space-x-2'>
            <Button>Primary Button</Button>
            <Button variant='secondary'>Secondary</Button>
            <Button variant='outline'>Outline</Button>
          </div>
          <div className='space-x-2'>
            <Badge>Active</Badge>
            <Badge variant='secondary'>Pending</Badge>
            <Badge variant='destructive'>Error</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
