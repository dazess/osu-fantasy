import React from 'react';
import { LeagueHero } from '@/components/league-hero';
import AuthButton from '@/components/AuthButton';

export default function OWC2025Page() {
  return (
    <div className="t bg-[#24222A] text-white relative">
      <AuthButton />
      <div className="pt-4">
        <LeagueHero />
      </div>
    </div>
  );
}
