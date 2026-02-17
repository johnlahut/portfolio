import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useVerifyPassword } from '../hooks';

type PasswordGateProps = {
  onSuccess?: () => void;
};

export function PasswordGate({ onSuccess }: PasswordGateProps) {
  const [password, setPassword] = useState('');
  const verify = useVerifyPassword();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    verify.mutate(password, { onSuccess });
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Chirp</CardTitle>
          <CardDescription>Enter the password to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            {verify.isError && (
              <p className="text-sm text-destructive">Incorrect password</p>
            )}
            <Button type="submit" disabled={verify.isPending || !password}>
              {verify.isPending ? 'Verifying...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
