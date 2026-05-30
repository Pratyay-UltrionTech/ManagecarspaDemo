import type { ComponentProps } from 'react';
import { cn } from './ui/utils';
import { BRAND_NAME, LOGO_PATH } from '../lib/branding';

export type AppLogoVariant = 'nav' | 'sidebar' | 'hero' | 'loader' | 'auth' | 'mark' | 'inline' | 'rail';

const variantClass: Record<AppLogoVariant, string> = {
  nav: 'h-9 w-auto max-h-10 sm:h-10 max-w-[min(52vw,240px)] sm:max-w-[280px]',
  sidebar: 'h-10 w-full max-h-12 max-w-none sm:h-11',
  hero: 'h-[4.5rem] sm:h-24 md:h-28 w-auto max-w-[min(92vw,440px)]',
  loader: 'h-16 w-auto max-w-[min(85vw,280px)]',
  auth: 'h-20 w-auto max-w-[min(88vw,300px)] sm:h-24 sm:max-w-[320px]',
  mark: 'h-8 w-auto max-h-9 max-w-[min(42vw,200px)] sm:h-9 sm:max-w-[220px]',
  inline: 'h-4 w-auto max-w-[100px]',
  rail: 'h-10 w-auto max-h-10 max-w-[56px]',
};

type Props = Omit<ComponentProps<'img'>, 'src' | 'alt'> & {
  variant?: AppLogoVariant;
};

export function AppLogo({ variant = 'nav', className, ...props }: Props) {
  return (
    <img
      src={LOGO_PATH}
      alt={BRAND_NAME}
      decoding="async"
      className={cn(
        'object-contain select-none',
        variant === 'sidebar' ? 'object-left' : 'object-center',
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
}
