import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { ChirpLogo } from '~/chirp/components/ChirpLogo';
import { checkAuthOptions, useVerifyPassword } from '~/chirp/hooks';

export const Route = createFileRoute('/chirp/login')({
  component: LoginComponent,
  loader: async ({ context: { queryClient } }) => {
    const auth = await queryClient.ensureQueryData(checkAuthOptions);
    if (auth) throw redirect({ to: '/chirp/gallery' });
  },
});

function LoginComponent() {
  const navigate = useNavigate();

  const [password, setPassword] = useState<string>('');
  const verify = useVerifyPassword();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    verify.mutate(password, {
      onSuccess: () => navigate({ to: '/chirp/gallery', from: '/chirp/login' }),
    });
  };

  return (
    <div
      className="
        relative flex min-h-screen w-full items-center justify-center
        overflow-hidden bg-chirp-page
      "
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0">
        <div className="relative mx-auto w-full max-w-7xl">
          <div
            className="
              absolute -top-[60px] -left-[100px] h-[400px] w-[500px]
              rounded-full
              bg-[radial-gradient(ellipse,rgba(230,162,106,0.08)_0%,transparent_70%)]
            "
          />
          <div
            className="
              absolute -top-[40px] right-[80px] hidden h-[350px] w-[450px]
              rounded-full
              bg-[radial-gradient(ellipse,rgba(230,162,106,0.06)_0%,transparent_70%)]
              lg:block
            "
          />
        </div>
      </div>
      {/* Card */}
      <div
        className="
          relative z-10 flex w-full max-w-[420px] flex-col gap-7 rounded-[20px]
          border border-chirp-border-warm/25
          bg-[linear-gradient(145deg,#312A26,#2A2421_55%,#25201D)] p-11
          shadow-[0_14px_36px_-6px_rgba(0,0,0,0.36)]
        "
      >
        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <ChirpLogo size="lg" />
          <span className="font-brand text-[28px] font-bold text-chirp-text">
            Chirp
          </span>
          <span className="text-sm text-chirp-text-body">
            Private daycare photo sharing
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="password"
              className="text-xs font-semibold text-chirp-text"
            >
              Daycare Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter secure passphrase"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="
                h-[46px] rounded-xl border-chirp-border-warm/25
                bg-(--chirp-input-bg) px-3.5 text-sm text-chirp-text
                placeholder:text-chirp-text-faint
                focus-visible:ring-chirp-accent/50
              "
            />
          </div>
          {verify.isError && (
            <p className="text-sm text-destructive">Incorrect password</p>
          )}
          <Button
            type="submit"
            disabled={verify.isPending || !password}
            className="
              h-12 rounded-xl border-0 text-[15px] font-bold text-chirp-page
              bg-chirp-gradient
              hover:opacity-90
            "
          >
            {verify.isPending ? 'Verifying...' : 'Sign In'}
          </Button>
        </form>

        {/* Footer */}
        <p className="m-0 text-center text-xs text-chirp-text-dim">
          Contact your daycare for the access password
        </p>
      </div>
    </div>
  );
}
