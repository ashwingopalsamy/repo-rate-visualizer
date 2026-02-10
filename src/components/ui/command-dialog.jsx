import { useMemo } from 'react';
import {
  CommandDialog as ShadcnCommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from './command.jsx';

export default function CommandDialog({ open, onOpenChange, commands = [], title = 'Command menu' }) {
  const groups = useMemo(() => {
    const grouped = new Map();
    commands.forEach(command => {
      const group = command.group || 'Actions';
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push(command);
    });
    return [...grouped.entries()];
  }, [commands]);

  return (
    <ShadcnCommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Search views and actions"
    >
      <CommandInput placeholder="Search views and actions…" />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {groups.map(([group, items]) => (
          <CommandGroup heading={group} key={group}>
            {items.map(command => (
              <CommandItem
                key={command.id}
                value={`${command.label} ${group}`}
                onSelect={() => {
                  onOpenChange?.(false);
                  command.execute?.();
                }}
              >
                <span>{command.label}</span>
                {command.shortcut ? <CommandShortcut>{command.shortcut}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </ShadcnCommandDialog>
  );
}
