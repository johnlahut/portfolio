import { Bird } from 'lucide-react';

import { cn } from '@/lib/utils';

type ChirpLogoSize = 'sm' | 'md' | 'lg';

type ChirpLogoProps = {
  size?: ChirpLogoSize;
  className?: string;
};

const sizeConfig: Record<
  ChirpLogoSize,
  { container: string; iconSize: number }
> = {
  sm: { container: 'size-6 rounded-md', iconSize: 12 },
  md: { container: 'size-8 rounded-[10px]', iconSize: 14 },
  lg: {
    container: 'size-16 rounded-2xl border border-chirp-border-warm/[0.36]',
    iconSize: 32,
  },
};

export function ChirpLogo({ size = 'md', className }: ChirpLogoProps) {
  const { container, iconSize } = sizeConfig[size];
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-chirp-gradient',
        container,
        className,
      )}
    >
      <Bird size={iconSize} className="text-white" />
    </div>
  );
}
