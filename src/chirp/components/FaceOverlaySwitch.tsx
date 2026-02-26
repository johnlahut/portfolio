import { ScanFace } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type FaceOverlaySwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  showIcon?: boolean;
  id?: string;
};

export function FaceOverlaySwitch({
  checked,
  onCheckedChange,
  label = 'Face overlays',
  showIcon = false,
  id = 'face-overlay-switch',
}: FaceOverlaySwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor={id}
        className="cursor-pointer text-sm text-chirp-text-muted"
      >
        {label}
      </Label>
      {showIcon && <ScanFace size={16} className="text-chirp-text-muted" />}
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        size="sm"
      />
    </div>
  );
}
