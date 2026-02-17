import { Controller } from 'react-hook-form';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { LanguageChoices } from '~/transformer/const';
import type { TransformerForm } from '~/transformer/types';

export const ClassifierSelect = () => {
  return (
    <Controller<TransformerForm, 'classifier'>
      name="classifier"
      render={({ field }) => (
        <Select
          name={field.name}
          value={field.value}
          onValueChange={field.onChange}
        >
          <SelectTrigger>
            <SelectValue className="text-blue-400" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem key={'type'} value={'type'}>
                <p className="font-mono text-syntax-keyword">type</p>
              </SelectItem>
              <SelectItem key={'interface'} value={'interface'}>
                <p className="font-mono text-syntax-keyword">interface</p>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    />
  );
};

export const LanguageSelect = () => {
  return (
    <Controller<TransformerForm, 'language'>
      name="language"
      render={({ field }) => (
        <Select
          name={field.name}
          value={field.value}
          onValueChange={field.onChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectLabel>Language</SelectLabel>
              {LanguageChoices.map((choice) => (
                <SelectItem key={choice.flag} value={choice.flag}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    />
  );
};
