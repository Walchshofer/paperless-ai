import { h } from 'preact';
import { useState } from 'preact/hooks';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';

export default function ShadcnCompat() {
  const [open, setOpen] = useState(false);
  const [toggled, setToggled] = useState(false);

  return (
    <div class="p-4">
      <h2 class="text-lg font-bold mb-2">shadcn/ui compatibility demo</h2>

      <Tabs.Root defaultValue="tab1">
        <Tabs.List aria-label="tabs">
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">
          <p>Content for tab 1</p>
        </Tabs.Content>
        <Tabs.Content value="tab2">
          <p>Content for tab 2</p>
        </Tabs.Content>
      </Tabs.Root>

      <div class="mt-4">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button class="px-3 py-1 bg-blue-600 text-white rounded">Open Dialog</button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay class="fixed inset-0 bg-black/40" />
            <Dialog.Content class="fixed left-1/2 top-1/3 -translate-x-1/2 bg-white p-4 rounded shadow">
              <Dialog.Title>Dialog Title</Dialog.Title>
              <Dialog.Description>Simple dialog content for testing.</Dialog.Description>
              <div class="mt-2">
                <button onClick={() => setOpen(false)} class="px-2 py-1 bg-gray-200 rounded">Close</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <div class="mt-4 flex items-center gap-3">
        <label class="flex items-center gap-2">
          <Switch.Root checked={toggled} onCheckedChange={(v: boolean) => setToggled(v)}>
            <Switch.Thumb class="inline-block w-4 h-4 bg-white rounded-full" />
          </Switch.Root>
          <span>{toggled ? 'On' : 'Off'}</span>
        </label>
      </div>
    </div>
  );
}
