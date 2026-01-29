import { h } from 'preact';

export default function ContextSidebarIsland(props: any) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-[#e5e0d8] bg-[#fdfaf6]">
        <button className="flex-1 py-3 text-sm font-['Space_Grotesk'] font-medium border-b-2 border-[#b87333] text-[#b87333]">Metadata</button>
        <button className="flex-1 py-3 text-sm font-['Space_Grotesk'] font-medium text-[#888]">Chat</button>
        <button className="flex-1 py-3 text-sm font-['Space_Grotesk'] font-medium text-[#888]">OCR</button>
      </div>
      <div className="p-6">
        <p className="text-sm text-gray-500">Context Sidebar Placeholder</p>
      </div>
    </div>
  );
}
